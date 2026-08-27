const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.gaqcjqgcwscshxicpgup:b89JVgY4J7w8RXAg@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
    }
  }
});

async function main() {
  const settings = await prisma.copySettings.findMany();
  console.log("CopySettings:", settings);
}

main().catch(console.error).finally(() => prisma.$disconnect());
