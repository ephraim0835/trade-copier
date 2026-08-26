import os
import time
import threading
import json
import logging
import subprocess
import uuid
import shutil
from datetime import datetime
from pathlib import Path

import psycopg2
import psutil
import requests
import MetaTrader5 as mt5
from dotenv import load_dotenv
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from supabase import create_client, Client

# Configure logging first
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s: %(message)s')
logger = logging.getLogger('vps-manager')

# Load environment variables (expects a .env file mounted at runtime)
load_dotenv()

ENCRYPTION_KEY_HEX = os.getenv('ENCRYPTION_KEY')
encryption_key = None
if ENCRYPTION_KEY_HEX and len(ENCRYPTION_KEY_HEX) == 64:
    encryption_key = bytes.fromhex(ENCRYPTION_KEY_HEX)
else:
    logger.warning("ENCRYPTION_KEY not found or invalid. Passwords will not be decrypted securely.")

SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
SUPABASE_URL = os.getenv('SUPABASE_URL')

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

    # Instead of mt5.initialize which can hang, we find the data path manually.
    # The terminal path is usually C:\Program Files\MetaTrader 5
    terminal_path = Path(os.environ.get('ProgramW6432', 'C:\\Program Files')) / 'MetaTrader 5'
    
    # The data path is in AppData\Roaming\MetaQuotes\Terminal\<hash>
    appdata = Path(os.environ.get('APPDATA', 'C:\\Users\\Plaiz\\AppData\\Roaming'))
    terminal_dir = appdata / 'MetaQuotes' / 'Terminal'
    
    data_path = None
    if terminal_dir.exists():
        # Find all valid terminal data directories
        valid_dirs = []
        for child in terminal_dir.iterdir():
            if child.is_dir() and len(child.name) == 32:  # MD5 hash length
                if (child / 'config').exists():
                    valid_dirs.append(child)
        # Sort by modification time (newest first)
        valid_dirs.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        
        # Assign each account its own directory so they run as separate MT5 instances
        # active_terminals maps login -> account dict (already imported from outer scope)
        already_assigned = {
            acc.get('data_path') for acc in active_terminals.values()
            if acc.get('data_path')
        }
        for d in valid_dirs:
            if str(d) not in already_assigned:
                data_path = d
                break
        # Fallback: reuse first dir if only one exists
        if not data_path and valid_dirs:
            data_path = valid_dirs[0]
    
    if not data_path:
        logger.error(f"Could not find MT5 Data Path in {terminal_dir}")
        return False
    
    # Store the assigned data path on the account so future assignments can avoid it
    account['data_path'] = str(data_path)

    logger.info(f"Terminal Data Path: {data_path}")
    logger.info(f"Terminal Path: {terminal_path}")
    
    # 2. Auto-compile EA using MetaEditor
    # Copy EA and dependencies into the terminal's MQL5/Experts folder to avoid MetaEditor /out: path space bugs
    source_ea = Path(__file__).parent.parent / 'ea' / ea_file
    source_json = Path(__file__).parent.parent / 'ea' / 'MqlJson.mqh'
    
    experts_dir = data_path / 'MQL5' / 'Experts'
    experts_dir.mkdir(parents=True, exist_ok=True)
    
    target_ea = experts_dir / ea_file
    target_json = experts_dir / 'MqlJson.mqh'
    compiled_ea = experts_dir / f"{ea_base}.ex5"
    
    metaeditor = terminal_path / 'metaeditor64.exe'
    
    if source_ea.exists():
        # Copy source and dependencies
        shutil.copy2(source_ea, target_ea)
        if source_json.exists():
            shutil.copy2(source_json, target_json)
            
        # Compile directly in the target directory without using /out:
        compile_cmd = [str(metaeditor), f"/compile:{target_ea}", f"/inc:{data_path / 'MQL5'}"]
        logger.info(f"Compiling EA {ea_file} with cmd: {' '.join(compile_cmd)}")
        result = subprocess.run(compile_cmd, capture_output=True, text=True)
        
        if not compiled_ea.exists():
            logger.error(f"Failed to compile {ea_file}. Stdout: {result.stdout}, Stderr: {result.stderr}")
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
        f.write(f"Symbol=EURUSDm\n")
        f.write(f"Period=H1\n")
        f.write(f"Expert={ea_base}\n")
        # ExpertParameters expects the file to be relative to MQL5\Presets
        f.write(f"ExpertParameters={set_file_path.name}\n\n")
        f.write(f"[Experts]\n")
        f.write(f"AllowDllImport=1\n")
        f.write(f"Enabled=1\n")
        f.write(f"WebRequest=1\n")
        f.write(f"WebRequestUrl=https://plaiz-markets-api.onrender.com\n")
        
    # 4.5. Enable WebRequest in common.ini (MT5 stores this in common.ini)
    common_ini_path = ini_file_dir / "common.ini"
    common_ini_content = ""
    if common_ini_path.exists():
        try:
            with open(common_ini_path, 'r', encoding='utf-16') as f:
                common_ini_content = f.read()
        except UnicodeError:
            with open(common_ini_path, 'r', encoding='utf-8', errors='ignore') as f2:
                common_ini_content = f2.read()
    
    # Check if WebRequestUrl already exists, if not append it
    if "WebRequestUrl=" not in common_ini_content:
        # If [Experts] exists, append after it, else append at the end
        if "[Experts]" in common_ini_content:
            common_ini_content = common_ini_content.replace("[Experts]", "[Experts]\nAllowWebRequest=1\nWebRequestUrl=https://plaiz-markets-api.onrender.com")
        else:
            common_ini_content += "\n[Experts]\nAllowWebRequest=1\nWebRequestUrl=https://plaiz-markets-api.onrender.com\n"
    else:
        import re
        common_ini_content = re.sub(r'AllowWebRequest=.*', 'AllowWebRequest=1', common_ini_content)
        common_ini_content = re.sub(r'WebRequestUrl=.*', 'WebRequestUrl=https://plaiz-markets-api.onrender.com', common_ini_content)
    
    with open(common_ini_path, 'w', encoding='utf-16') as f:
        f.write(common_ini_content)
        
    # 4.6. Directly patch terminal.ini to guarantee WebRequest is enabled BEFORE MT5 starts.
    # This is the authoritative settings file MT5 reads on boot. The startup ini only
    # applies overrides AFTER the terminal has already initialised — too late for the EA.
    import re as _re
    terminal_ini_path = ini_file_dir / "terminal.ini"
    terminal_ini_content = ""
    if terminal_ini_path.exists():
        try:
            terminal_ini_content = terminal_ini_path.read_text(encoding='utf-16')
        except UnicodeError:
            terminal_ini_content = terminal_ini_path.read_text(encoding='utf-8', errors='ignore')
    
    if "[Experts]" in terminal_ini_content:
        # Patch existing [Experts] section
        terminal_ini_content = _re.sub(r'WebRequest=\d*', 'WebRequest=1', terminal_ini_content)
        if "WebRequestUrl=" in terminal_ini_content:
            terminal_ini_content = _re.sub(r'WebRequestUrl=.*', 'WebRequestUrl=https://plaiz-markets-api.onrender.com', terminal_ini_content)
        else:
            terminal_ini_content = terminal_ini_content.replace("[Experts]", "[Experts]\nWebRequestUrl=https://plaiz-markets-api.onrender.com")
        if "WebRequest=" not in terminal_ini_content.split("[Experts]", 1)[-1].split("[", 1)[0]:
            terminal_ini_content = terminal_ini_content.replace("[Experts]", "[Experts]\nWebRequest=1")
    else:
        # No [Experts] section — append one
        terminal_ini_content += "\n[Experts]\nEnabled=1\nWebRequest=1\nWebRequestUrl=https://plaiz-markets-api.onrender.com\n"
    
    try:
        terminal_ini_path.write_text(terminal_ini_content, encoding='utf-16')
        logger.info("terminal.ini patched with WebRequest=1 successfully.")
    except Exception as e:
        logger.warning(f"Could not patch terminal.ini: {e}")

    # 5. Launch Terminal with the config
    logger.info(f"Launching MT5 terminal for account {login} with config and EA attached...")
    terminal_exe = terminal_path / 'terminal64.exe'
    
    # /allowwebfrom whitelists the URL for WebRequest on the command line, bypassing the GUI setting
    launch_cmd = [str(terminal_exe), f"/config:{ini_file_path}", "/allowwebfrom:https://plaiz-markets-api.onrender.com"]
    subprocess.Popen(launch_cmd)
    
    return True

