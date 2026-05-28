import { useState, useEffect } from 'react'
import { VOCAB, getLang } from '../data/loader.js'
import { loadProgress, getCompletionPercent } from '../utils/progress.js'
import { countDue } from '../utils/srs.js'

export default function Sidebar({ activeLang, activeMode, activeSection, onModeChange, onSectionChange, isOpen, darkMode, onToggleDark }) {
  const lang = getLang(activeLang)
  const progress = loadProgress(activeLang)
  const allCards = VOCAB[activeLang]?.all ?? []
  const allIds = allCards.map((c) => c.id)
  const dueCount = countDue(progress, allIds)
  const completionPct = getCompletionPercent(progress, allIds.length)
  const streak = progress.stats?.streak ?? 0
  const topics = Object.keys(VOCAB[activeLang]?.topics ?? {})

  const [pendingCount, setPendingCount] = useState(0)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`ll_pending_${activeLang}`)
      setPendingCount(stored ? JSON.parse(stored).length : 0)
    } catch {
      setPendingCount(0)
    }
  }, [activeLang, activeMode])

  const modes = [
    { id: 'theory', label: '📖 Theory' },
    { id: 'vocabulary', label: '🗂 Vocabulary' },
    { id: 'phrases', label: '💬 Phrases' },
    { id: 'lookup', label: '🔍 Lookup' },
  ]

  return (
    <aside className={`
      ${isOpen ? 'flex' : 'hidden'} md:flex
      w-56 shrink-0 flex-col min-h-0 overflow-y-auto
      bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
      absolute md:relative h-full z-20 md:z-auto
    `}>
      {/* Language header */}
      <div className={`${lang.lightBgClass} dark:bg-gray-700 px-4 py-4 border-b border-gray-200 dark:border-gray-600`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">{lang.flag}</span>
          <span className={`font-bold text-lg ${lang.accentClass}`}>{lang.label}</span>
        </div>

        {/* Streak */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2">
          <span className="text-base">{streak > 0 ? '🔥' : '💤'}</span>
          <span>{streak > 0 ? `${streak}-day streak` : 'No streak yet'}</span>
        </div>

        {/* Due cards */}
        <div className="flex items-center gap-2 text-sm mb-3">
          <span className="text-base">⏰</span>
          <span className={dueCount > 0 ? 'text-orange-600 font-semibold' : 'text-gray-500 dark:text-gray-400'}>
            {dueCount > 0 ? `${dueCount} due today` : 'All caught up!'}
          </span>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Progress</span>
            <span>{completionPct}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
            <div
              className={`${lang.bgClass} h-1.5 rounded-full transition-all`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{allIds.length} total cards</p>
        </div>
      </div>

      {/* Mode nav */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Sections</p>
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-all flex items-center justify-between ${
              activeMode === m.id
                ? `${lang.bgClass} text-white font-medium`
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span>{m.label}</span>
            {m.id === 'lookup' && pendingCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeMode === 'lookup' ? 'bg-white/30 text-white' : `${lang.lightBgClass} ${lang.accentClass}`
              } font-semibold`}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Topics (vocabulary mode) */}
      {activeMode === 'vocabulary' && topics.length > 0 && (
        <div className="px-3 py-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Topics</p>
          <button
            onClick={() => onSectionChange('all')}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm mb-1 transition-all ${
              activeSection === 'all'
                ? `${lang.borderClass} border-l-2 font-medium ${lang.accentClass} bg-gray-50 dark:bg-gray-700`
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            All topics
          </button>
          {topics.map((t) => (
            <button
              key={t}
              onClick={() => onSectionChange(t)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm mb-1 transition-all capitalize ${
                activeSection === t
                  ? `${lang.borderClass} border-l-2 font-medium ${lang.accentClass} bg-gray-50 dark:bg-gray-700`
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Theory pages */}
      {activeMode === 'theory' && (
        <div className="px-3 py-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Pages</p>
          {getTheoryPages(activeLang).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onSectionChange(key)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm mb-1 transition-all ${
                activeSection === key
                  ? `${lang.borderClass} border-l-2 font-medium ${lang.accentClass} bg-gray-50 dark:bg-gray-700`
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Keyboard hint + dark mode toggle */}
      <div className="mt-auto px-3 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          ⌨️ Space to flip · 1-4 to rate
        </p>
        <button
          onClick={onToggleDark}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="shrink-0 p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          aria-label="Toggle dark mode"
        >
          <span className="text-base leading-none">{darkMode ? '☀️' : '🌙'}</span>
        </button>
      </div>
    </aside>
  )
}

function getTheoryPages(lang) {
  const pages = {
    french: [
      { key: 'grammar', label: '📝 Grammar' },
      { key: 'pronunciation', label: '🔊 Pronunciation' },
      { key: 'verbs', label: '⚡ Verbs' },
      { key: 'tenses', label: '⏳ Tenses' },
    ],
    russian: [
      { key: 'azbuka', label: '🔤 Azbuka (Alphabet)' },
      { key: 'grammar', label: '📝 Grammar' },
      { key: 'cases', label: '📐 Cases' },
      { key: 'pronunciation', label: '🔊 Pronunciation' },
    ],
    chinese: [
      { key: 'pinyin', label: '🔤 Pinyin' },
      { key: 'tones', label: '🎵 Tones' },
      { key: 'radicals', label: '🧩 Radicals' },
      { key: 'grammar', label: '📝 Grammar' },
    ],
  }
  return pages[lang] ?? []
}
