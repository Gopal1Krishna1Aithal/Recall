'use server';

import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { calculateSpacedRepetition } from '@/lib/spaced-repetition';
import crypto from 'crypto';

/**
 * Escapes HTML characters to prevent XSS.
 */
function sanitizeNote(note: string): string {
  return note;
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
  tags?: string;
}) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized. Please sign in.' };
  }

  const { lcUrl, title, note, tags } = formData;

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
        tags: tags && tags.trim().length > 0 ? tags.trim() : null,
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
  updatedNote?: string,
  customIntervalDays?: number,
  failureReason?: string,
  sketch?: string
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

    // Spaced repetition calculation or custom override
    let nextInterval = customIntervalDays;
    let nextConfidence = problem.confidence;

    if (nextInterval === undefined || nextInterval === null) {
      const result = calculateSpacedRepetition({
        rating,
        currentInterval: problem.intervalDays,
        currentConfidence: problem.confidence,
      });
      nextInterval = result.nextInterval;
      nextConfidence = result.nextConfidence;
    } else {
      // Adjust confidence rating based on the rating option selected
      if (rating === 'Blank') {
        nextConfidence = Math.max(1, problem.confidence - 1);
      } else if (rating === 'GotIt') {
        nextConfidence = Math.min(5, problem.confidence + 1);
      }
    }

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
          failureReason: failureReason || null,
          sketch: sketch || null,
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
    include: {
      history: {
        orderBy: {
          reviewedAt: 'desc',
        },
      },
    },
    orderBy: {
      nextDue: 'asc',
    },
  });
}

/**
 * Calculates the current consecutive day review streak for the user.
 */