stop_event = threading.Event()
active_terminals = {}

# Worker thread that continuously polls the DB for inactive accounts
def poll_db_worker():
    """Background thread that polls the DB for active accounts and launches MT5 terminals."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env!")
        time.sleep(10)
        return
        
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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
                for attempt in range(3):
                    try:
                        token_res = requests.post(
                            f"{base_api}/accounts/internal/ea-token",
                            json={"accountId": account['id']},
                            headers={"Authorization": "Bearer internal_manager_secret_998877"},
                            timeout=30
                        )
                        if token_res.status_code == 201 or token_res.status_code == 200:
                            account['ea_token'] = token_res.json().get('token', 'dummy_token')
                            break
                        else:
                            logger.error(f"Failed to generate EA token: {token_res.text}")
                            break
                    except Exception as e:
                        logger.error(f"Error fetching EA token (attempt {attempt + 1}/3): {e}")
                        if attempt < 2:
                            time.sleep(2 ** attempt)
                
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
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("Missing SUPABASE credentials for telemetry")
        return
        
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
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
                'id': str(uuid.uuid4()),
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

def kill_existing_terminals():
    """Aggressively terminate any running MT5 terminal64.exe processes to ensure a cold boot."""
    killed = 0
    for proc in psutil.process_iter(['pid', 'name']):
        if proc.info['name'] == 'terminal64.exe':
            try:
                proc.kill()
                killed += 1
            except Exception as e:
                logger.warning(f"Failed to kill terminal64.exe (PID {proc.info['pid']}): {e}")
    if killed > 0:
        logger.info(f"Killed {killed} existing terminal64.exe processes to ensure a clean state.")
        # Wait for MT5 to finish writing its shutdown config to disk before we patch it
        time.sleep(4)

def force_webrequest_permission():
    """Write the WebRequest whitelist into common.ini BEFORE MT5 starts.
    MT5 overwrites common.ini on shutdown; we must patch it after every kill.
    """
    appdata = Path(os.environ.get('APPDATA', 'C:\\Users\\Plaiz\\AppData\\Roaming'))
    terminal_dir = appdata / 'MetaQuotes' / 'Terminal'
    if not terminal_dir.exists():
        return
    for child in terminal_dir.iterdir():
        if child.is_dir() and len(child.name) == 32 and (child / 'config').exists():
            common_ini_path = child / 'config' / 'common.ini'
            content = "[Experts]\nAllowWebRequest=1\nWebRequestUrl=https://plaiz-markets-api.onrender.com\n\n[Common]\n"
            # Preserve Environment key if present
            if common_ini_path.exists():
                try:
                    existing = common_ini_path.read_text(encoding='utf-16')
                except Exception:
                    try:
                        existing = common_ini_path.read_text(encoding='utf-8', errors='ignore')
                    except Exception:
                        existing = ''
                for line in existing.splitlines():
                    if line.startswith('Environment='):
                        content += line + '\n'
                        break
            try:
                common_ini_path.write_text(content, encoding='utf-16')
                logger.info(f"Force-patched WebRequest permission in {common_ini_path}")
            except Exception as e:
                logger.warning(f"Could not patch {common_ini_path}: {e}")


if __name__ == '__main__':
    logger.info('Starting VPS MT5 manager')
    kill_existing_terminals()
    force_webrequest_permission()
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

