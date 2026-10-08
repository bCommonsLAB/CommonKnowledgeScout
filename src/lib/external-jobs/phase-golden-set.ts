/**
 * @fileoverview External-Job Phase: Golden-Set-Lauf (Welle F, `golden_set_fahren`).
 *
 * @description
 * Liest die Set-Datei aus dem Library-Storage, faehrt den Lauf ueber den
 * Service (`golden-set/lauf.ts`, derselbe Kern wie das Skript), legt den
 * Bericht als Markdown NEBEN die Set-Datei und haengt Bericht und queryIds
 * als `cumulativeMeta.goldenSet` an den Job — dort liest `job_status` sie.
 * Fortschritt je Frage nach `job.logs`. Domaene `external-jobs` (ADR 0001),
 * ohne Secretary; Status und Fehler schreibt die Phase selbst.
 *
 * @module external-jobs
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { baueFrageKontext } from '@/lib/chat/golden-set/kontext'
import { fahreGoldenSet } from '@/lib/chat/golden-set/lauf'
import { parseGoldenSet } from '@/lib/chat/golden-set/schema'
import { getServerProvider } from '@/lib/storage/server-provider'
import type { ExternalJob } from '@/types/external-job'
import { GOLDEN_SET_STEP, leseGoldenSetOptionen } from './enqueue-golden-set'

/** Dateiname des Berichts neben der Set-Datei. */
export function berichtDateiname(setName: string, titel: string, jetzt: Date): string {
  const stamm = setName.replace(/\.json$/i, '')
  const zeit = jetzt.toISOString().slice(0, 16).replace(/[:T]/g, '-')
  return `${stamm}-lauf-${zeit}-${titel.replace(/[^\w-]+/g, '_')}.md`
}

export async function runGoldenSetPhase(job: ExternalJob): Promise<void> {
  const repo = new ExternalJobsRepository()
  const optionen = leseGoldenSetOptionen(job)
  await repo.updateStep(job.jobId, GOLDEN_SET_STEP, { status: 'running', startedAt: new Date() })
  try {
    const provider = await getServerProvider(job.userEmail, job.libraryId)
    if (!provider) throw new Error('Storage-Provider nicht verfuegbar')
    const { blob } = await provider.getBinary(optionen.setSourceId)
    const set = parseGoldenSet(JSON.parse(await blob.text()))
    const kontext = await baueFrageKontext({ libraryId: job.libraryId, userEmail: job.userEmail, baseline: optionen.baseline, model: optionen.model })
    await repo.pushLog(job.jobId, { phase: 'golden_set', progress: 0, message: `${set.fragen.length} Fragen, Modell ${kontext.model}${optionen.baseline ? ', BASELINE' : ''}` })

    const lauf = await fahreGoldenSet({
      kontext, set, titel: optionen.titel, retriever: optionen.retriever, temperature: optionen.temperature,
      nur: optionen.nur, richterModel: optionen.richterModel,
      onFortschritt: (stand) => repo.pushLog(job.jobId, {
        phase: 'golden_set', progress: Math.round((stand.index / stand.gesamt) * 100),
        message: `${stand.index}/${stand.gesamt} ${stand.frageId}: ${stand.bestanden ? 'OK' : 'FEHL'} (queryId ${stand.queryId})`,
      }),
    })

    const name = berichtDateiname(optionen.setName, optionen.titel, new Date())
    const datei = await provider.uploadFile(optionen.setParentId, new File([`${lauf.markdown}\n`], name, { type: 'text/markdown' }))
    const ergebnis = {
      titel: optionen.titel, model: lauf.model, baseline: optionen.baseline, richterModel: optionen.richterModel ?? null,
      bericht: lauf.bericht, berichtDatei: { id: datei.id, name }, queryIds: lauf.queryIds,
    }
    await repo.appendMeta(job.jobId, { goldenSet: ergebnis }, 'phase-golden-set')
    await repo.updateStep(job.jobId, GOLDEN_SET_STEP, {
      status: 'completed', endedAt: new Date(),
      details: { fragen: lauf.eintraege.length, bestanden: lauf.bericht.gesamt.deterministischBestanden, bericht: name },
    })
    await repo.setStatus(job.jobId, 'completed')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await repo.updateStep(job.jobId, GOLDEN_SET_STEP, { status: 'failed', endedAt: new Date(), error: { message } })
    await repo.setStatus(job.jobId, 'failed', { error: { code: 'golden_set_failed', message } })
    throw error
  }
}
