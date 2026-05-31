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
import QuickLookup from './components/QuickLookup.jsx'
import { VOCAB, getLang } from './data/loader.js'
import { requestVocabGeneration } from './utils/github.js'

export default function App() {
  const [activeLang, setActiveLang] = useState('french')
  const [activeMode, setActiveMode] = useState('vocabulary')
  const [activeSection, setActiveSection] = useState('all')
  const [subMode, setSubMode] = useState('due')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ll_dark') === 'true')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [quickLookupOpen, setQuickLookupOpen] = useState(false)
  const [cefrLevel, setCefrLevel] = useState('A2')
  const [generateState, setGenerateState] = useState('idle')
  const [generateError, setGenerateError] = useState('')
  const [workflowUrl, setWorkflowUrl] = useState('')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('ll_dark', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    if (activeMode !== 'vocabulary') return
    setGenerateState('idle')
    setGenerateError('')
    setWorkflowUrl('')
  }, [activeLang, activeSection, activeMode])

  // Global keyboard shortcut: `/` or `Ctrl+K` opens Quick Lookup
  useEffect(() => {
    const handler = (e) => {
      if (quickLookupOpen) return
      const tag = document.activeElement?.tagName
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable
      if ((e.key === '/' && !isEditing) || (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault()
        setQuickLookupOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [quickLookupOpen])

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

  async function handleGenerateVocab() {
    const token = localStorage.getItem('ll_github_token')?.trim() || ''
    if (!token) {
      setGenerateState('error')
      setGenerateError('Set up a GitHub token in Lookup → Token setup first.')
      return
    }
    if (!activeSection || activeSection === 'all') {
      setGenerateState('error')
      setGenerateError('Select a specific vocabulary topic first.')
      return
    }

    setGenerateState('running')
    setGenerateError('')
    setWorkflowUrl('')
    try {
      const res = await requestVocabGeneration(token, {
        lang: activeLang,
        topic: activeSection,
        count: 20,
        cefrLevel,
      })
      setWorkflowUrl(res.workflowUrl)
      setGenerateState('success')
    } catch (err) {
      setGenerateState('error')
      setGenerateError(err?.message || 'Failed to request vocabulary generation.')
    }
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
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        onOpenQuickLookup={() => setQuickLookupOpen(true)}
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
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(d => !d)}
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
                <div className="ml-auto shrink-0 flex items-center gap-2 pl-2">
                  <div className="flex items-center gap-1">
                    {['A2', 'B2', 'C1'].map((level) => (
                      <button
                        key={level}
                        onClick={() => setCefrLevel(level)}
                        className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                          cefrLevel === level
                            ? `${langMeta.bgClass} text-white`
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                        title={`Use ${level} level for generated vocabulary`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleGenerateVocab}
                    disabled={generateState === 'running' || activeSection === 'all'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all ${
                      generateState === 'running' || activeSection === 'all'
                        ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                        : `${langMeta.bgClass} hover:opacity-90`
                    }`}
                    title={activeSection === 'all' ? 'Pick a topic first' : 'Generate new words for current topic'}
                  >
                    {generateState === 'running' ? '⏳ Requesting…' : '🤖 Generate words'}
                  </button>
                  <span className="text-sm text-gray-400 dark:text-gray-500 self-center">
                    {cards.length} cards
                  </span>
                </div>
              </div>
              {generateState === 'error' && (
                <div className="px-4 sm:px-6 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/40">
                  ❌ {generateError}
                </div>
              )}
              {generateState === 'success' && (
                <div className="px-4 sm:px-6 py-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-900/40">
                  ✅ Generation requested for <strong>{activeLang}</strong> / <strong>{activeSection}</strong> ({cefrLevel}).
                  {workflowUrl && (
                    <a href={workflowUrl} target="_blank" rel="noreferrer" className="underline ml-1">
                      Open workflow ↗
                    </a>
                  )}
                </div>
              )}

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

      {/* Quick Lookup modal */}
      {quickLookupOpen && (
        <QuickLookup
          lang={activeLang}
          langMeta={langMeta}
          onClose={() => setQuickLookupOpen(false)}
        />
      )}
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
