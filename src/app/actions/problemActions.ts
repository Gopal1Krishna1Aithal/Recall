'use server';

import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { calculateSpacedRepetition } from '@/lib/spaced-repetition';

/**
 * Escapes HTML characters to prevent XSS.
 */
function sanitizeNote(note: string): string {
  return note
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Extracts a capitalized title from a LeetCode URL slug.
 * Example: https://leetcode.com/problems/two-sum/ -> "Two Sum"
 */
export async function extractTitleFromUrl(urlStr: string): Promise<string> {
  try {
    const url = new URL(urlStr.trim());
    const pathParts = url.pathname.split('/');
    const problemsIndex = pathParts.indexOf('problems');
    
    if (problemsIndex !== -1 && pathParts[problemsIndex + 1]) {
      const slug = pathParts[problemsIndex + 1];
      return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  } catch (error) {
    // If not a valid URL or parsing fails, return empty
  }
  return '';
}

/**
 * Logs a new DSA problem.
 */
export async function logProblemAction(formData: {
  lcUrl: string;
  title: string;
  note: string;
}) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized. Please sign in.' };
  }

  const { lcUrl, title, note } = formData;

  if (!lcUrl || !lcUrl.startsWith('http')) {
    return { success: false, error: 'Please enter a valid LeetCode URL.' };
  }
  if (!title || title.trim().length === 0) {
    return { success: false, error: 'Title is required.' };
  }
  if (!note || note.trim().length === 0) {
    return { success: false, error: 'Note is required.' };
  }
  if (note.length > 800) {
    return { success: false, error: 'Note cannot exceed 800 characters.' };
  }

  try {
    const escapedNote = sanitizeNote(note.trim());
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 1); // tomorrow

    const problem = await prisma.problemLog.create({
      data: {
        userId: session.userId,
        title: title.trim(),
        lcUrl: lcUrl.trim(),
        note: escapedNote,
        confidence: 3,
        intervalDays: 1,
        nextDue: nextDue,
      },
    });

    return { success: true, problem };
  } catch (error: any) {
    // Catch unique constraint violations for (user_id, lc_url)
    if (error.code === 'P2002') {
      return { success: false, error: 'You have already logged this problem URL.' };
    }
    console.error('Error creating problem log:', error);
    return { success: false, error: 'Failed to save problem. Please try again.' };
  }
}

/**
 * Submits a spaced repetition review rating.
 */
export async function submitReviewAction(
  problemId: string,
  rating: 'Blank' | 'Shaky' | 'GotIt',
  updatedNote?: string
) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    // Tenant Isolation check
    const problem = await prisma.problemLog.findFirst({
      where: {
        problemId: problemId,
        userId: session.userId,
      },
    });

    if (!problem) {
      return { success: false, error: 'Problem log not found or unauthorized.' };
    }

    // Spaced repetition calculation
    const { nextInterval, nextConfidence } = calculateSpacedRepetition({
      rating,
      currentInterval: problem.intervalDays,
      currentConfidence: problem.confidence,
    });

    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + nextInterval);

    const updatedData: any = {
      intervalDays: nextInterval,
      confidence: nextConfidence,
      nextDue: nextDue,
    };

    if (updatedNote !== undefined) {
      updatedData.note = sanitizeNote(updatedNote.trim());
    }

    // Transaction to update log and write history entry
    await prisma.$transaction([
      prisma.problemLog.update({
        where: { problemId },
        data: updatedData,
      }),
      prisma.revisionHistory.create({
        data: {
          problemId,
          rating,
        },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error submitting review:', error);
    return { success: false, error: 'Failed to record review.' };
  }
}

/**
 * Updates a problem's note directly.
 */
export async function updateProblemNoteAction(problemId: string, note: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized.' };
  }

  if (!note || note.trim().length === 0) {
    return { success: false, error: 'Note cannot be empty.' };
  }
  if (note.length > 800) {
    return { success: false, error: 'Note cannot exceed 800 characters.' };
  }

  try {
    const escapedNote = sanitizeNote(note.trim());

    // Update with tenant isolation
    const result = await prisma.problemLog.updateMany({
      where: {
        problemId,
        userId: session.userId,
      },
      data: {
        note: escapedNote,
      },
    });

    if (result.count === 0) {
      return { success: false, error: 'Problem not found or unauthorized.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating note:', error);
    return { success: false, error: 'Failed to update note.' };
  }
}

/**
 * Deletes a problem log.
 */
export async function deleteProblemAction(problemId: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    // Delete with tenant isolation
    const result = await prisma.problemLog.deleteMany({
      where: {
        problemId,
        userId: session.userId,
      },
    });

    if (result.count === 0) {
      return { success: false, error: 'Problem not found or unauthorized.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting problem:', error);
    return { success: false, error: 'Failed to delete problem.' };
  }
}

/**
 * Retrieves problems due today (or overdue).
 */
export async function getTodayQueueAction() {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  const now = new Date();

  return await prisma.problemLog.findMany({
    where: {
      userId: session.userId,
      nextDue: {
        lte: now,
      },
    },
    orderBy: {
      nextDue: 'asc',
    },
  });
}

/**
 * Retrieves all problems logged by the user.
 */
export async function getAllProblemsAction() {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  return await prisma.problemLog.findMany({
    where: {
      userId: session.userId,
    },
    orderBy: {
      nextDue: 'asc',
    },
  });
}
