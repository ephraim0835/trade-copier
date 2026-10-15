import os
import sys
import time
import subprocess
import psutil
import win32gui
import win32con
import win32process
from pathlib import Path
import shutil

TERMINAL_EXE = r"C:\Program Files\MetaTrader 5\terminal64.exe"

# All brokers from broker-combobox.tsx with clean search queries
BROKER_SEARCH_QUERIES = [
    # Top African & Global
    "Exness Technologies",
    "Deriv",
    "HF Markets",
    "XM Global",
    "Octa Markets",
    "ForexTime",
    "FBS Markets",
    "Just Global Markets",
    "Kwakol Markets",
    "LiteFinance",
    "InstaFintech",
    "Infinox",
    # Global & ECN
    "IC Markets",
    "Pepperstone",
    "Tickmill",
    "Vantage Global",
    "FP Markets",
    "FxPro",
    "RoboForex",
    "Avatrade",
    "Alpari",
    "Axi",
    "Admirals",
    "BlackBull Markets",
    "Capital.com",
    "EagleFX",
    "Fusion Markets",
    "Moneta Markets",
    "AXIORY",
    "Trade Nation",
    "Equiti",
    "Blueberry Markets",
    "Skilling",
    "BDSwiss",
    "IronFX",
    "ThinkMarkets",
    "Tradeview",
    "GO Markets",
    "AMarkets",
    "MultiBank Group",
    "NordFX",
    "SuperForex",
    "Weltrade",
    "Windsor Brokers",
    # Prop Firms
    "FTMO",
    "Funding Pips",
    "FundedNext",
    "Eightcap",
    "Alpha Capital Group",
    "The Funded Trader",
    "MyFundedFX",
    "E8 Funding",
    "True Forex Funds",
    "SurgeTrader",
    "Fidelcrest",
    "Topstep",
    "KortanaFX",
    "Nova Funding",
    "Infinity Forex Funds",
    "Quantec",
    "The Trading Pit",
    "MetaQuotes"
]

def find_child_by_id(parent, ctrl_id):
    result = []
    def enum_cb(h, _):
        if win32gui.GetDlgCtrlID(h) == ctrl_id:
            result.append(h)
        return True
    win32gui.EnumChildWindows(parent, enum_cb, None)
    return result[0] if result else None

