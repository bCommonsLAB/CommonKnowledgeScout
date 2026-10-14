/**
 * @fileoverview Reine Bausteine der Brueckenwerkzeuge fuer Speicher-Verbindungen
 * (Plan speicher-verbindungen-und-library-anlage, A3).
 *
 * @description
 * Die Bruecke sieht eine Verbindung nur in ihrer geheimnisfreien Sicht
 * (`StorageConnectionSummary`). Ein Agent nennt sie per Id oder Bezeichnung;
 * `waehleVerbindung` loest das eindeutig auf oder scheitert mit der Liste der
 * vorhandenen Verbindungen. `pruefeZuweisung` stellt sicher, dass eine
 * Library nur an eine Verbindung ihres Typs gehaengt wird.
 *
 * @module mcp
 */

import type { Library } from '@/types/library'
import type { StorageConnectionSummary } from '@/types/storage-connection'

/** Eine Verbindung, wie die Bruecke sie zeigt — nie Geheimnisse, nur „hinterlegt ja/nein". */
export interface VerbindungsZeile {
  id: string
  bezeichnung: string
  typ: string
  zuletztGeprueft: { am: string; ok: boolean; meldung: string } | null
  nextcloud?: { webdavUrl: string; benutzer: string; passwortHinterlegt: boolean }
  onedrive?: { geheimnisHinterlegt: boolean; angemeldet: boolean }
  libraries: Array<{ id: string; name: string }>
}

function nenneVorhandene(kandidaten: StorageConnectionSummary[]): string {
  if (kandidaten.length === 0) return 'Das Konto hat noch keine Speicher-Verbindung.'
  return `Vorhanden: ${kandidaten.map((k) => `"${k.label}" (${k.type}, ${k.id})`).join(', ')}.`
}

/**
 * Loest eine Angabe des Agenten auf: zuerst exakte Id, dann Bezeichnung ohne
 * Gross-/Kleinschreibung. Mehrdeutig oder unbekannt: Fehler mit Liste.
 */
export function waehleVerbindung(angabe: string, kandidaten: StorageConnectionSummary[]): StorageConnectionSummary {
  const gesucht = angabe.trim()
  if (gesucht === '') throw new Error('Speicher-Verbindung: leere Angabe')
  const perId = kandidaten.find((k) => k.id === gesucht)
  if (perId) return perId
  const perName = kandidaten.filter((k) => k.label.trim().toLowerCase() === gesucht.toLowerCase())
  if (perName.length === 1) return perName[0]
  if (perName.length > 1) {
    throw new Error(`Speicher-Verbindung "${gesucht}" ist mehrdeutig — per Id angeben. ${nenneVorhandene(perName)}`)
  }
  throw new Error(`Speicher-Verbindung "${gesucht}" nicht gefunden. ${nenneVorhandene(kandidaten)}`)
}

/** Geheimnisfreie Zeile fuer `speicher_verbindungen_auflisten`, mit den Libraries, die darauf liegen. */
export function verbindungsZeile(summary: StorageConnectionSummary, libraries: Library[]): VerbindungsZeile {
  return {
    id: summary.id,
    bezeichnung: summary.label,
    typ: summary.type,
    zuletztGeprueft: summary.lastTest
      ? { am: summary.lastTest.at, ok: summary.lastTest.ok, meldung: summary.lastTest.message }
      : null,
    ...(summary.nextcloud
      ? { nextcloud: { webdavUrl: summary.nextcloud.webdavUrl, benutzer: summary.nextcloud.username, passwortHinterlegt: summary.nextcloud.appPasswordSet } }
      : {}),
    ...(summary.onedrive
      ? { onedrive: { geheimnisHinterlegt: summary.onedrive.clientSecretSet, angemeldet: summary.onedrive.loggedIn } }
      : {}),
    libraries: libraries.filter((l) => l.storageConnectionId === summary.id).map((l) => ({ id: l.id, name: l.label })),
  }
}

/** Darf diese Library an diese Verbindung? Wirft mit Grund, sonst nichts. */
export function pruefeZuweisung(library: Pick<Library, 'label' | 'type'>, verbindung: StorageConnectionSummary): void {
  if (library.type !== 'nextcloud' && library.type !== 'onedrive') {
    throw new Error(`Library "${library.label}" ist ${library.type} — nur nextcloud- und onedrive-Libraries liegen auf einer Speicher-Verbindung`)
  }
  if (verbindung.type !== library.type) {
    throw new Error(`Speicher-Verbindung "${verbindung.label}" ist ${verbindung.type}, die Library "${library.label}" aber ${library.type}`)
  }
}
