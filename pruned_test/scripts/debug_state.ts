const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();

  const cmds = await p.executionCommand.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (cmds.length === 0) {
    console.log('No ExecutionCommands found.');
  } else {
    cmds.forEach((c: any) => {
      console.log('---');
      console.log('CMD:', c.id);
      console.log('  Status    :', c.status);
      console.log('  Type      :', c.type);
      console.log('  SubAcctId :', c.subAccountId);
      console.log('  Expires   :', c.expiresAt);
      console.log('  CreatedAt :', c.createdAt);
      console.log('  Delivered :', c.deliveredAt);
      console.log('  Executed  :', c.executedAt);
    });
  }

  const accounts = await p.mt5Account.findMany();
  console.log('\n--- Mt5Accounts ---');
  accounts.forEach((a: any) => {
    console.log(`  ID: ${a.id} | Role: ${a.role} | Demo: ${a.isDemo} | Active: ${a.isActive}`);
  });

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
