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

def launch_mt5_and_attach_ea(account):
    login = account['login']
    password = account.get('password')
    server = account['server']
    broker = account['broker']
    ea_file = account.get('ea_file', 'SubCopier.mq5')  # MasterCopier.mq5 or SubCopier.mq5
    ea_base = ea_file.replace('.mq5', '')
    
    # 1. Initialize MT5 just to get paths
    try:
        mt5_login = int(login)
    except ValueError:
        logger.warning(f"Skipping MT5 initialization for account {login} because it is not numeric.")
        return False

    initialized = mt5.initialize(login=mt5_login, password=password, server=server)
    if not initialized:
        logger.error(f'Failed to initialize MT5 for account {login}: {mt5.last_error()}')
        return False
        
    term_info = mt5.terminal_info()
    data_path = Path(term_info.data_path)
    terminal_path = Path(term_info.path)
    mt5.shutdown() # Shutdown so we can re-launch with custom config
    
    logger.info(f"Terminal Data Path: {data_path}")
    logger.info(f"Terminal Path: {terminal_path}")
    
    # 2. Auto-compile EA using MetaEditor
    source_ea = Path(__file__).parent.parent / 'ea' / ea_file
    compiled_ea = data_path / 'MQL5' / 'Experts' / f"{ea_base}.ex5"
    metaeditor = terminal_path / 'metaeditor64.exe'
    
    if source_ea.exists():
        logger.info(f"Compiling EA {ea_file}...")
        compile_cmd = [str(metaeditor), f"/compile:{source_ea}", f"/out:{compiled_ea}"]
        subprocess.run(compile_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if not compiled_ea.exists():
            logger.error(f"Failed to compile {ea_file}")
            return False
        else:
            logger.info(f"Compiled successfully to {compiled_ea}")
    else:
        logger.error(f"Source EA {source_ea} not found")
        return False
        
    # 3. Create .set file for EA inputs
    # MQL5\Presets is the standard location for MT5 EA presets
    set_file_dir = data_path / 'MQL5' / 'Presets'
    set_file_dir.mkdir(parents=True, exist_ok=True)
    set_file_path = set_file_dir / f"{login}_config.set"
    
    base_api = os.getenv('NEXT_PUBLIC_API_URL', 'https://plaiz-markets-api.onrender.com')
    if account.get('role') == 'MASTER':
        api_url = f"{base_api}/master/signal"
    else:
        api_url = f"{base_api}/execution"

    with open(set_file_path, 'w') as f:
        f.write(f"API_URL={api_url}\n")
        f.write(f"SUB_ACCOUNT_ID={account.get('id', '')}\n")
        f.write(f"EA_TOKEN={account.get('ea_token', '')}\n")
        
    # 4. Create startup.ini file
    ini_file_dir = data_path / 'config'
    ini_file_dir.mkdir(parents=True, exist_ok=True)
    ini_file_path = ini_file_dir / f"startup_{login}.ini"
    
    with open(ini_file_path, 'w') as f:
        f.write(f"[Common]\n")
        f.write(f"Login={login}\n")
        f.write(f"Password={password}\n")
        f.write(f"Server={server}\n\n")
        f.write(f"[StartUp]\n")
        f.write(f"Symbol=EURUSD\n")
        f.write(f"Period=H1\n")
        f.write(f"Expert={ea_base}\n")
        # Relative path to MQL5\Presets doesn't always work for ExpertParameters,
        # but ExpertParameters looks in MQL5\Profiles\Tester or absolute paths.
        # Let's pass the absolute path just to be safe.
        f.write(f"ExpertParameters={set_file_path.absolute()}\n")
        
    # 5. Launch Terminal with the config
    logger.info(f"Launching MT5 terminal for account {login} with config and EA attached...")
    terminal_exe = terminal_path / 'terminal64.exe'
    
    # We use subprocess.Popen to launch it asynchronously
    # /portable flag allows multiple terminals from the same folder
    launch_cmd = [str(terminal_exe), f"/config:{ini_file_path}", "/portable"]
    subprocess.Popen(launch_cmd)
    
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
            response = supabase.table('Mt5Account').select('id,login,password,broker,server,isActive,role').execute()
            
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
                
                # Fetch a real EA token from the API
                base_api = os.getenv('NEXT_PUBLIC_API_URL', 'https://plaiz-markets-api.onrender.com')
                try:
                    token_res = requests.post(
                        f"{base_api}/accounts/internal/ea-token",
                        json={"accountId": account['id']},
                        headers={"Authorization": "Bearer internal_manager_secret_998877"},
                        timeout=5
                    )
                    if token_res.status_code == 201 or token_res.status_code == 200:
                        account['ea_token'] = token_res.json().get('token', 'dummy_token')
                    else:
                        logger.error(f"Failed to generate EA token: {token_res.text}")
                except Exception as e:
                    logger.error(f"Error fetching EA token: {e}")
                
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
            
            import uuid
            supabase.table('VpsEnvironment').upsert({
                'id': str(uuid.uuid4()),
                'name': 'vps-main-1',
                'status': 'HEALTHY',
                'cpuUsage': cpu,
                'memoryUsage': ram,
                'diskUsage': disk,
                'activeTerminals': terminals,
                'lastHeartbeat': 'now()'
            }, on_conflict='name').execute()
            
        except Exception as e:
            logger.error(f'Telemetry failed: {e}')
            
        time.sleep(30)

def keep_alive_worker():
    """Background thread that pings the Render API to prevent it from sleeping on the free tier."""
    ping_url = os.getenv('KEEP_ALIVE_URL', 'https://plaiz-markets-api.onrender.com/api/health')
    logger.info(f"Keep-alive worker started. Will ping {ping_url} every 10 minutes.")
    
    # Wait a bit before the first ping
    time.sleep(10)
    
    while True:
        try:
            logger.info(f"Sending keep-alive ping to {ping_url} to prevent Render from sleeping...")
            response = requests.get(ping_url, timeout=10)
            if response.status_code == 200:
                logger.info(f"Keep-alive ping successful: {response.text}")
            else:
                logger.warning(f"Keep-alive ping returned status code {response.status_code}")
        except Exception as e:
            logger.error(f"Keep-alive ping failed: {e}")
        
        # Sleep for 10 minutes (600 seconds)
        time.sleep(600)


if __name__ == '__main__':
    logger.info('Starting VPS MT5 manager')
    poll_thread = threading.Thread(target=poll_db_worker, daemon=True)
    poll_thread.start()
    
    telemetry_thread = threading.Thread(target=telemetry_worker, daemon=True)
    telemetry_thread.start()
    
    keep_alive_thread = threading.Thread(target=keep_alive_worker, daemon=True)
    keep_alive_thread.start()
    
    # Keep the main thread alive so Docker container stays up
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        logger.info('Shutting down manager')
        mt5.shutdown()

