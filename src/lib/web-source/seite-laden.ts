/**
 * @fileoverview HTML einer von aussen genannten Seite laden (sicherer Abruf, Zeichensatz).
 *
 * @description
 * Ein Weg fuer `webseite_erschliessen` und `seite_lesen`. Der Abruf laeuft
 * ueber `sichererAbruf` (keine internen Adressen, Umleitungen geprueft,
 * Groessengrenze). Der Zeichensatz kommt aus dem Content-Type, sonst aus
 * `<meta charset>` — eine Seite in ISO-8859-1 als UTF-8 zu lesen, zerstoert
 * Umlaute und damit den Wortlaut.
 *
 * @module web-source
 */

import { sichererAbruf } from './sicherer-abruf'

/** Kennung der Abrufe: Browser-Form (viele Seiten liefern sonst nichts) mit eigenem Namen. */
export const PAGE_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 KnowledgeScout'

/** Obergrenze fuer das HTML einer Seite. */
export const MAX_SEITE_BYTES = 10 * 1024 * 1024

export interface GeladeneSeite {
  html: string
  /** Adresse nach Umleitungen — Basis fuer relative Links. */
  endAdresse: string
  zeichensatz: string
}

/** Zeichensatz aus Content-Type oder `<meta>`; ohne Angabe utf-8 (HTML-Standard fuer neue Seiten). */
export function zeichensatzVon(contentType: string, kopf: string): string {
  const ausKopfzeile = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)
  if (ausKopfzeile) return ausKopfzeile[1].toLowerCase()
  const ausMeta = kopf.match(/<meta\b[^>]*\bcharset\s*=\s*["']?([\w-]+)/i)
  return ausMeta ? ausMeta[1].toLowerCase() : 'utf-8'
}

export async function ladeSeite(url: string): Promise<GeladeneSeite> {
  const res = await sichererAbruf(url, { headers: { 'User-Agent': PAGE_USER_AGENT, Accept: 'text/html,*/*' }, maxBytes: MAX_SEITE_BYTES, timeoutMs: 30_000 })
  if (res.status === 403 || res.status === 429) {
    throw new Error(
      `Seite nicht ladbar: HTTP ${res.status} — die Website weist den Abruf ab (Sperre fuer automatische Abrufe oder zu viele Abrufe in kurzer Zeit). ` +
        'Spaeter mit Abstand erneut versuchen, oder die Seite im Browser oeffnen und ihr HTML uebergeben (Parameter html).',
    )
  }
  if (res.status < 200 || res.status >= 300) throw new Error(`Seite nicht ladbar: HTTP ${res.status}`)
  const type = res.headers['content-type'] ?? ''
  if (!/html|xml/i.test(type)) throw new Error(`Adresse liefert kein HTML (Content-Type "${type || 'unbekannt'}")`)
  const zeichensatz = zeichensatzVon(type, res.buffer.subarray(0, 4096).toString('latin1'))
  let dekoder: TextDecoder
  try {
    dekoder = new TextDecoder(zeichensatz)
  } catch {
    throw new Error(`Seite nennt den unbekannten Zeichensatz "${zeichensatz}" — nicht gelesen`)
  }
  return { html: dekoder.decode(res.buffer), endAdresse: res.endAdresse, zeichensatz }
}

export async function ladeSeiteHtml(url: string): Promise<string> {
  return (await ladeSeite(url)).html
}
