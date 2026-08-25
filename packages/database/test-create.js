const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

function encrypt(text) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'cefebc7648a25734178ba0d8f9e1a4c5c68f50abe38f86d38f03ce6509a01809', 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function testAction() {
  try {
    const user = await prisma.user.findFirst();
    console.log("Found user:", user.email, "role:", user.role);

    const account = await prisma.mt5Account.create({
      data: {
        userId: user.id,
        login: "123456",
        password: encrypt("password123"),
        broker: "Test Broker",
        server: "Test Server",
        role: "MASTER",
        isActive: false,
        isDemo: true,
      }
    });

    console.log("Successfully created MT5 Account:", account);
  } catch (error) {
    console.error("Failed:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAction();
