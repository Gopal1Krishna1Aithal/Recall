export type ReviewRating = 'Blank' | 'Shaky' | 'GotIt';

interface SpacedRepetitionInput {
  rating: ReviewRating;
  currentInterval: number; // in days
  currentConfidence: number; // integer 1 to 5
}

interface SpacedRepetitionOutput {
  nextInterval: number; // in days
  nextConfidence: number; // integer 1 to 5
}

/**
 * Calculates the next interval and confidence level based on the user's rating.
 * 
 * Rules:
 * - Blank: interval_days = 1, confidence = max(1, confidence - 1)
 * - Shaky: interval_days = max(2, round(current_interval * 1.5)), confidence unchanged
 * - Got It: interval_days = max(4, round(current_interval * 2.5)), confidence = min(5, confidence + 1)
 */
export function calculateSpacedRepetition({
  rating,
  currentInterval,
  currentConfidence,
}: SpacedRepetitionInput): SpacedRepetitionOutput {
  let nextInterval = 1;
  let nextConfidence = currentConfidence;

  switch (rating) {
    case 'Blank':
      nextInterval = 1;
      nextConfidence = Math.max(1, currentConfidence - 1);
      break;

    case 'Shaky':
      nextInterval = Math.max(2, Math.round(currentInterval * 1.5));
      // confidence remains unchanged
      break;

    case 'GotIt':
      nextInterval = Math.max(4, Math.round(currentInterval * 2.5));
      nextConfidence = Math.min(5, currentConfidence + 1);
      break;

    default:
      // Fallback
      nextInterval = 1;
  }

  return {
    nextInterval,
    nextConfidence,
  };
}

/**
 * Helper to calculate the next due date based on current time and interval days.
 * @param intervalDays Number of days from now
 */
export function calculateNextDue(intervalDays: number): Date {
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + intervalDays);
  return nextDue;
}
