import os
import time
import threading
import json
import logging
from datetime import datetime
from pathlib import Path

import psycopg2
import MetaTrader5 as mt5
from dotenv import load_dotenv
import requests

# Load environment variables (expects a .env file mounted at runtime)
load_dotenv()

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ENCRYPTION_KEY_HEX = os.getenv('ENCRYPTION_KEY')
encryption_key = None
if ENCRYPTION_KEY_HEX and len(ENCRYPTION_KEY_HEX) == 64:
    encryption_key = bytes.fromhex(ENCRYPTION_KEY_HEX)
else:
    logger.warning("ENCRYPTION_KEY not found or invalid. Passwords will not be decrypted securely.")

def decrypt_password(encrypted_str):
    if not encrypted_str or ':' not in encrypted_str or not encryption_key:
        return encrypted_str
    
    try:
        parts = encrypted_str.split(':')
        if len(parts) != 3:
            return encrypted_str
        
        iv = bytes.fromhex(parts[0])
        auth_tag = bytes.fromhex(parts[1])
        ciphertext = bytes.fromhex(parts[2])
        
        aesgcm = AESGCM(encryption_key)
        # AESGCM in cryptography expects ciphertext + auth_tag together
        decrypted = aesgcm.decrypt(iv, ciphertext + auth_tag, None)
        return decrypted.decode('utf-8')
    except Exception as e:
        logger.error(f"Failed to decrypt password: {e}")
        return encrypted_str

SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Configure logging
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s: %(message)s')
logger = logging.getLogger('vps-manager')

# Function to launch MT5 terminal and attach EA for a given account
def launch_mt5_and_attach_ea(account):
    login = account['login']
    password = account.get('password')
    server = account['server']
    broker = account['broker']
    ea_file = account.get('ea_file', 'SubCopier.mq5')  # default to SubCopier, can be overridden
    ea_path = Path(__file__).parent.parent / 'ea' / ea_file
    if not ea_path.exists():
        logger.error(f'EA file not found: {ea_path}')
        return False

    # Initialize MT5 connection (this will start the terminal if not already running)
    # Note: MetaTrader5.initialize expects the path to terminal, login, password, server
    # We are using default terminal path, assuming it's in PATH.
    try:
        mt5_login = int(login)
    except ValueError:
        logger.warning(f"Skipping MT5 initialization for account {login} because it is not numeric.")
        return False

    initialized = mt5.initialize(login=mt5_login, password=password, server=server)
    if not initialized:
        logger.error(f'Failed to initialize MT5 for account {login}: {mt5.last_error()}')
        return False
    logger.info(f'MT5 initialized for account {login} on server {server}')

    # Attach EA by sending a custom WebRequest to the EA's built‑in HTTP endpoint
    # The EA expects an Authorization header with a token (we reuse the account's token)
    ea_token = account.get('ea_token') or ''
    headers = {
        'Authorization': f'Bearer {ea_token}',
        'Connection': 'close'
    }
    try:
        # The EA is listening on localhost:9001 (as defined in the EA code)
        resp = requests.post('http://127.0.0.1:9001/ea/start', headers=headers, timeout=5)
        if resp.status_code == 200:
            logger.info(f'EA {ea_file} started for account {login}')
        else:
            logger.warning(f'EA start returned status {resp.status_code} for account {login}')
    except Exception as e:
        logger.error(f'Error contacting EA for account {login}: {e}')
        mt5.shutdown()
        return False
    return True

stop_event = threading.Event()
active_terminals = {}

import subprocess
import json

# Worker thread that continuously polls the DB for inactive accounts
def poll_db_worker():
    """Background thread that polls the DB for active accounts and launches MT5 terminals."""
    import psutil
    from supabase import create_client, Client
    
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env!")
        time.sleep(10)
        return
        
    supabase: Client = create_client(supabase_url, supabase_key)

    while not stop_event.is_set():
        try:
            # Fetch active accounts using the Supabase REST API (immune to all connection pooler issues)
            response = supabase.table('Mt5Account').select('id,login,password,broker,server,isActive,role').eq('isActive', True).execute()
            
            for row in response.data:
                account = {
                    'id': row.get('id'),
                    'login': str(row.get('login')),
                    'password': decrypt_password(row.get('password')),
                    'broker': row.get('broker'),
                    'server': row.get('server'),
                    'is_active': row.get('isActive'),
                    'role': row.get('role'),
                    'ea_token': 'dummy_token',
                    'ea_file': 'MasterCopier.mq5' if row.get('role') == 'MASTER' else 'SubCopier.mq5'
                }
                
                login = account['login']
                if login not in active_terminals:
                    logger.info(f"New active account detected: {login}. Launching MT5...")
                    success = launch_mt5_and_attach_ea(account)
                    if success:
                        active_terminals[login] = account
                        
        except Exception as e:
            logger.error(f"Supabase API polling error: {e}")
        
        # Sleep before next poll
        time.sleep(10)
def telemetry_worker():
    import psutil
    from supabase import create_client, Client
    
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        logger.error("Missing SUPABASE credentials for telemetry")
        return
        
    supabase: Client = create_client(supabase_url, supabase_key)
    
    while True:
        try:
            cpu = psutil.cpu_percent(interval=1)
            ram = psutil.virtual_memory().percent
            disk = psutil.disk_usage('/').percent
            
            # Count running terminals
            terminals = 0
            for proc in psutil.process_iter(['name']):
                try:
                    if proc.info['name'] and 'terminal' in proc.info['name'].lower():
                        terminals += 1
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            
            supabase.table('VpsEnvironment').upsert({
                'name': 'vps-main-1',
                'status': 'HEALTHY',
                'cpuPercent': cpu,
                'ramPercent': ram,
                'diskPercent': disk,
                'activeTerminals': terminals,
                'lastHeartbeatAt': 'now()'
            }, on_conflict='name').execute()
            
        except Exception as e:
            logger.error(f'Telemetry failed: {e}')
            
        time.sleep(30)

if __name__ == '__main__':
    logger.info('Starting VPS MT5 manager')
    poll_thread = threading.Thread(target=poll_db_worker, daemon=True)
    poll_thread.start()
    
    telemetry_thread = threading.Thread(target=telemetry_worker, daemon=True)
    telemetry_thread.start()
    
    # Keep the main thread alive so Docker container stays up
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        logger.info('Shutting down manager')
        mt5.shutdown()

