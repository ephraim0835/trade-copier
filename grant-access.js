require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function grantAccess() {
  const email = process.argv[2];
  if (!email) {
    console.error("Please provide an email address as an argument.");
    console.error("Example: node grant-access.js your-email@example.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  
  if (user) {
    // Elevate to ADMIN to bypass all subscription checks
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' }
    });
    
    // Create an internal free subscription
    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: 'pro',
        status: 'INTERNAL_FREE',
      }
    });
    console.log(`\n✅ Access granted successfully for: ${email}`);
    console.log("You can now refresh the dashboard and use all features!");
  } else {
    console.log(`\n❌ User with email ${email} not found.`);
    console.log("Make sure you have registered first!");
  }
}

grantAccess().catch(e => {
  console.error(e);
  process.exit(1);
});
