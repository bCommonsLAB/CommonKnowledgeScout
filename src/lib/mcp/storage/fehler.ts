/**
 * @fileoverview Einheitliche Fehlerbilder ueber alle Provider (Q5, Welle ST4).
 *
 * @description
 * Die Provider melden heterogen: Graph liefert HTTP-Status und einen
 * JSON-Fehler, WebDAV wirft Objekte mit `status`, das Dateisystem wirft
 * `ENOENT`/`EACCES`. Fuer den Agenten ist das ein Rauschen, aus dem er die
 * eine Frage nicht beantworten kann, auf die es ankommt:
 *
 * **Hat ein zweiter Versuch Sinn?** Beim Versionskonflikt ja, bei
 * `pfad_zu_lang` nie.
 *
 * Deshalb traegt jedes Fehlerbild `wiederholbar` mit. Was sich NICHT zuordnen
 * laesst, bekommt kein wohlwollendes Standard-Bild, sondern `unbekannt` mit
 * der Originalmeldung — ein falsch einsortierter Fehler schickt den Agenten
 * in genau die Schleife, die diese Zuordnung verhindern soll.
 *
 * @module mcp/storage
 */

import { StorageError } from '@/lib/storage/types'
import { FolderPathNotFoundError } from '../resolve-folder'
import { SchreibschutzError } from './schreibschutz'

export type FehlerCode =
  | 'nicht_gefunden'
  | 'konflikt'
  | 'zu_gross'
  | 'pfad_zu_lang'
  | 'kein_zugriff'
  | 'nur_lesen'
  | 'gesperrt'
  | 'nicht_unterstuetzt'
  | 'zeitueberschreitung'
  /** Anlegen scheiterte, weil es die Datei schon gibt (ST5). */
  | 'existiert_bereits'
  /** Ein Patch traf mehrdeutig oder gar nicht (ST5). */
  | 'nicht_eindeutig'
  | 'unbekannt'

export interface Fehlerbild {
  code: FehlerCode
  meldung: string
  /** Ob ein unveraenderter zweiter Versuch Aussicht auf Erfolg hat. */
  wiederholbar: boolean
}

/** Ob ein Fehler dieses Codes durch blosses Wiederholen weggehen kann. */
const WIEDERHOLBAR: Record<FehlerCode, boolean> = {
  // Der Konflikt ist wiederholbar, aber NICHT unveraendert: erst mergen,
  // dann mit der aktuellen Version erneut schreiben.
  konflikt: true,
  zeitueberschreitung: true,
  gesperrt: true,
  // OneDrive zeigt frisch angelegte Items verzoegert — einmal warten hilft.
  nicht_gefunden: true,
  kein_zugriff: false,
  nur_lesen: false,
  pfad_zu_lang: false,
  zu_gross: false,
  nicht_unterstuetzt: false,
  // Beide sind wiederholbar, aber NICHT unveraendert: erst den Aufruf
  // korrigieren (anderer Name bzw. mehr Kontext im altText), dann erneut.
  existiert_bereits: false,
  nicht_eindeutig: false,
  unbekannt: false,
}

function ausHttpStatus(status: number): FehlerCode | null {
  if (status === 404 || status === 410) return 'nicht_gefunden'
  if (status === 412 || status === 409) return 'konflikt'
  if (status === 413) return 'zu_gross'
  if (status === 401 || status === 403) return 'kein_zugriff'
  if (status === 423) return 'gesperrt'
  if (status === 405 || status === 501) return 'nicht_unterstuetzt'
  if (status === 408 || status === 504) return 'zeitueberschreitung'
  if (status === 429 || status === 503) return 'zeitueberschreitung'
  return null
}

function ausNodeCode(code: string): FehlerCode | null {
  if (code === 'ENOENT' || code === 'ENOTDIR') return 'nicht_gefunden'
  if (code === 'EACCES' || code === 'EPERM') return 'kein_zugriff'
  if (code === 'EROFS') return 'nur_lesen'
  if (code === 'ENAMETOOLONG') return 'pfad_zu_lang'
  if (code === 'EFBIG' || code === 'ENOSPC') return 'zu_gross'
  if (code === 'ETIMEDOUT') return 'zeitueberschreitung'
  return null
}

/** Ordnet einen beliebigen Provider-Fehler einem Fehlerbild zu (Q5). */
export function ordneFehlerZu(fehler: unknown): Fehlerbild {
  const meldung = fehler instanceof Error ? fehler.message : String(fehler)
  const code = bestimmeCode(fehler, meldung)
  return { code, meldung, wiederholbar: WIEDERHOLBAR[code] }
}

function bestimmeCode(fehler: unknown, meldung: string): FehlerCode {
  if (fehler instanceof SchreibschutzError) return fehler.code
  if (fehler instanceof FolderPathNotFoundError) return 'nicht_gefunden'
  if (fehler instanceof StorageError && fehler.code === 'VERSION_CONFLICT') return 'konflikt'

  const status = (fehler as { status?: number; statusCode?: number })?.status
    ?? (fehler as { statusCode?: number })?.statusCode
  if (typeof status === 'number') {
    const ausStatus = ausHttpStatus(status)
    if (ausStatus) return ausStatus
  }

  const nodeCode = (fehler as { code?: unknown })?.code
  if (typeof nodeCode === 'string') {
    const ausNode = ausNodeCode(nodeCode)
    if (ausNode) return ausNode
  }

  // Letzter Versuch am Text — Graph und WebDAV formulieren teils nur dort.
  // Nur eindeutige Signale, kein Raten an Teilwoertern.
  //
  // Welle ST5 (Cowork-Befund 28.08.2026): „existiert bereits" und „altText
  // kommt n-mal vor" sind VORHERGESEHENE Faelle, kamen aber als `unbekannt`
  // heraus. Der Agent musste die deutsche Meldung parsen, um sie von einem
  // echten Ausfall zu unterscheiden — genau das soll Q5 ersparen.
  if (/existiert bereits/i.test(meldung)) return 'existiert_bereits'
  if (/kommt \d+-mal vor|kommt in der Datei nicht vor|ist mehrdeutig/i.test(meldung)) return 'nicht_eindeutig'
  if (/\bnicht gefunden\b|\bnot ?found\b/i.test(meldung)) return 'nicht_gefunden'
  if (/nicht versioniert schreiben|kann diese Operation nicht/i.test(meldung)) return 'nicht_unterstuetzt'
  return 'unbekannt'
}

/**
 * Fehler-Ergebnis der Storage-Werkzeuge — mit Code und Wiederhol-Auskunft.
 *
 * Ersetzt `errorResult` in dieser Schicht: derselbe Klartext, aber der
 * Aufrufer muss die Meldung nicht mehr interpretieren, um zu wissen, ob
 * ein zweiter Versuch Sinn hat.
 */
export function storageFehler(fehler: unknown): {
  content: Array<{ type: 'text'; text: string }>
  isError: true
} {
  const bild = ordneFehlerZu(fehler)
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ fehler: bild.code, ...bild }, null, 2) }],
  }
}
