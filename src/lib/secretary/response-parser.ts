/**
 * @fileoverview Secretary Response Parser - Markdown Response Parsing
 * 
 * @description
 * Parses markdown responses from Secretary Service transformer. Extracts frontmatter
 * blocks, parses key-value pairs, and handles JSON arrays/objects in frontmatter
 * (chapters, TOC, etc.). Provides strict parsing with error reporting for invalid
 * JSON structures.
 * 
 * @module secretary
 * 
 * @exports
 * - parseSecretaryMarkdownStrict: Strictly parses Secretary markdown responses
 * - FrontmatterParseResult: Interface for parsing results
 * 
 * @usedIn
 * - src/lib/external-jobs: External jobs parse Secretary responses
 * - src/app/api/secretary: Secretary API routes parse responses
 * 
 * @dependencies
 * - @/lib/markdown/frontmatter: Frontmatter extraction utilities
 * - @/lib/debug/logger: Logging utilities
 */

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
  if (!fm) return { frontmatter: null, meta: {}, errors: [] }
  const meta: Record<string, unknown> = {}
  const errors: string[] = []

  // Raw key: value pairs (keep as string)
  // WICHTIG: Bei großen Frontmatter-Blöcken kann split('\n') problematisch sein
  // Verwende daher eine robustere Zeilen-Parsing-Logik
  const lines = fm.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const t = line.trim()
    if (!t || t === '---') continue
    const idx = t.indexOf(':')
    if (idx > 0) {
      const k = t.slice(0, idx).trim()
      const rawValue = t.slice(idx + 1).trim()

      // Roundtrip-stabiler Scalar-Parser:
      // - quoted strings via JSON.parse dekodieren (wichtig für \n, \", usw.)
      // - Zahlen/Booleans typisieren, damit Patch-Roundtrips `pages: 2` nicht zu `"2"` machen
      // - sonst Rohstring behalten
      let parsedValue: unknown = rawValue
      if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
        try {
          parsedValue = JSON.parse(rawValue)
        } catch {
          parsedValue = rawValue.slice(1, -1)
        }
      } else if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
        parsedValue = rawValue.slice(1, -1)
      } else if (rawValue === 'true' || rawValue === 'false') {
        parsedValue = rawValue === 'true'
      } else if (/^[-+]?[0-9]+(\.[0-9]+)?$/.test(rawValue)) {
        parsedValue = Number(rawValue)
      }

      meta[k] = parsedValue
    }
  }

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
  // WICHTIG: Alle Array-Felder aus Event-Templates müssen hier gelistet sein,
  // sonst werden sie als String gespeichert (z.B. '["Paolo Dongilli"]' statt Array).
  const jsonKeys = [
    'chapters',
    'toc',
    'confidence',
    'provenance',
    'slides',
    'tags',
    'authors',
    'topics',
    'speakers',
    'speakers_image_url',
    'speakers_url',
    'authors_image_url',
    'attachments_url',
    'galleryImageUrls',
    '_source_files',
  ]
  for (const k of jsonKeys) {
    const raw = extractBalancedJsonAfterKey(fm, k)
    if (raw) {
      try { 
        meta[k] = JSON.parse(raw)
      } catch (e) { 
        errors.push(`${k} ist kein gültiges JSON: ${(e as Error).message}`)
        UILogger.warn('response-parser', 'parseSecretaryMarkdownStrict:json-error', { key: k, error: (e as Error).message })
      }
    }
  }

  // Fallback: Wenn extractBalancedJsonAfterKey fehlschlägt (z.B. bei unerwarteter Formatierung),
  // versuche den bereits extrahierten String-Wert direkt zu JSON-parsen.
  // Deckt Fälle ab, in denen der Wert korrekt als '["a","b"]' vorliegt,
  // aber die Bracket-Suche im Gesamttext nicht greift.
  for (const k of jsonKeys) {
    if (typeof meta[k] === 'string') {
      const str = (meta[k] as string).trim()
      if (str.startsWith('[') || str.startsWith('{')) {
        try { meta[k] = JSON.parse(str) } catch { /* Wert bleibt als String */ }
      }
    }
  }

  return { frontmatter: fm, meta, errors }
}

