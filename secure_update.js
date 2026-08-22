const readline = require('readline');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.query = "Enter the new Supabase database password: ";
rl.stdoutMuted = true;

rl._writeToOutput = function _writeToOutput(stringToWrite) {
  if (rl.stdoutMuted)
    rl.output.write("\x1B[2K\x1B[200D" + rl.query + "*".repeat(rl.line.length));
  else
    rl.output.write(stringToWrite);
};

rl.question(rl.query, function(password) {
  rl.stdoutMuted = false;
  const cleanPassword = password.trim();
  
  console.log('\n[Secure Update] URL-encoding password...');
  const encodedPassword = encodeURIComponent(cleanPassword).replace(/[!'()*~.-]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });
  
  const sshKey = "C:\\Users\\Plaiz\\Downloads\\ssh-key-2026-08-20.key";
  const sshUserHost = "opc@84.12.94.57";
  
  // Use the pooler connection string you provided
  const newDbUrl = `postgresql://postgres.gaqcjqgcwscshxicpgup:${encodedPassword}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
  
  const shContent = `#!/bin/bash
set -e

# Replace the entire DATABASE_URL and DIRECT_URL lines
sed -i -E "s|^DATABASE_URL=.*|DATABASE_URL=\\"${newDbUrl}\\"|g" /opt/trade-copier/.env
sed -i -E "s|^DIRECT_URL=.*|DIRECT_URL=\\"${newDbUrl}\\"|g" /opt/trade-copier/.env

echo "[Secure Update] .env updated securely."
echo "[Secure Update] Recreating API container to apply new .env file..."
cd /opt/trade-copier
# CRITICAL FIX: docker compose restart does NOT reload .env files!
# We MUST use docker compose up -d to recreate the container with the new variables.
docker compose up -d api
sleep 8
echo "[Secure Update] API Logs (Verification):"
docker compose logs api --tail=30
`;

  const tempScriptPath = path.join(__dirname, 'temp_secure_update.sh');
  
  try {
    fs.writeFileSync(tempScriptPath, shContent, { mode: 0o700 });
    console.log("[Secure Update] Transferring script to VPS...");
    execSync(`scp -i "${sshKey}" "${tempScriptPath}" ${sshUserHost}:/tmp/temp_secure_update.sh`, { stdio: 'inherit' });
    console.log("[Secure Update] Executing script securely on the VPS...");
    execSync(`ssh -i "${sshKey}" ${sshUserHost} "bash /tmp/temp_secure_update.sh && rm /tmp/temp_secure_update.sh"`, { stdio: 'inherit' });
    console.log("\n[Secure Update] Complete!");
  } catch (err) {
    console.error("\n[Secure Update] Connection or command failed.", err.message);
  } finally {
    if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath);
  }
  
  rl.close();
});
