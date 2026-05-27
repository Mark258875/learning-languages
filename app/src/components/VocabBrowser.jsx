import { useState, useMemo } from 'react'

/**
 * VocabBrowser — scrollable table view of all vocabulary for a language.
 * Supports search + topic filter chips. Rows expand to show example sentence.
 */
export default function VocabBrowser({ lang, cards, topics }) {
  const [search, setSearch] = useState('')
  const [activeTopic, setActiveTopic] = useState('all')
  const [expanded, setExpanded] = useState(null) // index of expanded row

  const isChinese = lang === 'chinese'

  // Build topic list from the topics object keys
  const topicNames = useMemo(() => Object.keys(topics ?? {}), [topics])

  // Filter cards by topic then by search query
  const filtered = useMemo(() => {
    let list = activeTopic === 'all' ? cards : (topics[activeTopic] ?? [])
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((c) => {
      const word = (c.word || c.simplified || c.traditional || c.pinyin || '').toLowerCase()
      const trans = (c.translation || '').toLowerCase()
      return word.includes(q) || trans.includes(q)
    })
  }, [cards, topics, activeTopic, search])

  const toggle = (i) => setExpanded(expanded === i ? null : i)

  return (
    <div className="flex flex-col h-full">
      {/* Sticky filter bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2 shrink-0">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setExpanded(null) }}
          placeholder="Search word or translation…"
          className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700"
        />
        {/* Topic chips */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            onClick={() => { setActiveTopic('all'); setExpanded(null) }}
            className={`text-xs px-2.5 py-0.5 rounded-full border transition-all ${
              activeTopic === 'all'
                ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent'
                : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-500'
            }`}
          >
            All
          </button>
          {topicNames.map((t) => (
            <button
              key={t}
              onClick={() => { setActiveTopic(t); setExpanded(null) }}
              className={`text-xs px-2.5 py-0.5 rounded-full border transition-all ${
                activeTopic === t
                  ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent'
                  : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-500'
              }`}
            >
              {t}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {filtered.length} / {activeTopic === 'all' ? cards.length : (topics[activeTopic]?.length ?? 0)} words
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">
            {search ? `No results for "${search}"` : 'No words in this topic yet.'}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <tr>
                {isChinese ? (
                  <>
                    <th className="text-left px-4 py-2 font-medium w-24">Han</th>
                    <th className="text-left px-4 py-2 font-medium w-28">Pinyin</th>
                  </>
                ) : (
                  <>
                    <th className="text-left px-4 py-2 font-medium w-40">Word</th>
                    <th className="text-left px-4 py-2 font-medium w-32 hidden sm:table-cell">Pronunciation</th>
                  </>
                )}
                <th className="text-left px-4 py-2 font-medium">Translation</th>
                <th className="w-8 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((card, i) => {
                const isOpen = expanded === i
                const hasExample = card.example || card.example_translation

                return (
                  <>
                    <tr
                      key={`${card.id}-row`}
                      onClick={() => hasExample && toggle(i)}
                      className={`border-t border-gray-100 dark:border-gray-800 transition-colors ${
                        hasExample ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60' : ''
                      } ${isOpen ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                    >
                      {isChinese ? (
                        <>
                          <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">
                            <span className="text-base">{card.simplified}</span>
                            {card.traditional && card.traditional !== card.simplified && (
                              <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">({card.traditional})</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 font-mono text-xs">
                            {card.pinyin}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">
                            {card.word}
                          </td>
                          <td className="px-4 py-2.5 text-gray-400 dark:text-gray-500 font-mono text-xs hidden sm:table-cell">
                            {card.pronunciation || '—'}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                        {card.translation}
                      </td>
                      <td className="px-2 py-2.5 text-gray-300 dark:text-gray-600 text-right">
                        {hasExample ? (isOpen ? '▾' : '▸') : ''}
                      </td>
                    </tr>

                    {/* Expanded example row */}
                    {isOpen && hasExample && (
                      <tr key={`${card.id}-example`} className="bg-blue-50/40 dark:bg-blue-900/10">
                        <td
                          colSpan={4}
                          className="px-4 pb-3 pt-0 text-xs text-gray-500 dark:text-gray-400 italic"
                        >
                          {card.example && (
                            <p className="text-gray-700 dark:text-gray-300 not-italic mb-0.5">
                              {card.example}
                              {isChinese && card.example_pinyin && (
                                <span className="text-gray-400 ml-2 font-mono">({card.example_pinyin})</span>
                              )}
                            </p>
                          )}
                          {card.example_translation && (
                            <p>{card.example_translation}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
