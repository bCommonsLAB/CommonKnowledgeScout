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
import { befundeFuerJob } from './job-befunde'
import { coverQuelleAus, ereignisseAusTrace, folienAus } from './job-ereignisse'

export interface FehlerGruppe {
  ursache: string
  code: string | null
  schritt: string | null
  anzahl: number
  jobIds: string[]
  quellen: Array<{ sourceId: string | null; name: string | null }>
  deutung: FehlerDeutung | null
}

/** Welle K2/K3: Lesersicht je Job — was der Ingest fuer Cover und Folien gerechnet hat, und was fehlt. */
export interface BilanzZeile {
  jobId: string
  status: ExternalJob['status']
  quelle: { sourceId: string | null; name: string | null }
  /** `slides | flyer | none` aus cover_source; null, wenn der Job kein Cover-Ereignis schrieb. */
  coverQuelle: string | null
  folien: { aufgeloest: number; unaufgeloest: number } | null
  befunde: string[]
}

export interface BatchBilanz {
  zaehler: { queued: number; running: number; completed: number; failed: number; pendingStorage: number; total: number }
  /** Welle K3: Jobs mit mindestens einem Befund — auch unter den completed. */
  mitBefund: number
  fehlerNachUrsache: FehlerGruppe[]
  zeilen: BilanzZeile[]
}

/** Mehr Eintraege je Gruppe sagen nichts Neues — job_status liefert den Rest. */
const MAX_JE_GRUPPE = 30
/** Gruppierungsschluessel: Meldung gekuerzt, damit Varianten mit Pfaden zusammenfallen. */
const SCHLUESSEL_LAENGE = 160

function ursacheVon(job: ExternalJob): { ursache: string; code: string | null; schritt: string | null; deutung: FehlerDeutung | null } {
  const details = fehlerDetailsAusTrace(job)
  const letztes = details.length > 0 ? details[details.length - 1] : null
  const meldung = letztes?.meldung ?? job.error?.message ?? null
  const code = letztes?.code ?? job.error?.code ?? null
  return {
    ursache: meldung ? meldung.trim().slice(0, SCHLUESSEL_LAENGE) : 'ohne Fehlermeldung (alter Job ohne Trace?)',
    code,
    schritt: letztes?.schritt ?? null,
    // Welle I3: Die Deutung liest die UNGEKUERZTE Meldung samt Code und
    // Antwort-Auszug — die Signatur („0 LLM-Aufrufe") stand oft hinter dem
    // 160-Zeichen-Schluessel und fiel so durchs Raster.
    deutung: deuteFehler([code, job.error?.code, job.error?.message, meldung, letztes?.antwortAuszug]),
  }
}

function zeileVon(job: ExternalJob): BilanzZeile {
  const ereignisse = ereignisseAusTrace(job)
  const folien = folienAus(ereignisse)
  return {
    jobId: job.jobId,
    status: job.status,
    quelle: { sourceId: job.correlation?.source?.itemId ?? null, name: job.correlation?.source?.name ?? null },
    coverQuelle: coverQuelleAus(ereignisse)?.quelle ?? null,
    folien: folien ? { aufgeloest: folien.aufgeloest, unaufgeloest: folien.unaufgeloest } : null,
    befunde: befundeFuerJob({ status: job.status, steps: job.steps, ereignisse }),
  }
}

export function bilanziereJobs(jobs: readonly ExternalJob[]): BatchBilanz {
  const zaehler = { queued: 0, running: 0, completed: 0, failed: 0, pendingStorage: 0, total: jobs.length }
  const gruppen = new Map<string, FehlerGruppe>()
  const zeilen: BilanzZeile[] = []
  for (const job of jobs) {
    switch (job.status) {
      case 'queued': zaehler.queued += 1; break
      case 'running': zaehler.running += 1; break
      case 'completed': zaehler.completed += 1; break
      case 'failed': zaehler.failed += 1; break
      case 'pending-storage': zaehler.pendingStorage += 1; break
      default: throw new Error(`Unbekannter Job-Status "${String(job.status)}" an Job ${job.jobId}`)
    }
    zeilen.push(zeileVon(job))
    if (job.status !== 'failed') continue
    const { ursache, code, schritt, deutung } = ursacheVon(job)
    const gruppe = gruppen.get(ursache) ?? {
      ursache, code, schritt, anzahl: 0, jobIds: [], quellen: [], deutung,
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
    mitBefund: zeilen.filter((z) => z.befunde.length > 0).length,
    fehlerNachUrsache: [...gruppen.values()].sort((a, b) => b.anzahl - a.anzahl),
    zeilen,
  }
}
