/**
 * @fileoverview Metadaten eines Videos, wie yt-dlp sie ueber den Secretary liefert (Welle K1).
 *
 * @description
 * `POST /api/media/resolve` traegt seit Welle S einen Block `metadata`
 * (description, upload_date, uploader, channel, chapters, tags, thumbnail,
 * webpage_url). Hier wird er typgeprueft gelesen: fehlt er (aelterer
 * Secretary), ist das Ergebnis `null` — der Aufrufer nennt das, statt es zu
 * verschweigen. Reine Funktionen, unit-testbar.
 *
 * @module web-source
 */

export interface MediaKapitel {
  /** Beginn in Sekunden. */
  start: number
  /** Ende in Sekunden oder null. */
  ende: number | null
  titel: string
}

export interface MediaMetadata {
  /** Beschreibung woertlich, Absaetze an Leerzeilen (leer, wenn yt-dlp keine kennt). */
  description: string
  /** YYYY-MM-DD aus upload_date (YYYYMMDD), sonst leer — nie geraten. */
  uploadDate: string
  uploader: string
  channel: string
  kapitel: MediaKapitel[]
  tags: string[]
  /** Vorschaubild (hoechste Aufloesung, die yt-dlp nennt) oder leer. */
  thumbnail: string
  webpageUrl: string
}

/** Extractoren, bei denen Titel, Beschreibung, Datum und Cover aus yt-dlp kommen statt aus dem HTML. */
const VIDEO_EXTRACTOREN = ['youtube', 'vimeo', 'peertube'] as const

/** yt-dlp nennt den Extractor z. B. als `youtube`, `Youtube`, `youtube:tab`, `vimeo`, `PeerTube`. */
export function istVideoExtractor(extractor: string): boolean {
  const e = extractor.trim().toLowerCase()
  if (!e) return false
  return VIDEO_EXTRACTOREN.some((name) => e === name || e.startsWith(`${name}:`))
}

/** `20151109` → `2015-11-09`; alles andere bleibt leer (kein Raten). */
export function uploadDateZuIso(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const m = raw.trim().match(/^(\d{4})(\d{2})(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const iso = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return iso ? iso[1] : ''
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function kapitelAus(raw: unknown): MediaKapitel[] {
  if (!Array.isArray(raw)) return []
  const out: MediaKapitel[] = []
  for (const k of raw) {
    if (!k || typeof k !== 'object') continue
    const o = k as { start_time?: unknown; end_time?: unknown; title?: unknown }
    const start = typeof o.start_time === 'number' && Number.isFinite(o.start_time) ? o.start_time : null
    const titel = asText(o.title)
    if (start === null || !titel) continue
    out.push({ start, ende: typeof o.end_time === 'number' && Number.isFinite(o.end_time) ? o.end_time : null, titel })
  }
  return out
}

/** Liest den Block `metadata` der Secretary-Antwort; `null`, wenn er fehlt oder kein Objekt ist. */
export function parseMediaMetadata(raw: unknown): MediaMetadata | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const d = raw as Record<string, unknown>
  return {
    description: asText(d['description']),
    uploadDate: uploadDateZuIso(d['upload_date']),
    uploader: asText(d['uploader']),
    channel: asText(d['channel']),
    kapitel: kapitelAus(d['chapters']),
    tags: Array.isArray(d['tags']) ? d['tags'].filter((t): t is string => typeof t === 'string' && t.trim().length > 0) : [],
    thumbnail: asText(d['thumbnail']),
    webpageUrl: asText(d['webpage_url']),
  }
}

/** Sekunden → `h:mm:ss` bzw. `m:ss` fuer Kapitel-Zeitmarken. */
export function zeitmarke(sekunden: number): string {
  const s = Math.max(0, Math.floor(sekunden))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}
