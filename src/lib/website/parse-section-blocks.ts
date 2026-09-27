/**
 * Bloecke INNERHALB einer Sektion (Welle S3): Kennzahl-Kacheln, Chips, Kasten.
 *
 * Konvention wie bei den Sektionen: HTML-Kommentar-Marker, Obsidian-kompatibel.
 *
 *   <!-- stats -->
 *   - **600+** Massnahmen
 *   - **5** Handlungsfelder
 *
 *   <!-- chips label="Traeger & Partnernetzwerk" -->
 *   - Verein A
 *   - Verein B
 *
 *   <!-- box label="Bald" kind=card -->
 *   **Aus der Praxis** — Initiativen eintragen.
 *   <!-- /box -->
 *
 * `stats` und `chips` nehmen die unmittelbar folgende Markdown-Liste; `box`
 * reicht bis `<!-- /box -->` (`kind` = `card` weiss mit Schatten, `note`
 * durchscheinender Streifen). Alles dazwischen bleibt Markdown. Fehler
 * (Kachel ohne `**Wert**`, Block ohne Liste, Kasten ohne Ende) werfen —
 * `seite_pruefen` und der Renderer melden sie, nichts wird still verschluckt.
 */

export interface StatsItem {
  value: string
  label: string
}

export type BoxKind = 'card' | 'note'
const BOX_KINDS: readonly BoxKind[] = ['card', 'note']

export type SectionContentBlock =
  | { type: 'markdown'; markdown: string }
  | { type: 'stats'; items: StatsItem[] }
  | { type: 'chips'; label?: string; items: string[] }
  | { type: 'box'; label?: string; kind: BoxKind; markdown: string }

const BLOCK_RE = /<!--\s*(stats|chips|box)\b([^>]*?)-->/g
const BOX_END_RE = /<!--\s*\/box\s*-->/
const ATTR_RE = /(\w+)\s*=\s*(?:"([^"]*)"|([\w-]+))/g
const LIST_LINE_RE = /^\s*[-*]\s+(.*\S)\s*$/
const STAT_RE = /^\*\*(.+?)\*\*\s+(.+)$/

function attrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  ATTR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTR_RE.exec(raw)) !== null) out[m[1]] = m[2] ?? m[3]
  return out
}

/** Nimmt die Liste direkt nach dem Marker; liefert Eintraege und den Rest-Text. */
function nimmListe(text: string, block: string): { items: string[]; rest: string } {
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length && lines[i].trim() === '') i++
  const items: string[] = []
  while (i < lines.length) {
    const m = lines[i].match(LIST_LINE_RE)
    if (!m) break
    items.push(m[1])
    i++
  }
  if (items.length === 0) throw new Error(`${block}-Block ohne Liste: direkt nach <!-- ${block} --> muss eine Markdown-Liste ("- …") stehen`)
  return { items, rest: lines.slice(i).join('\n') }
}

function pushMarkdown(blocks: SectionContentBlock[], text: string): void {
  const t = text.trim()
  if (t) blocks.push({ type: 'markdown', markdown: t })
}

/** Zerlegt den Markdown einer Sektion in Text- und Sonderbloecke. */
export function parseSectionBlocks(markdown: string): SectionContentBlock[] {
  const blocks: SectionContentBlock[] = []
  let rest = markdown
  for (;;) {
    BLOCK_RE.lastIndex = 0
    const m = BLOCK_RE.exec(rest)
    if (!m) break
    pushMarkdown(blocks, rest.slice(0, m.index))
    const name = m[1]
    const a = attrs(m[2] ?? '')
    const nach = rest.slice(m.index + m[0].length)
    if (name === 'box') {
      const ende = nach.match(BOX_END_RE)
      if (!ende || ende.index === undefined) throw new Error('box-Block ohne Ende: <!-- /box --> fehlt')
      const kind = a.kind ?? 'card'
      if (!(BOX_KINDS as readonly string[]).includes(kind)) {
        throw new Error(`Ungueltiges box kind="${kind}". Erlaubt: ${BOX_KINDS.join(', ')}`)
      }
      blocks.push({ type: 'box', label: a.label?.trim() || undefined, kind: kind as BoxKind, markdown: nach.slice(0, ende.index).trim() })
      rest = nach.slice(ende.index + ende[0].length)
      continue
    }
    const { items, rest: danach } = nimmListe(nach, name)
    if (name === 'stats') {
      const stats = items.map((zeile) => {
        const s = zeile.match(STAT_RE)
        if (!s) throw new Error(`Kachel-Zeile "${zeile}" — erwartet "- **Wert** Beschriftung"`)
        return { value: s[1].trim(), label: s[2].trim() }
      })
      blocks.push({ type: 'stats', items: stats })
    } else {
      blocks.push({ type: 'chips', label: a.label?.trim() || undefined, items: items.map((z) => z.replace(/\*\*/g, '').trim()) })
    }
    rest = danach
  }
  pushMarkdown(blocks, rest)
  return blocks
}
