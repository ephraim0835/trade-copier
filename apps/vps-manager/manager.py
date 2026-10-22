import os
import re
import time
import threading
import json
import logging
import subprocess
import uuid
import shutil
import stat
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

# Known direct hostnames for brokers without preloaded servers.dat definitions
# Note: MT5 expects hostnames WITHOUT :443 (e.g. 'mt5.demo.trade-hw.online')
KNOWN_BROKER_SERVERS = {
    'headway-real': 'mt5.real.trade-hw.online',
    'headway-demo': 'mt5.demo.trade-hw.online',
    'mt5.real.trade-hw.online:443': 'mt5.real.trade-hw.online',
    'mt5.demo.trade-hw.online:443': 'mt5.demo.trade-hw.online',
}

def resolve_server_name(server_str: str) -> str:
    if not server_str:
        return ''
    cleaned = server_str.strip()
    if ':443' in cleaned:
        cleaned = cleaned.replace(':443', '')
    return KNOWN_BROKER_SERVERS.get(cleaned.lower(), cleaned)


def get_broker_symbol(account):
    broker = (account.get('broker') or '').lower()
    server = (account.get('server') or '').lower()
    
    # Deriv synthetic servers use Volatility 75 Index
    if 'deriv' in broker:
        if 'synthetic' in server or 'server' in server:
            return 'Volatility 75 Index'
        return 'EURUSD'
        
    # JustMarkets standard accounts use '.m' suffix
    if 'just' in broker:
        if 'pro' in server or 'raw' in server:
            return 'EURUSD'
        return 'EURUSD.m'
        
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

        # Block MetaQuotes LiveUpdate hijacking in portable instance
        try:
            lu_block = instance_dir / 'liveupdate'
            if lu_block.exists() and lu_block.is_dir():
                shutil.rmtree(lu_block, ignore_errors=True)
            if not lu_block.exists():
                lu_block.write_bytes(b"LOCKED_LIVEUPDATE_BLOCK")
                os.chmod(lu_block, stat.S_IREAD)
        except Exception:
            pass

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
    for fallback_loc in [Path(__file__).parent.parent / 'ea' / f"{ea_base}.ex5", Path(__file__).parent / f"{ea_base}.ex5"]:
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

    # Use bundled default.tpl as primary template with verified MT5 window/expert structure
    tpl_candidates = [
        Path(__file__).parent / 'default.tpl',
    ]
    master_data_dir = get_latest_mt5_data_dir()
    if master_data_dir:
        tpl_candidates.append(master_data_dir / 'MQL5' / 'Profiles' / 'Templates' / 'default.tpl')
    
    tpl_file_path = None
    for cand in tpl_candidates:
        if cand.exists():
            tpl_file_path = cand
            break
    
    if tpl_file_path and tpl_file_path.exists():
        content = ''
        try:
            content = tpl_file_path.read_text(encoding='utf-16', errors='ignore')
        except Exception:
            pass
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
            
        for base_prof in [data_path / 'MQL5' / 'Profiles' / 'Charts' / 'Default', data_path / 'Profiles' / 'Charts' / 'Default']:
            base_prof.mkdir(parents=True, exist_ok=True)
            with open(base_prof / "order.wnd", 'w', encoding='utf-8') as f:
                f.write("chart01\n")
            (base_prof / "chart01.chr").write_text(content, encoding='utf-8')

        logger.info(f"Seeded chart01.chr for {account.get('broker')} with symbol={target_symbol} and EA={ea_base}")
    else:
        logger.error(f"FATAL: No default.tpl found in candidates! Cannot seed chart01.chr!")
        
    # 4. Create startup.ini file with resource-saving flags
    ini_file_dir = data_path / 'config'
    ini_file_dir.mkdir(parents=True, exist_ok=True)
    ini_file_name = f"startup_{login}.ini"
    ini_file_path = ini_file_dir / ini_file_name
    
    clean_login = str(login).replace('\r', '').replace('\n', '').strip()
    clean_password = str(password).replace('\r', '').replace('\n', '')
    clean_server = str(resolved_server).replace('\r', '').replace('\n', '').strip()
    clean_base_api_root = str(base_api_root).replace('\r', '').replace('\n', '').strip()

    with open(ini_file_path, 'w', encoding='utf-8') as f:
        f.write(f"[Common]\n")
        f.write(f"Login={clean_login}\n")
        f.write(f"Password={clean_password}\n")
        f.write(f"Server={clean_server}\n")
        f.write(f"AutoConfiguration=true\n")
        f.write(f"EnableNews=false\n")
        f.write(f"CertInstall=0\n")
        f.write(f"ProfileLast=Default\n\n")
        f.write(f"[Charts]\n")
        f.write(f"MaxBars=1000\n")
        f.write(f"SaveDeleted=0\n")
        f.write(f"PrintAllOrders=0\n\n")
        f.write(f"[StartUp]\n")
        f.write(f"Minimised=1\n\n")
        f.write(f"[Experts]\n")
        f.write(f"AllowDllImport=1\n")
        f.write(f"Enabled=1\n")
        f.write(f"Account=0\n")
        f.write(f"Profile=0\n")
        f.write(f"Chart=0\n")
        f.write(f"WebRequest=1\n")
        f.write(f"AllowWebRequest=1\n")
        f.write(f"WebRequestUrl1={clean_base_api_root}\n")

    # Tune terminal.ini for sound off and news off to conserve CPU, and enforce Expert Advisor execution permissions
    terminal_ini = ini_file_dir / 'terminal.ini'
    try:
        terminal_ini_content = (
            "[Common]\n"
            "NewsEnable=0\n"
            "SoundEnable=0\n\n"
            "[Charts]\n"
            "MaxBars=1000\n\n"
            "[Experts]\n"
            "Enabled=1\n"
            "Account=0\n"
            "Profile=0\n"
            "Chart=0\n"
            "AllowDllImport=1\n"
            "WebRequest=1\n"
            "AllowWebRequest=1\n"
            f"WebRequestUrl1={clean_base_api_root}\n"
        )
        terminal_ini.write_text(terminal_ini_content, encoding='utf-16')
    except Exception as e:
        logger.warning(f"Could not write terminal.ini: {e}")

    # 5. Launch Terminal with the config
    logger.info(f"Launching MT5 terminal for account {login} with config and EA attached...")
    terminal_exe = terminal_path / 'terminal64.exe'
    
    # We MUST use /portable to ensure it uses the current folder as its data path
    launch_cmd = [str(terminal_exe), "/portable", f"/config:config\\{ini_file_name}"]
    logger.info(f"Command: {launch_cmd}")
    
    force_webrequest_permission()
    
    # Ensure any previous instance for this account is stopped first
    kill_account_terminal(account)
    time.sleep(1)

    proc = subprocess.Popen(launch_cmd, cwd=str(terminal_path))
    account['process'] = proc
    account['instance_dir'] = str(terminal_path)
    account['server'] = server
    account['launch_time'] = time.time()

    # Clean up transient plaintext startup.ini after terminal initialization to protect stored passwords (SEC-020)
    def _delayed_ini_cleanup(target_ini):
        time.sleep(15)
        try:
            p = Path(target_ini)
            if p.exists():
                p.unlink(missing_ok=True)
        except Exception:
            pass

    threading.Thread(target=_delayed_ini_cleanup, args=(str(ini_file_path),), daemon=True).start()

    # Record log file offsets at launch so diagnostics only inspect new session logs
    try:
        logs_dir = terminal_path / 'logs'
        log_files = sorted(logs_dir.glob('*.log'), key=lambda p: p.stat().st_mtime, reverse=True) if logs_dir.exists() else []
        account['log_offset'] = log_files[0].stat().st_size if log_files else 0
        account['log_file'] = str(log_files[0]) if log_files else None

        mql_dir = terminal_path / 'MQL5' / 'Logs'
        mql_files = sorted(mql_dir.glob('*.log'), key=lambda p: p.stat().st_mtime, reverse=True) if mql_dir.exists() else []
        account['mql_offset'] = mql_files[0].stat().st_size if mql_files else 0
        account['mql_file'] = str(mql_files[0]) if mql_files else None
    except Exception:
        pass
    
    return True

