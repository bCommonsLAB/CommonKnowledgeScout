/**
 * @fileoverview Optimistische Sperre fuer Storage-Schreibvorgaenge (Welle ST1).
 *
 * @description
 * Der `StorageProvider`-Vertrag kennt als einzigen Schreibweg
 * `uploadFile(parentId, file)` — „ganze Datei, neuer Stand, kein Vergleich".
 * Wer eine Datei aendern will, liest sie, rechnet und laedt sie hoch; was in
 * der Zwischenzeit ein anderer Schreiber getan hat, geht dabei verloren, ohne
 * dass es jemand merkt. Dass am 27.08.2026 nichts verlorenging, als parallel
 * ein Audio-Job in derselben Library lief, war Glueck, keine Zusicherung.
 *
 * `StorageVersioning` schliesst diese Luecke: eine Datei wird an Ort und
 * Stelle geschrieben, aber nur, wenn sie noch die Version traegt, die der
 * Aufrufer gelesen hat. Sonst wirft der Provider — statt zu ueberschreiben.
 *
 * Bewusst NICHT im `StorageProvider`-Pflichtinterface, sondern als
 * Fähigkeit per Feature-Detection (`supportsVersioning`): so schreibt es
 * `docs/contracts/storage-contracts.md` §1 fuer optionale Zusatzmethoden vor,
 * und ein kuenftiges Backend ohne Versionsbegriff bleibt implementierbar,
 * ohne hier zu luegen.
 *
 * @module contracts
 */

import { StorageError } from './storage-provider'

/** Bedingung, unter der geschrieben werden darf. */
export interface StorageUpdateOptions {
  /**
   * Version, die der Aufrufer beim Lesen gesehen hat
   * (`StorageItemMetadata.version`). Absichtlich PFLICHT: ein optionales
   * Feld waere in der Praxis ein weggelassenes, und damit waere die Sperre
   * genau dann weg, wenn sie gebraucht wird.
   */
  ifVersion: string
}

/** Ergebnis eines erfolgreichen In-Place-Schreibvorgangs. */
export interface StorageUpdateResult {
  /** Id der Datei NACH dem Schreiben. */
  id: string
  /** Version NACH dem Schreiben — direkt als naechstes `ifVersion` nutzbar. */
  version: string
  /**
   * Gesetzt, wenn der Provider die Id beim Schreiben doch gewechselt hat.
   * Der Aufrufer muss gespeicherte Ids dann nachziehen, statt in ein
   * spaeteres `NOT_FOUND` zu laufen — der Fall, der die `_INDEX.md` schon
   * einmal unauffindbar gemacht hat.
   */
  idChanged?: { from: string; to: string }
}

/**
 * Die erwartete Version stimmt nicht mehr — jemand anderes war schneller.
 *
 * Traegt die aktuelle Version mit, damit der Aufrufer neu lesen, mergen und
 * gezielt erneut schreiben kann. Den aktuellen INHALT traegt dieser Fehler
 * bewusst nicht: ihn zu laden kostet einen Storage-Read auf dem Fehlerpfad,
 * und der Aufrufer, der ihn wirklich braucht (die MCP-Bruecke), haengt ihn
 * an seine Antwort an — dort spart es die teure Runde Agent ↔ Server, um die
 * es geht.
 */
export class StorageVersionConflictError extends StorageError {
  constructor(
    message: string,
    /** Version, unter der der Aufrufer schreiben wollte. */
    public readonly expectedVersion: string,
    /** Version, die die Datei jetzt tatsaechlich traegt. */
    public readonly currentVersion: string | null,
    provider: string,
  ) {
    super(message, 'VERSION_CONFLICT', provider)
    this.name = 'StorageVersionConflictError'
  }
}

/** True, wenn ein Fehler ein Versionskonflikt ist (ueber Prozess-/Bundle-Grenzen sicher). */
export function isVersionConflict(error: unknown): error is StorageVersionConflictError {
  return error instanceof StorageError && error.code === 'VERSION_CONFLICT'
}

/**
 * Optionale Faehigkeit: eine bestehende Datei an Ort und Stelle ersetzen.
 */
export interface StorageVersioning {
  /**
   * Ersetzt den Inhalt einer BESTEHENDEN Datei unter Versionsbedingung.
   *
   * Unterschied zu `uploadFile`, und der Grund fuer die eigene Methode:
   * adressiert wird die Datei selbst (`itemId`), nicht Elternordner + Name.
   * Der Provider legt nichts an — existiert die Datei nicht, wirft er,
   * statt sie stillschweigend zu erzeugen.
   *
   * @throws StorageVersionConflictError wenn `ifVersion` nicht der aktuellen Version entspricht
   */
  updateFile(
    itemId: string,
    content: Blob,
    options: StorageUpdateOptions,
  ): Promise<StorageUpdateResult>
}

/**
 * Feature-Detection: kann dieser Provider versioniert schreiben?
 *
 * Aufrufer, die ohne die Sperre nicht arbeiten duerfen, pruefen das und
 * melden `nicht_unterstuetzt` — sie weichen NICHT auf `uploadFile` aus.
 * Ein solcher Fallback waere genau die stille Ueberschreibung, gegen die
 * diese Schnittstelle gebaut ist.
 */
export function supportsVersioning<T extends object>(provider: T): provider is T & StorageVersioning {
  return typeof (provider as { updateFile?: unknown }).updateFile === 'function'
}
