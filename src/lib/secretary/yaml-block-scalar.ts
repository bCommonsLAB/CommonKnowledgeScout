/**
 * @fileoverview YAML-Block-Scalars im Frontmatter lesen (`key: |`, `|-`, `|+`, `>`, `>-`, `>+`)
 *
 * @description
 * Der Frontmatter-Parser liest `key: value` zeilenweise. Ein Block-Scalar
 * (`summary: |` + eingerueckte Zeilen) wurde dabei frueher zerlegt: der Kopf
 * wurde zum Wert `"|"`, jede Inhaltszeile mit Doppelpunkt zu einem eigenen
 * Top-Level-Key (Befund 16.10.2026). Dieses Modul sammelt den eingerueckten
 * Inhalt zu EINEM String nach den YAML-Regeln fuer Literal (`|`) und
 * gefaltete (`>`) Scalars samt Chomping (`-` strip, `+` keep, sonst clip).
 *
 * Geschrieben wird Frontmatter weiterhin nur ueber `createMarkdownWithFrontmatter`
 * (ein Wert je Zeile, JSON-quotiert); Block-Scalars kommen nur von aussen
 * (Obsidian, aeltere Editoren) und werden hier gelesen, nie erzeugt.
 *
 * @module secretary
 */

/** Kopf eines Block-Scalars: `|` oder `>`, optional Chomping und Einrueckungsziffer. */
const BLOCK_HEADER = /^([|>])([+-]?)([1-9]?)([+-]?)$/

export interface BlockScalarResult {
  value: string
  /** Index der ersten Zeile NACH dem Block */
  nextIndex: number
}

function indentOf(line: string): number {
  const m = line.match(/^ */)
  return m ? m[0].length : 0
}

export function isBlockScalarHeader(rawValue: string): boolean {
  return BLOCK_HEADER.test(rawValue)
}

/**
 * Liest den Inhalt eines Block-Scalars ab `startIndex` (erste Zeile nach dem Kopf).
 * Zum Block gehoeren Leerzeilen und alle Zeilen, die tiefer eingerueckt sind
 * als die Kopfzeile. Folgt kein eingerueckter Inhalt, ist der Wert "" (YAML).
 */
export function readBlockScalar(
  lines: string[],
  startIndex: number,
  headerLine: string,
  rawValue: string,
): BlockScalarResult {
  const m = rawValue.match(BLOCK_HEADER)
  if (!m) throw new Error(`Kein Block-Scalar-Kopf: "${rawValue}"`)
  const style = m[1] as '|' | '>'
  const chomping = m[2] || m[4]
  const headerIndent = indentOf(headerLine)

  // Einrueckung des Blocks = die der ersten nicht-leeren Zeile (oder explizite Ziffer).
  let blockIndent = m[3] ? headerIndent + Number(m[3]) : -1
  let i = startIndex
  if (blockIndent < 0) {
    for (let j = startIndex; j < lines.length; j++) {
      if (lines[j]!.trim() === '') continue
      blockIndent = indentOf(lines[j]!)
      break
    }
  }
  if (blockIndent <= headerIndent) return { value: '', nextIndex: startIndex }

  const content: string[] = []
  for (; i < lines.length; i++) {
    const line = lines[i]!.replace(/\r$/, '')
    if (line.trim() === '') { content.push(''); continue }
    if (indentOf(line) < blockIndent) break
    content.push(line.slice(blockIndent))
  }

  // Abschliessende Leerzeilen fuer das Chomping abtrennen.
  let end = content.length
  while (end > 0 && content[end - 1] === '') end--
  const body = content.slice(0, end)
  const trailingBlank = content.length - end
  // Leerzeilen am Ende, die schon zur naechsten Struktur gehoeren, nicht verbrauchen.
  const nextIndex = i - trailingBlank

  let text: string
  if (style === '|') {
    text = body.join('\n')
  } else {
    // Gefaltet: benachbarte Zeilen mit Leerzeichen verbinden, Leerzeilen werden Umbrueche.
    text = ''
    for (let k = 0; k < body.length; k++) {
      const cur = body[k]!
      if (k === 0) { text = cur; continue }
      const prev = body[k - 1]!
      if (cur === '') text += '\n'
      else if (prev === '') text += cur
      // Tiefer eingerueckte Zeilen werden nicht gefaltet (YAML „more-indented").
      else if (cur.startsWith(' ') || prev.startsWith(' ')) text += `\n${cur}`
      else text += ` ${cur}`
    }
  }

  if (body.length === 0) return { value: '', nextIndex }
  if (chomping === '-') return { value: text, nextIndex }
  if (chomping === '+') return { value: text + '\n'.repeat(trailingBlank + 1), nextIndex: i }
  return { value: `${text}\n`, nextIndex }
}
