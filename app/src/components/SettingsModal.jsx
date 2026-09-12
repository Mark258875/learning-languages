import { useState, useEffect } from 'react'
import { ACTIONS, DEFAULT_KEYS, displayKey, loadKeybindings, saveKeybindings } from '../utils/keybindings.js'

/**
 * SettingsModal — remap the Flashcard keyboard shortcuts.
 * Open with the ⚙️ button in the top nav. Close with Escape, backdrop click, or ×.
 * A remap is saved to localStorage immediately and synced to GitHub in the background.
 *
 * ponytail: a remap here only applies to *new* Flashcard views (it reads
 * keybindings on mount) — if you have a flashcard session open in another
 * tab/behind this modal, switch away and back to pick it up.
 */
export default function SettingsModal({ onClose }) {
  const [keys, setKeys] = useState(() => loadKeybindings().keys)
  const [listening, setListening] = useState(null) // action id currently capturing a key, or null
  const [conflictWith, setConflictWith] = useState(null)

  // Escape closes the modal, unless we're mid-capture (that Escape cancels the capture instead).
  useEffect(() => {
    if (listening) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [listening, onClose])

  // While capturing, the next keydown becomes the new binding for `listening`.
  useEffect(() => {
    if (!listening) return
    const handler = (e) => {
      e.preventDefault()
      if (e.key === 'Escape') { setListening(null); return }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const clash = Object.entries(keys).find(([id, k]) => id !== listening && k === key)
      const next = { ...keys, [listening]: key }
      setKeys(next)
      setConflictWith(clash ? clash[0] : null)
      setListening(null)
      saveKeybindings(next)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [listening, keys])

  function reset() {
    setKeys(DEFAULT_KEYS)
    setConflictWith(null)
    saveKeybindings(DEFAULT_KEYS)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-600">
          <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">⚙️ Flashcard shortcuts</span>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none p-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-2">
          {ACTIONS.map(({ id, label }) => (
            <div key={id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
              <button
                onClick={() => { setListening(id); setConflictWith(null) }}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold min-w-[76px] transition-all ${
                  listening === id
                    ? 'bg-amber-500 text-white animate-pulse'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {listening === id ? 'Press a key…' : displayKey(keys[id])}
              </button>
            </div>
          ))}

          {conflictWith && (
            <p className="text-xs text-amber-600 dark:text-amber-400 pt-1">
              That key was already used for "{ACTIONS.find((a) => a.id === conflictWith)?.label}" —
              reassign it if you don't want the two to overlap.
            </p>
          )}

          <div className="pt-3 flex items-center justify-between border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={reset}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 underline"
            >
              Reset to defaults
            </button>
            <span className="text-xs text-gray-300 dark:text-gray-600">Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
