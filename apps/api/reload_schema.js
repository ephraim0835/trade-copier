const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: 'postgresql://postgres.gaqcjqgcwscshxicpgup:b89JVgY4J7w8RXAg@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });

async function main() {
  await prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema'`);
  console.log('Schema cache reloaded');
}
main().catch(console.error).finally(() => prisma.$disconnect());
