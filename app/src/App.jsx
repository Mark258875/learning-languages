import { useState, useEffect } from 'react'
import LanguageNav from './components/LanguageNav.jsx'
import Sidebar from './components/Sidebar.jsx'
import Flashcard from './components/Flashcard.jsx'
import TheoryView from './components/TheoryView.jsx'
import AlphabetGrid from './components/AlphabetGrid.jsx'
import Quiz from './components/Quiz.jsx'
import PhrasesView from './components/PhrasesView.jsx'
import LookupView from './components/LookupView.jsx'
import VocabBrowser from './components/VocabBrowser.jsx'
import { VOCAB, getLang } from './data/loader.js'

export default function App() {
  const [activeLang, setActiveLang] = useState('french')
  const [activeMode, setActiveMode] = useState('vocabulary')
  const [activeSection, setActiveSection] = useState('all')
  const [subMode, setSubMode] = useState('due')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ll_dark') === 'true')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('ll_dark', String(darkMode))
  }, [darkMode])

  const langMeta = getLang(activeLang)

  function handleLangChange(lang) {
    setActiveLang(lang)
    setActiveMode('vocabulary')
    setActiveSection('all')
    setSubMode('due')
    setSidebarOpen(false)
  }

  function handleModeChange(mode) {
    setActiveMode(mode)
    if (mode !== 'lookup') {
      setActiveSection(mode === 'vocabulary' ? 'all' : Object.keys(VOCAB[activeLang]?.topics ?? {})[0] ?? 'grammar')
    }
    setSubMode('due')
    setSidebarOpen(false)
  }

  const vocabData = VOCAB[activeLang]
  const cards =
    activeSection === 'all'
      ? (vocabData?.all ?? [])
      : (vocabData?.topics?.[activeSection] ?? [])

  const phrases = vocabData?.phrases ?? []

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <LanguageNav
        activeLang={activeLang}
        onSelect={handleLangChange}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(d => !d)}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-10 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          activeLang={activeLang}
          activeMode={activeMode}
          activeSection={activeSection}
          onModeChange={handleModeChange}
          onSectionChange={(s) => { setActiveSection(s); setSidebarOpen(false) }}
          isOpen={sidebarOpen}
        />

        <main className="flex-1 overflow-y-auto flex flex-col dark:bg-gray-900">
          {activeMode === 'theory' && (
            <TheoryView lang={activeLang} section={activeSection} />
          )}

          {activeMode === 'vocabulary' && (
            <>
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 flex gap-2 shrink-0 overflow-x-auto">
                {[
                  { id: 'due', label: '🔁 Practice Due' },
                  { id: 'new', label: '✨ Learn New' },
                  { id: 'quiz', label: '🎯 Quiz' },
                  { id: 'browse', label: '📋 Browse' },
                  ...(activeLang !== 'french' ? [{ id: 'alphabet', label: activeLang === 'russian' ? '🔤 Azbuka' : '🔤 Pinyin' }] : []),
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setSubMode(btn.id)}
                    className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      subMode === btn.id
                        ? `${langMeta.bgClass} text-white`
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
                <span className="ml-auto shrink-0 text-sm text-gray-400 dark:text-gray-500 self-center pl-2">
                  {cards.length} cards
                </span>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                {subMode === 'browse' ? (
                  <VocabBrowser
                    lang={activeLang}
                    cards={vocabData?.all ?? []}
                    topics={vocabData?.topics ?? {}}
                  />
                ) : subMode === 'alphabet' ? (
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

          {activeMode === 'lookup' && (
            <LookupView lang={activeLang} langMeta={langMeta} />
          )}
        </main>
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500 gap-3 p-8 text-center">
      <span className="text-4xl">📭</span>
      <p className="max-w-sm text-sm">{message}</p>
    </div>
  )
}
