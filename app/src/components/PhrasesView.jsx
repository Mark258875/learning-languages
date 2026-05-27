import { getLang } from '../data/loader.js'

export default function PhrasesView({ phrases, lang }) {
  const langMeta = getLang(lang)
  const isChinese = lang === 'chinese'

  if (!phrases || phrases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
        <span className="text-4xl">💬</span>
        <p>No phrases yet. Add them to <code>{lang}/phrases/common.json</code>.</p>
      </div>
    )
  }

  // Group by tags if available
  const grouped = {}
  for (const p of phrases) {
    const tag = p.tags?.[0] ?? 'general'
    if (!grouped[tag]) grouped[tag] = []
    grouped[tag].push(p)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      {Object.entries(grouped).map(([tag, items]) => (
        <div key={tag}>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 capitalize">{tag}</h3>
          <div className="space-y-3">
            {items.map((p, i) => (
              <PhraseCard key={p.id ?? i} phrase={p} lang={lang} langMeta={langMeta} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PhraseCard({ phrase, lang, langMeta }) {
  const isChinese = lang === 'chinese'
  const mainText = isChinese ? phrase.simplified : phrase.phrase

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className={`font-semibold text-gray-800 text-base ${isChinese ? 'text-xl' : ''}`}>
            {mainText}
          </p>
          {isChinese && phrase.pinyin && (
            <p className="text-blue-500 text-sm mt-0.5">{phrase.pinyin}</p>
          )}
          {phrase.pronunciation && !isChinese && (
            <p className="text-gray-400 font-mono text-xs mt-0.5">{phrase.pronunciation}</p>
          )}
          <p className="text-gray-600 text-sm mt-1">{phrase.translation}</p>
          {phrase.context && (
            <p className="text-gray-400 text-xs mt-1 italic">📍 {phrase.context}</p>
          )}
        </div>
        <span className={`shrink-0 text-xs px-2 py-1 rounded-full ${langMeta.lightBgClass} ${langMeta.accentClass} font-medium`}>
          {phrase.tags?.[0] ?? 'phrase'}
        </span>
      </div>
    </div>
  )
}
