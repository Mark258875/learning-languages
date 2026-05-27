import { useState } from 'react'
import LanguageNav from './components/LanguageNav.jsx'
import Sidebar from './components/Sidebar.jsx'
import Flashcard from './components/Flashcard.jsx'
import TheoryView from './components/TheoryView.jsx'
import AlphabetGrid from './components/AlphabetGrid.jsx'
import Quiz from './components/Quiz.jsx'
import PhrasesView from './components/PhrasesView.jsx'
import { VOCAB, getLang } from './data/loader.js'

export default function App() {
  const [activeLang, setActiveLang] = useState('french')
  const [activeMode, setActiveMode] = useState('vocabulary')
  const [activeSection, setActiveSection] = useState('all')
  const [subMode, setSubMode] = useState('due') // 'new' | 'due' | 'quiz' | 'alphabet'

  const langMeta = getLang(activeLang)

  function handleLangChange(lang) {
    setActiveLang(lang)
    setActiveMode('vocabulary')
    setActiveSection('all')
    setSubMode('due')
  }

  function handleModeChange(mode) {
    setActiveMode(mode)
    setActiveSection(mode === 'vocabulary' ? 'all' : Object.keys(VOCAB[activeLang]?.topics ?? {})[0] ?? 'grammar')
    setSubMode('due')
  }

  // Resolve which cards to show
  const vocabData = VOCAB[activeLang]
  const cards =
    activeSection === 'all'
      ? (vocabData?.all ?? [])
      : (vocabData?.topics?.[activeSection] ?? [])

  const phrases = vocabData?.phrases ?? []

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <LanguageNav activeLang={activeLang} onSelect={handleLangChange} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeLang={activeLang}
          activeMode={activeMode}
          activeSection={activeSection}
          onModeChange={handleModeChange}
          onSectionChange={setActiveSection}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {activeMode === 'theory' && (
            <TheoryView lang={activeLang} section={activeSection} />
          )}

          {activeMode === 'vocabulary' && (
            <>
              {/* Sub-mode bar */}
              <div className="bg-white border-b border-gray-200 px-6 py-3 flex gap-2 shrink-0">
                {[
                  { id: 'due', label: '🔁 Practice Due' },
                  { id: 'new', label: '✨ Learn New' },
                  { id: 'quiz', label: '🎯 Quiz' },
                  ...(activeLang !== 'french' ? [{ id: 'alphabet', label: activeLang === 'russian' ? '🔤 Azbuka' : '🔤 Pinyin' }] : []),
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setSubMode(btn.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      subMode === btn.id
                        ? `${langMeta.bgClass} text-white`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
                <span className="ml-auto text-sm text-gray-400 self-center">
                  {cards.length} cards
                </span>
              </div>

              <div className="flex-1">
                {subMode === 'alphabet' ? (
                  <AlphabetGrid lang={activeLang} />
                ) : subMode === 'quiz' ? (
                  cards.length >= 4 ? (
                    <Quiz cards={cards} lang={activeLang} />
                  ) : (
                    <EmptyState message="Need at least 4 cards to start a quiz." />
                  )
                ) : (
                  cards.length > 0 ? (
                    <Flashcard cards={cards} lang={activeLang} subMode={subMode} />
                  ) : (
                    <EmptyState message={`No cards in "${activeSection}". Add words to ${activeLang}/vocabulary/topics/${activeSection}.json`} />
                  )
                )}
              </div>
            </>
          )}

          {activeMode === 'phrases' && (
            <PhrasesView phrases={phrases} lang={activeLang} />
          )}
        </main>
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3 p-8 text-center">
      <span className="text-4xl">📭</span>
      <p className="max-w-sm text-sm">{message}</p>
    </div>
  )
}
