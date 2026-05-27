import { VOCAB, getLang } from '../data/loader.js'
import { loadProgress, getCompletionPercent } from '../utils/progress.js'
import { countDue } from '../utils/srs.js'

export default function Sidebar({ activeLang, activeMode, activeSection, onModeChange, onSectionChange }) {
  const lang = getLang(activeLang)
  const progress = loadProgress(activeLang)
  const allCards = VOCAB[activeLang]?.all ?? []
  const allIds = allCards.map((c) => c.id)
  const dueCount = countDue(progress, allIds)
  const completionPct = getCompletionPercent(progress, allIds.length)
  const streak = progress.stats?.streak ?? 0
  const topics = Object.keys(VOCAB[activeLang]?.topics ?? {})

  const modes = [
    { id: 'theory', label: '📖 Theory' },
    { id: 'vocabulary', label: '🗂 Vocabulary' },
    { id: 'phrases', label: '💬 Phrases' },
  ]

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-0 overflow-y-auto">
      {/* Language header */}
      <div className={`${lang.lightBgClass} px-4 py-4 border-b border-gray-200`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">{lang.flag}</span>
          <span className={`font-bold text-lg ${lang.accentClass}`}>{lang.label}</span>
        </div>

        {/* Streak */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <span className="text-base">{streak > 0 ? '🔥' : '💤'}</span>
          <span>{streak > 0 ? `${streak}-day streak` : 'No streak yet'}</span>
        </div>

        {/* Due cards */}
        <div className="flex items-center gap-2 text-sm mb-3">
          <span className="text-base">⏰</span>
          <span className={dueCount > 0 ? 'text-orange-600 font-semibold' : 'text-gray-500'}>
            {dueCount > 0 ? `${dueCount} due today` : 'All caught up!'}
          </span>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{completionPct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={`${lang.bgClass} h-1.5 rounded-full transition-all`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{allIds.length} total cards</p>
        </div>
      </div>

      {/* Mode nav */}
      <div className="px-3 py-3 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sections</p>
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-all ${
              activeMode === m.id
                ? `${lang.bgClass} text-white font-medium`
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Topics (only in vocabulary mode) */}
      {activeMode === 'vocabulary' && topics.length > 0 && (
        <div className="px-3 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Topics</p>
          <button
            onClick={() => onSectionChange('all')}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm mb-1 transition-all ${
              activeSection === 'all'
                ? `${lang.borderClass} border-l-2 font-medium ${lang.accentClass} bg-gray-50`
                : 'text-gray-600 hover:bg-gray-50'
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
                  ? `${lang.borderClass} border-l-2 font-medium ${lang.accentClass} bg-gray-50`
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Theory sections (only in theory mode) */}
      {activeMode === 'theory' && (
        <div className="px-3 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pages</p>
          {getTheoryPages(activeLang).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onSectionChange(key)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm mb-1 transition-all ${
                activeSection === key
                  ? `${lang.borderClass} border-l-2 font-medium ${lang.accentClass} bg-gray-50`
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
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
