import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const accounts = await prisma.mt5Account.findMany();
        console.log(JSON.stringify(accounts));
    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
