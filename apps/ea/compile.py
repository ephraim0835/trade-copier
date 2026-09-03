import os
import shutil
import subprocess
from pathlib import Path

instances_dir = Path("C:/Users/Plaiz/MT5_Instances")
source_ea = Path("C:/Users/Plaiz/Documents/Projects/Trade copier 1.0!/apps/ea/SubCopier.mq5")

for instance in instances_dir.iterdir():
    if not instance.is_dir(): continue
    
    metaeditor = instance / 'metaeditor64.exe'
    if not metaeditor.exists(): continue
    
    target_ea = instance / 'MQL5' / 'Experts' / 'SubCopier.mq5'
    if target_ea.exists():
        shutil.copy2(source_ea, target_ea)
        print(f"Compiling in {instance.name}...")
        cmd = [str(metaeditor), f"/compile:{target_ea}", f"/inc:{instance / 'MQL5'}"]
        subprocess.run(cmd, capture_output=True)
        print("Done.")
