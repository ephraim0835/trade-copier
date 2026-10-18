import os
import shutil
import subprocess
from pathlib import Path

ea_dir = Path("c:/Users/Plaiz/Documents/Projects/Trade copier 1.0!/apps/ea")
sub_ea = ea_dir / "SubCopier.mq5"
master_ea = ea_dir / "MasterCopier.mq5"
wininet = ea_dir / "WinInet.mqh"
mqljson = ea_dir / "MqlJson.mqh"

instances_dir = Path("C:/Users/Plaiz/MT5_Instances")

for instance in instances_dir.iterdir():
    if not instance.is_dir():
        continue
    
    metaeditor = instance / 'metaeditor64.exe'
    if not metaeditor.exists():
        continue
    
    experts_dir = instance / 'MQL5' / 'Experts'
    if not experts_dir.exists():
        continue
    
    # Copy shared includes to Experts and Include
    if wininet.exists():
        shutil.copy2(wininet, experts_dir / 'WinInet.mqh')
        include_dir = instance / 'MQL5' / 'Include'
        if include_dir.exists():
            shutil.copy2(wininet, include_dir / 'WinInet.mqh')
    if mqljson.exists():
        shutil.copy2(mqljson, experts_dir / 'MqlJson.mqh')
        include_dir = instance / 'MQL5' / 'Include'
        if include_dir.exists():
            shutil.copy2(mqljson, include_dir / 'MqlJson.mqh')
    
    # SubCopier
    target_sub = experts_dir / 'SubCopier.mq5'
    if target_sub.exists() or (instance / 'startup.ini').exists():
        shutil.copy2(sub_ea, target_sub)
        print(f"Compiling SubCopier in {instance.name}...")
        cmd = [str(metaeditor), f"/compile:{target_sub}", f"/inc:{instance / 'MQL5'}", "/log"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        compiled = experts_dir / 'SubCopier.ex5'
        print(f"  SubCopier.ex5 compiled: {compiled.exists()}")
    
    # MasterCopier
    target_master = experts_dir / 'MasterCopier.mq5'
    if target_master.exists():
        shutil.copy2(master_ea, target_master)
        print(f"Compiling MasterCopier in {instance.name}...")
        cmd = [str(metaeditor), f"/compile:{target_master}", f"/inc:{instance / 'MQL5'}", "/log"]
        res = subprocess.run(cmd, capture_output=True, text=True)
        compiled = experts_dir / 'MasterCopier.ex5'
        print(f"  MasterCopier.ex5 compiled: {compiled.exists()}")

# Also copy compiled binaries to apps/ea and apps/vps-manager
for inst in instances_dir.iterdir():
    sub_ex5 = inst / 'MQL5' / 'Experts' / 'SubCopier.ex5'
    if sub_ex5.exists():
        shutil.copy2(sub_ex5, ea_dir / 'SubCopier.ex5')
        shutil.copy2(sub_ex5, Path("c:/Users/Plaiz/Documents/Projects/Trade copier 1.0!/apps/vps-manager/SubCopier.ex5"))
        break

for inst in instances_dir.iterdir():
    master_ex5 = inst / 'MQL5' / 'Experts' / 'MasterCopier.ex5'
    if master_ex5.exists():
        shutil.copy2(master_ex5, ea_dir / 'MasterCopier.ex5')
        shutil.copy2(master_ex5, Path("c:/Users/Plaiz/Documents/Projects/Trade copier 1.0!/apps/vps-manager/MasterCopier.ex5"))
        break

print("All compilations and distributions complete!")
