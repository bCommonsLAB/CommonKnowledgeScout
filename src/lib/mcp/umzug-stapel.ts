/**
 * @fileoverview Stapel-Ausfuehrung fuer Umzuege (Welle ST9).
 *
 * @description
 * Praxisbilanz 28.08.2026: „Erschliessen ist EIN Aufruf mit bis zu 30
 * Quellen — Strukturieren dagegen ist ein Aufruf pro Datei. besprechungen/
 * zu zerlegen kostete 26 Aufrufe, jeder mit OneDrive-Latenz. Es gibt kein
 * sourceIds fuer Umzuege." Das Konzept hatte Schritt 2 (Erschliessen) als
 * den teuren angenommen und Schritt 1 (Strukturieren) uebersehen — dieser
 * Stapel schliesst die Luecke nach demselben Muster wie die Jobs.
 *
 * Stapel-Semantik wie bei `runForSources`: Fehler EINER Quelle brechen den
 * Stapel nicht ab — jede Zeile traegt ihr eigenes Ergebnis, damit der Agent
 * gezielt nachfassen kann statt blind neu zu starten. Alle Quellen ziehen in
 * DENSELBEN Ziel-Ordner; Umbenennen bleibt bewusst Einzeloperation, denn ein
 * gemeinsamer neuer Name ergibt fuer mehrere Dateien keinen Sinn.
 *
 * @module mcp
 */

/** Obergrenze je Stapel — gleicher Wert wie bei den Erschliessungs-Jobs. */
export const MAX_UMZUEGE = 30

/** Ergebnis-Zeile: verschoben ODER gescheitert, nie beides. */
export interface UmzugZeile {
  quelle: string
  verschoben?: true
  fehler?: string
}

/**
 * Zieht jede Quelle einzeln um; `name` und `bewege` sind injiziert, damit
 * die Stapel-Logik ohne Storage und ohne moveFamily testbar bleibt.
 */
export async function fuehreStapelUmzugAus(args: {
  sourceIds: string[]
  /** Anzeigename der Quelle — nur fuer die Ergebnis-Zeile, darf scheitern. */
  name: (sourceId: string) => Promise<string>
  /** Der eigentliche Umzug (moveFamily); wirft bei Fehlschlag. */
  bewege: (sourceId: string) => Promise<void>
}): Promise<{ zeilen: UmzugZeile[]; verschoben: number; gescheitert: number }> {
  const { sourceIds, name, bewege } = args
  if (sourceIds.length === 0) throw new Error('sourceIds ist leer')
  if (sourceIds.length > MAX_UMZUEGE) {
    throw new Error(`Hoechstens ${MAX_UMZUEGE} Quellen je Stapel — es waren ${sourceIds.length}`)
  }

  const zeilen: UmzugZeile[] = []
  for (const sourceId of sourceIds) {
    // Der Name dient nur der Lesbarkeit der Antwort — scheitert der Lookup,
    // bleibt die Id die beste Aussage, und der Umzug wird trotzdem versucht.
    const quelle = await name(sourceId).catch(() => sourceId)
    try {
      await bewege(sourceId)
      zeilen.push({ quelle, verschoben: true })
    } catch (error) {
      zeilen.push({ quelle, fehler: error instanceof Error ? error.message : String(error) })
    }
  }
  return {
    zeilen,
    verschoben: zeilen.filter((zeile) => zeile.verschoben).length,
    gescheitert: zeilen.filter((zeile) => zeile.fehler).length,
  }
}
