/**
 * @fileoverview Textdatei an Ort und Stelle ersetzen (Welle ST1).
 *
 * @description
 * Der Weg, den generierte Dateien im Archiv (`_INDEX.md`, `AKTUELL.md`,
 * `PROJEKTE.md`, Erschliessungs-Bloecke) nehmen sollen, an EINER Stelle.
 *
 * Vorher lief das als `deleteItem` + `uploadFile`. Das hat zwei Kosten, die
 * beide schon eingetreten sind: Die Datei bekommt eine neue itemId, und
 * gespeicherte Ids laufen danach in `NOT_FOUND` — genau das passierte der
 * `_INDEX.md`. Und zwischen Loeschen und Hochladen existiert die Datei
 * nicht; bricht der Upload ab, ist sie weg.
 *
 * @module storage
 */

import type { StorageProvider } from './types'
import { supportsVersioning } from './types'

/**
 * Ersetzt den Inhalt einer bestehenden Textdatei unter Versionsbedingung.
 *
 * Liest die aktuelle Version unmittelbar vor dem Schreiben. Das ist kein
 * Ersatz fuer eine Version, die der Aufrufer schon kennt — wer eine hat,
 * ruft `provider.updateFile` direkt auf und schuetzt damit auch die Zeit
 * seit SEINEM Lesen. Diese Funktion ist fuer Aufrufer, die generierte
 * Dateien neu schreiben und vor allem die stabile Id brauchen.
 *
 * @throws wenn der Provider nicht versioniert schreiben kann — es gibt
 *   bewusst KEINEN Rueckfall auf delete+upload: das waere die stille
 *   Ueberschreibung, gegen die diese Schicht gebaut ist.
 */
export async function ersetzeTextDatei(args: {
  provider: StorageProvider
  fileId: string
  inhalt: string
  mimeType?: string
}): Promise<{ fileId: string; version: string }> {
  const { provider, fileId, inhalt } = args

  if (!supportsVersioning(provider)) {
    throw new Error(
      `Storage-Provider "${provider.name}" kann nicht versioniert schreiben — ` +
      `Datei ${fileId} wurde NICHT geaendert. (Erwartet: StorageVersioning.updateFile; ` +
      `betrifft die HTTP-Proxy-Provider im Client-Kontext, nicht den Server-Pfad.)`,
    )
  }

  const aktuell = await provider.getItemById(fileId)
  const version = aktuell.metadata.version
  if (!version) {
    throw new Error(
      `Datei ${fileId} (${aktuell.metadata.name}) liefert keine Version — ` +
      `ohne sie gibt es keine Schreibbedingung, und es wurde NICHTS geaendert.`,
    )
  }

  const blob = new Blob([inhalt], { type: args.mimeType ?? 'text/markdown' })
  const ergebnis = await provider.updateFile(fileId, blob, { ifVersion: version })
  return { fileId: ergebnis.id, version: ergebnis.version }
}
