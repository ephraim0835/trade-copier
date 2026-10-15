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
import psycopg2
import psycopg2.extras
import datetime
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

DATABASE_URL = os.getenv('DATABASE_URL')
MAX_VPS_CPU_PERCENT = int(os.getenv('MAX_VPS_CPU_PERCENT', '85'))
MAX_VPS_RAM_PERCENT = int(os.getenv('MAX_VPS_RAM_PERCENT', '85'))

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

def get_broker_symbol(account):
    broker = (account.get('broker') or '').lower()
    server = (account.get('server') or '').lower()
    
    # Deriv synthetic servers use Volatility 75 Index
    if 'deriv' in broker:
        if 'synthetic' in server or 'server' in server:
            return 'Volatility 75 Index'
        return 'EURUSD'
        
    # JustMarkets standard accounts use '.s' suffix
    if 'just' in broker:
        if 'pro' in server or 'raw' in server:
            return 'EURUSD'
        return 'EURUSD.s'
        
    # Exness standard accounts use 'm' suffix
    if 'exness' in broker:
        if 'pro' in server or 'zero' in server or 'raw' in server:
            return 'EURUSD'
        return 'EURUSDm'
        
    # XM micro accounts use 'micro' suffix
    if 'xm' in broker:
        if 'micro' in server:
            return 'EURUSDmicro'
        return 'EURUSD'

    # Common ECN / Raw / Pro / Cent suffixes across prop firms & brokers
    if 'ecn' in server or 'ecn' in broker:
        return 'EURUSD.ecn'
    if 'raw' in server or 'raw' in broker:
        return 'EURUSD.raw'
    if 'zero' in server or 'zero' in broker:
        return 'EURUSD.zero'
    if 'pro' in server or 'pro' in broker:
        return 'EURUSD.pro'
    if 'cent' in server or 'cent' in broker or 'micro' in server:
        return 'EURUSDc'
    if '_i' in server or 'institutional' in broker:
        return 'EURUSD_i'
        
    # Standard default for all other brokers (FTMO, IC Markets, FundedNext, The5ers, etc.)
    return 'EURUSD'


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

    def get_latest_mt5_data_dir():
        terminals_dir = Path(os.environ.get('APPDATA', 'C:\\Users\\Plaiz\\AppData\\Roaming')) / 'MetaQuotes' / 'Terminal'
        if not terminals_dir.exists():
            return None
        
        # Find the most recently modified directory (which corresponds to the active terminal)
        # Exclude 'Common' and 'Community' folders. Also ensure it's a fully initialized terminal with an MQL5/Include folder.
        dirs = [d for d in terminals_dir.iterdir() if d.is_dir() and d.name not in ['Common', 'Community'] and (d / 'MQL5' / 'Include').exists()]
        if not dirs:
            return None
            
        return max(dirs, key=lambda d: d.stat().st_mtime)

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
                master_data = get_latest_mt5_data_dir()
                if master_data and master_data.exists():
                    shutil.copytree(master_data, instance_dir, dirs_exist_ok=True)
            except Exception as e:
                logger.error(f"Failed to copy MT5 instance: {e}")
                return None, None
                
        # Always ensure the latest master servers.dat (with all broker definitions) is synced into this instance
        config_dir = instance_dir / 'config'
        config_dir.mkdir(parents=True, exist_ok=True)
        master_servers_candidates = [
            Path(__file__).parent / 'servers.dat',
            Path("C:/Program Files/MetaTrader 5/Config/servers.dat"),
        ]
        master_data = get_latest_mt5_data_dir()
        if master_data and (master_data / 'config' / 'servers.dat').exists():
            master_servers_candidates.insert(0, master_data / 'config' / 'servers.dat')

        for cand in master_servers_candidates:
            if cand.exists() and cand.stat().st_size > 100000:
                shutil.copy2(cand, config_dir / 'servers.dat')
                logger.info(f"Synced master servers.dat ({cand.stat().st_size:,} bytes) into {instance_dir.name}")
                break

        # For portable instances, the terminal path AND data path are the exact same directory
        return instance_dir, instance_dir

    terminal_path, data_path = get_terminal_path_for_account(account)
    if not terminal_path or not data_path:
        return False
        
    logger.info(f"Portable Instance Path: {terminal_path}")
    
    # Store the assigned data path on the account
    account['data_path'] = str(data_path)

    # 2. Auto-compile EA using MetaEditor (with pre-compiled .ex5 fallback)
    source_ea = Path(__file__).parent.parent / 'ea' / ea_file
    source_json = Path(__file__).parent.parent / 'ea' / 'MqlJson.mqh'
    source_wininet = Path(__file__).parent.parent / 'ea' / 'WinInet.mqh'
    
    experts_dir = data_path / 'MQL5' / 'Experts'
    experts_dir.mkdir(parents=True, exist_ok=True)
    
    target_ea = experts_dir / ea_file
    target_json = experts_dir / 'MqlJson.mqh'
    target_wininet = experts_dir / 'WinInet.mqh'
    compiled_ea = experts_dir / f"{ea_base}.ex5"
    
    # First seed with pre-compiled .ex5 if available as guaranteed fallback
    for fallback_loc in [Path(__file__).parent / f"{ea_base}.ex5", Path(__file__).parent.parent / 'ea' / f"{ea_base}.ex5"]:
        if fallback_loc.exists():
            shutil.copy2(fallback_loc, compiled_ea)
            break

    metaeditor = terminal_path / 'metaeditor64.exe'
    if not metaeditor.exists():
        metaeditor = Path("C:/Program Files/MetaTrader 5/metaeditor64.exe")
    
    if source_ea.exists():
        # Copy source and dependencies
        shutil.copy2(source_ea, target_ea)
        if source_json.exists():
            shutil.copy2(source_json, target_json)
        if source_wininet.exists():
            shutil.copy2(source_wininet, target_wininet)
            
        # Check if already compiled and fresh to save 100% of compile CPU
        needs_compile = True
        if compiled_ea.exists():
            try:
                if compiled_ea.stat().st_mtime >= source_ea.stat().st_mtime:
                    needs_compile = False
                    logger.info(f"EA binary {ea_base}.ex5 is already compiled and up-to-date. Skipping compilation to conserve CPU.")
            except Exception:
                needs_compile = True

        if needs_compile:
            # Compile directly in the target directory using portable mode
            compile_cmd = [str(metaeditor), '/portable', f'/compile:MQL5\\Experts\\{ea_file}', '/log']
            logger.info(f"Compiling EA {ea_file} with cmd: {' '.join(compile_cmd)}")
            result = subprocess.run(compile_cmd, cwd=str(terminal_path), capture_output=True, text=True)
            
            if not compiled_ea.exists():
                logger.error(f"Failed to compile {ea_file} and no precompiled fallback found. Stdout: {result.stdout}, Stderr: {result.stderr}")
                return False
            else:
                logger.info(f"EA binary ready at {compiled_ea}")
        else:
            logger.info(f"Using cached compiled EA binary at {compiled_ea}")
    else:
        if not compiled_ea.exists():
            logger.error(f"Source EA {source_ea} not found and no compiled binary exists.")
            return False
        logger.info(f"Using precompiled binary at {compiled_ea}")
        
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
        
    import urllib.parse
    parsed = urllib.parse.urlparse(base_api)
    base_api_root = f"{parsed.scheme}://{parsed.netloc}"

    files_dir = data_path / 'MQL5' / 'Files'
    files_dir.mkdir(parents=True, exist_ok=True)
    with open(files_dir / "ea_config.txt", 'w', newline='\n') as f:
        f.write(f"API_URL={api_url}\n")
        f.write(f"EA_TOKEN={account.get('ea_token', '')}\n")
        if account.get('role') == 'SUB':
            f.write(f"SUB_ACCOUNT_ID={account.get('id', '')}\n")

    # Use default.tpl from roaming folder or fallback to bundled default.tpl
    master_data_dir = get_latest_mt5_data_dir()
    tpl_candidates = []
    if master_data_dir:
        tpl_candidates.append(master_data_dir / 'MQL5' / 'Profiles' / 'Templates' / 'default.tpl')
    tpl_candidates.append(Path(__file__).parent / 'default.tpl')
    
    tpl_file_path = None
    for cand in tpl_candidates:
        if cand.exists():
            tpl_file_path = cand
            break
    
    profile_dir = data_path / 'MQL5' / 'Profiles' / 'Charts' / 'Default'
    if profile_dir.exists():
        shutil.rmtree(profile_dir, ignore_errors=True)
    profile_dir.mkdir(parents=True, exist_ok=True)
    
    with open(profile_dir / "order.wnd", 'w') as f:
        f.write("chart01\n")
        
    chr_file_path = profile_dir / "chart01.chr"
    if tpl_file_path and tpl_file_path.exists():
        # Read the template, dynamically replace the EA name so it matches MasterCopier or SubCopier
        content = tpl_file_path.read_text(encoding='utf-16', errors='ignore')
        if not '<chart>' in content:
            content = tpl_file_path.read_text(encoding='utf-8', errors='ignore')
            
        content = content.replace("name=MasterCopier", f"name={ea_base}")
        content = content.replace("path=Experts\\MasterCopier.ex5", f"path=Experts\\{ea_base}.ex5")
        
        target_symbol = get_broker_symbol(account)
        import re
        content = re.sub(r'symbol=[^\r\n]+', f'symbol={target_symbol}', content)
            
        ea_token = account.get('ea_token', '')
        if 'EA_TOKEN=' in content:
            content = re.sub(r'EA_TOKEN=.*', f'EA_TOKEN={ea_token}', content)
        if 'API_URL=' in content:
            content = re.sub(r'API_URL=.*', f'API_URL={api_url}', content)
            
        chr_file_path.write_text(content, encoding='utf-8')
        logger.info(f"Seeded chart01.chr for {account.get('broker')} with symbol={target_symbol}")
    else:
        logger.error(f"FATAL: No default.tpl found in candidates! Cannot seed chart01.chr!")
        
    # 4. Create startup.ini file with resource-saving flags
    ini_file_dir = data_path / 'config'
    ini_file_dir.mkdir(parents=True, exist_ok=True)
    ini_file_name = f"startup_{login}.ini"
    ini_file_path = ini_file_dir / ini_file_name
    
    with open(ini_file_path, 'w') as f:
        f.write(f"[Common]\n")
        f.write(f"Login={login}\n")
        f.write(f"Password={password}\n")
        f.write(f"Server={server}\n")
        f.write(f"AutoConfiguration=true\n")
        f.write(f"EnableNews=false\n")
        f.write(f"CertInstall=0\n")
        f.write(f"ProfileLast=Default\n\n")
        f.write(f"[Charts]\n")
        f.write(f"MaxBars=1000\n")
        f.write(f"SaveDeleted=0\n")
        f.write(f"PrintAllOrders=0\n\n")
        f.write(f"[StartUp]\n")
        f.write(f"Minimised=1\n")

    # Tune terminal.ini for sound off and news off to conserve CPU
    terminal_ini = ini_file_dir / 'terminal.ini'
    try:
        terminal_ini.write_text("[Common]\nNewsEnable=0\nSoundEnable=0\n[Charts]\nMaxBars=1000\n", encoding='utf-16')
    except Exception:
        pass

    # 5. Launch Terminal with the config
    logger.info(f"Launching MT5 terminal for account {login} with config and EA attached...")
    terminal_exe = terminal_path / 'terminal64.exe'
    
    # We MUST use /portable to ensure it uses the current folder as its data path
    launch_cmd = [str(terminal_exe), "/portable", f"/config:config\\{ini_file_name}"]
    logger.info(f"Command: {launch_cmd}")
    
    force_webrequest_permission()
    
    proc = subprocess.Popen(launch_cmd, cwd=str(terminal_path))
    account['process'] = proc
    account['instance_dir'] = str(terminal_path)
    account['server'] = server
    
    return True

