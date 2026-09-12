// Minimal self-check for the progress-merge logic that keeps devices in sync.
// Run: node src/utils/progress.test.mjs
import assert from 'node:assert/strict'
import { mergeProgress } from './progress.js'

// Missing side returns the other side untouched.
assert.equal(mergeProgress(null, 'b'), 'b')
assert.equal(mergeProgress('a', null), 'a')

// Per-card: the entry with the later lastReview wins.
const local = {
  stats: { lastStudied: '2026-09-01' },
  cards: {
    c1: { lastReview: '2026-09-01', interval: 3 },
    onlyLocal: { lastReview: '2026-09-05', interval: 1 },
  },
}
const remote = {
  stats: { lastStudied: '2026-09-05' },
  cards: {
    c1: { lastReview: '2026-09-05', interval: 6 }, // reviewed on another device since
    onlyRemote: { lastReview: '2026-09-02', interval: 2 },
  },
}
const merged = mergeProgress(local, remote)

assert.deepEqual(merged.cards.c1, remote.cards.c1, 'newer review of a shared card should win')
assert.deepEqual(merged.cards.onlyLocal, local.cards.onlyLocal, 'card only reviewed locally must survive the merge')
assert.deepEqual(merged.cards.onlyRemote, remote.cards.onlyRemote, 'card only reviewed remotely must survive the merge')
assert.equal(merged.stats.lastStudied, '2026-09-05', 'stats should come from whichever side studied more recently')

// A stale remote (older stats) must not clobber the local streak/stats.
const staleRemote = { stats: { lastStudied: '2026-08-20', streak: 1 }, cards: {} }
const keepLocal = mergeProgress(local, staleRemote)
assert.equal(keepLocal.stats.lastStudied, '2026-09-01', 'must not regress to a stale remote')

console.log('PASS: mergeProgress — 5 assertions')
