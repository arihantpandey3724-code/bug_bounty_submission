const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const treasures = await prisma.treasureBug.findMany();
    console.log('PRISMA TREASURES:', treasures);
  } catch (err) {
    console.error('PRISMA ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