def kill_account_terminal(login):
    """Gracefully or forcefully terminates terminal process matching startup_{login}.ini"""
    for proc in psutil.process_iter(['name', 'cmdline']):
        try:
            if proc.info['name'] and 'terminal' in proc.info['name'].lower():
                if proc.info['cmdline'] and f"startup_{login}.ini" in ' '.join(proc.info['cmdline']):
                    proc.kill()
                    logger.info(f"Terminated MT5 terminal process for {login}")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

def check_terminal_logs_for_diagnostics(acc):
    """Sniffs the MT5 instance logs for instant connection, broker, or auth diagnostic feedback."""
    instance_dir = acc.get('instance_dir')
    if not instance_dir:
        return None
    
    logs_dir = Path(instance_dir) / 'logs'
    if not logs_dir.exists():
        return None
    
    log_files = sorted(logs_dir.glob('*.log'), key=lambda p: p.stat().st_mtime, reverse=True)
    if not log_files:
        return None
    
    target_log = log_files[0]
    try:
        content = ''
        try:
            content = target_log.read_text(encoding='utf-16-le', errors='ignore')
        except Exception:
            content = target_log.read_text(encoding='utf-8', errors='ignore')
        
        lines = content.splitlines()[-50:]
        for line in reversed(lines):
            # Check authorization failure
            if 'authorization' in line.lower() and 'failed' in line.lower():
                if 'invalid account' in line.lower():
                    return 'FAILED', f"Broker rejected login: Invalid account number for server '{acc.get('server')}'"
                if 'incorrect password' in line.lower() or 'invalid password' in line.lower():
                    return 'FAILED', f"Broker rejected login: Incorrect trading password for server '{acc.get('server')}'"
                return 'FAILED', f"Broker authorization failed: {line.strip()}"
            
            # Check connection failure
            if 'connect failed' in line.lower() or 'no connection' in line.lower():
                if '0 access points found' in line.lower():
                    return 'FAILED', f"Broker connection failed: Server '{acc.get('server')}' not reachable. Check server name."
                return 'FAILED', f"Broker network error: Unable to connect to {acc.get('server')}"
            
            # Check web request permission error
            if 'webrequest to' in line.lower() and 'not allowed' in line.lower():
                return 'FAILED', "WebRequest URL not whitelisted in common.ini"
                
    except Exception as e:
        logger.debug(f"Error checking terminal logs for {acc.get('login')}: {e}")
        
    return None

