import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

// Use the DIRECT_URL (port 5432) to bypass the PgBouncer pooler,
// which is often firewall-blocked for local scripts.
const directUrl = (process.env.DIRECT_URL || process.env.DATABASE_URL || '')
  .replace(':6543/', ':5432/');

const prisma = new PrismaClient({ datasourceUrl: directUrl });

async function deleteEverything() {
  try {
    console.log("Deleting all records to reset DB...");
    await prisma.executionCommand.deleteMany({});
    await prisma.tradeCopy.deleteMany({});
    await prisma.tradeSignal.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.deal.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.position.deleteMany({});
    await prisma.copySettings.deleteMany({});
    await prisma.eaToken.deleteMany({});
    await prisma.accountSubscription.deleteMany({});
    await prisma.mt5Account.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.vpsEnvironment.deleteMany({});
    await prisma.user.deleteMany({});
    console.log("Successfully deleted all users and related data!");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

deleteEverything();