export async function getReviewStreakAction(timezone?: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, streak: 0 };
  }

  try {
    const history = await prisma.revisionHistory.findMany({
      where: {
        problem: {
          userId: session.userId,
        },
      },
      select: {
        reviewedAt: true,
      },
      orderBy: {
        reviewedAt: 'desc',
      },
    });

    if (history.length === 0) {
      return { success: true, streak: 0 };
    }

    const tz = timezone || 'UTC';

    // Helper to format Date in target timezone
    const getLocalDateStr = (d: Date) => {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const parts = formatter.formatToParts(d);
        const year = parts.find(p => p.type === 'year')!.value;
        const month = parts.find(p => p.type === 'month')!.value;
        const day = parts.find(p => p.type === 'day')!.value;
        return `${year}-${month}-${day}`;
      } catch (e) {
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const date = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${date}`;
      }
    };

    const uniqueDates = new Set<string>();
    for (const record of history) {
      uniqueDates.add(getLocalDateStr(record.reviewedAt));
    }

    const today = new Date();
    const todayStr = getLocalDateStr(today);
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateStr(yesterday);

    let streak = 0;
    let currentCheckDate = new Date();
    let currentCheckDateStr = getLocalDateStr(currentCheckDate);

    if (uniqueDates.has(todayStr)) {
      currentCheckDateStr = todayStr;
    } else if (uniqueDates.has(yesterdayStr)) {
      currentCheckDate = yesterday;
      currentCheckDateStr = yesterdayStr;
    } else {
      return { success: true, streak: 0 };
    }

    while (true) {
      if (uniqueDates.has(currentCheckDateStr)) {
        streak++;
        currentCheckDate.setDate(currentCheckDate.getDate() - 1);
        currentCheckDateStr = getLocalDateStr(currentCheckDate);
      } else {
        break;
      }
    }

    return { success: true, streak };
  } catch (error) {
    console.error('Error calculating streak:', error);
    return { success: false, streak: 0 };
  }
}

/**
 * Helper to extract LeetCode username from a URL or username string.
 */
export async function extractLeetcodeUsername(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (trimmed.includes('leetcode.com')) {
    try {
      const urlStr = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      const url = new URL(urlStr);
      const pathParts = url.pathname.split('/').filter(Boolean);

      // Handle u/username or just /username
      if (pathParts[0] === 'u') {
        return pathParts[1] || '';
      } else if (pathParts[0] && pathParts[0] !== 'problems' && pathParts[0] !== 'discuss') {
        return pathParts[0];
      }
    } catch (e) {
      // Fallback below
    }
  }

  // Fallback to removing URL elements manually or trimming
  return trimmed.replace(/^https?:\/\/(www\.)?leetcode\.com\/(u\/)?/, '').split('/')[0].replace(/^@/, '').trim();
}

/**
 * Saves or updates the user's LeetCode username.
 */
/**
 * Generates a deterministic verification code for the user's LeetCode connection.
 */
export async function getLeetcodeVerificationCodeAction() {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized.' };
  }
  const hash = crypto.createHash('sha256').update(session.userId).digest('hex');
  const code = `Recall-${hash.substring(0, 6).toUpperCase()}`;
  return { success: true, code };
}

/**
 * Saves or updates the user's LeetCode username after verification.
 */
export async function saveLeetcodeUsernameAction(input: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized. Please sign in.' };
  }

  const cleanInput = input.trim();
  if (cleanInput.length === 0) {
    try {
      await prisma.user.update({
        where: { userId: session.userId },
        data: { leetcodeUsername: null },
      });
      return { success: true };
    } catch (error) {
      console.error('Error clearing username:', error);
      return { success: false, error: 'Failed to clear LeetCode username.' };
    }
  }

  const username = await extractLeetcodeUsername(cleanInput);

  if (!username || username.length < 3) {
    return { success: false, error: 'Invalid LeetCode username or URL.' };
  }

  if (/\s/.test(username)) {
    return { success: false, error: 'LeetCode username cannot contain spaces.' };
  }

  // Validate username and verify profile code match against LeetCode API
  try {
    const query = `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            aboutMe
          }
        }
      }
    `;
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify({
        query,
        variables: { username }
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      return { success: false, error: `LeetCode API validation failed (status ${response.status}).` };
    }

    const json = await response.json();
    if (json.errors || !json.data?.matchedUser) {
      return { success: false, error: `LeetCode user "${username}" does not exist.` };
    }

    const matchedUser = json.data.matchedUser;
    const aboutMe = matchedUser.profile?.aboutMe || '';
    
    const hash = crypto.createHash('sha256').update(session.userId).digest('hex');
    const expectedCode = `Recall-${hash.substring(0, 6).toUpperCase()}`;

    if (!aboutMe.includes(expectedCode)) {
      return {
        success: false,
        error: `Verification failed! Please add your unique verification code "${expectedCode}" to your LeetCode profile "About Me" / bio section and try again.`
      };
    }

    // Save validated username slug
    await prisma.user.update({
      where: { userId: session.userId },
      data: { leetcodeUsername: username },
    });
    return { success: true, username };
  } catch (error) {
    console.error('Error in saveLeetcodeUsernameAction:', error);
    return { success: false, error: 'Failed to validate username with LeetCode. Check your connection.' };
  }
}

/**
 * Fetches recent solved LeetCode problems that haven't been logged in Recall yet.
 */
export async function fetchRecentLeetcodeSubmissionsAction() {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { userId: session.userId },
      select: { leetcodeUsername: true },
    });

    if (!user || !user.leetcodeUsername) {
      return { success: true, submissions: [], leetcodeUsername: null };
    }

    const query = `
      query recentAcSubmissions($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
          title
          titleSlug
          timestamp
        }
      }
    `;

    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify({
        query,
        variables: {
          username: user.leetcodeUsername,
          limit: 10
        }
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`LeetCode API returned status ${response.status}`);
    }

    const result = await response.json();
    const submissionList = result?.data?.recentAcSubmissionList || [];

    // Fetch existing problem logs to filter out
    const loggedProblems = await prisma.problemLog.findMany({
      where: { userId: session.userId },
      select: { lcUrl: true }
    });

    const loggedUrls = new Set(loggedProblems.map(p => p.lcUrl.toLowerCase().trim()));

    const unloggedSubmissions: { title: string; lcUrl: string; timestamp: number }[] = [];
    for (const sub of submissionList) {
      const lcUrl = `https://leetcode.com/problems/${sub.titleSlug}/`;
      const cleanUrl = lcUrl.toLowerCase().trim();
      
      const isAlreadyLogged = Array.from(loggedUrls).some(url => 
        url === cleanUrl || 
        url === cleanUrl + '/' || 
        cleanUrl === url + '/'
      );

      if (!isAlreadyLogged) {
        unloggedSubmissions.push({
          title: sub.title,
          lcUrl,
          timestamp: parseInt(sub.timestamp) * 1000
        });
      }
    }

    // Deduplicate array by URL
    const uniqueSubmissions: { title: string; lcUrl: string; timestamp: number }[] = [];
    const seenUrls = new Set<string>();
    for (const sub of unloggedSubmissions) {
      if (!seenUrls.has(sub.lcUrl)) {
        seenUrls.add(sub.lcUrl);
        uniqueSubmissions.push(sub);
      }
    }

    return { success: true, submissions: uniqueSubmissions, leetcodeUsername: user.leetcodeUsername };
  } catch (error: any) {
    console.error('Error fetching submissions:', error);
    return { success: false, error: 'Failed to fetch LeetCode submissions.' };
  }
}

