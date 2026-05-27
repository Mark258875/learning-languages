import { useState, useCallback } from 'react'
import { getLang } from '../data/loader.js'

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getWrongOptions(cards, correct, count = 3) {
  const others = cards.filter((c) => c.id !== correct.id)
  return shuffleArray(others).slice(0, count).map((c) => c.translation)
}

function MultipleChoice({ card, cards, lang, onResult }) {
  const langMeta = getLang(lang)
  const [selected, setSelected] = useState(null)
  const wrong = getWrongOptions(cards, card)
  const options = shuffleArray([card.translation, ...wrong])

  function handleSelect(opt) {
    if (selected) return
    setSelected(opt)
    setTimeout(() => {
      onResult(opt === card.translation)
      setSelected(null)
    }, 800)
  }

  const isChinese = lang === 'chinese'
  const displayWord = isChinese
    ? `${card.simplified}${card.simplified !== card.traditional ? ' / ' + card.traditional : ''}`
    : card.word

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4 max-w-md mx-auto w-full">
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 w-full p-8 text-center">
        <p className="text-gray-400 text-xs mb-3 uppercase tracking-wide">What does this mean?</p>
        <div className="text-4xl font-bold text-gray-800 mb-2">{displayWord}</div>
        {isChinese && <div className="text-xl text-blue-500 font-medium">{card.pinyin}</div>}
        {!isChinese && card.pronunciation && (
          <div className="text-gray-400 font-mono text-sm mt-1">{card.pronunciation}</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        {options.map((opt, i) => {
          let cls = 'bg-white border-2 border-gray-200 text-gray-800 hover:border-gray-400'
          if (selected) {
            if (opt === card.translation) cls = 'bg-green-500 border-green-500 text-white'
            else if (opt === selected) cls = 'bg-red-400 border-red-400 text-white'
            else cls = 'bg-white border-gray-200 text-gray-400 opacity-60'
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(opt)}
              className={`rounded-xl px-4 py-4 text-sm font-medium transition-all text-center ${cls}`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FillBlank({ card, lang, onResult }) {
  const [input, setInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const langMeta = getLang(lang)
  const isChinese = lang === 'chinese'

  const answer = isChinese ? card.pinyin : card.word

  const exampleWithBlank = card.example
    ? card.example.replace(
        new RegExp(isChinese ? card.simplified : card.word, 'i'),
        '______'
      )
    : null

  function handleSubmit(e) {
    e.preventDefault()
    if (!input.trim()) return
    setSubmitted(true)
    const correct = input.trim().toLowerCase() === answer.toLowerCase()
    setTimeout(() => {
      onResult(correct)
      setInput('')
      setSubmitted(false)
    }, 1200)
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4 max-w-md mx-auto w-full">
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 w-full p-8 text-center">
        <p className="text-gray-400 text-xs mb-3 uppercase tracking-wide">Translate this word</p>
        <div className="text-3xl font-bold text-gray-800 mb-2">{card.translation}</div>
        {exampleWithBlank && (
          <p className="text-gray-500 text-sm italic mt-4 bg-gray-50 rounded-lg p-3">
            {exampleWithBlank}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="w-full flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitted}
          placeholder={`Type in ${lang === 'french' ? 'French' : lang === 'russian' ? 'Russian (or transliteration)' : 'Pinyin'}...`}
          className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition"
        />
        <button
          type="submit"
          disabled={submitted || !input.trim()}
          className={`${langMeta.bgClass} text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-40`}
        >
          Check
        </button>
      </form>

      {submitted && (
        <div className={`w-full rounded-xl p-4 text-center font-medium ${
          input.trim().toLowerCase() === answer.toLowerCase()
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {input.trim().toLowerCase() === answer.toLowerCase()
            ? '✅ Correct!'
            : `❌ The answer was: ${answer}`}
        </div>
      )}
    </div>
  )
}

export default function Quiz({ cards, lang }) {
  const langMeta = getLang(lang)
  const [quizType, setQuizType] = useState('multiple') // 'multiple' | 'fill'
  const [queue, setQueue] = useState(() => shuffleArray(cards))
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [done, setDone] = useState(false)

  function handleResult(correct) {
    setScore((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }))
    if (idx + 1 >= queue.length) {
      setDone(true)
    } else {
      setIdx((i) => i + 1)
    }
  }

  function restart() {
    setQueue(shuffleArray(cards))
    setIdx(0)
    setScore({ correct: 0, total: 0 })
    setDone(false)
  }

  if (done) {
    const pct = Math.round((score.correct / score.total) * 100)
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-8">
        <div className="text-6xl">{pct >= 80 ? '🏆' : pct >= 60 ? '👏' : '💪'}</div>
        <h2 className="text-2xl font-bold text-gray-800">Quiz Complete!</h2>
        <p className="text-3xl font-bold" style={{ color: pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626' }}>
          {score.correct} / {score.total} ({pct}%)
        </p>
        <button onClick={restart} className={`${langMeta.bgClass} text-white px-8 py-3 rounded-xl font-medium hover:opacity-90 transition`}>
          Try Again
        </button>
      </div>
    )
  }

  const card = queue[idx]

  return (
    <div className="flex flex-col h-full">
      {/* Quiz type toggle */}
      <div className="flex justify-center gap-3 pt-6 px-4">
        {[['multiple', '🎯 Multiple Choice'], ['fill', '✏️ Fill in the Blank']].map(([type, label]) => (
          <button
            key={type}
            onClick={() => { setQuizType(type); restart() }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              quizType === type
                ? `${langMeta.bgClass} text-white`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Score */}
      <div className="text-center text-sm text-gray-500 mt-3">
        Question {idx + 1} / {queue.length} &nbsp;·&nbsp; Score: {score.correct}/{score.total}
      </div>

      {quizType === 'multiple'
        ? <MultipleChoice card={card} cards={cards} lang={lang} onResult={handleResult} />
        : <FillBlank card={card} lang={lang} onResult={handleResult} />
      }
    </div>
  )
}
