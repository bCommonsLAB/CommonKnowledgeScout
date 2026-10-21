/**
 * @fileoverview Video-Anmeldung am Konto: setzen, Status lesen, Cookies fuer den Secretary laden (Welle C2/C3).
 *
 * @description
 * Dienst fuer Oberflaeche (`/api/account/video-login`), Bruecke
 * (`video_anmeldung_lesen`) und die Medien-Aufrufe (webseite_erschliessen,
 * Playlist, web-source-Jobs). Der Klartext kommt nur ueber `ladeVideoCookies`
 * heraus und geht ausschliesslich in den Body eines Secretary-Aufrufs; alles
 * andere sieht den Status (`VideoAnmeldungStatus`). Fehlt die Anmeldung, ist
 * das `null`, nicht ein leerer String — der Aufrufer entscheidet sichtbar.
 *
 * @module video-login
 */

import { deleteVideoLogin, getVideoLoginBeschreibung, getVideoLoginCookies, upsertVideoLogin } from '@/lib/repositories/video-login-repo'
import { beschreibeCookiesDatei, statusAusBeschreibung, type VideoAnmeldungStatus } from './cookies-datei'

/** Prueft die Datei, speichert sie verschluesselt und liefert den Status. */
export async function setzeVideoAnmeldung(userEmail: string, cookiesText: string): Promise<VideoAnmeldungStatus> {
  const beschreibung = beschreibeCookiesDatei(cookiesText)
  if (!beschreibung.hatYoutube) {
    throw new Error(`Die Datei enthaelt kein Cookie fuer youtube.com oder google.com (gefunden: ${beschreibung.domains.slice(0, 5).join(', ') || 'keine Domain'}) — im Browser bei YouTube angemeldet exportieren`)
  }
  await upsertVideoLogin(userEmail, cookiesText, beschreibung)
  return statusAusBeschreibung(beschreibung, new Date().toISOString())
}

export async function leseVideoAnmeldungStatus(userEmail: string): Promise<VideoAnmeldungStatus> {
  const doc = await getVideoLoginBeschreibung(userEmail)
  return statusAusBeschreibung(doc?.beschreibung ?? null, doc?.updatedAt ?? null)
}

export async function loescheVideoAnmeldung(userEmail: string): Promise<boolean> {
  return deleteVideoLogin(userEmail)
}

/**
 * Klartext fuer den Secretary-Aufruf; `null`, wenn die Person keine Anmeldung
 * hinterlegt hat. Ein Fehler beim Entschluesseln (fehlender Schluessel) faellt
 * laut — ein Medien-Aufruf ohne die hinterlegten Cookies waere ein stiller Fallback.
 */
export async function ladeVideoCookies(userEmail: string): Promise<string | null> {
  return getVideoLoginCookies(userEmail)
}
