const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Master and Sub accounts with EA Tokens...');

  // Create demo user
  let user = await prisma.user.findUnique({ where: { email: 'demo6@copier.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: 'demo6@copier.com', password: 'hashedpassword', role: 'USER' }
    });
  }

  // 1. Create Master Account
  let master = await prisma.mt5Account.findFirst({ where: { login: '10001', role: 'MASTER' } });
  if (!master) {
    master = await prisma.mt5Account.create({
      data: { userId: user.id, login: '10001', broker: 'MetaQuotes', server: 'Demo', role: 'MASTER', isDemo: true, isActive: true }
    });
  }

  // 2. Create Sub Account
  let sub = await prisma.mt5Account.findFirst({ where: { login: '20002', role: 'SUB' } });
  if (!sub) {
    sub = await prisma.mt5Account.create({
      data: { userId: user.id, login: '20002', broker: 'MetaQuotes', server: 'Demo', role: 'SUB', isDemo: true, isActive: true }
    });
  }

  // Add CopySettings to Sub
  let settings = await prisma.copySettings.findUnique({ where: { mt5AccountId: sub.id } });
  if (!settings) {
    await prisma.copySettings.create({
      data: { mt5AccountId: sub.id, riskPercentage: 1.0 }
    });
  }

  // 3. Generate EA Tokens (We will use fixed secrets for testing)
  // Token format: tokenId.secret
  // Secret is just 'secret123'
  const secret = 'secret123';
  const hashedSecret = await bcrypt.hash(secret, 10);

  // Master Token
  const masterTokenId = 'master-token-id';
  await prisma.eaToken.deleteMany({ where: { id: masterTokenId } });
  await prisma.eaToken.create({
    data: { id: masterTokenId, mt5AccountId: master.id, tokenHash: hashedSecret }
  });

  // Sub Token
  const subTokenId = 'sub-token-id';
  await prisma.eaToken.deleteMany({ where: { id: subTokenId } });
  await prisma.eaToken.create({
    data: { id: subTokenId, mt5AccountId: sub.id, tokenHash: hashedSecret }
  });

  console.log('\n--- Seeding Complete ---');
  console.log('Master Token: ' + masterTokenId + '.' + secret);
  console.log('Sub Token:    ' + subTokenId + '.' + secret);
  console.log('\nPlease use these tokens in your MT5 Terminal parameters for testing.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());
