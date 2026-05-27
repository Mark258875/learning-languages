import { useState } from 'react'
import { AZBUKA } from '../data/loader.js'
import { reviewCard, RATING_LABELS, RATING_COLORS } from '../utils/srs.js'
import { loadProgress, updateCardProgress } from '../utils/progress.js'

// ────────────────────────────────────────────
// Russian Azbuka grid + flashcard drill
// ────────────────────────────────────────────
function AzbukaGrid({ onSelectLetter }) {
  const vowels = AZBUKA.filter((l) => l.category === 'vowel')
  const consonants = AZBUKA.filter((l) => l.category === 'consonant')
  const signs = AZBUKA.filter((l) => l.category === 'sign')

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-1 text-gray-800">Russian Alphabet — Azbuka (Азбука)</h2>
      <p className="text-gray-500 text-sm mb-6">33 letters. Click any to study with flashcard mode.</p>

      <Section title="Vowels (10)" items={vowels} color="bg-blue-50 border-blue-200" onSelect={onSelectLetter} />
      <Section title="Consonants (21)" items={consonants} color="bg-gray-50 border-gray-200" onSelect={onSelectLetter} />
      <Section title="Signs (2)" items={signs} color="bg-amber-50 border-amber-200" onSelect={onSelectLetter} />
    </div>
  )
}

function Section({ title, items, color, onSelect }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {items.map((letter) => (
          <button
            key={letter.letter_index}
            onClick={() => onSelect(letter)}
            className={`${color} border rounded-xl p-2 text-center hover:shadow-md transition-all group`}
          >
            <div className="text-2xl font-bold text-gray-800 group-hover:scale-110 transition-transform">
              {letter.letter.split(' ')[0]}
            </div>
            <div className="text-xs text-gray-500 mt-1">{letter.sound}</div>
            {letter.tricky && <div className="text-xs text-red-400 mt-0.5">⚠️</div>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// Azbuka flashcard drill
// ────────────────────────────────────────────
function AzbukaCard({ letter, onNext, onRate }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4 max-w-md mx-auto">
      <button onClick={() => onNext(null)} className="self-start text-gray-400 hover:text-gray-700 text-sm">
        ← Back to grid
      </button>

      <div className={`flip-card w-full`} style={{ height: 300 }}>
        <div className={`flip-card-inner w-full h-full relative ${flipped ? 'flipped' : ''}`}>
          {/* Front — just the letter */}
          <div
            className="flip-card-front absolute inset-0 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center justify-center cursor-pointer gap-2"
            onClick={() => setFlipped(true)}
          >
            <div className="text-8xl font-bold text-gray-800">{letter.letter}</div>
            <p className="text-gray-400 text-sm">Click to reveal</p>
          </div>
          {/* Back — mnemonic, sound, example */}
          <div className="flip-card-back absolute inset-0 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center justify-center p-6 gap-3">
            <div className="text-4xl font-bold text-gray-800">{letter.letter}</div>
            <div className="text-2xl font-mono text-red-600">{letter.ipa || `/${letter.sound}/`}</div>
            <div className="text-center text-gray-600 text-sm bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
              💡 {letter.mnemonic}
            </div>
            <div className="text-center">
              <span className="text-lg font-bold text-gray-700">{letter.example_word}</span>
              <span className="text-gray-400 text-sm"> ({letter.example_transliteration})</span>
              <span className="text-gray-500 text-sm"> = {letter.example_translation}</span>
            </div>
            {letter.note && (
              <div className="text-xs text-blue-600 italic text-center">{letter.note}</div>
            )}
          </div>
        </div>
      </div>

      {flipped && (
        <div className="flex gap-3 w-full">
          {RATING_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => { onRate(i); setFlipped(false) }}
              className={`flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-all ${RATING_COLORS[i]}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────
// Pinyin chart (static table)
// ────────────────────────────────────────────
function PinyinChart() {
  const initials = ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s']
  const toneExamples = [
    { tone: 1, mark: 'ā', description: 'High level', example: 'mā (妈) mom', color: 'bg-blue-100 text-blue-700' },
    { tone: 2, mark: 'á', description: 'Rising', example: 'má (麻) hemp', color: 'bg-green-100 text-green-700' },
    { tone: 3, mark: 'ǎ', description: 'Dip-rise', example: 'mǎ (马) horse', color: 'bg-amber-100 text-amber-700' },
    { tone: 4, mark: 'à', description: 'Falling', example: 'mà (骂) scold', color: 'bg-red-100 text-red-700' },
    { tone: 5, mark: 'a', description: 'Neutral', example: 'ma (吗) ?', color: 'bg-gray-100 text-gray-600' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-1 text-gray-800">Chinese Pinyin System</h2>
      <p className="text-gray-500 text-sm mb-6">The phonetic romanization of Mandarin Chinese.</p>

      {/* Tones */}
      <h3 className="text-lg font-semibold text-gray-700 mb-3">Four Tones</h3>
      <div className="grid grid-cols-5 gap-2 mb-8">
        {toneExamples.map(({ tone, mark, description, example, color }) => (
          <div key={tone} className={`${color} rounded-xl p-3 text-center`}>
            <div className="text-3xl font-bold mb-1">{mark}</div>
            <div className="text-xs font-semibold">{description}</div>
            <div className="text-xs mt-1 opacity-80">{example}</div>
          </div>
        ))}
      </div>

      {/* Initials */}
      <h3 className="text-lg font-semibold text-gray-700 mb-3">Initials (Consonants)</h3>
      <div className="flex flex-wrap gap-2 mb-8">
        {initials.map((init) => (
          <span key={init} className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 font-mono text-sm font-semibold text-gray-700">
            {init}
          </span>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Key tip:</strong> Aspirated vs unaspirated pairs: b/p, d/t, g/k, j/q, zh/ch, z/c.
        Put your hand in front of your mouth — aspirated consonants create a puff of air.
      </div>
    </div>
  )
}

// ────────────────────────────────────────────
// Main AlphabetGrid component
// ────────────────────────────────────────────
export default function AlphabetGrid({ lang }) {
  const [selectedLetter, setSelectedLetter] = useState(null)
  const [progress, setProgress] = useState(() => loadProgress(lang))
  const [drillQueue, setDrillQueue] = useState(null)
  const [drillIdx, setDrillIdx] = useState(0)

  if (lang === 'russian') {
    if (selectedLetter) {
      return (
        <AzbukaCard
          letter={selectedLetter}
          onNext={() => setSelectedLetter(null)}
          onRate={(rating) => {
            const cardId = `azbuka_${selectedLetter.letter_index}`
            const state = progress.cards?.[cardId]
            const newState = reviewCard(state, rating)
            const newProgress = updateCardProgress(lang, cardId, newState)
            setProgress(newProgress)
          }}
        />
      )
    }
    return <AzbukaGrid onSelectLetter={setSelectedLetter} />
  }

  if (lang === 'chinese') {
    return <PinyinChart />
  }

  return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <p>No alphabet module for French (uses Latin script).</p>
    </div>
  )
}
