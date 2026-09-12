// Minimal self-check for keybindings defaults/merge logic.
// Run: node src/utils/keybindings.test.mjs
import assert from 'node:assert/strict'

// keybindings.js touches localStorage only inside function bodies, but
// loadKeybindings()/displayKey() are pure enough to exercise with a stub.
globalThis.localStorage = {
  _data: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null },
  setItem(k, v) { this._data[k] = String(v) },
  removeItem(k) { delete this._data[k] },
}

const { loadKeybindings, saveKeybindings, displayKey, DEFAULT_KEYS, ACTIONS } = await import('./keybindings.js')

// No token anywhere in this test — pushes/pulls no-op (github.js calls never fire).

// 1. First-ever load returns the defaults.
assert.deepEqual(loadKeybindings().keys, DEFAULT_KEYS, 'fresh install should get the defaults')

// 2. Saving a partial override still fills in the rest from defaults.
localStorage.setItem('ll_keybindings', JSON.stringify({ updatedAt: '2026-01-01', keys: { flip: 'j' } }))
const partial = loadKeybindings()
assert.equal(partial.keys.flip, 'j', 'explicit override should win')
assert.equal(partial.keys.again, DEFAULT_KEYS.again, 'unset actions should fall back to defaults')

// 3. saveKeybindings persists immediately and round-trips.
const custom = { flip: 'j', again: 'a', hard: 's', good: 'd', easy: 'k' }
saveKeybindings(custom)
assert.deepEqual(loadKeybindings().keys, custom, 'saved keybindings should be the ones read back')

// 4. displayKey formatting.
assert.equal(displayKey(' '), 'Space')
assert.equal(displayKey('f'), 'F')
assert.equal(displayKey('Enter'), 'Enter')
assert.equal(displayKey(''), '—')

// 5. Every action has a binding after load (no undefined keys reach the UI).
for (const { id } of ACTIONS) assert.ok(loadKeybindings().keys[id], `action "${id}" must have a bound key`)

console.log('PASS: keybindings — 8 assertions')