def sync_brokers():
    print(f"=== Starting Sync for {len(BROKER_SEARCH_QUERIES)} Brokers ===")
    
    # Terminate any running MT5 instances
    for p in psutil.process_iter():
        if 'terminal' in p.name().lower():
            try: p.kill()
            except: pass
    time.sleep(2)

    print("Launching MT5 to query MetaQuotes broker directory...")
    proc = subprocess.Popen([TERMINAL_EXE])
    
    main_hwnd = None
    start = time.time()
    while time.time() - start < 25:
        def cb(h, extra):
            if win32gui.IsWindowVisible(h):
                if 'MetaQuotes' in win32gui.GetClassName(h):
                    extra.append(h)
            return True
        found = []
        win32gui.EnumWindows(cb, found)
        if found:
            main_hwnd = found[0]
            break
        time.sleep(1)
        
    if not main_hwnd:
        print("ERROR: Failed to find MT5 main window!")
        proc.kill()
        return False

    print(f"MT5 main window found (HWND {main_hwnd}). Waiting for interface...")
    time.sleep(3)

    # Dismiss login modal if present
    def close_login(h, _):
        if win32gui.GetWindowText(h) == 'Login':
            win32gui.PostMessage(h, win32con.WM_COMMAND, 2, 0)
        return True
    win32gui.EnumWindows(close_login, None)
    time.sleep(1)

    # Open 'Open an Account' wizard (command 32919)
    print("Opening Account Wizard...")
    win32gui.PostMessage(main_hwnd, win32con.WM_COMMAND, 32919, 0)
    time.sleep(2)

    wizard_dlg = None
    for _ in range(15):
        def find_wizard(h, extra):
            if win32gui.GetWindowText(h) == 'Open an Account':
                extra.append(h)
            return True
        dialogs = []
        win32gui.EnumWindows(find_wizard, dialogs)
        if dialogs:
            wizard_dlg = dialogs[0]
            break
        time.sleep(0.5)

    if not wizard_dlg:
        print("ERROR: Failed to find wizard dialog!")
        proc.kill()
        return False

    print(f"Wizard dialog found (HWND {wizard_dlg}). Beginning batch broker download...")

    success_count = 0
    total = len(BROKER_SEARCH_QUERIES)

    for idx, broker in enumerate(BROKER_SEARCH_QUERIES, 1):
        print(f"\n[{idx}/{total}] Searching broker: '{broker}'")
        edit_hwnd = find_child_by_id(wizard_dlg, 10814)
        find_btn_hwnd = find_child_by_id(wizard_dlg, 10815)
        list_hwnd = find_child_by_id(wizard_dlg, 10729)
        next_btn_hwnd = find_child_by_id(wizard_dlg, 12324)

        if not edit_hwnd or not find_btn_hwnd or not list_hwnd:
            back_btn = find_child_by_id(wizard_dlg, 12323)
            if back_btn:
                win32gui.SendMessage(back_btn, win32con.BM_CLICK, 0, 0)
                time.sleep(1)
            edit_hwnd = find_child_by_id(wizard_dlg, 10814)
            find_btn_hwnd = find_child_by_id(wizard_dlg, 10815)
            list_hwnd = find_child_by_id(wizard_dlg, 10729)
            next_btn_hwnd = find_child_by_id(wizard_dlg, 12324)

        if not edit_hwnd:
            print(f"  Warning: Controls unavailable for {broker}, skipping.")
            continue

        # Set text and search
        win32gui.SendMessage(edit_hwnd, win32con.WM_SETTEXT, 0, broker)
        time.sleep(0.2)
        win32gui.SendMessage(find_btn_hwnd, win32con.BM_CLICK, 0, 0)

        # Wait for search results
        has_results = False
        for _ in range(6):
            time.sleep(0.8)
            count = win32gui.SendMessage(list_hwnd, 0x1000 + 4, 0, 0) # LVM_GETITEMCOUNT
            if count > 1:
                has_results = True
                print(f"  Found {count} matches from MetaQuotes directory.")
                break

        if has_results:
            # Select second item (the first matched broker result)
            win32gui.SendMessage(list_hwnd, win32con.WM_KEYDOWN, win32con.VK_DOWN, 0)
            win32gui.SendMessage(list_hwnd, win32con.WM_KEYUP, win32con.VK_DOWN, 0)
            time.sleep(0.3)

            # Click Next > to download server definitions into local cache
            win32gui.SendMessage(next_btn_hwnd, win32con.BM_CLICK, 0, 0)
            time.sleep(2.5) # allow MT5 network thread to download profiles

            # Click < Back
            back_btn = find_child_by_id(wizard_dlg, 12323)
            if back_btn:
                win32gui.SendMessage(back_btn, win32con.BM_CLICK, 0, 0)
                time.sleep(0.8)

            success_count += 1
        else:
            print(f"  No extra matches for '{broker}' (might be single default or already indexed).")

    # Cancel and close
    print("\nBatch download complete. Closing wizard...")
    cancel_btn = find_child_by_id(wizard_dlg, 2)
    if cancel_btn:
        win32gui.SendMessage(cancel_btn, win32con.BM_CLICK, 0, 0)
    time.sleep(1)

    print("Closing MT5 gracefully to write updated servers.dat to disk...")
    win32gui.SendMessage(main_hwnd, win32con.WM_CLOSE, 0, 0)
    time.sleep(4)

    for p in psutil.process_iter():
        if 'terminal' in p.name().lower():
            try: p.kill()
            except: pass

    # Find the newly generated servers.dat
    terminals_dir = Path(os.environ.get('APPDATA', 'C:\\Users\\Plaiz\\AppData\\Roaming')) / 'MetaQuotes' / 'Terminal'
    dirs = [d for d in terminals_dir.iterdir() if d.is_dir() and d.name not in ['Common', 'Community'] and (d / 'config' / 'servers.dat').exists()]
    if not dirs:
        print("ERROR: Could not find active terminal data directory with servers.dat!")
        return False

    latest_dir = max(dirs, key=lambda d: (d / 'config' / 'servers.dat').stat().st_mtime)
    source_dat = latest_dir / 'config' / 'servers.dat'
    dat_size = source_dat.stat().st_size
    print(f"\nSUCCESS: Master servers.dat generated! Size: {dat_size:,} bytes at {source_dat}")

    # 1. Base MT5 Program Files (optional, requires admin)
    base_config = Path("C:/Program Files/MetaTrader 5/Config")
    try:
        if base_config.exists():
            shutil.copy2(source_dat, base_config / "servers.dat")
            print(f"Copied master servers.dat to {base_config / 'servers.dat'}")
    except PermissionError:
        print("Note: Skipped copying to Program Files (requires Admin rights, not needed for portable instances).")

    # 2. Project repository copy
    repo_copy = Path(__file__).parent / "servers.dat"
    shutil.copy2(source_dat, repo_copy)
    print(f"Copied master servers.dat to {repo_copy}")

    # 3. All existing MT5_Instances
    instances_dir = Path("C:/Users/Plaiz/MT5_Instances")
    if instances_dir.exists():
        for inst in instances_dir.iterdir():
            if inst.is_dir():
                (inst / 'config').mkdir(parents=True, exist_ok=True)
                shutil.copy2(source_dat, inst / 'config' / 'servers.dat')
                print(f"Synced servers.dat into active instance {inst.name}")

    print(f"\n=== All {success_count}/{total} brokers indexed and ready for automated trading! ===")
    return True

if __name__ == '__main__':
    sync_brokers()
