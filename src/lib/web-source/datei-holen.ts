/**
 * @fileoverview Eine Datei von einer Adresse laden und pruefen, bevor sie ins Archiv kommt.
 *
 * @description
 * Kern von `datei_von_adresse_holen`. Der Server laedt (sicherer Abruf, keine
 * internen Adressen), der Agent braucht weder Shell noch Netzzugang. Geprueft
 * wird, bevor irgendetwas geschrieben wird:
 *
 * - Statt der Datei eine HTML-Seite (Anmelde- oder Sperrseite) → abgelehnt.
 * - `erwarteterTyp` weicht vom Content-Type ab → abgelehnt.
 * - Endung des Dateinamens passt nicht zum Content-Type → abgelehnt.
 * - Fuer Typen mit bekannter Signatur (PDF, PNG, JPEG, GIF, ZIP/Office) muss
 *   der Inhalt sie tragen — der Content-Type ist nur eine Behauptung.
 *
 * Nichts wird umgedeutet oder „passend gemacht": Was nicht stimmt, wird mit
 * Grund abgelehnt.
 *
 * @module web-source
 */

import { createHash } from 'node:crypto'
import { PAGE_USER_AGENT } from './seite-laden'
import { sichererAbruf } from './sicherer-abruf'

/** Obergrenze je Datei. */
export const MAX_DATEI_BYTES = 100 * 1024 * 1024

export interface GeholteDatei {
  buffer: Buffer
  dateiname: string
  mimeType: string
  bytes: number
  sha256: string
  endAdresse: string
  /** ISO-Zeitpunkt des Abrufs. */
  abgerufenAm: string
}

const ENDUNG_TYP: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
  zip: 'application/zip', csv: 'text/csv', txt: 'text/plain', json: 'application/json', mp3: 'audio/mpeg', mp4: 'video/mp4',
  html: 'text/html', htm: 'text/html',
}

const UNBESTIMMT = new Set(['application/octet-stream', 'binary/octet-stream', 'application/download', 'application/force-download', ''])
const ZIP = (b: Buffer): boolean => b.subarray(0, 2).toString('latin1') === 'PK'
const SIGNATUR: Record<string, (b: Buffer) => boolean> = {
  'application/pdf': (b) => b.subarray(0, 1024).includes('%PDF-'),
  'image/png': (b) => b.subarray(0, 8).toString('latin1') === '\x89PNG\r\n\x1a\n',
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8,
  'image/gif': (b) => b.subarray(0, 4).toString('latin1') === 'GIF8',
  'application/zip': ZIP,
  [ENDUNG_TYP.docx]: ZIP, [ENDUNG_TYP.xlsx]: ZIP, [ENDUNG_TYP.pptx]: ZIP,
}

function endung(name: string): string {
  const m = name.match(/\.([A-Za-z0-9]{1,8})$/)
  return m ? m[1].toLowerCase() : ''
}

/** Dateiname aus `Content-Disposition` (filename* vor filename), sonst leer. */
export function nameAusKopfzeile(disposition: string): string {
  const stern = disposition.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/)
  if (stern) {
    try {
      return decodeURIComponent(stern[1].trim())
    } catch {
      return ''
    }
  }
  const schlicht = disposition.match(/filename\s*=\s*(?:"([^"]*)"|([^;]+))/i)
  return schlicht ? (schlicht[1] ?? schlicht[2] ?? '').trim() : ''
}

/** Entfernt, was in einem Dateinamen nichts verloren hat (Pfadtrenner, Steuerzeichen, reservierte Zeichen). */
export function saubererName(roh: string): string {
  // eslint-disable-next-line no-control-regex
  return roh.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 200)
}

function nameAusAdresse(adresse: string): string {
  const letztes = new URL(adresse).pathname.split('/').filter(Boolean).pop() ?? ''
  try {
    return decodeURIComponent(letztes)
  } catch {
    return letztes
  }
}