stop_event = threading.Event()
active_terminals = {}

# Worker thread that continuously polls the DB for inactive accounts

def execute_query(query, params=None, fetch=False):
    if not DATABASE_URL:
        logger.error("Missing DATABASE_URL in .env!")
        return None
    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(query, params)
                if fetch:
                    return cur.fetchall()
                conn.commit()
                return True
    except Exception as e:
        logger.error(f"Database error: {e}")
        return None

def poll_db_worker():
    """Background thread that polls the DB for active accounts and launches MT5 terminals."""
    if not DATABASE_URL:
        logger.error("Missing DATABASE_URL in .env!")
        time.sleep(10)
        return

    while not stop_event.is_set():
        try:
            rows = execute_query('SELECT id, login, password, broker, server, "isActive", role, "connectionStatus", "lastHeartbeatAt" FROM "Mt5Account"', fetch=True)
            if rows is None:
                time.sleep(10)
                continue
            
            for row in rows:
                account = {
                    'id': row.get('id'),
                    'login': str(row.get('login')),
                    'password': decrypt_password(row.get('password')),
                    'broker': row.get('broker'),
                    'server': row.get('server'),
                    'is_active': row.get('isActive'),
                    'role': row.get('role'),
                    'connectionStatus': row.get('connectionStatus'),
                    'lastHeartbeatAt': row.get('lastHeartbeatAt'),
                    'ea_file': 'MasterCopier.mq5' if row.get('role') == 'MASTER' else 'SubCopier.mq5'
                }
                
                login = account['login']
                
                # Check stale heartbeat for intelligent watchdog
                is_stale = False
                if account['connectionStatus'] == 'ONLINE' and account['lastHeartbeatAt']:
                    try:
                        hb_time = account['lastHeartbeatAt']
                        if isinstance(hb_time, str):
                            hb_str = hb_time.replace('Z', '+00:00')
                            hb_time = datetime.datetime.fromisoformat(hb_str)
                        if hb_time.tzinfo is None:
                            hb_time = hb_time.replace(tzinfo=datetime.timezone.utc)
                        if (datetime.datetime.now(datetime.timezone.utc) - hb_time).total_seconds() > 180:
                            is_stale = True
                    except Exception:
                        pass
                
                if account['is_active']:
                    # Prevent continuous infinite retry loop for FAILED accounts.
                    # FAILED accounts are retried when the user edits credentials, clicks Retry in UI,
                    # or sends a START/RESTART command from the Admin Panel.
                    if account['connectionStatus'] == 'FAILED' and not is_stale:
                        continue

                    # Prevent double-provisioning
                    if account['connectionStatus'] == 'PROVISIONING' and login not in active_terminals:
                        continue
                        
                    if login not in active_terminals or is_stale:
                        if is_stale:
                            logger.info(f"Intelligent Watchdog: Account {login} is ONLINE but heartbeat is stale. Terminating for safe recovery.")
                            kill_account_terminal(login)
                            if login in active_terminals:
                                del active_terminals[login]
                        
                        # Pre-flight check: CPU / RAM limits
                        if psutil.virtual_memory().percent > 98:
                            logger.warning(f"Capacity limit reached (CPU: {psutil.cpu_percent()}%, RAM: {psutil.virtual_memory().percent}%). Cannot provision {account['login']}.")
                            execute_query('UPDATE "Mt5Account" SET "connectionStatus" = %s, "provisioningError" = %s WHERE id = %s', ('FAILED', 'VPS Capacity Limit Exceeded', account['id']))
                            continue
                            
                        logger.info(f"New active account detected (or recovering): {login}. Fetching EA token and launching MT5...")
                        
                        execute_query('UPDATE "Mt5Account" SET "connectionStatus" = %s, "provisioningError" = NULL WHERE id = %s', ('PROVISIONING', account['id']))
                        
                        # Fetch EA token only when launching. 
                        # We will block launch and retry infinitely with bounded backoff if the API is offline.
                        base_api = os.getenv('API_URL') or os.getenv('NEXT_PUBLIC_API_URL')
                        if base_api:
                            attempt = 0
                            while True:
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
                                            account['ea_token'] = token_res.json().get('token')
                                            if account['ea_token']:
                                                logger.info(f"Successfully obtained EA token for {login}")
                                                break
                                            else:
                                                raise Exception("Token was empty")
                                        else:
                                            raise Exception(f"Status {token_res.status_code}")
                                except Exception as e:
                                    # Bounded exponential backoff: 1, 2, 4, 8, 10, 10, ...
                                    sleep_time = min(2 ** attempt, 10)
                                    logger.error(f"Error fetching EA token (attempt {attempt + 1}). API offline? Retrying in {sleep_time}s: {e}")
                                    
                                    if attempt >= 5:
                                        logger.error(f"Max retries reached for EA token {login}. Marking failed.")
                                        execute_query('UPDATE "Mt5Account" SET "connectionStatus" = %s, "provisioningError" = %s WHERE id = %s', ('FAILED', 'Failed to fetch EA token', account['id']))
                                        break
                                        
                                    time.sleep(sleep_time)
                                    attempt += 1

                        if account.get('ea_token'):
                            success = launch_mt5_and_attach_ea(account)
                            if success:
                                active_terminals[login] = account
                                account['launch_time'] = time.time()
                        else:
                            logger.error(f"Cannot launch {login} without an EA token.")
                else:
                    if login in active_terminals:
                        logger.info(f"Account {login} is no longer active. Terminal will be stopped.")
                        kill_account_terminal(login)
                        del active_terminals[login]
                        execute_query('UPDATE "Mt5Account" SET "connectionStatus" = %s WHERE id = %s', ('OFFLINE', account['id']))
                        
            # Fast log diagnostic sniffer & timeout check for active terminals
            current_time = time.time()
            for login, acc in list(active_terminals.items()):
                # 1. Instant terminal log sniffer (checks for broker auth/connect rejection in sub-seconds)
                diag = check_terminal_logs_for_diagnostics(acc)
                if diag:
                    diag_status, diag_msg = diag
                    logger.error(f"[LOG DIAGNOSTIC] Account {login} failed fast: {diag_msg}")
                    execute_query('UPDATE "Mt5Account" SET "connectionStatus" = %s, "provisioningError" = %s WHERE id = %s', (diag_status, diag_msg, acc['id']))
                    kill_account_terminal(login)
                    del active_terminals[login]
                    continue

                # 2. Check for provisioning timeouts (120s without ONLINE status)
                if acc.get('launch_time') and (current_time - acc['launch_time']) > 120:
                    for row in rows:
                        if str(row.get('login')) == login:
                            if row.get('connectionStatus') == 'PROVISIONING':
                                logger.error(f"Timeout: EA {login} never sent heartbeat after 120s. Killing process.")
                                execute_query('UPDATE "Mt5Account" SET "connectionStatus" = %s, "provisioningError" = %s WHERE id = %s', ('FAILED', 'EA initialization timeout (no heartbeat from broker/chart)', acc['id']))
                                kill_account_terminal(login)
                                del active_terminals[login]
                            break
            
            # Detect deleted accounts
            fetched_logins = set(str(row.get('login')) for row in rows)
            for login in list(active_terminals.keys()):
                if login not in fetched_logins:
                    logger.info(f"Account {login} was deleted. Killing terminal.")
                    kill_account_terminal(login)
                    del active_terminals[login]
                        
        except Exception as e:
            logger.error(f"Supabase API polling error: {e}")
        
        # Sleep before next poll
        time.sleep(10)