def kill_account_terminal(account_or_login):
    """Gracefully or forcefully terminates terminal process matching login or instance folder"""
    login_str = str(account_or_login.get('login') if isinstance(account_or_login, dict) else account_or_login)
    acc_id = str(account_or_login.get('id', '')) if isinstance(account_or_login, dict) else ''
    inst_dir = str(account_or_login.get('instance_dir', '')) if isinstance(account_or_login, dict) else ''
    
    for proc in psutil.process_iter(['name', 'cmdline']):
        try:
            if proc.info['name'] and 'terminal' in proc.info['name'].lower():
                cmd = ' '.join(proc.info['cmdline'] or [])
                if (
                    (f"startup_{login_str}.ini" in cmd)
                    or (acc_id and acc_id in cmd)
                    or (inst_dir and Path(inst_dir).name in cmd)
                ):
                    proc.kill()
                    logger.info(f"Terminated MT5 terminal process for {login_str}")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

def sweep_all_orphan_terminals(db_rows):
    """
    Scans ALL running terminal64 and terminal.exe processes on the operating system.
    If any running terminal does not belong to an active, valid database account,
    terminates it immediately.
    """
    valid_logins = {str(r.get('login')) for r in db_rows if r.get('isActive')}
    valid_ids = {str(r.get('id')) for r in db_rows if r.get('isActive')}
    
    for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'exe']):
        try:
            pname = (proc.info.get('name') or '').lower()
            if 'terminal64' in pname or 'terminal.exe' in pname:
                pid = proc.info['pid']
                cmd = ' '.join(proc.info.get('cmdline') or [])
                exe = proc.info.get('exe') or ''
                
                # Extract login from config filename
                login_match = re.search(r'startup_(\d+)\.ini', cmd)
                found_login = login_match.group(1) if login_match else None
                
                # Extract account UUID from path or cmdline
                id_match = re.search(r'MT5_Instances[\\/]([0-9a-fA-F-]{36})', cmd + ' ' + exe)
                found_id = id_match.group(1) if id_match else None
                
                is_valid = False
                if found_login and found_login in valid_logins:
                    is_valid = True
                elif found_id and found_id in valid_ids:
                    is_valid = True
                    
                if not is_valid:
                    logger.info(f"[ORPHAN CLEANUP] Found running terminal PID {pid} (login={found_login}, id={found_id}) with no active DB account. Terminating process...")
                    try:
                        proc.kill()
                        logger.info(f"[ORPHAN CLEANUP] Successfully killed orphan terminal PID {pid}")
                    except Exception as ke:
                        logger.warning(f"Could not kill process PID {pid}: {ke}")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
        except Exception as e:
            logger.debug(f"Error checking process for orphan cleanup: {e}")

