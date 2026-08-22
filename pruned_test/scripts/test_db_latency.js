const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

async function test(url, name) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  const start = Date.now();
  try {
    const res = await p.executionCommand.findMany({ take: 1 });
    console.log(`[${name}] Response Time: ${Date.now() - start} ms`);
  } catch (e) {
    console.error(`[${name}] Error: ${e.message} (${Date.now() - start} ms)`);
  } finally {
    await p.$disconnect();
  }
}

async function run() {
  console.log('Testing PgBouncer vs Direct...');
  await test(env.DATABASE_URL, 'PgBouncer :6543');
  await test(env.DIRECT_URL, 'Direct PostgreSQL :5432');
}

run();
