/**
 * @fileoverview Bilanz eines Batches: Fehler nach Ursache, nicht nach Zahl.
 *
 * @description
 * Live-Test 07./08.10.2026: 33 Jobs standen auf „Worker-Timeout", die
 * Ursache war „kein Twin". Wer nur Zaehler sieht, startet alles neu; wer die
 * Ursache sieht, startet nur dort neu, wo es etwas bringt. Diese Funktion
 * gruppiert gescheiterte Jobs nach ihrer letzten Fehlermeldung (aus dem
 * Trace, sonst `job.error`) und nennt je Gruppe die betroffenen Quellen.
 *
 * @module mcp
 */

import type { ExternalJob } from '@/types/external-job'
import { fehlerDetailsAusTrace } from './job-fehler-details'
import { deuteFehler, type FehlerDeutung } from './fehler-deutung'

export interface FehlerGruppe {
  ursache: string
  code: string | null
  schritt: string | null
  anzahl: number
  jobIds: string[]
  quellen: Array<{ sourceId: string | null; name: string | null }>
  deutung: FehlerDeutung | null
}

export interface BatchBilanz {
  zaehler: { queued: number; running: number; completed: number; failed: number; pendingStorage: number; total: number }
  fehlerNachUrsache: FehlerGruppe[]
}

/** Mehr Eintraege je Gruppe sagen nichts Neues — job_status liefert den Rest. */
const MAX_JE_GRUPPE = 30
/** Gruppierungsschluessel: Meldung gekuerzt, damit Varianten mit Pfaden zusammenfallen. */
const SCHLUESSEL_LAENGE = 160

function ursacheVon(job: ExternalJob): { ursache: string; code: string | null; schritt: string | null } {
  const details = fehlerDetailsAusTrace(job)
  const letztes = details.length > 0 ? details[details.length - 1] : null
  const meldung = letztes?.meldung ?? job.error?.message ?? null
  return {
    ursache: meldung ? meldung.trim().slice(0, SCHLUESSEL_LAENGE) : 'ohne Fehlermeldung (alter Job ohne Trace?)',
    code: letztes?.code ?? job.error?.code ?? null,
    schritt: letztes?.schritt ?? null,
  }
}

export function bilanziereJobs(jobs: readonly ExternalJob[]): BatchBilanz {
  const zaehler = { queued: 0, running: 0, completed: 0, failed: 0, pendingStorage: 0, total: jobs.length }
  const gruppen = new Map<string, FehlerGruppe>()
  for (const job of jobs) {
    switch (job.status) {
      case 'queued': zaehler.queued += 1; break
      case 'running': zaehler.running += 1; break
      case 'completed': zaehler.completed += 1; break
      case 'failed': zaehler.failed += 1; break
      case 'pending-storage': zaehler.pendingStorage += 1; break
      default: throw new Error(`Unbekannter Job-Status "${String(job.status)}" an Job ${job.jobId}`)
    }
    if (job.status !== 'failed') continue
    const { ursache, code, schritt } = ursacheVon(job)
    const gruppe = gruppen.get(ursache) ?? {
      ursache, code, schritt, anzahl: 0, jobIds: [], quellen: [], deutung: deuteFehler([ursache]),
    }
    gruppe.anzahl += 1
    if (gruppe.jobIds.length < MAX_JE_GRUPPE) {
      gruppe.jobIds.push(job.jobId)
      gruppe.quellen.push({ sourceId: job.correlation?.source?.itemId ?? null, name: job.correlation?.source?.name ?? null })
    }
    gruppen.set(ursache, gruppe)
  }
  return {
    zaehler,
    fehlerNachUrsache: [...gruppen.values()].sort((a, b) => b.anzahl - a.anzahl),
  }
}