def cleanup_orphaned_instance_dirs(all_db_ids):
    """Safely cleans up directories in MT5_Instances for accounts deleted from the database."""
    instances_root = Path(r"C:\Users\Plaiz\MT5_Instances")
    if not instances_root.exists():
        return
        
    def _remove_readonly(func, path, excinfo):
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            pass

    for p in instances_root.iterdir():
        if p.is_dir() and re.match(r'^[0-9a-fA-F-]{36}$', p.name):
            if p.name not in all_db_ids:
                try:
                    logger.info(f"[DISK CLEANUP] Removing orphaned instance folder for deleted account: {p.name}")
                    shutil.rmtree(p, onerror=_remove_readonly)
                except Exception as e:
                    logger.debug(f"Could not delete orphaned folder {p.name}: {e}")

def check_terminal_logs_for_diagnostics(acc):
    """Sniffs the MT5 instance logs for instant connection, broker, or auth diagnostic feedback."""
    instance_dir = acc.get('instance_dir')
    if not instance_dir:
        return None
    
    server_name = acc.get('server') or 'broker server'
    login_id = acc.get('login') or ''
    launch_ts = acc.get('launch_time', 0)
    launch_dt = datetime.datetime.fromtimestamp(launch_ts) if launch_ts > 0 else None
    
    # 1. Inspect network and terminal logs
    logs_dir = Path(instance_dir) / 'logs'
    if logs_dir.exists():
        log_files = sorted(logs_dir.glob('*.log'), key=lambda p: p.stat().st_mtime, reverse=True)
        if log_files:
            target_log = log_files[0]
            try:
                # If the log file was not modified after this session launched, no new entries exist
                if launch_ts > 0 and target_log.stat().st_mtime < launch_ts:
                    lines = []
                else:
                    content = ''
                    try:
                        content = target_log.read_text(encoding='utf-16-le', errors='ignore')
                    except Exception:
                        content = target_log.read_text(encoding='utf-8', errors='ignore')
                    lines = content.splitlines()[-100:]
                
                for line in reversed(lines):
                    # Check MT5 log line timestamp format: HH:MM:SS
                    if launch_dt:
                        match = re.search(r'\b(\d{2}):(\d{2}):(\d{2})\b', line)
                        if match:
                            h, m, s = map(int, match.groups())
                            line_dt = launch_dt.replace(hour=h, minute=m, second=s, microsecond=0)
                            # If log line is older than launch time by more than 10s, stop backward search
                            if (launch_dt - line_dt).total_seconds() > 10:
                                break

                    line_lower = line.lower()
                    
                    # Ignore non-broker community, cloud, or MQL5 service logs
                    if 'community' in line_lower or 'mql5.com' in line_lower or 'cloud server' in line_lower:
                        continue

                    # Authorization Failures
                    if 'authorization' in line_lower and 'failed' in line_lower:
                        if 'invalid account' in line_lower:
                            return 'FAILED', f"Invalid Account Number: Server '{server_name}' does not recognize account '{login_id}'. Please verify your MT5 account number."
                        if 'incorrect password' in line_lower or 'invalid password' in line_lower:
                            return 'FAILED', f"Incorrect Password: The password entered does not match account '{login_id}' on server '{server_name}'. Please verify your trading password."
                        if 'investor' in line_lower:
                            return 'FAILED', f"Investor Password Detected: You entered a read-only investor password. Trade Copier requires the Master/Trading password to copy trades."
                        if 'disabled' in line_lower:
                            return 'FAILED', f"Account Disabled: Account '{login_id}' is disabled or archived on server '{server_name}'."
                        if 'trading disabled' in line_lower:
                            return 'FAILED', f"Trading Disabled: The broker has disabled trading privileges on account '{login_id}'."
                        if 'no connection' in line_lower:
                            return 'FAILED', f"Connection Failed: Unable to establish a network link to broker server '{server_name}'."
                        return 'FAILED', f"Broker Authorization Failed: The broker rejected login credentials for account '{login_id}' on server '{server_name}'."
                    
                    # Server & Connection Failures
                    if 'connect failed' in line_lower or 'no connection' in line_lower or 'server not responding' in line_lower:
                        if '0 access points found' in line_lower or 'not found' in line_lower:
                            return 'FAILED', f"Invalid Server Name: Broker server '{server_name}' is unreachable or does not exist. Please check the exact server name in your broker portal."
                        return 'FAILED', f"Network Connection Failed: Cannot connect to '{server_name}'. Verify broker server status and name."

                    # WebRequest Security Permissions
                    if 'webrequest to' in line_lower and 'not allowed' in line_lower:
                        return 'FAILED', "WebRequest Permission Denied: The API endpoint URL is not whitelisted in MT5 common.ini settings."
                        
            except Exception as e:
                logger.debug(f"Error checking terminal network logs for {login_id}: {e}")

    # 2. Inspect MQL5 Experts Logs (EA runtime errors)
    mql_logs_dir = Path(instance_dir) / 'MQL5' / 'Logs'
    if mql_logs_dir.exists():
        mql_log_files = sorted(mql_logs_dir.glob('*.log'), key=lambda p: p.stat().st_mtime, reverse=True)
        if mql_log_files:
            target_mql_log = mql_log_files[0]
            try:
                if launch_ts > 0 and target_mql_log.stat().st_mtime < launch_ts:
                    lines = []
                else:
                    content = ''
                    try:
                        content = target_mql_log.read_text(encoding='utf-16-le', errors='ignore')
                    except Exception:
                        content = target_mql_log.read_text(encoding='utf-8', errors='ignore')
                    lines = content.splitlines()[-60:]
                
                for line in reversed(lines):
                    if launch_dt:
                        match = re.search(r'\b(\d{2}):(\d{2}):(\d{2})\b', line)
                        if match:
                            h, m, s = map(int, match.groups())
                            line_dt = launch_dt.replace(hour=h, minute=m, second=s, microsecond=0)
                            if (launch_dt - line_dt).total_seconds() > 10:
                                break

                    line_lower = line.lower()
                    if 'webrequest failed with code 401' in line_lower or 'unauthorized' in line_lower:
                        return 'FAILED', "EA Authentication Failed: Invalid or expired EA authorization token (HTTP 401)."
                    if 'initialization failed' in line_lower:
                        return 'FAILED', "Terminal Startup Interrupted: The Trade Copier expert initialization failed. Please try again."
            except Exception as e:
                logger.debug(f"Error checking MQL5 logs for {login_id}: {e}")
                
    return None

