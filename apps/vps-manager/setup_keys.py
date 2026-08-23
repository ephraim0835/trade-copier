import os
import getpass
from pathlib import Path

def main():
    print("=== Supabase Keys Setup ===")
    print("Your input will be hidden as you type/paste for security.\n")
    
    url = getpass.getpass("Enter your SUPABASE_URL: ").strip()
    key = getpass.getpass("Enter your SUPABASE_SERVICE_ROLE_KEY: ").strip()
    
    if not url or not key:
        print("Error: Both URL and KEY are required. Run the script again.")
        return
        
    env_content = f'SUPABASE_URL="{url}"\nSUPABASE_SERVICE_ROLE_KEY="{key}"\n'
    
    # Paths to .env files
    vps_manager_env = Path('.env')
    root_env = Path('../../.env.vps')
    
    # Write to apps/vps-manager/.env
    with open(vps_manager_env, 'w') as f:
        f.write(env_content)
        
    # Write to root /.env.vps
    with open(root_env, 'w') as f:
        f.write(env_content)
        
    print("\n✅ Success! Your keys have been securely written to the .env files.")
    print("You can now run 'python manager.py' to start the manager.")

if __name__ == "__main__":
    main()
