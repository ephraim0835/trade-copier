$ErrorActionPreference = 'Stop'
$regions = 'eu-west-1','eu-west-2','us-east-1','us-west-1','eu-central-1','ap-southeast-1','ap-south-1','ap-northeast-1','sa-east-1','ca-central-1','us-east-2'

foreach ($r in $regions) {
    Write-Host "Testing region: $r"
    $env:DATABASE_URL = "postgresql://postgres.gaqcjqgcwscshxicpgup:b89JVgY4J7w8RXAg@aws-0-$r.pooler.supabase.com:6543/postgres?pgbouncer=true"
    $env:DIRECT_URL = "postgresql://postgres.gaqcjqgcwscshxicpgup:b89JVgY4J7w8RXAg@aws-0-$r.pooler.supabase.com:5432/postgres"
    
    # Run prisma db pull
    try {
        npx prisma db pull 2>&1 | Out-String -OutVariable output
        if ($LASTEXITCODE -eq 0) {
            Write-Host "SUCCESS: Region is $r"
            exit 0
        } else {
            if ($output -match "FATAL" -or $output -match "Can't reach") {
                Write-Host "FAILED: $r"
            } else {
                Write-Host "OTHER ERROR in ${r}: $output"
            }
        }
    } catch {
        Write-Host "CATCH ERROR in ${r}: $_"
    }
}
Write-Host "Could not find valid region."
