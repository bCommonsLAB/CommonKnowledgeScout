/**
 * @fileoverview Cookie-Datei im Netscape-Format pruefen und beschreiben (Welle C2, rein).
 *
 * @description
 * Die Person exportiert ihre YouTube-Anmeldung als `cookies.txt` (Browser-
 * Erweiterung, yt-dlp-Format) und hinterlegt sie am Konto. Hier wird die
 * Datei geprueft (Format, Groesse) und beschrieben (Domains, Ablauf), OHNE
 * ihren Inhalt weiterzugeben: Der Status fuer Oberflaeche und Bruecke
 * entsteht aus dieser Beschreibung, nie aus den Werten. Eine Datei, die kein
 * Cookie-Format hat, wird laut abgewiesen, nicht still gespeichert.
 *
 * @module video-login
 */

export const MAX_COOKIES_BYTES = 256 * 1024

export interface CookiesBeschreibung {
  /** Anzahl der Cookie-Zeilen (ohne Kommentare und Leerzeilen). */
  zeilen: number
  /** Domains ohne fuehrenden Punkt, eindeutig, sortiert. */
  domains: string[]
  /** true, wenn mindestens ein Cookie fuer youtube.com oder google.com dabei ist. */
  hatYoutube: boolean
  /** Fruehester Ablauf eines YouTube-/Google-Cookies mit Ablaufdatum (ISO) oder null (nur Sitzungs-Cookies). */
  laeuftAbAm: string | null
}

const YOUTUBE_DOMAINS = /(^|\.)(youtube\.com|google\.com|googlevideo\.com)$/i

/** Prueft und beschreibt eine Netscape-Cookie-Datei; wirft bei fremdem Format oder Uebergroesse. */
export function beschreibeCookiesDatei(text: string): CookiesBeschreibung {
  if (Buffer.byteLength(text, 'utf8') > MAX_COOKIES_BYTES) {
    throw new Error(`Cookie-Datei zu gross (Grenze ${MAX_COOKIES_BYTES / 1024} kB) — ist das wirklich eine cookies.txt?`)
  }
  const domains = new Set<string>()
  let zeilen = 0
  let fruehester: number | null = null
  let hatYoutube = false
  for (const roh of text.replace(/\r\n?/g, '\n').split('\n')) {
    const zeile = roh.trim()
    if (!zeile || zeile.startsWith('#')) continue
    const felder = roh.split('\t')
    if (felder.length < 7) {
      throw new Error('Keine Cookie-Datei im Netscape-Format (sieben tabulatorgetrennte Felder je Zeile) — mit „Get cookies.txt LOCALLY" oder yt-dlp --cookies exportieren')
    }
    zeilen += 1
    const domain = felder[0].trim().replace(/^\./, '').toLowerCase()
    if (domain) domains.add(domain)
    const ablauf = Number(felder[4].trim())
    if (YOUTUBE_DOMAINS.test(domain)) {
      hatYoutube = true
      if (Number.isFinite(ablauf) && ablauf > 0 && (fruehester === null || ablauf < fruehester)) fruehester = ablauf
    }
  }
  if (zeilen === 0) throw new Error('Cookie-Datei enthaelt keine Cookie-Zeilen')
  return {
    zeilen,
    domains: Array.from(domains).sort(),
    hatYoutube,
    laeuftAbAm: fruehester === null ? null : new Date(fruehester * 1000).toISOString(),
  }
}

/** Status fuer Oberflaeche und Bruecke — nie der Inhalt. */
export interface VideoAnmeldungStatus {
  hinterlegt: boolean
  zeilen: number
  domains: string[]
  hatYoutube: boolean
  laeuftAbAm: string | null
  /** true, wenn laeuftAbAm in der Vergangenheit liegt. */
  abgelaufen: boolean
  aktualisiertAm: string | null
}

export function statusAusBeschreibung(b: CookiesBeschreibung | null, aktualisiertAm: string | null, jetzt: Date = new Date()): VideoAnmeldungStatus {
  if (!b) return { hinterlegt: false, zeilen: 0, domains: [], hatYoutube: false, laeuftAbAm: null, abgelaufen: false, aktualisiertAm: null }
  return {
    hinterlegt: true, zeilen: b.zeilen, domains: b.domains, hatYoutube: b.hatYoutube, laeuftAbAm: b.laeuftAbAm,
    abgelaufen: b.laeuftAbAm !== null && new Date(b.laeuftAbAm).getTime() < jetzt.getTime(),
    aktualisiertAm,
  }
}
