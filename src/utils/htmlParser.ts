// Parser HTML seguro para browser e Node.js

/**
 * Parse HTML de forma segura usando DOMParser do browser ou cheerio no Node.js
 */
export function parseHtmlSafe(html: string): {
  querySelector: (selector: string) => Element | null
  querySelectorAll: (selector: string) => Element[]
  isCheerio: boolean
} {
  // Browser environment
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    
    return {
      querySelector: (selector: string) => doc.querySelector(selector),
      querySelectorAll: (selector: string) => Array.from(doc.querySelectorAll(selector)),
      isCheerio: false
    }
  }
  
  // Node environment: use cheerio (instale: npm i cheerio)
  // require aqui para não quebrar bundlers/browser
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cheerio = require('cheerio')
  const $ = cheerio.load(html)
  
  return {
    querySelector: (selector: string) => {
      const result = $(selector).first()
      return result.length > 0 ? result[0] : null
    },
    querySelectorAll: (selector: string) => {
      return Array.from($(selector))
    },
    isCheerio: true
  }
}
