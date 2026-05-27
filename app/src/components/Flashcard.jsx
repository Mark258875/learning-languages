import { useState, useEffect, useCallback } from 'react'
import { reviewCard, RATING_LABELS, RATING_COLORS, getDueCards, getNewCards } from '../utils/srs.js'
import { loadProgress, updateCardProgress } from '../utils/progress.js'
import { getLang } from '../data/loader.js'

function CardDisplay({ card, lang }) {
  if (!card) return null
  const isChinese = lang === 'chinese'

  if (isChinese) {
    return (
      <div className="text-center">
        <div className="text-5xl font-bold mb-1 tracking-wider text-gray-800 dark:text-gray-100">{card.simplified}</div>
        {card.simplified !== card.traditional && (
          <div className="text-2xl text-gray-400 dark:text-gray-500 mb-2">({card.traditional})</div>
        )}
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="text-4xl font-bold mb-2 text-gray-800 dark:text-gray-100">{card.word}</div>
      {card.pronunciation && (
        <div className="text-gray-500 dark:text-gray-400 text-lg font-mono">{card.pronunciation}</div>
      )}
      {card.gender && (
        <div className="text-gray-400 dark:text-gray-500 text-sm italic mt-1">({card.gender})</div>
      )}
    </div>
  )
}

function CardBack({ card, lang }) {
  if (!card) return null
  const isChinese = lang === 'chinese'
  return (
    <div className="text-center space-y-3">
      {isChinese && (
        <>
          <div className="text-3xl font-bold text-gray-700 dark:text-gray-200">{card.simplified}</div>
          <div className="text-xl text-blue-600 dark:text-blue-400 font-medium">{card.pinyin}</div>
        </>
      )}
      <div className="text-2xl font-semibold text-gray-800 dark:text-gray-100">{card.translation}</div>
      {card.example && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl text-left border border-gray-100 dark:border-gray-600">
          <p className="text-gray-700 dark:text-gray-300 italic text-sm">{card.example}</p>
          {isChinese && card.example_pinyin && (
            <p className="text-blue-500 dark:text-blue-400 text-xs mt-1">{card.example_pinyin}</p>
          )}
          {card.example_translation && (
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{card.example_translation}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Flashcard({ cards, lang, subMode }) {
  const langMeta = getLang(lang)
  const [progress, setProgress] = useState(() => loadProgress(lang))
  const [flipped, setFlipped] = useState(false)
  const [sessionIndex, setSessionIndex] = useState(0)
  const [sessionDone, setSessionDone] = useState(false)

  const allIds = cards.map((c) => c.id)
  const queue =
    subMode === 'new'
      ? getNewCards(progress, allIds)
      : getDueCards(progress, allIds)

  const currentId = queue[sessionIndex]
  const currentCard = cards.find((c) => c.id === currentId)

  const handleRate = useCallback((rating) => {
    if (!currentCard) return
    const state = progress.cards?.[currentId]
    const newState = reviewCard(state, rating)
    const newProgress = updateCardProgress(lang, currentId, newState)
    setProgress(newProgress)
    setFlipped(false)
    if (sessionIndex + 1 >= queue.length) {
      setSessionDone(true)
    } else {
      setSessionIndex((i) => i + 1)
    }
  }, [currentCard, currentId, progress, lang, sessionIndex, queue.length])

  // Keyboard shortcuts: Space/Enter = flip, 1-4 = rate
  useEffect(() => {
    function handleKey(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!flipped && currentCard) setFlipped(true)
      } else if (flipped) {
        const map = { '1': 0, '2': 1, '3': 2, '4': 3 }
        if (map[e.key] !== undefined) handleRate(map[e.key])
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [flipped, handleRate, currentCard])

  function handleRestart() {
    setSessionIndex(0)
    setFlipped(false)
    setSessionDone(false)
    setProgress(loadProgress(lang))
  }

  if (queue.length === 0 || sessionDone) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-8">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {queue.length === 0 ? 'No cards to review!' : 'Session complete!'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          {queue.length === 0
            ? subMode === 'new'
              ? 'All cards have been introduced. Switch to "Practice Due" to review.'
              : 'No cards are due. Come back tomorrow!'
            : `You reviewed ${queue.length} card${queue.length !== 1 ? 's' : ''}. Great work!`}
        </p>
        <button
          onClick={handleRestart}
          className={`${langMeta.bgClass} text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition`}
        >
          Review Again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4 max-w-xl mx-auto w-full">
      {/* Progress */}
      <div className="w-full flex justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{sessionIndex + 1} / {queue.length}</span>
        <span className="capitalize">{subMode === 'new' ? '✨ New cards' : '🔁 Due cards'}</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div
          className={`${langMeta.bgClass} h-1.5 rounded-full transition-all`}
          style={{ width: `${(sessionIndex / queue.length) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div className="flip-card w-full max-w-md" style={{ height: 260 }}>
        <div className={`flip-card-inner w-full h-full relative ${flipped ? 'flipped' : ''}`}>
          {/* Front */}
          <div
            className="flip-card-front absolute inset-0 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 flex items-center justify-center p-8 cursor-pointer"
            onClick={() => { if (!flipped) setFlipped(true) }}
          >
            {!flipped && (
              <div className="w-full">
                <CardDisplay card={currentCard} lang={lang} />
                <p className="text-center text-gray-400 dark:text-gray-500 text-xs mt-6">Click to reveal · Space</p>
              </div>
            )}
          </div>
          {/* Back */}
          <div className="flip-card-back absolute inset-0 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 flex items-center justify-center p-8">
            <CardBack card={currentCard} lang={lang} />
          </div>
        </div>
      </div>

      {/* Rating buttons */}
      {flipped && (
        <div className="flex gap-2 w-full max-w-md">
          {RATING_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => handleRate(i)}
              className={`flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-all ${RATING_COLORS[i]}`}
              title={`Press ${i + 1}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Flip button */}
      {!flipped && (
        <button
          onClick={() => setFlipped(true)}
          className={`${langMeta.bgClass} text-white px-10 py-3 rounded-xl font-medium hover:opacity-90 transition`}
        >
          Flip Card
        </button>
      )}
    </div>
  )
}
