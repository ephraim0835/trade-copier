const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function main() {
  console.log("Verifying development environment...");
  if (process.env.NODE_ENV !== 'development' && process.env.DEMO_ONLY !== 'true') {
    throw new Error("This is not a development environment. Aborting.");
  }

  const seedPassword = process.env.DEV_SEED_PASSWORD || "TestPassword123!";
  const hash = await argon2.hash(seedPassword);

  const users = await prisma.user.findMany();
  let updatedCount = 0;

  for (const user of users) {
    if (user.password === 'dummy' || user.password === 'hashedpassword') {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hash }
      });
      console.log(`Updated password for user: ${user.email}`);
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} development users with Argon2id hashes.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
