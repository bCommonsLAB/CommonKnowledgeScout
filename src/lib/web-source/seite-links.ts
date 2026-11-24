/**
 * @fileoverview Links einer Seite: Typ und Einordnung nach der Endung der Adresse.
 *
 * @module web-source
 */

export type LinkArt = 'seite' | 'pdf' | 'dokument' | 'medium' | 'bild' | 'mail'

export interface SeitenLink {
  /** Laufende Nummer in Lesereihenfolge, ab 1. */
  nr: number
  text: string
  url: string
  art: LinkArt
  /** Wortlaut der letzten Ueberschrift vor dem Link, leer ohne. */
  abschnitt: string
  /** Text des Blocks, in dem der Link steht (Listenzeile, Tabellenzeile, Absatz), gekuerzt. */
  kontext: string
}

const ENDUNGEN: Array<[LinkArt, RegExp]> = [
  ['pdf', /\.pdf$/i],
  ['dokument', /\.(docx?|xlsx?|pptx?|od[tsp]|rtf|csv|txt|zip|epub)$/i],
  ['medium', /\.(mp3|m4a|wav|ogg|oga|opus|flac|mp4|m4v|mov|webm|mkv|m3u8|mpd)$/i],
  ['bild', /\.(jpe?g|png|gif|webp|svg|avif|tiff?)$/i],
]

/**
 * Art eines Links — NUR aus Schema und Endung des Pfades gelesen, nichts abgerufen.
 * Eine Adresse ohne sprechende Endung ist deshalb `seite`, auch wenn sie ein PDF liefert.
 */
export function linkArt(url: string): LinkArt {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return 'seite'
  }
  if (u.protocol === 'mailto:') return 'mail'
  for (const [art, re] of ENDUNGEN) if (re.test(u.pathname)) return art
  return 'seite'
}

/** Absolute Adresse eines href, oder null fuer Anker, Skripte und Unlesbares. */
export function linkAdresse(href: string, basis: string): string | null {
  const roh = href.trim()
  if (!roh || roh.startsWith('#') || /^(javascript|data|tel|sms|blob):/i.test(roh)) return null
  try {
    const u = new URL(roh, basis)
    return /^(https?|mailto):$/.test(u.protocol) ? u.toString() : null
  } catch {
    return null
  }
}
