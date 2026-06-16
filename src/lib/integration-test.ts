import prisma from './db';
import { calculateSpacedRepetition } from './spaced-repetition';

async function runTests() {
  console.log('Starting integration tests...');

  // Clean up any test users
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['user-a@test.com', 'user-b@test.com']
      }
    }
  });

  // 1. Create Test Users
  const userA = await prisma.user.create({
    data: {
      email: 'user-a@test.com',
    }
  });
  console.log('User A created:', userA.userId);

  const userB = await prisma.user.create({
    data: {
      email: 'user-b@test.com',
    }
  });
  console.log('User B created:', userB.userId);

  // 2. Log a problem for User A
  const problemA1 = await prisma.problemLog.create({
    data: {
      userId: userA.userId,
      title: 'Two Sum',
      lcUrl: 'https://leetcode.com/problems/two-sum/',
      note: 'Use a hash map to find the complement in O(N).',
      confidence: 3,
      intervalDays: 1,
      nextDue: new Date(),
    }
  });
  console.log('Logged problem for User A:', problemA1.problemId);

  // Verify duplicate prevention on (userId, lcUrl)
  try {
    await prisma.problemLog.create({
      data: {
        userId: userA.userId,
        title: 'Two Sum Duplicate',
        lcUrl: 'https://leetcode.com/problems/two-sum/', // Same URL for same user
        note: 'Duplicate URL',
        confidence: 3,
        intervalDays: 1,
      }
    });
    throw new Error('Allowed duplicate URL for User A (FAILED)');
  } catch (err: any) {
    if (err.message && err.message.includes('FAILED')) {
      throw err;
    }
    console.log('Duplicate URL check passed (Prevented correctly).');
  }

  // Verify that User B can log the SAME LeetCode URL without conflict
  const problemB1 = await prisma.problemLog.create({
    data: {
      userId: userB.userId,
      title: 'Two Sum B',
      lcUrl: 'https://leetcode.com/problems/two-sum/', // Same URL, different user
      note: 'User B note',
      confidence: 3,
      intervalDays: 1,
    }
  });
  console.log('Logged same URL for User B (Isolated correctly):', problemB1.problemId);

  // 3. Test Tenant Isolation for Updates / Deletes
  // Let's verify that updating a problem with updateMany/deleteMany is scoped to user_id
  const nonExistentUpdate = await prisma.problemLog.updateMany({
    where: {
      problemId: problemA1.problemId,
      userId: userB.userId, // User B trying to update User A's problem
    },
    data: {
      note: 'Hacked note',
    }
  });
  if (nonExistentUpdate.count !== 0) {
    throw new Error('Tenant isolation breach! User B was able to update User A\'s note.');
  }
  console.log('Tenant isolation for update check passed.');

  // Try to delete User A's problem as User B
  const nonExistentDelete = await prisma.problemLog.deleteMany({
    where: {
      problemId: problemA1.problemId,
      userId: userB.userId, // User B trying to delete User A's problem
    }
  });
  if (nonExistentDelete.count !== 0) {
    throw new Error('Tenant isolation breach! User B was able to delete User A\'s problem.');
  }
  console.log('Tenant isolation for delete check passed.');

  // 4. Verify Spaced Repetition Updates
  // Submit a "Got It" rating for User A's problem
  const rating = 'GotIt';
  const { nextInterval, nextConfidence } = calculateSpacedRepetition({
    rating,
    currentInterval: problemA1.intervalDays,
    currentConfidence: problemA1.confidence,
  });

  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + nextInterval);

  await prisma.$transaction([
    prisma.problemLog.update({
      where: { problemId: problemA1.problemId },
      data: {
        intervalDays: nextInterval,
        confidence: nextConfidence,
        nextDue: nextDue,
      },
    }),
    prisma.revisionHistory.create({
      data: {
        problemId: problemA1.problemId,
        rating,
      },
    }),
  ]);

  const updatedProblem = await prisma.problemLog.findUnique({
    where: { problemId: problemA1.problemId }
  });

  if (!updatedProblem || updatedProblem.confidence !== 4 || updatedProblem.intervalDays !== 4) {
    throw new Error('Spaced repetition state update failed in database.');
  }
  console.log('Spaced repetition updates correctly applied to database.');

  // 5. Verify Custom Interval Override
  const customIntervalDays = 7;
  const customNextDue = new Date();
  customNextDue.setDate(customNextDue.getDate() + customIntervalDays);

  await prisma.problemLog.update({
    where: { problemId: problemA1.problemId },
    data: {
      intervalDays: customIntervalDays,
      confidence: 5,
      nextDue: customNextDue,
    }
  });

  const customUpdated = await prisma.problemLog.findUnique({
    where: { problemId: problemA1.problemId }
  });

  if (!customUpdated || customUpdated.intervalDays !== 7) {
    throw new Error('Custom interval override failed to update in database.');
  }
  console.log('Custom interval override updates correctly verified.');

  // Clean up
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['user-a@test.com', 'user-b@test.com']
      }
    }
  });
  console.log('Cleaned up test data.');
  console.log('All integration tests passed successfully!');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Integration test failed:', err);
    process.exit(1);
  });
