import { LANGUAGES, getLang } from '../data/loader.js'

export default function LanguageNav({ activeLang, onSelect }) {
  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-1 h-14">
          <span className="text-lg font-bold text-gray-700 mr-4">🌍 LangLearn</span>
          {LANGUAGES.map((lang) => {
            const active = activeLang === lang.id
            return (
              <button
                key={lang.id}
                onClick={() => onSelect(lang.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  active
                    ? `${lang.bgClass} text-white shadow-md`
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                {lang.label}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