def telemetry_worker():
    if not DATABASE_URL:
        logger.error("Missing DATABASE credentials for telemetry")
        return
        
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
            
            execute_query("""
                INSERT INTO "VpsEnvironment" (id, name, status, "cpuPercent", "ramPercent", "diskPercent", "activeTerminals", "lastHeartbeatAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (name) DO UPDATE SET 
                    status = EXCLUDED.status,
                    "cpuPercent" = EXCLUDED."cpuPercent",
                    "ramPercent" = EXCLUDED."ramPercent",
                    "diskPercent" = EXCLUDED."diskPercent",
                    "activeTerminals" = EXCLUDED."activeTerminals",
                    "lastHeartbeatAt" = now()
            """, (str(uuid.uuid4()), 'vps-main-1', 'HEALTHY', cpu, ram, disk, terminals))
            
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
            response = requests.get(ping_url, timeout=60)
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

    appdata = Path(r"C:\Users\Plaiz\MT5_Instances")
    terminal_dir = appdata
    if not terminal_dir.exists():
        return
    for child in terminal_dir.iterdir():
        if child.is_dir() and (child / 'config').exists():
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


def command_worker():
    """Background thread that listens for Admin Panel commands (START, RESTART, STOP, SYNC)."""
    if not DATABASE_URL:
        return
        
    logger.info("Admin Command Listener active. Monitoring database queue for remote commands...")
    while not stop_event.is_set():
        try:
            rows = execute_query(
                'SELECT id, "lastCommand", "commandStatus" FROM "VpsEnvironment" WHERE "commandStatus" = %s AND "lastCommand" IS NOT NULL LIMIT 1',
                ('PENDING',),
                fetch=True
            )
            if rows:
                for row in rows:
                    env_id = row['id']
                    cmd = (row['lastCommand'] or '').upper()
                    logger.info(f"[ADMIN COMMAND] Received '{cmd}' from Admin Panel!")
                    
                    if cmd in ['START', 'SYNC']:
                        execute_query(
                            'UPDATE "VpsEnvironment" SET "commandStatus" = %s, "commandMessage" = %s, "lastHeartbeatAt" = now() WHERE id = %s',
                            ('EXECUTED', f'Synchronized terminals successfully at {datetime.datetime.now().strftime("%H:%M:%S")}', env_id)
                        )
                        logger.info("Triggered instant fleet synchronization.")
                        
                    elif cmd == 'RESTART':
                        execute_query(
                            'UPDATE "VpsEnvironment" SET "commandStatus" = %s, "commandMessage" = %s WHERE id = %s',
                            ('EXECUTING', 'Restarting MT5 terminal fleet...', env_id)
                        )
                        kill_existing_terminals()
                        active_terminals.clear()
                        force_webrequest_permission()
                        execute_query(
                            'UPDATE "VpsEnvironment" SET "commandStatus" = %s, "commandMessage" = %s, "lastHeartbeatAt" = now() WHERE id = %s',
                            ('EXECUTED', 'Fleet cold-restarted successfully', env_id)
                        )
                        logger.info("Fleet cold restart complete.")
                        
                    elif cmd == 'STOP':
                        logger.info("Executing STOP command: Terminating all MT5 terminals...")
                        kill_existing_terminals()
                        active_terminals.clear()
                        execute_query(
                            'UPDATE "VpsEnvironment" SET "commandStatus" = %s, "commandMessage" = %s, "lastHeartbeatAt" = now() WHERE id = %s',
                            ('EXECUTED', 'All MT5 terminals safely stopped', env_id)
                        )
        except Exception as e:
            logger.error(f"Error in command worker: {e}")
            
        time.sleep(3)


if __name__ == '__main__':
    logger.info('Starting VPS MT5 manager')
    kill_existing_terminals()
    force_webrequest_permission()
    
    poll_thread = threading.Thread(target=poll_db_worker, daemon=True)
    poll_thread.start()
    
    telemetry_thread = threading.Thread(target=telemetry_worker, daemon=True)
    telemetry_thread.start()
    
    command_thread = threading.Thread(target=command_worker, daemon=True)
    command_thread.start()
    
    keep_alive_thread = threading.Thread(target=keep_alive_worker, daemon=True)
    keep_alive_thread.start()
    
    # Keep the main thread alive
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        logger.info('Shutting down manager')
        stop_event.set()
        mt5.shutdown()