/** Prueft Typ, Endung und Signatur; wirft mit Grund. Gibt den Typ zurueck, unter dem die Datei abgelegt wird. */
export function pruefeDateiTyp(args: { buffer: Buffer; contentType: string; dateiname: string; erwarteterTyp?: string }): string {
  const gemeldet = args.contentType.split(';')[0].trim().toLowerCase()
  const erwartet = args.erwarteterTyp?.trim().toLowerCase()
  const nachEndung = ENDUNG_TYP[endung(args.dateiname)]
  if (gemeldet === 'text/html' && erwartet !== 'text/html' && nachEndung !== 'text/html') {
    throw new Error('Adresse liefert eine HTML-Seite statt einer Datei (oft eine Anmelde- oder Sperrseite) — nichts geschrieben')
  }
  if (erwartet && !UNBESTIMMT.has(gemeldet) && gemeldet !== erwartet) {
    throw new Error(`Erwartet war "${erwartet}", die Adresse liefert "${gemeldet}" — nichts geschrieben`)
  }
  if (nachEndung && !UNBESTIMMT.has(gemeldet) && gemeldet !== nachEndung) {
    throw new Error(`Der Dateiname endet auf .${endung(args.dateiname)}, die Adresse liefert aber "${gemeldet}" — nichts geschrieben`)
  }
  if (erwartet && nachEndung && erwartet !== nachEndung) {
    throw new Error(`erwarteterTyp "${erwartet}" passt nicht zur Endung .${endung(args.dateiname)} — nichts geschrieben`)
  }
  const typ = erwartet ?? (UNBESTIMMT.has(gemeldet) ? nachEndung : gemeldet)
  if (!typ) {
    throw new Error(`Die Adresse nennt keinen Dateityp (Content-Type "${gemeldet || 'fehlt'}") und der Dateiname keine bekannte Endung — erwarteterTyp oder dateiname mit Endung angeben. Nichts geschrieben`)
  }
  const signatur = SIGNATUR[typ]
  if (signatur && !signatur(args.buffer)) throw new Error(`Der Inhalt ist kein "${typ}" (Signatur fehlt) — nichts geschrieben`)
  if (!signatur && UNBESTIMMT.has(gemeldet)) {
    throw new Error(`Die Adresse nennt keinen Dateityp, und fuer "${typ}" ist keine Signatur bekannt, an der sich der Inhalt pruefen liesse — nichts geschrieben`)
  }
  return typ
}

/** Laedt und prueft eine Datei. Schreibt nichts. */
export async function holeDatei(adresse: string, optionen: { dateiname?: string; erwarteterTyp?: string; timeoutMs?: number } = {}): Promise<GeholteDatei> {
  const abgerufenAm = new Date().toISOString()
  const res = await sichererAbruf(adresse, { headers: { 'User-Agent': PAGE_USER_AGENT, Accept: '*/*' }, maxBytes: MAX_DATEI_BYTES, timeoutMs: optionen.timeoutMs ?? 120_000 })
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} — nichts geschrieben`)
  if (res.buffer.length === 0) throw new Error('Adresse lieferte 0 Bytes — nichts geschrieben')
  const dateiname = saubererName(optionen.dateiname ?? (nameAusKopfzeile(res.headers['content-disposition'] ?? '') || nameAusAdresse(res.endAdresse)))
  if (!dateiname) throw new Error('Aus Adresse und Antwort ergibt sich kein Dateiname — dateiname angeben. Nichts geschrieben')
  const mimeType = pruefeDateiTyp({ buffer: res.buffer, contentType: res.headers['content-type'] ?? '', dateiname, erwarteterTyp: optionen.erwarteterTyp })
  if (!endung(dateiname)) throw new Error(`Der Dateiname "${dateiname}" hat keine Endung — dateiname mit Endung angeben. Nichts geschrieben`)
  return { buffer: res.buffer, dateiname, mimeType, bytes: res.buffer.length, sha256: createHash('sha256').update(res.buffer).digest('hex'), endAdresse: res.endAdresse, abgerufenAm }
}
