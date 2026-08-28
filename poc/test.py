import os
import subprocess
import time

terminal_path = r"C:\Program Files\MetaTrader 5\terminal64.exe"
data_path = r"C:\Users\Plaiz\AppData\Roaming\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075"

ini_content = """[Common]
Login=476554748
Password=@Soyini08
Server=Exness-MT5Trial9
CertInstall=0
[Charts]
Symbol=EURUSDm
Period=H1
Expert=MasterCopier
"""
with open("test_startup.ini", "w") as f:
    f.write(ini_content)

subprocess.Popen([terminal_path, "/config:test_startup.ini"])
print("Launched.")
