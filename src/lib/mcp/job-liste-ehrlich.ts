/**
 * @fileoverview Kuerzlich gescheiterte Jobs sichtbar machen (Welle ST9).
 *
 * @description
 * Praxisbilanz 28.08.2026: „Die offene Job-Liste meldete Ruhe, waehrend
 * vierzehn von fuenfzehn Jobs gescheitert waren." Der Default von
 * `job_liste` zeigt nur queued/running — das ist als „was laeuft noch?"
 * dokumentiert, aber wer nach einem Stapel-Start auf seine Jobs wartet,
 * liest Ruhe als Erfolg. Eine Auskunft, die Fehlschlaege verschweigt,
 * waehrend man auf sie wartet, ist die falsche Vorgabe.
 *
 * Deshalb traegt die ungefilterte Antwort jetzt die Fehlschlaege der
 * letzten Stunde mit — als Zaehler plus jobIds, damit der Agent direkt
 * `job_status` (mit fehlerDetails) aufrufen kann.
 *
 * @module mcp
 */

/** Zeitfenster: Fehlschlaege aelter als eine Stunde sind Geschichte, kein Alarm. */
export const FEHLSCHLAG_FENSTER_MS = 60 * 60 * 1000

/** Die Felder, die die Zaehlung braucht — bewusst schmal (testbar). */
export interface JobFuerZaehlung {
  jobId: string
  updatedAt?: Date | string | null
}

export interface KuerzlichGescheitert {
  anzahl: number
  jobIds: string[]
  hinweis: string | null
}

/**
 * Zaehlt Jobs, deren letzter Stand im Zeitfenster liegt. `jetzt` ist
 * injizierbar (Tests); unlesbare Zeitstempel zaehlen NICHT mit — ein
 * geratener Alarm waere schlechter als ein verpasster alter Job, denn er
 * schickt den Agenten in eine Fehlersuche ohne Fehler.
 */
export function zaehleKuerzlichGescheitert(
  gescheiterteJobs: JobFuerZaehlung[],
  jetzt: Date = new Date(),
): KuerzlichGescheitert {
  const schwelle = jetzt.getTime() - FEHLSCHLAG_FENSTER_MS
  const kuerzlich = gescheiterteJobs.filter((job) => {
    const wert = job.updatedAt instanceof Date ? job.updatedAt.getTime() : Date.parse(job.updatedAt ?? '')
    return Number.isFinite(wert) && wert >= schwelle
  })
  const jobIds = kuerzlich.slice(0, 15).map((job) => job.jobId)
  return {
    anzahl: kuerzlich.length,
    jobIds,
    hinweis: kuerzlich.length === 0
      ? null
      : `${kuerzlich.length} Job(s) sind in der letzten Stunde GESCHEITERT — eine leere ` +
        'queued/running-Liste heisst hier nicht Erfolg. Details je Job: job_status (liefert fehlerDetails).',
  }
}
