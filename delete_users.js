const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteEverything() {
  try {
    console.log("Deleting all records to reset DB...");
    // Delete in order to respect foreign keys
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
    
    // Finally delete users
    await prisma.user.deleteMany({});
    console.log("Successfully deleted all users and related data!");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

deleteEverything();
