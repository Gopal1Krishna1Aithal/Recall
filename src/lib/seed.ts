import prisma from './db';

async function seed() {
  console.log('Seeding sample data for local testing...');

  // Clean up existing test data for test@example.com
  const existingUser = await prisma.user.findUnique({
    where: { email: 'test@example.com' }
  });

  if (existingUser) {
    await prisma.user.delete({
      where: { userId: existingUser.userId }
    });
    console.log('Cleared existing test@example.com data.');
  }

  // Create user
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
    }
  });
  console.log('Created user test@example.com:', user.userId);

  const now = new Date();
  
  // Problem 1: Due Today
  const dueToday1 = new Date(now);
  dueToday1.setHours(dueToday1.getHours() - 2); // Make it due a couple hours ago

  await prisma.problemLog.create({
    data: {
      userId: user.userId,
      title: 'Two Sum',
      lcUrl: 'https://leetcode.com/problems/two-sum/',
      note: 'Use a Hash Map to store complement of target and current index. Reduces time complexity to O(N) and space complexity to O(N).',
      confidence: 3,
      intervalDays: 1,
      nextDue: dueToday1,
    }
  });

  // Problem 2: Due Today
  const dueToday2 = new Date(now);
  dueToday2.setHours(dueToday2.getHours() - 1); // Make it due an hour ago

  await prisma.problemLog.create({
    data: {
      userId: user.userId,
      title: 'Reverse Linked List',
      lcUrl: 'https://leetcode.com/problems/reverse-linked-list/',
      note: 'Use three pointers: prev, curr, and next. Iterate and reverse links in-place. Time: O(N), Space: O(1).',
      confidence: 4,
      intervalDays: 2,
      nextDue: dueToday2,
    }
  });

  // Problem 3: Due Tomorrow
  const dueTomorrow = new Date(now);
  dueTomorrow.setDate(dueTomorrow.getDate() + 1); // Due tomorrow

  await prisma.problemLog.create({
    data: {
      userId: user.userId,
      title: 'Valid Anagram',
      lcUrl: 'https://leetcode.com/problems/valid-anagram/',
      note: 'Use a single frequency tracker of size 26 for lowercase characters. Increment count for string s, decrement for string t.',
      confidence: 5,
      intervalDays: 4,
      nextDue: dueTomorrow,
    }
  });

  console.log('Sample problems seeded successfully!');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