stop_event = threading.Event()
sync_event = threading.Event()
active_terminals = {}

# Worker thread that continuously polls the DB for inactive accounts

def execute_query(query, params=None, fetch=False):
    if not DATABASE_URL:
        logger.error("Missing DATABASE_URL in .env!")
        return None
    for attempt in range(3):
        # On retry, fallback to direct host without -pooler to bypass pooler connection limits/timeouts
        target_db_url = DATABASE_URL if attempt == 0 else DATABASE_URL.replace('-pooler', '')
        try:
            with psycopg2.connect(target_db_url, connect_timeout=15) as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    cur.execute(query, params)
                    if fetch:
                        return cur.fetchall()
                    conn.commit()
                    return True
        except Exception as e:
            if attempt < 2:
                time.sleep(2 ** attempt)
                continue
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
                sync_event.wait(timeout=10)
                sync_event.clear()
                continue
            
            # 1. Sweep and kill any running terminal processes that don't belong to an active DB account
            sweep_all_orphan_terminals(rows)
            
            # 2. Clean up active_terminals dictionary for deleted accounts
            db_logins = {str(r.get('login')) for r in rows}
            db_ids = {str(r.get('id')) for r in rows}
            for term_login in list(active_terminals.keys()):
                if term_login not in db_logins:
                    logger.info(f"Account {term_login} was deleted from database. Terminating active terminal record.")
                    kill_account_terminal(term_login)
                    del active_terminals[term_login]
            
            # 3. Clean up orphaned disk folders for deleted accounts
            cleanup_orphaned_instance_dirs(db_ids)
            
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
                
                # Check stale heartbeat for intelligent watchdog with launch grace period
                is_stale = False
                launch_time = active_terminals.get(login, {}).get('launch_time', 0)
                if (time.time() - launch_time) > 600: # 10 minute grace after launch
                    if account['connectionStatus'] == 'ONLINE' and account['lastHeartbeatAt']:
                        try:
                            hb_time = account['lastHeartbeatAt']
                            if isinstance(hb_time, str):
                                hb_str = hb_time.replace('Z', '+00:00')
                                hb_time = datetime.datetime.fromisoformat(hb_str)
                            if hb_time.tzinfo is None:
                                hb_time = hb_time.replace(tzinfo=datetime.timezone.utc)
                            if (datetime.datetime.now(datetime.timezone.utc) - hb_time).total_seconds() > 600:
                                # Only kill if process actually died or exited
                                proc = active_terminals.get(login, {}).get('process')
                                if not proc or proc.poll() is not None:
                                    is_stale = True
                                else:
                                    logger.debug(f"Watchdog: Account {login} heartbeat is >600s old, but terminal PID {proc.pid} is still actively running. Preserving process.")
                        except Exception:
                            pass
                
                if account['is_active']:
                    # Prevent continuous infinite retry loop for FAILED accounts.
                    # FAILED accounts are retried when the user edits credentials, clicks Retry in UI,
                    # or sends a START/RESTART command from the Admin Panel.
                    if account['connectionStatus'] == 'FAILED' and not is_stale:
                        continue
                        
                    is_pending_reconnect = (account['connectionStatus'] == 'PENDING')
                    if login in active_terminals:
                        proc = active_terminals[login].get('process')
                        if proc and proc.poll() is not None:
                            logger.info(f"Terminal process for {login} exited (code {proc.poll()}). Cleaning up active_terminals.")
                            del active_terminals[login]
                        elif is_pending_reconnect:
                            logger.info(f"User requested reconnect for {login} (connectionStatus=PENDING). Terminating existing terminal for fresh connection.")
                            kill_account_terminal(login)
                            if login in active_terminals:
                                del active_terminals[login]

                    if login not in active_terminals or is_stale or is_pending_reconnect:
                        if is_stale and not is_pending_reconnect:
                            logger.info(f"Intelligent Watchdog: Account {login} is ONLINE but heartbeat is stale. Terminating for safe recovery.")
                            kill_account_terminal(login)
                            if login in active_terminals:
                                del active_terminals[login]
                        
                        # Pre-flight check: CPU / RAM limits
                        if psutil.virtual_memory().percent > 98:
                            logger.warning(f"Capacity limit reached (CPU: {psutil.cpu_percent()}%, RAM: {psutil.virtual_memory().percent}%). Cannot provision {account['login']}.")
                            execute_query('UPDATE "Mt5Account" SET "connectionStatus" = %s, "provisioningError" = %s WHERE id = %s', ('FAILED', 'The trading server is temporarily busy. Please wait a moment and try again.', account['id']))
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
                                        execute_query('UPDATE "Mt5Account" SET "connectionStatus" = %s, "provisioningError" = %s WHERE id = %s', ('FAILED', 'Failed to authorize terminal session with the server. Please try reconnecting.', account['id']))
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
                        
            # Fast log diagnostic sniffer, telemetry bridge & timeout check for active terminals
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

                # 2. Realtime Telemetry Bridge via MT5 Python IPC
                # Queries live broker status, balance, equity directly from running terminal
                last_tel = acc.get('last_telemetry_time', 0)
                if current_time - last_tel >= 5:
                    acc['last_telemetry_time'] = current_time
                    instance_dir = acc.get('instance_dir') or acc.get('data_path')
                    if instance_dir:
                        terminal_exe = str(Path(instance_dir) / 'terminal64.exe')
                        try:
                            init_kwargs = {
                                "path": terminal_exe,
                                "portable": True,
                                "timeout": 10000
                            }
                            # Connect to running terminal without re-logging in to prevent MT5 "automated trading disabled"
                            connected = mt5.initialize(**init_kwargs)
                            if not connected and acc.get('password') and acc.get('server'):
                                try:
                                    init_kwargs["login"] = int(login)
                                    init_kwargs["password"] = acc.get('password')
                                    srv_raw = acc.get('server', '')
                                    init_kwargs["server"] = resolve_server_name(srv_raw)
                                    connected = mt5.initialize(**init_kwargs)
                                except Exception:
                                    pass

                            if connected:
                                info = mt5.account_info()
                                if info and str(info.login) == str(login):
                                    telemetry_payload = {
                                        "balance": float(info.balance),
                                        "equity": float(info.equity),
                                        "margin": float(info.margin),
                                        "freeMargin": float(info.margin_free),
                                        "floatingPl": float(info.profit),
                                        "currency": str(info.currency)
                                    }
                                    
                                    # 1. Update database directly with zero latency
                                    execute_query(
                                        'UPDATE "Mt5Account" SET "connectionStatus" = %s, "lastHeartbeatAt" = %s, balance = %s, equity = %s, margin = %s, "freeMargin" = %s, "floatingPl" = %s, currency = %s, "provisioningError" = NULL WHERE id = %s',
                                        ('ONLINE', datetime.datetime.now(datetime.timezone.utc), info.balance, info.equity, info.margin, info.margin_free, info.profit, info.currency, acc['id'])
                                    )
                                    
                                    # 2. Also notify the API for real-time WebSocket events if reachable
                                    base_api = os.getenv('API_URL') or os.getenv('NEXT_PUBLIC_API_URL')
                                    ea_token = acc.get('ea_token')
                                    if base_api and ea_token:
                                        try:
                                            requests.post(
                                                f"{base_api}/accounts/telemetry",
                                                headers={"Authorization": f"Bearer {ea_token}"},
                                                json=telemetry_payload,
                                                timeout=5
                                            )
                                        except Exception as te:
                                            logger.debug(f"Telemetry API post error for {login}: {te}")
                                        
                                    # 3. Synchronize closed deals and update TradeSignal / TradeCopy profit & close status
                                    try:
                                        deals_from = datetime.datetime.now() - datetime.timedelta(hours=24)
                                        deals = mt5.history_deals_get(deals_from, datetime.datetime.now() + datetime.timedelta(hours=1))
                                        if deals:
                                            is_master = (acc.get('role') == 'MASTER')
                                            for d in deals:
                                                # entry == 1 is DEAL_ENTRY_OUT (exit deal)
                                                if getattr(d, 'entry', 0) == 1 and getattr(d, 'position_id', 0) > 0:
                                                    pos_id = int(d.position_id)
                                                    d_profit = float(d.profit)
                                                    d_price = float(d.price)
                                                    d_vol = float(d.volume)
                                                    if is_master:
                                                        execute_query(
                                                            'UPDATE "TradeSignal" SET profit = %s, "closePrice" = %s, "isClosed" = true WHERE ticket = %s AND ("isClosed" = false OR profit IS NULL)',
                                                            (d_profit, d_price, pos_id)
                                                        )
                                                    else:
                                                        execute_query(
                                                            'UPDATE "TradeCopy" SET profit = %s, "closePrice" = %s, "closedVolume" = %s, "currentVolume" = 0, state = %s WHERE ("subPositionId" = %s OR "subOrderTicket" = %s) AND ("currentVolume" > 0 OR profit IS NULL)',
                                                            (d_profit, d_price, d_vol, 'EXECUTED', pos_id, pos_id)
                                                        )
                                    except Exception as de:
                                        logger.debug(f"Deals sync error for {login}: {de}")

                                    # 4. Record periodic AccountSnapshot if none exists in last 30 minutes
                                    try:
                                        execute_query(
                                            '''
                                            INSERT INTO "AccountSnapshot" (id, "mt5AccountId", balance, equity, "floatingPl", timestamp, "createdAt")
                                            SELECT gen_random_uuid(), %s, %s, %s, %s, NOW(), NOW()
                                            WHERE NOT EXISTS (
                                                SELECT 1 FROM "AccountSnapshot"
                                                WHERE "mt5AccountId" = %s AND timestamp > NOW() - INTERVAL '30 minutes'
                                            )
                                            ''',
                                            (acc['id'], float(info.balance), float(info.equity), float(info.profit), acc['id'])
                                        )
                                    except Exception as se:
                                        logger.debug(f"Snapshot insert error for {login}: {se}")

                                    if acc.get('connectionStatus') != 'ONLINE':
                                        logger.info(f"Account {login} verified ONLINE on broker! Balance: {info.balance} {info.currency}")
                                        acc['connectionStatus'] = 'ONLINE'
                                mt5.shutdown()
                        except Exception as ie:
                            logger.debug(f"MT5 IPC telemetry poll error for {login}: {ie}")

                # 3. Check for provisioning timeouts (120s without ONLINE status)
                if acc.get('launch_time') and (current_time - acc['launch_time']) > 120:
                    if acc.get('connectionStatus') != 'ONLINE':
                        for row in rows:
                            if str(row.get('login')) == login:
                                if row.get('connectionStatus') == 'PROVISIONING':
                                    logger.error(f"Timeout: EA {login} never sent heartbeat after 120s. Killing process.")
                                    execute_query('UPDATE "Mt5Account" SET "connectionStatus" = %s, "provisioningError" = %s WHERE id = %s', ('FAILED', 'Connection timed out waiting for the broker chart to respond. Please check your MT5 login credentials and server name.', acc['id']))
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
        
        # Sleep before next poll or wake immediately on admin command
        sync_event.wait(timeout=5)
        sync_event.clear()

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
    logger.info(f"Keep-alive worker started. Will ping {ping_url} every 4 minutes to prevent Render dormancy.")
    
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
        
        # Sleep for 4 minutes (240 seconds) - safely below Render's 15-minute idle threshold
        time.sleep(240)

