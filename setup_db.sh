#!/bin/bash
set -e

ENV_FILE="/opt/trade-copier/.env"

echo "DATABASE_URL=\"postgres://postgres.gaqcjqgcwscshxicpgup:b89JVgY4J7w8RXAg@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true\"" > $ENV_FILE
echo "DIRECT_URL=\"postgres://postgres.gaqcjqgcwscshxicpgup:b89JVgY4J7w8RXAg@aws-1-eu-west-1.pooler.supabase.com:5432/postgres\"" >> $ENV_FILE

echo "JWT_ACCESS_SECRET=\"$(openssl rand -base64 32)\"" >> $ENV_FILE
echo "JWT_REFRESH_SECRET=\"$(openssl rand -base64 32)\"" >> $ENV_FILE
echo "EA_TOKEN_SIGNING_SECRET=\"$(openssl rand -base64 32)\"" >> $ENV_FILE
echo "NEXTAUTH_SECRET=\"$(openssl rand -base64 32)\"" >> $ENV_FILE
echo "NEXTAUTH_URL=\"http://127.0.0.1:3000\"" >> $ENV_FILE
echo "NODE_ENV=\"production\"" >> $ENV_FILE
echo "PORT=\"3001\"" >> $ENV_FILE
echo "FRONTEND_URL=\"http://127.0.0.1:3000\"" >> $ENV_FILE
echo "NEXT_PUBLIC_API_URL=\"http://127.0.0.1:3001\"" >> $ENV_FILE

chmod 600 $ENV_FILE
echo "Success"
