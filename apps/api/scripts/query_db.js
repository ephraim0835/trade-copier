const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.mt5Account.findMany({ include: { tokens: true } }).then(res => { 
  console.log(JSON.stringify(res, null, 2)); 
  prisma.$disconnect();
});
