/**
 * Lingea dictionary helpers — URL builders and external reference links.
 *
 * Lingea (slovniky.lingea.cz) is used as a primary external reference for
 * French↔English lookups. No API is available, so we link out to the site.
 */

/**
 * Build a Lingea FR→EN lookup URL.
 */
export function lingeaFrEnUrl(word) {
  return `https://slovniky.lingea.cz/francouzsko-anglicky/${encodeURIComponent(word)}`
}

/**
 * Build a Lingea EN→FR lookup URL.
 */
export function lingeaEnFrUrl(word) {
  return `https://slovniky.lingea.cz/anglicko-francouzsky/${encodeURIComponent(word)}`
}

/**
 * Build a WordReference FR→EN URL.
 */
export function wordReferenceFrEnUrl(word) {
  return `https://www.wordreference.com/fren/${encodeURIComponent(word)}`
}

/**
 * Build a WordReference EN→FR URL.
 */
export function wordReferenceEnFrUrl(word) {
  return `https://www.wordreference.com/enfr/${encodeURIComponent(word)}`
}

/**
 * Generate external lookup links for a word based on language and direction.
 *
 * @param {string} word
 * @param {'french'|'russian'|'chinese'} lang
 * @param {'target'|'english'} direction - 'target' means the word is in the target language
 * @returns {Array<{id: string, label: string, url: string}>}
 */
export function externalLinks(word, lang, direction = 'target') {
  const encoded = encodeURIComponent(word)
  const links = [
    {
      id: 'wiktionary',
      label: 'Wiktionary ↗',
      url: `https://en.wiktionary.org/wiki/${encoded}`,
    },
  ]

  if (lang === 'french') {
    if (direction === 'target') {
      links.unshift({
        id: 'lingea',
        label: 'Lingea FR→EN ↗',
        url: lingeaFrEnUrl(word),
      })
      links.push({
        id: 'wordreference',
        label: 'WordReference ↗',
        url: wordReferenceFrEnUrl(word),
      })
    } else {
      links.unshift({
        id: 'lingea',
        label: 'Lingea EN→FR ↗',
        url: lingeaEnFrUrl(word),
      })
      links.push({
        id: 'wordreference',
        label: 'WordReference ↗',
        url: wordReferenceEnFrUrl(word),
      })
    }
  }

  return links
}
