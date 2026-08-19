/**
 * @fileoverview Verweis-Parser fuer Berichte und Indizes — reine Funktion, KEIN LLM.
 *
 * @description
 * Kern der doppelten Buchhaltung (Projektauftrag §2 Leitprinzip 6): Die Bodies
 * von `BERICHT.md`/`_INDEX.md` sind Buch 1 (was die Akteure behaupten). Dieser
 * Parser extrahiert daraus die Verweise, die anschliessend gegen Buch 2 (das
 * gescannte Inventar) aufgeloest werden.
 *
 * Erkannt werden Obsidian-Wikilinks (`[[Ziel]]`, `[[Ziel|Alias]]`,
 * `![[Ziel]]`) und RELATIVE Markdown-Links (`[Text](Unterordner/Datei.md)`).
 * Externe Ziele (http/https/mailto), reine Anker (`#abschnitt`) und absolute
 * Pfade sind keine Bestands-Verweise und werden nicht geprueft.
 *
 * Die SEMANTISCHE Gegenkontrolle („sagt der Bericht, was das Transkript
 * sagt?") ist bewusst nicht Sache von KnowledgeScout (F5) — sie leistet die
 * naechste Cowork-Session ueber den Rueckmeldungsblock.
 *
 * @module agent-view
 */

export type ReferenceSyntax = 'wikilink' | 'markdown-link'

export interface ParsedReference {
  /** Ziel wie im Text (ohne Alias, ohne Anker). */
  target: string
  syntax: ReferenceSyntax
  /** Sichtbarer Text bzw. Alias (Anzeige im Befund). */
  label: string
}

const FENCED_CODE_RE = /```[\s\S]*?```|~~~[\s\S]*?~~~/g
const INLINE_CODE_RE = /`[^`\n]*`/g
const WIKILINK_RE = /!?\[\[([^\][|]+)(?:\|([^\]]*))?\]\]/g
const MD_LINK_RE = /!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

const EXTERNAL_PREFIX_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

/** Ist das Ziel ein bestandsinterner, pruefbarer Verweis? */
export function isCheckableTarget(raw: string): boolean {
  const target = raw.trim()
  if (target === '') return false
  if (target.startsWith('#')) return false
  if (target.startsWith('/')) return false
  if (EXTERNAL_PREFIX_RE.test(target)) return false
  return true
}

/** Entfernt Anker/Block-Referenz und dekodiert Prozent-Kodierung. */
export function normalizeTarget(raw: string): string {
  let target = raw.trim().split('#')[0].split('^')[0].trim()
  target = target.replace(/\\/g, '/').replace(/^\.\//, '')
  try {
    target = decodeURIComponent(target)
  } catch {
    // Ungueltige Prozent-Sequenz: Rohform weiterverwenden, nicht raten.
  }
  return target.replace(/\/+$/, '')
}

/**
 * Extrahiert alle pruefbaren Verweise aus einem Markdown-Body.
 * Code-Bloecke werden vorher entfernt (Beispielpfade sind keine Verweise).
 * Reihenfolge = Textreihenfolge, Duplikate bleiben erhalten (Zaehlung).
 */
export function parseReferences(body: string): ParsedReference[] {
  const text = body.replace(FENCED_CODE_RE, '\n').replace(INLINE_CODE_RE, ' ')
  const refs: ParsedReference[] = []

  for (const match of text.matchAll(WIKILINK_RE)) {
    const rawTarget = match[1] ?? ''
    if (!isCheckableTarget(rawTarget)) continue
    const target = normalizeTarget(rawTarget)
    if (target === '') continue
    refs.push({ target, syntax: 'wikilink', label: (match[2] ?? rawTarget).trim() })
  }

  for (const match of text.matchAll(MD_LINK_RE)) {
    const rawTarget = match[2] ?? ''
    if (!isCheckableTarget(rawTarget)) continue
    const target = normalizeTarget(rawTarget)
    if (target === '') continue
    refs.push({ target, syntax: 'markdown-link', label: (match[1] || rawTarget).trim() })
  }

  return refs
}

/** Verweise ohne Duplikate (erster Treffer gewinnt, Reihenfolge bleibt). */
export function uniqueReferences(refs: readonly ParsedReference[]): ParsedReference[] {
  const seen = new Set<string>()
  const out: ParsedReference[] = []
  for (const ref of refs) {
    const key = ref.target.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ref)
  }
  return out
}
