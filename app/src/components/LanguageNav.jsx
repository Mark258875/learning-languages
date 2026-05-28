import { LANGUAGES } from '../data/loader.js'

export default function LanguageNav({ activeLang, onSelect, onToggleSidebar, onOpenQuickLookup }) {
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm shrink-0 z-30">
      <div className="px-4">
        <div className="flex items-center gap-1 h-14">
          {/* Hamburger — mobile only */}
          <button
            onClick={onToggleSidebar}
            className="md:hidden mr-2 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
            aria-label="Toggle sidebar"
          >
            <span className="text-xl leading-none">☰</span>
          </button>

          <span className="text-lg font-bold text-gray-700 dark:text-gray-200 mr-4 shrink-0">🌍 LangLearn</span>

          {/* Language buttons */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {LANGUAGES.map((lang) => {
              const active = activeLang === lang.id
              return (
                <button
                  key={lang.id}
                  onClick={() => onSelect(lang.id)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium text-sm transition-all shrink-0 ${
                    active
                      ? `${lang.bgClass} text-white shadow-md`
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="hidden sm:inline">{lang.label}</span>
                </button>
              )
            })}
          </div>

          {/* Quick Lookup button */}
          <button
            onClick={onOpenQuickLookup}
            className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-600"
            title="Quick Lookup (/ or Ctrl+K)"
            aria-label="Quick Lookup"
          >
            <span>🔍</span>
            <span className="hidden sm:inline">Quick Lookup</span>
            <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 font-normal ml-0.5">/</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
