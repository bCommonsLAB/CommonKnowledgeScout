/**
 * @fileoverview Konfliktantwort mit aktuellem Inhalt (Q1, Welle ST2).
 *
 * @description
 * Die Anforderung Q1 verlangt, dass ein Versionskonflikt den aktuellen
 * Inhalt UND die aktuelle Version mitliefert — „damit der Aufrufer mergen
 * und erneut schreiben kann, ohne noch einmal zu lesen".
 *
 * Der Provider-Fehler traegt bewusst nur die Version (siehe
 * `packages/contracts/src/storage-versioning.ts`). Den Inhalt haengt diese
 * Schicht an: Der Storage-Read auf dem Fehlerpfad ist billig, die zusaetzliche
 * Runde Agent ↔ Server waere es nicht — und um die geht es.
 *
 * @module mcp/storage
 */

import { isVersionConflict } from '@/lib/storage/types'
import type { StorageProvider } from '@/lib/storage/types'
import { begrenze } from './bereich'
import type { ToolResult } from '../tool-shared'

/** Wie viel aktueller Inhalt einer Konfliktantwort beigelegt wird. */
const MAX_KONFLIKT_BYTES = 64 * 1024

/**
 * Baut die Konfliktantwort, wenn `fehler` ein Versionskonflikt ist —
 * sonst `null`, und der Aufrufer behandelt den Fehler normal weiter.
 */
export async function konfliktAntwort(args: {
  fehler: unknown
  provider: StorageProvider
  fileId: string
  pfad: string
}): Promise<ToolResult | null> {
  const { fehler, provider, fileId, pfad } = args
  if (!isVersionConflict(fehler)) return null

  // Scheitert das Nachladen, bleibt die Konfliktmeldung trotzdem eine
  // Konfliktmeldung — nur ohne Inhalt. Sie als Programmfehler auszugeben
  // waere die schlechtere Auskunft.
  let aktuellerInhalt: string | null = null
  let nachladeFehler: string | null = null
  try {
    const { blob } = await provider.getBinary(fileId)
    aktuellerInhalt = begrenze(await blob.text(), MAX_KONFLIKT_BYTES).inhalt
  } catch (nachladen) {
    nachladeFehler = nachladen instanceof Error ? nachladen.message : String(nachladen)
  }

  return {
    isError: true,
    content: [{
      type: 'text',
      text: JSON.stringify({
        fehler: 'konflikt',
        meldung: fehler.message,
        pfad,
        id: fileId,
        erwarteteVersion: fehler.expectedVersion,
        aktuelleVersion: fehler.currentVersion,
        aktuellerInhalt,
        nachladeFehler,
        hinweis:
          'Es wurde NICHTS geschrieben. Den aktuellen Inhalt mit der eigenen Aenderung ' +
          'zusammenfuehren und mit aktuelleVersion als ifVersion erneut schreiben. ' +
          'Ein zweiter Versuch mit derselben ifVersion scheitert wieder.',
      }, null, 2),
    }],
  }
}
