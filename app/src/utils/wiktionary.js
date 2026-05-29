/**
 * Shared Wiktionary helpers used by LookupView and QuickLookup.
 */

export const WIKT_API = 'https://en.wiktionary.org/w/api.php'
export const WIKT_LANG = { french: 'French', russian: 'Russian', chinese: 'Chinese' }

export function externalLookupLinks(word, lang) {
  const encoded = encodeURIComponent(word)
  const links = [
    {
      id: 'wiktionary',
      label: 'Open in Wiktionary ↗',
      url: `https://en.wiktionary.org/wiki/${encoded}`,
    },
  ]
  if (lang === 'french') {
    links.push({
      id: 'lingea',
      label: 'Open in Lingea ↗',
      url: `https://slovniky.lingea.cz/francouzsko-anglicky/${encoded}`,
    })
  }
  return links
}

/**
 * Parse the wikitext of a Wiktionary page and extract the relevant data
 * for the given target language section.
 */
export function parseWikitext(wikitext, targetLang) {
  const parts = wikitext.split(/(?=\n==[^=][^=]*==\n)/)
  let langSection = null
  for (const part of parts) {
    const header = part.match(/^[\n]*==([^=]+)==\n/)
    if (header && header[1].trim().toLowerCase() === targetLang.toLowerCase()) {
      langSection = part
      break
    }
  }
  if (!langSection) return null

  const ipaMatch = langSection.match(/\{\{IPA\|[^|]*\|([^|}]+)/)
  const ipa = ipaMatch ? ipaMatch[1].trim() : null

  const posMatch = langSection.match(
    /===\s*(Noun|Verb|Adjective|Adverb|Pronoun|Phrase|Interjection|Conjunction|Preposition|Particle)\s*===/
  )
  const pos = posMatch ? posMatch[1].toLowerCase() : null

  let gender = null
  if (/\{\{fr-noun\|m/.test(langSection) || /g=m/.test(langSection)) gender = 'masculine'
  else if (/\{\{fr-noun\|f/.test(langSection) || /g=f/.test(langSection)) gender = 'feminine'

  const rawDefs = [...langSection.matchAll(/^# ([^#:\n][^\n]*)/gm)]
    .map((m) =>
      m[1]
        .replace(/\{\{[^}]+\}\}/g, '')
        .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
        .replace(/'{2,3}/g, '')
        .replace(/^\s*[:;]\s*/, '')
        .trim()
    )
    .filter(Boolean)

  const uxMatch = langSection.match(/\{\{ux\|[^|]+\|([^|}\n]+)/)
  const italicMatch = langSection.match(/^#: ''([^']+)''/m)
  const example = uxMatch
    ? uxMatch[1].trim()
    : italicMatch
    ? italicMatch[1].trim()
    : null

  let pinyin = null
  const pinyinMatch = langSection.match(/\|m=([a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s]+)/i)
  if (pinyinMatch) pinyin = pinyinMatch[1].trim().split('\n')[0].split('|')[0].trim()

  return {
    ipa,
    pos,
    gender,
    pinyin,
    definitions: rawDefs.slice(0, 3),
    definition: rawDefs[0] || null,
    example,
  }
}

/**
 * Build a pending vocab entry (repo schema) from a Wiktionary parse result.
 */
export function buildEntry(word, parsed, lang) {
  const base = {
    id: '',
    translation: parsed.definition || '',
    tags: ['lookup'],
    source: 'wiktionary',
    verified: false,
  }
  if (parsed.example) {
    base.example = parsed.example
    base.example_translation = ''
  }
  if (lang === 'chinese') {
    return {
      ...base,
      simplified: word,
      traditional: '',
      pinyin: parsed.pinyin || parsed.ipa || '',
    }
  }
  return {
    ...base,
    word,
    pronunciation: parsed.ipa || '',
    ...(lang === 'french' && parsed.gender ? { gender: parsed.gender } : {}),
  }
}

/**
 * Fetch Wiktionary full article wikitext for a word.
 * Returns the parsed result object or null if not found.
 */
export async function wiktionaryLookup(word, lang) {
  const url =
    `${WIKT_API}?action=parse&page=${encodeURIComponent(word)}` +
    `&prop=wikitext&format=json&origin=*`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Network error: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.info)
  const wikitext = data.parse?.wikitext?.['*'] || ''
  return parseWikitext(wikitext, WIKT_LANG[lang])
}

/**
 * Fetch Wiktionary opensearch suggestions (for autocomplete + auto-correct).
 * Returns an array of suggestion strings.
 */
export async function fetchSuggestions(query, limit = 5) {
  const url = `${WIKT_API}?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&format=json&origin=*`
  const res = await fetch(url)
  const data = await res.json()
  return data[1] ?? []
}
