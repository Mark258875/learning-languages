import ReactMarkdown from 'react-markdown'
import { THEORY } from '../data/loader.js'

export default function TheoryView({ lang, section }) {
  const content = THEORY[lang]?.[section]

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
        <span className="text-4xl">📄</span>
        <p>No content found for <strong>{section}</strong>.</p>
        <p className="text-sm">Add a <code>{section}.md</code> file to <code>{lang}/theory/</code>.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="prose prose-gray max-w-none
        prose-headings:font-bold prose-headings:text-gray-800
        prose-h1:text-2xl prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
        prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2
        prose-table:border-collapse prose-table:w-full
        prose-th:bg-gray-100 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-sm
        prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-gray-200 prose-td:text-sm
        prose-code:bg-gray-100 prose-code:rounded prose-code:px-1 prose-code:text-sm
        prose-blockquote:border-l-4 prose-blockquote:border-amber-400 prose-blockquote:pl-4 prose-blockquote:text-gray-600
        prose-strong:text-gray-900
        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
      ">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
