/**
 * SM-2 Spaced Repetition Algorithm
 * Based on: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 *
 * Rating scale:
 *   0 = Again   (complete blackout)
 *   1 = Hard    (incorrect, but remembered on hint)
 *   2 = Good    (correct with difficulty)
 *   3 = Easy    (perfect recall)
 */

export const RATING = { AGAIN: 0, HARD: 1, GOOD: 2, EASY: 3 }
export const RATING_LABELS = ['Again', 'Hard', 'Good', 'Easy']
export const RATING_COLORS = [
  'bg-red-500 hover:bg-red-600',
  'bg-orange-400 hover:bg-orange-500',
  'bg-green-500 hover:bg-green-600',
  'bg-blue-500 hover:bg-blue-600',
]

const DEFAULT_CARD = {
  easeFactor: 2.5,
  interval: 0,
  repetitions: 0,
  dueDate: null,
  lastReview: null,
}

/**
 * Calculate next review date using SM-2.
 * @param {object} card - current SRS state of the card
 * @param {number} rating - 0 (Again) to 3 (Easy)
 * @returns {object} updated SRS state
 */
export function reviewCard(card = DEFAULT_CARD, rating) {
  let { easeFactor, interval, repetitions } = { ...DEFAULT_CARD, ...card }
  const today = todayStr()

  if (rating === RATING.AGAIN) {
    // Reset
    repetitions = 0
    interval = 1
  } else {
    // Update ease factor
    easeFactor = Math.max(
      1.3,
      easeFactor + 0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02)
    )

    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetitions += 1

    // Bonus for Easy
    if (rating === RATING.EASY) {
      interval = Math.round(interval * 1.3)
    }
  }

  const dueDate = addDays(today, interval)

  return { easeFactor, interval, repetitions, dueDate, lastReview: today }
}

/**
 * Return cards due today or overdue, sorted by due date (oldest first).
 * @param {object} progress - progress JSON (cards map)
 * @param {string[]} allCardIds - all card IDs to include
 * @returns {string[]} IDs of due cards
 */
export function getDueCards(progress, allCardIds) {
  const today = todayStr()
  return allCardIds
    .filter((id) => {
      const state = progress?.cards?.[id]
      if (!state || !state.dueDate) return true // never reviewed = due
      return state.dueDate <= today
    })
    .sort((a, b) => {
      const da = progress?.cards?.[a]?.dueDate ?? '1970-01-01'
      const db = progress?.cards?.[b]?.dueDate ?? '1970-01-01'
      return da.localeCompare(db)
    })
}

/** Get cards that have never been reviewed */
export function getNewCards(progress, allCardIds) {
  return allCardIds.filter((id) => !progress?.cards?.[id])
}

/** Count cards due today */
export function countDue(progress, allCardIds) {
  return getDueCards(progress, allCardIds).length
}

// --- Date helpers ---

export function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
