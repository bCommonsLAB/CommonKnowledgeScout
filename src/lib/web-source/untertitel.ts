/**
 * @fileoverview Fertige Untertitel einer Videoseite ueber den Secretary holen (statt Tonspur und Transkription).
 *
 * @description
 * `POST /api/media/subtitles` des Secretary liefert die Untertitelspur einer
 * Videoseite als Transkript mit Zeitmarken, ohne das Medium zu laden. Vorrang
 * dort: die von Hand gepflegte Spur der gewuenschten Sprache, sonst die
 * automatische Spur in der Originalsprache; maschinell uebersetzte Spuren nie.
 * Hier wird die Antwort typgeprueft gelesen. Traegt das Video keine brauchbare
 * Spur, wirft der Aufruf mit dem Grund des Secretary — ob dann die Tonspur
 * transkribiert wird, entscheidet der Aufrufer (`rueckfall`), nie diese Datei.
 *
 * @module web-source
 */

import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout'
import { parseMediaMetadata, type MediaMetadata } from './media-metadata'
import { medienAnfrageBody, secretaryFehler, secretaryHeaders } from './media-resolve'

/** Woher das Transkript eines Videos kommt. */
export const TRANSKRIPT_WEGE = ['tonspur', 'untertitel'] as const
export type TranskriptWeg = (typeof TRANSKRIPT_WEGE)[number]

/** Liest den Schalter `transkript`; weggelassen = `tonspur`, ein unbekannter Wert ist ein Fehler. */
export function leseTranskriptWeg(wert: unknown): TranskriptWeg {
  if (wert === undefined || wert === null) return 'tonspur'
  const treffer = TRANSKRIPT_WEGE.find((w) => w === wert)
  if (!treffer) throw new Error(`transkript "${String(wert)}" ist unbekannt — erlaubt: ${TRANSKRIPT_WEGE.join(', ')}`)
  return treffer
}

export const UNTERTITEL_ARTEN = ['manuell', 'automatisch'] as const
export type UntertitelArt = (typeof UNTERTITEL_ARTEN)[number]

export interface UntertitelAbdeckung {
  /** Erste und letzte Zeile in Sekunden. */
  beginn: number
  ende: number
  /** Anteil der letzten Zeile an der Dauer (0–1); null, wenn die Dauer unbekannt ist. */
  anteil: number | null
  /** Groesste Luecke zwischen zwei Zeilen in Sekunden und ihre Stelle. */
  groessteLuecke: number
  groessteLueckeBei: number
  zeilen: number
  woerter: number
}

export interface Untertitel {
  extractor: string
  title: string
  /** Sekunden oder null. */
  duration: number | null
  /** Sprache der gelieferten Spur (Grundsprache, z. B. `en`). */
  sprache: string
  art: UntertitelArt
  /** Schluessel der Spur bei yt-dlp, z. B. `en-orig`. */
  spur: string
  format: string
  /** Absaetze mit Zeitmarke `[hh:mm:ss]`, durch Leerzeilen getrennt. */
  text: string
  absaetze: number
  abdeckung: UntertitelAbdeckung
  /** Derselbe Block wie bei media/resolve (Beschreibung, Datum, Kanal, Kapitel, Cover). */
  metadata: MediaMetadata | null
}

function zahl(wert: unknown, feld: string): number {
  if (typeof wert !== 'number' || !Number.isFinite(wert)) throw new Error(`Secretary media/subtitles: Feld ${feld} fehlt oder ist keine Zahl`)
  return wert
}

function text(wert: unknown, feld: string): string {
  if (typeof wert !== 'string' || !wert.trim()) throw new Error(`Secretary media/subtitles: Feld ${feld} fehlt oder ist leer`)
  return wert
}

/** Liest `data` der Secretary-Antwort; wirft bei fehlenden Pflichtfeldern oder unbekannter Art. */
export function parseUntertitel(d: Record<string, unknown>): Untertitel {
  const art = UNTERTITEL_ARTEN.find((a) => a === d['art'])
  if (!art) throw new Error(`Secretary media/subtitles: unbekannte Art der Spur "${String(d['art'])}"`)
  const a = d['abdeckung']
  if (!a || typeof a !== 'object' || Array.isArray(a)) throw new Error('Secretary media/subtitles: Feld abdeckung fehlt')
  const ab = a as Record<string, unknown>
  const anteil = ab['anteil']
  return {
    extractor: typeof d['extractor'] === 'string' ? d['extractor'] : '',
    title: typeof d['title'] === 'string' ? d['title'] : '',
    duration: typeof d['duration'] === 'number' && d['duration'] > 0 ? d['duration'] : null,
    sprache: text(d['sprache'], 'sprache'),
    art,
    spur: text(d['spur'], 'spur'),
    format: text(d['format'], 'format'),
    text: text(d['text'], 'text'),
    absaetze: Array.isArray(d['absaetze']) ? d['absaetze'].length : 0,
    abdeckung: {
      beginn: zahl(ab['beginn'], 'abdeckung.beginn'),
      ende: zahl(ab['ende'], 'abdeckung.ende'),
      anteil: typeof anteil === 'number' && Number.isFinite(anteil) ? anteil : null,
      groessteLuecke: zahl(ab['groesste_luecke'], 'abdeckung.groesste_luecke'),
      groessteLueckeBei: zahl(ab['groesste_luecke_bei'], 'abdeckung.groesste_luecke_bei'),
      zeilen: zahl(ab['zeilen'], 'abdeckung.zeilen'),
      woerter: zahl(ab['woerter'], 'abdeckung.woerter'),
    },
    metadata: parseMediaMetadata(d['metadata']),
  }
}

/** Holt die Untertitel einer Videoseite; `sprache` = gewuenschte Sprache der gepflegten Spur (sonst Originalsprache). */
export async function holeUntertitelViaSecretary(pageUrl: string, cookies: string | null = null, sprache?: string): Promise<Untertitel> {
  const { baseUrl, headers } = secretaryHeaders()
  const body = medienAnfrageBody(pageUrl, cookies, sprache && sprache.trim() ? { sprache: sprache.trim() } : {})
  const res = await fetchWithTimeout(`${baseUrl}/media/subtitles`, { method: 'POST', headers, body, timeoutMs: 90_000 })
  if (res.status === 404) throw new Error('Secretary media/subtitles: die Route gibt es dort nicht (HTTP 404) — der Secretary ist aelter als die Untertitel-Route')
  if (!res.ok) throw await secretaryFehler(res, 'media/subtitles')
  const payload = (await res.json().catch(() => null)) as { status?: string; data?: Record<string, unknown> } | null
  if (!payload || payload.status !== 'success' || !payload.data) throw new Error('Secretary media/subtitles: Antwort ohne data')
  return parseUntertitel(payload.data)
}
