const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function checkConfig() {
  console.log('--- 1. Checking Configuration ---');
  let envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) {
    envFile = path.join(__dirname, 'packages/database/.env');
  }
  
  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, 'utf8');
    const dbUrlMatch = content.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
    if (dbUrlMatch) {
      try {
        const url = new URL(dbUrlMatch[1]);
        const isPooler = url.port === '6543'; // Supavisor default port
        
        console.log(`Host: ${url.hostname}`);
        console.log(`Port: ${url.port}`);
        console.log(`Is Supavisor Pooler?: ${isPooler ? 'YES' : 'NO'}`);
        console.log(`Params: ${url.search}`);
        console.log(`Connection Limit param included: ${url.searchParams.has('connection_limit') ? 'YES (' + url.searchParams.get('connection_limit') + ')' : 'NO'}`);
        console.log(`PgBouncer param included: ${url.searchParams.has('pgbouncer') ? 'YES (' + url.searchParams.get('pgbouncer') + ')' : 'NO'}`);
        console.log(`Pool Timeout param included: ${url.searchParams.has('pool_timeout') ? 'YES (' + url.searchParams.get('pool_timeout') + ')' : 'NO'}`);
      } catch (e) {
        console.log('Failed to parse URL', e.message);
      }
    } else {
      console.log('DATABASE_URL not found in .env');
    }
  } else {
    console.log('No .env file found');
  }
}

async function testConnection() {
  console.log('\n--- 2. Minimal Connection Test ---');
  // Initialize PrismaClient with log to see connection attempts
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('Connecting...');
    await prisma.$connect();
    console.log('Connection successful!');
    
    console.log('Executing test query (SELECT 1)...');
    const result = await prisma.$queryRawUnsafe('SELECT 1 as result');
    console.log('Query result:', result);
    
    console.log('Test PASSED.');
  } catch (error) {
    console.log('Test FAILED.');
    console.log('Error Category:', error.name);
    console.log('Error Code:', error.code);
    console.log('Error Message:', error.message);
  } finally {
    console.log('Disconnecting...');
    await prisma.$disconnect();
  }
}

async function main() {
  await checkConfig();
  await testConnection();
}

main().catch(console.error);