def kill_existing_terminals():
    """Aggressively terminate any running MT5 terminal64.exe processes to ensure a cold boot."""
    killed = 0
    for proc in psutil.process_iter(['pid', 'name']):
        name = (proc.info.get('name') or '').lower()
        if 'terminal64' in name or 'terminal.exe' in name:
            try:
                proc.kill()
                killed += 1
            except Exception as e:
                logger.warning(f"Failed to kill terminal process (PID {proc.info['pid']}): {e}")
    if killed > 0:
        logger.info(f"Killed {killed} existing terminal processes to ensure a clean state.")
        time.sleep(2)

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

    dirs_to_check = [
        Path(r"C:\Users\Plaiz\MT5_Instances"),
        Path(os.environ.get('APPDATA', 'C:\\Users\\Plaiz\\AppData\\Roaming')) / 'MetaQuotes' / 'Terminal'
    ]
    for terminal_dir in dirs_to_check:
        if not terminal_dir.exists():
            continue
        for child in terminal_dir.iterdir():
            target_configs = []
            if child.is_dir() and (child / 'config').exists():
                target_configs.append(child / 'config' / 'common.ini')
            elif child.is_dir() and child.name == 'Common':
                target_configs.append(child / 'common.ini')
            for common_ini_path in target_configs:
                content = f"[Experts]\nEnabled=1\nAccount=0\nProfile=0\nChart=0\nAllowDllImport=1\nWebRequest=1\nAllowWebRequest=1\nWebRequestUrl1={base_api_root}\n\n[Common]\n"
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

            # Also force patch terminal.ini in instances to ensure Account=0 and Enabled=1
            if child.is_dir() and (child / 'config').exists():
                term_ini = child / 'config' / 'terminal.ini'
                try:
                    t_content = (
                        "[Common]\nNewsEnable=0\nSoundEnable=0\n\n"
                        "[Charts]\nMaxBars=1000\n\n"
                        f"[Experts]\nEnabled=1\nAccount=0\nProfile=0\nChart=0\nAllowDllImport=1\nWebRequest=1\nAllowWebRequest=1\nWebRequestUrl1={base_api_root}\n"
                    )
                    term_ini.write_text(t_content, encoding='utf-16')
                except Exception:
                    pass

    # Clean out any pending liveupdate files to prevent MT5 restart/update freezes
    try:
        appdata_terminal = Path(os.environ.get('APPDATA', 'C:\\Users\\Plaiz\\AppData\\Roaming')) / 'MetaQuotes' / 'Terminal'
        if appdata_terminal.exists():
            for lu in appdata_terminal.glob('*/liveupdate'):
                if lu.is_dir():
                    for f in lu.iterdir():
                        try:
                            if f.is_file():
                                f.unlink()
                            elif f.is_dir():
                                shutil.rmtree(f, ignore_errors=True)
                        except Exception:
                            pass
    except Exception:
        pass


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
                    
                    if cmd == 'START':
                        # Reset failed accounts so poll_db_worker can retry them fresh
                        execute_query(
                            'UPDATE "Mt5Account" SET "connectionStatus" = %s, "provisioningError" = NULL WHERE "isActive" = true AND "connectionStatus" = %s',
                            ('PENDING', 'FAILED')
                        )
                        sync_event.set()
                        execute_query(
                            'UPDATE "VpsEnvironment" SET "commandStatus" = %s, "commandMessage" = %s, "lastHeartbeatAt" = now() WHERE id = %s',
                            ('EXECUTED', f'Bot engine awakened & fleet synchronized successfully at {datetime.datetime.now().strftime("%H:%M:%S")}', env_id)
                        )
                        logger.info("Bot engine awakened & instant fleet synchronization triggered.")
                        
                    elif cmd == 'SYNC':
                        sync_event.set()
                        execute_query(
                            'UPDATE "VpsEnvironment" SET "commandStatus" = %s, "commandMessage" = %s, "lastHeartbeatAt" = now() WHERE id = %s',
                            ('EXECUTED', f'Terminals synchronized with database at {datetime.datetime.now().strftime("%H:%M:%S")}', env_id)
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
                            'UPDATE "Mt5Account" SET "connectionStatus" = %s, "provisioningError" = NULL WHERE "isActive" = true AND "connectionStatus" = %s',
                            ('PENDING', 'FAILED')
                        )
                        sync_event.set()
                        execute_query(
                            'UPDATE "VpsEnvironment" SET "commandStatus" = %s, "commandMessage" = %s, "lastHeartbeatAt" = now() WHERE id = %s',
                            ('EXECUTED', f'Fleet cold-restarted successfully at {datetime.datetime.now().strftime("%H:%M:%S")}', env_id)
                        )
                        logger.info("Fleet cold restart complete.")
                        
                    elif cmd == 'STOP':
                        logger.info("Executing STOP command: Terminating all MT5 terminals...")
                        kill_existing_terminals()
                        active_terminals.clear()
                        execute_query(
                            'UPDATE "VpsEnvironment" SET "commandStatus" = %s, "commandMessage" = %s, "lastHeartbeatAt" = now() WHERE id = %s',
                            ('EXECUTED', f'All MT5 terminals safely stopped at {datetime.datetime.now().strftime("%H:%M:%S")}', env_id)
                        )
                        
                    elif cmd in ('PAUSE', 'RESUME'):
                        sync_event.set()
                        execute_query(
                            'UPDATE "VpsEnvironment" SET "commandStatus" = %s, "commandMessage" = %s, "lastHeartbeatAt" = now() WHERE id = %s',
                            ('EXECUTED', f'{cmd} state processed & synchronized at {datetime.datetime.now().strftime("%H:%M:%S")}', env_id)
                        )
                        logger.info(f"Processed {cmd} command and synchronized fleet.")
                        
                    else:
                        execute_query(
                            'UPDATE "VpsEnvironment" SET "commandStatus" = %s, "commandMessage" = %s, "lastHeartbeatAt" = now() WHERE id = %s',
                            ('FAILED', f'Unknown command {cmd} ignored at {datetime.datetime.now().strftime("%H:%M:%S")}', env_id)
                        )
                        logger.warning(f"Unknown command '{cmd}' marked as FAILED.")
        except Exception as e:
            logger.error(f"Error in command worker: {e}")
            
        time.sleep(2)


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

