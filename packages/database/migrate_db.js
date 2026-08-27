const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const results = [];
    
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "CopySettings" RENAME COLUMN "riskMultiplier" TO "riskPercentage"');
      results.push('Renamed CopySettings');
    } catch (e) { results.push('CopySettings: ' + e.message); }

    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "CopySettings" ALTER COLUMN "riskPercentage" SET DEFAULT 1.0');
      results.push('Set Default');
    } catch (e) { results.push('Set Default: ' + e.message); }

    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "AccountSubscription" RENAME COLUMN "riskMultiplier" TO "riskPercentage"');
      results.push('Renamed AccountSubscription');
    } catch (e) { results.push('AccountSubscription: ' + e.message); }

    console.log(results);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
