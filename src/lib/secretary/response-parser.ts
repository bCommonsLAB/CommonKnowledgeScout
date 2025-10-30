import { extractFrontmatterBlock } from '@/lib/markdown/frontmatter'
import { UILogger } from '@/lib/debug/logger'

export interface FrontmatterParseResult {
  frontmatter: string | null
  meta: Record<string, unknown>
  errors: string[]
}

/**
 * Strictly parse a Markdown string produced by the Secretary transformer.
 * - Extracts the first frontmatter block via --- ... ---
 * - Parses key: value lines as raw strings without coercion
 * - Parses chapters/toc only if they are valid JSON arrays
 * - Returns errors for any JSON parse failures (no tolerance)
 */
export function parseSecretaryMarkdownStrict(markdown: string): FrontmatterParseResult {
  const fm = extractFrontmatterBlock(markdown)
  UILogger.debug('response-parser', 'parseSecretaryMarkdownStrict:start', {
    markdownLength: typeof markdown === 'string' ? markdown.length : 0,
    hasFrontmatter: !!fm
  })
  if (!fm) return { frontmatter: null, meta: {}, errors: [] }
  const meta: Record<string, unknown> = {}
  const errors: string[] = []

  // Raw key: value pairs (keep as string)
  for (const line of fm.split('\n')) {
    const t = line.trim()
    if (!t || t === '---') continue
    const idx = t.indexOf(':')
    if (idx > 0) {
      const k = t.slice(0, idx).trim()
      const v = t.slice(idx + 1)
      meta[k] = v
    }
  }
  UILogger.debug('response-parser', 'parseSecretaryMarkdownStrict:raw-keys', {
    keys: Object.keys(meta)
  })

  // Generische, robuste JSON-Extraktion (Array oder Objekt) nach einem Schlüssel.
  function extractBalancedJsonAfterKey(text: string, key: string): string | null {
    const keyIdx = text.indexOf(`${key}:`)
    if (keyIdx === -1) return null
    let i = keyIdx + key.length + 1
    while (i < text.length && /\s/.test(text[i]!)) i++
    const opener = text[i]
    const closer = opener === '[' ? ']' : opener === '{' ? '}' : null
    if (!closer) return null
    const start = i
    let depth = 0
    let inString = false
    let quote: '"' | "'" | null = null
    let escaped = false
    for (; i < text.length; i++) {
      const ch = text[i]!
      if (inString) {
        if (escaped) { escaped = false; continue }
        if (ch === '\\') { escaped = true; continue }
        if (ch === quote) { inString = false; quote = null; continue }
        continue
      }
      if (ch === '"' || ch === "'") { inString = true; quote = ch as '"' | "'"; continue }
      if (ch === opener) { depth++; continue }
      if (ch === closer) { depth--; if (depth === 0) { const end = i + 1; return text.slice(start, end) } }
    }
    return null
  }

  // Spezifische Schlüssel, die JSON enthalten können
  const jsonKeys = ['chapters', 'toc', 'confidence', 'provenance', 'slides']
  for (const k of jsonKeys) {
    const raw = extractBalancedJsonAfterKey(fm, k)
    if (raw) {
      try { 
        meta[k] = JSON.parse(raw)
        UILogger.debug('response-parser', 'parseSecretaryMarkdownStrict:json-parsed', { key: k, length: raw.length })
      } catch (e) { 
        errors.push(`${k} ist kein gültiges JSON: ${(e as Error).message}`)
        UILogger.warn('response-parser', 'parseSecretaryMarkdownStrict:json-error', { key: k, error: (e as Error).message })
      }
    }
  }

  UILogger.debug('response-parser', 'parseSecretaryMarkdownStrict:done', {
    keyCount: Object.keys(meta).length,
    errorCount: errors.length
  })

  return { frontmatter: fm, meta, errors }
}