/**
 * Retrieves failure reasons breakdown for analytical insights.
 */
export async function getWeaknessAnalyticsAction() {
  const session = await getSession();
  if (!session) {
    return { success: false, analytics: [], total: 0 };
  }

  try {
    const history = await prisma.revisionHistory.findMany({
      where: {
        problem: {
          userId: session.userId,
        },
        failureReason: {
          not: null,
        },
      },
      select: {
        failureReason: true,
      },
    });

    const counts: Record<string, number> = {};
    let total = 0;
    for (const record of history) {
      if (record.failureReason) {
        counts[record.failureReason] = (counts[record.failureReason] || 0) + 1;
        total++;
      }
    }

    const analytics = Object.entries(counts).map(([reason, count]) => ({
      reason,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    return { success: true, analytics, total };
  } catch (error) {
    console.error('Error fetching weakness analytics:', error);
    return { success: false, analytics: [], total: 0 };
  }
}

/**
 * Retrieves revision counts grouped by date for the last 16 weeks to render a GitHub-style heatmap.
 */
export async function getRevisionHeatmapAction(timezone?: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, heatmap: {} };
  }

  try {
    const endDate = new Date();
    const currentDay = endDate.getDay();
    const daysToSaturday = 6 - currentDay;
    endDate.setDate(endDate.getDate() + daysToSaturday);
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 16 * 7 + 1);
    startDate.setHours(0, 0, 0, 0);

    const history = await prisma.revisionHistory.findMany({
      where: {
        problem: {
          userId: session.userId,
        },
        reviewedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        reviewedAt: true,
      },
    });

    const tz = timezone || 'UTC';

    const getLocalDateStr = (d: Date) => {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const parts = formatter.formatToParts(d);
        const year = parts.find(p => p.type === 'year')!.value;
        const month = parts.find(p => p.type === 'month')!.value;
        const day = parts.find(p => p.type === 'day')!.value;
        return `${year}-${month}-${day}`;
      } catch (e) {
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const date = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${date}`;
      }
    };

    const heatmap: Record<string, number> = {};
    for (const record of history) {
      const dateStr = getLocalDateStr(record.reviewedAt);
      heatmap[dateStr] = (heatmap[dateStr] || 0) + 1;
    }

    return { success: true, heatmap };
  } catch (error) {
    console.error('Error fetching revision heatmap:', error);
    return { success: false, heatmap: {} };
  }
}

/**
 * Forces a problem to be due today by updating nextDue to now.
 */
export async function forceDueTodayAction(problemId: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const now = new Date();
    await prisma.problemLog.updateMany({
      where: {
        problemId,
        userId: session.userId,
      },
      data: {
        nextDue: now,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error forcing problem due today:', error);
    return { success: false, error: 'Failed to reschedule problem.' };
  }
}

/**
 * Retrieves the count of reviews done on each day of the current week (Monday-Sunday) in the user's timezone.
 */
export async function getWeeklyRevisionSummaryAction(timezone?: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, summary: {} };
  }

  try {
    const tz = timezone || 'UTC';
    const now = new Date();

    // Find the Monday of the current week
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + distanceToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const history = await prisma.revisionHistory.findMany({
      where: {
        problem: {
          userId: session.userId,
        },
        reviewedAt: {
          gte: startOfWeek,
        },
      },
      select: {
        reviewedAt: true,
      },
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const summary: Record<string, number> = {
      'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0
    };

    for (const record of history) {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          weekday: 'short',
        });
        const dayName = formatter.format(record.reviewedAt);
        if (summary[dayName] !== undefined) {
          summary[dayName]++;
        }
      } catch (e) {
        const dayIdx = record.reviewedAt.getUTCDay();
        const dayName = dayNames[dayIdx];
        if (summary[dayName] !== undefined) {
          summary[dayName]++;
        }
      }
    }

    return { success: true, summary };
  } catch (error) {
    console.error('Error fetching weekly revision summary:', error);
    return { success: false, summary: {} };
  }
}


