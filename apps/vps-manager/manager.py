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
import shutil

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

    def get_terminal_path_for_account(account):
        # Dynamically provision a completely independent portable MT5 instance for this account
        account_id = account['id']
        instance_dir = Path("C:/Users/Plaiz/MT5_Instances") / account_id
        
        if not instance_dir.exists():
            logger.info(f"Provisioning new portable MT5 instance for account {account_id}...")
            base_install = Path("C:/Program Files/MetaTrader 5")
            if not base_install.exists():
                logger.error(f"Base MT5 installation at {base_install} not found!")
                return None, None
            try:
                shutil.copytree(base_install, instance_dir)
                # Seed the portable instance with the Master account's data directory so it has the MQL5 standard libraries
                master_data = Path(os.environ.get('APPDATA', 'C:\\Users\\Plaiz\\AppData\\Roaming')) / 'MetaQuotes' / 'Terminal' / 'D0E8209F77C8CF37AD8BF550E51FF075'
                if master_data.exists():
                    shutil.copytree(master_data, instance_dir, dirs_exist_ok=True)
            except Exception as e:
                logger.error(f"Failed to copy MT5 instance: {e}")
                return None, None
                
        # For portable instances, the terminal path AND data path are the exact same directory
        return instance_dir, instance_dir

    terminal_path, data_path = get_terminal_path_for_account(account)
    if not terminal_path or not data_path:
        return False
        
    logger.info(f"Portable Instance Path: {terminal_path}")
    
    # Store the assigned data path on the account
    account['data_path'] = str(data_path)

    # 2. Auto-compile EA using MetaEditor
    # Copy EA and dependencies into the terminal's MQL5/Experts folder to avoid MetaEditor /out: path space bugs
    source_ea = Path(__file__).parent.parent / 'ea' / ea_file
    source_json = Path(__file__).parent.parent / 'ea' / 'MqlJson.mqh'
    source_wininet = Path(__file__).parent.parent / 'ea' / 'WinInet.mqh'
    
    experts_dir = data_path / 'MQL5' / 'Experts'
    experts_dir.mkdir(parents=True, exist_ok=True)
    
    target_ea = experts_dir / ea_file
    target_json = experts_dir / 'MqlJson.mqh'
    target_wininet = experts_dir / 'WinInet.mqh'
    compiled_ea = experts_dir / f"{ea_base}.ex5"
    
    metaeditor = terminal_path / 'metaeditor64.exe'
    
    if source_ea.exists():
        # Copy source and dependencies
        shutil.copy2(source_ea, target_ea)
        if source_json.exists():
            shutil.copy2(source_json, target_json)
        if source_wininet.exists():
            shutil.copy2(source_wininet, target_wininet)
            
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
    
    base_api = os.getenv('API_URL') or os.getenv('NEXT_PUBLIC_API_URL')
    if not base_api:
        logger.error("API_URL or NEXT_PUBLIC_API_URL must be defined in environment variables.")
        return False
    if account.get('role') == 'MASTER':
        api_url = f"{base_api}/master/signal"
    else:
        api_url = f"{base_api}/execution"

    files_dir = data_path / 'MQL5' / 'Files'
    files_dir.mkdir(parents=True, exist_ok=True)
    with open(files_dir / "ea_config.txt", 'w') as f:
        f.write(f"API_URL={api_url}\n")
        f.write(f"EA_TOKEN={account.get('ea_token', '')}\n")
        if account.get('role') == 'SUB':
            f.write(f"SUB_ACCOUNT_ID={account.get('id', '')}\n")

    # Use the user's manually saved default.tpl from the Master account's roaming folder and copy it into the Default profile!
    # This ensures we get a perfectly formatted chart template.
    tpl_file_path = Path(os.environ.get('APPDATA', 'C:\\Users\\Plaiz\\AppData\\Roaming')) / 'MetaQuotes' / 'Terminal' / 'D0E8209F77C8CF37AD8BF550E51FF075' / 'MQL5' / 'Profiles' / 'Templates' / 'default.tpl'
    
    profile_dir = data_path / 'MQL5' / 'Profiles' / 'Charts' / 'Default'
    if profile_dir.exists():
        shutil.rmtree(profile_dir, ignore_errors=True)
    profile_dir.mkdir(parents=True, exist_ok=True)
    
    with open(profile_dir / "order.wnd", 'w') as f:
        f.write("chart01\n")
        
    chr_file_path = profile_dir / "chart01.chr"
    if tpl_file_path.exists():
        # Read the template, dynamically replace the EA name so it matches MasterCopier or SubCopier
        content = tpl_file_path.read_text(encoding='utf-16', errors='ignore')
        if not '<chart>' in content:
            content = tpl_file_path.read_text(encoding='utf-8', errors='ignore')
            
        content = content.replace("name=MasterCopier", f"name={ea_base}")
        content = content.replace("path=Experts\\MasterCopier.ex5", f"path=Experts\\{ea_base}.ex5")
        
        chr_file_path.write_text(content, encoding='utf-8')
    else:
        logger.error(f"FATAL: {tpl_file_path} does not exist! Cannot seed chart01.chr!")
        
    # 4. Create startup.ini file
    ini_file_dir = data_path / 'config'
    ini_file_dir.mkdir(parents=True, exist_ok=True)
    ini_file_name = f"startup_{login}.ini"
    ini_file_path = ini_file_dir / ini_file_name
    
    with open(ini_file_path, 'w') as f:
        f.write(f"[Common]\n")
        f.write(f"Login={login}\n")
        f.write(f"Password={password}\n")
        f.write(f"Server={server}\n")
        f.write(f"CertInstall=0\n")
        f.write(f"[Charts]\n")
        f.write(f"ProfileLast=Default\n")
        f.write(f"[Experts]\n")
        f.write(f"AllowDllImport=1\n")
        f.write(f"Enabled=1\n")
        f.write(f"WebRequest=1\n")
        f.write(f"AllowWebRequest=1\n\n")

    # 5. Launch Terminal with the config
    logger.info(f"Launching MT5 terminal for account {login} with config and EA attached...")
    terminal_exe = terminal_path / 'terminal64.exe'
    
    # We MUST use /portable to ensure it uses the current folder as its data path
    launch_cmd = [str(terminal_exe), "/portable", f"/config:config\\{ini_file_name}"]
    logger.info(f"Command: {launch_cmd}")
    proc = subprocess.Popen(launch_cmd, cwd=str(terminal_path))
    account['process'] = proc
    
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
                
                login = account['login']
                if account['is_active']:
                    if login not in active_terminals:
                        logger.info(f"New active account detected: {login}. Fetching EA token and launching MT5...")
                        
                        # Fetch EA token only when launching
                        base_api = os.getenv('API_URL') or os.getenv('NEXT_PUBLIC_API_URL')
                        if base_api:
                            for attempt in range(3):
                                try:
                                    internal_secret = os.getenv('INTERNAL_MANAGER_SECRET')
                                    if internal_secret:
                                        token_res = requests.post(
                                            f"{base_api}/accounts/internal/ea-token",
                                            json={"accountId": account['id']},
                                            headers={"Authorization": f"Bearer {internal_secret}"},
                                            timeout=10
                                        )
                                        if token_res.status_code in [200, 201]:
                                            account['ea_token'] = token_res.json().get('token', 'dummy_token')
                                            break
                                except Exception as e:
                                    logger.error(f"Error fetching EA token (attempt {attempt + 1}/3): {e}")
                                    time.sleep(2 ** attempt)

                        success = launch_mt5_and_attach_ea(account)
                        if success:
                            active_terminals[login] = account
                else:
                    if login in active_terminals:
                        logger.info(f"Account {login} is no longer active. Terminal will be stopped.")
                        # We just remove it from active_terminals, a cleanup loop should kill it,
                        # or we kill it right here.
                        import psutil
                        for proc in psutil.process_iter(['name', 'cmdline']):
                            try:
                                if proc.info['name'] and 'terminal' in proc.info['name'].lower():
                                    if proc.info['cmdline'] and f"startup_{login}.ini" in ' '.join(proc.info['cmdline']):
                                        proc.kill()
                                        logger.info(f"Killed MT5 terminal for {login}")
                            except (psutil.NoSuchProcess, psutil.AccessDenied):
                                pass
                        del active_terminals[login]
            
            # Detect deleted accounts
            fetched_logins = set(str(row.get('login')) for row in response.data)
            for login in list(active_terminals.keys()):
                if login not in fetched_logins:
                    logger.info(f"Account {login} was deleted. Killing terminal.")
                    import psutil
                    for proc in psutil.process_iter(['name', 'cmdline']):
                        try:
                            if proc.info['name'] and 'terminal' in proc.info['name'].lower():
                                if proc.info['cmdline'] and f"startup_{login}.ini" in ' '.join(proc.info['cmdline']):
                                    proc.kill()
                                    logger.info(f"Killed MT5 terminal for {login}")
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            pass
                    del active_terminals[login]
                        
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
    ping_url = os.getenv('KEEP_ALIVE_URL')
    if not ping_url:
        logger.warning("KEEP_ALIVE_URL not set. Keep-alive worker will not run.")
        return
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
    base_api = os.getenv('API_URL') or os.getenv('NEXT_PUBLIC_API_URL')
    if not base_api:
        logger.error("API_URL or NEXT_PUBLIC_API_URL must be defined for WebRequest permission.")
        return
    import urllib.parse
    parsed = urllib.parse.urlparse(base_api)
    base_api_root = f"{parsed.scheme}://{parsed.netloc}"

    appdata = Path(os.environ.get('APPDATA', 'C:\\Users\\Plaiz\\AppData\\Roaming'))
    terminal_dir = appdata / 'MetaQuotes' / 'Terminal'
    if not terminal_dir.exists():
        return
    for child in terminal_dir.iterdir():
        if child.is_dir() and len(child.name) == 32 and (child / 'config').exists():
            common_ini_path = child / 'config' / 'common.ini'
            content = f"[Experts]\nEnabled=1\nAllowDllImport=1\nWebRequest=1\nAllowWebRequest=1\nWebRequestUrl1={base_api_root}\n\n[Common]\n"
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

