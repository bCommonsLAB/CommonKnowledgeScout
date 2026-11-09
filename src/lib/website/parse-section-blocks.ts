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
 *   <!-- questions -->          (Welle N1, nur in layout=story)
 *   - Wie veraendert der Klimawandel die Artenvielfalt?
 *
 *   <!-- cards -->              (Welle N2, in jeder Sektion)
 *   <!-- popular n=5 -->        (09.11.2026, nur in layout=story; keine Liste, Fragen aus dem Fragen-Log)
 *   - **Das Archiv entdecken** Stoebere in Studien. [Zum Archiv →](?view=gallery)
 *
 * `stats`, `chips`, `questions` und `cards` nehmen die unmittelbar folgende Markdown-Liste; `box`
 * reicht bis `<!-- /box -->` (`kind` = `card` weiss mit Schatten, `note`
 * durchscheinender Streifen). Alles dazwischen bleibt Markdown. Fehler
 * (Kachel ohne `**Wert**`, Block ohne Liste, Kasten ohne Ende) werfen —
 * `seite_pruefen` und der Renderer melden sie, nichts wird still verschluckt.
 */

import { loeseKartenziel } from './kartenziel'

export interface StatsItem {
  value: string
  label: string
}

/**
 * Erlaubte Symbole einer Kachel (Welle N4, `:name:` am Anfang des Textes).
 * Kuratierte Liste — der Renderer (`section-cards.tsx`) bildet jeden Namen auf
 * ein Lucide-Icon ab; ein unbekannter Name wirft beim Parsen (kein stiller
 * Fallback). Neue Symbole: hier UND in der Map im Renderer ergaenzen.
 */
export const CARD_ICON_NAMES = [
  'archive', 'list', 'help', 'book', 'search', 'map', 'info', 'compass', 'leaf', 'users', 'file', 'calendar', 'image', 'message', 'sparkles',
] as const
export type CardIconName = (typeof CARD_ICON_NAMES)[number]

/** Eine Kachel des Blocks `cards` (Welle N2); `href` ist schon gegen `loeseKartenziel` geprueft. */
export interface CardItem {
  title: string
  text: string
  linkLabel: string
  href: string
  /** Welle N4: optionales Symbol (`:name:` am Textanfang), aus `CARD_ICON_NAMES`. */
  icon?: CardIconName
}

export type BoxKind = 'card' | 'note'
const BOX_KINDS: readonly BoxKind[] = ['card', 'note']

export type SectionContentBlock =
  | { type: 'markdown'; markdown: string }
  | { type: 'stats'; items: StatsItem[] }
  | { type: 'chips'; label?: string; items: string[] }
  | { type: 'box'; label?: string; kind: BoxKind; markdown: string }
  /** Welle N1: Beispielfragen der Story-Sektion (`<!-- questions -->` + Liste); nur in `layout=story` erlaubt (Sektions-Parser). */
  | { type: 'questions'; items: string[] }
  /** Welle N2: Kacheln mit Titel, Text und Link (`<!-- cards -->` + Liste); in jeder Sektion erlaubt. */
  | { type: 'cards'; items: CardItem[] }
  /** 09.11.2026 (SFSCON): meistgestellte Fragen der Library (`<!-- popular n=5 -->`, ohne Liste); nur in `layout=story` erlaubt (Sektions-Parser). */
  | { type: 'popular'; n: number }

const BLOCK_RE = /<!--\s*(stats|chips|box|questions|cards|popular)\b([^>]*?)-->/g
const BOX_END_RE = /<!--\s*\/box\s*-->/
const ATTR_RE = /(\w+)\s*=\s*(?:"([^"]*)"|([\w-]+))/g
const LIST_LINE_RE = /^\s*[-*]\s+(.*\S)\s*$/
const STAT_RE = /^\*\*(.+?)\*\*\s+(.+)$/
const CARD_RE = /^\*\*(.+?)\*\*\s*(.*?)\s*\[([^\]]+)\]\(([^)\s]+)\)$/

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

/** Ein fuehrendes `:name:` am Textanfang (Welle N4); unbekannter Name wirft. */
const CARD_ICON_RE = /^:([a-z0-9-]+):\s*([\s\S]*)$/

/** Eine Zeile "**Titel** [:symbol:] Text [Linktext](Ziel)"; ohne Titel oder Link, mit unbekanntem Ziel/Symbol wirft sie. */
function kachel(zeile: string): CardItem {
  const m = zeile.match(CARD_RE)
  if (!m) throw new Error(`Karten-Zeile "${zeile}" — erwartet "- **Titel** Text [Linktext](Ziel)"`)
  const href = m[4]
  loeseKartenziel(href)
  let text = m[2].trim()
  let icon: CardIconName | undefined
  const im = text.match(CARD_ICON_RE)
  if (im) {
    if (!(CARD_ICON_NAMES as readonly string[]).includes(im[1])) {
      throw new Error(`Unbekanntes Karten-Symbol ":${im[1]}:" — erlaubt: ${CARD_ICON_NAMES.join(', ')}`)
    }
    icon = im[1] as CardIconName
    text = im[2].trim()
  }
  return { title: m[1].trim(), text, linkLabel: m[3].trim(), href, icon }
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
    if (name === 'popular') {
      const roh = a.n ?? '5'
      const n = Number(roh)
      if (!Number.isInteger(n) || n < 1 || n > 12) throw new Error(`popular n="${roh}" — erwartet eine ganze Zahl von 1 bis 12`)
      blocks.push({ type: 'popular', n })
      rest = nach
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
    } else if (name === 'cards') {
      blocks.push({ type: 'cards', items: items.map(kachel) })
    } else if (name === 'questions') {
      blocks.push({ type: 'questions', items: items.map((z) => z.replace(/\*\*/g, '').trim()) })
    } else {
      blocks.push({ type: 'chips', label: a.label?.trim() || undefined, items: items.map((z) => z.replace(/\*\*/g, '').trim()) })
    }
    rest = danach
  }
  pushMarkdown(blocks, rest)
  return blocks
}
