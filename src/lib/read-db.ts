import prisma from './db';

async function main() {
  const users = await prisma.user.findMany();
  console.log('All Users in DB:', JSON.stringify(users, null, 2));

  const problems = await prisma.problemLog.findMany();
  console.log('Total problems logged:', problems.length);
}

main().then(() => process.exit(0));
