import { calculateSpacedRepetition } from './spaced-repetition.ts';
import assert from 'assert';

console.log("Running spaced repetition unit tests...");

try {
  // Test Blank rating
  const res1 = calculateSpacedRepetition({ rating: 'Blank', currentInterval: 4, currentConfidence: 3 });
  assert.strictEqual(res1.nextInterval, 1, "Blank rating should reset interval to 1 day");
  assert.strictEqual(res1.nextConfidence, 2, "Blank rating should decrement confidence by 1");

  const res1Min = calculateSpacedRepetition({ rating: 'Blank', currentInterval: 1, currentConfidence: 1 });
  assert.strictEqual(res1Min.nextInterval, 1, "Blank rating should keep interval at 1 day");
  assert.strictEqual(res1Min.nextConfidence, 1, "Blank rating confidence should not drop below 1");

  // Test Shaky rating
  const res2 = calculateSpacedRepetition({ rating: 'Shaky', currentInterval: 1, currentConfidence: 3 });
  assert.strictEqual(res2.nextInterval, 2, "Shaky rating nextInterval should be max(2, round(1 * 1.5)) = 2");
  assert.strictEqual(res2.nextConfidence, 3, "Shaky rating should not change confidence");

  const res2Larger = calculateSpacedRepetition({ rating: 'Shaky', currentInterval: 4, currentConfidence: 3 });
  assert.strictEqual(res2Larger.nextInterval, 6, "Shaky rating nextInterval should be round(4 * 1.5) = 6");
  assert.strictEqual(res2Larger.nextConfidence, 3, "Shaky rating should not change confidence");

  // Test Got It rating
  const res3 = calculateSpacedRepetition({ rating: 'GotIt', currentInterval: 1, currentConfidence: 3 });
  assert.strictEqual(res3.nextInterval, 4, "Got It rating nextInterval should be max(4, round(1 * 2.5)) = 4");
  assert.strictEqual(res3.nextConfidence, 4, "Got It rating should increment confidence by 1");

  const res3Larger = calculateSpacedRepetition({ rating: 'GotIt', currentInterval: 4, currentConfidence: 4 });
  assert.strictEqual(res3Larger.nextInterval, 10, "Got It rating nextInterval should be round(4 * 2.5) = 10");
  assert.strictEqual(res3Larger.nextConfidence, 5, "Got It rating should increment confidence by 1");

  const res3Max = calculateSpacedRepetition({ rating: 'GotIt', currentInterval: 4, currentConfidence: 5 });
  assert.strictEqual(res3Max.nextConfidence, 5, "Got It rating confidence should not exceed 5");

  console.log("All spaced repetition tests passed successfully!");
  process.exit(0);
} catch (error) {
  console.error("Spaced repetition test failure:", error);
  process.exit(1);
}
