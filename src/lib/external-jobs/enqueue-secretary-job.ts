/**
 * @fileoverview Secretary-Jobs programmatisch einreihen (MCP-Bruecke, Welle 5).
 *
 * @description
 * Dieselben Job-Formen, die die `/api/secretary/process-{audio,video,text}/job`-
 * Routen bauen — als Service fuer Aufrufer OHNE Clerk-Session (MCP-Werkzeuge
 * `quelle_erschliessen` / `transformation_starten`). Der External-Jobs-Worker
 * uebernimmt die Verarbeitung wie bisher (Strangler unveraendert):
 *
 * - Quelle erschliessen (audio/video): Job `transcribe`; der Worker laedt das
 *   Binary selbst aus dem Storage. Mit `template` laeuft danach auch
 *   Template+Ingest (voll erschliessen), ohne bleibt es Transcript-only.
 * - Template auf vorhandenen Text (Muster der text-Job-Route): Job mit
 *   `extract: ignore` anlegen und den Callback direkt mit `extracted_text`
 *   fuettern — der Text kommt beim MCP-Werkzeug aus dem Mongo-Transkript,
 *   der Job haengt an der QUELLE (dort landet die Transformation).
 *
 * Die Job-Objekte werden von reinen Buildern erzeugt (unit-testbar).
 *
 * @module external-jobs
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { FileLogger } from '@/lib/debug/logger'
import { getSelfBaseUrl } from '@/lib/env'
import type { PhasePolicies } from '@/lib/processing/phase-policy'
import type { ExternalJob } from '@/types/external-job'

export interface SourceRef {
  itemId: string
  parentId: string
  name: string
  mimeType?: string
}

export type EnqueueJob = Omit<ExternalJob, 'createdAt' | 'updatedAt'>

export interface BuiltJob {
  job: EnqueueJob
  jobSecret: string
}

function newJobIdentity(repo: ExternalJobsRepository): { jobId: string; jobSecret: string; jobSecretHash: string } {
  const jobId = crypto.randomUUID()
  const jobSecret = crypto.randomBytes(24).toString('base64url')
  return { jobId, jobSecret, jobSecretHash: repo.hashSecret(jobSecret) }
}

/** Erschliessungs-Job (audio/video) — exakt die Form der Job-Routen. */
export function buildSourceTranscribeJob(args: {
  jobId: string
  jobSecretHash: string
  libraryId: string
  userEmail: string
  source: SourceRef
  mediaType: 'audio' | 'video'
  template?: string
  /** LLM-Modell fuer die Template-Transformation. */
  llmModel?: string
  targetLanguage?: string
  /**
   * Welle ST11: Extract-Gate uebergehen (`policies.extract: 'force'`).
   * Noetig fuer Familien, die die Gate-Annahme „Transformation impliziert
   * Transkript" verletzen (Alt-Format-Migration, Befund 29.08.2026): Das
   * Gate liest die vorhandene Zusammenfassung als Beweis fuers Transkript
   * und ueberspringt die Transkription — der Job wird completed, ohne je
   * etwas zu schreiben.
   */
  erzwingen?: boolean
}): EnqueueJob {
  const template = args.template?.trim() || undefined
  const llmModel = args.llmModel?.trim() || undefined
  const extractPolicy = args.erzwingen === true ? 'force' : 'do'
  const policies: PhasePolicies = template
    ? { extract: extractPolicy, metadata: 'do', ingest: 'do' }
    : { extract: extractPolicy, metadata: 'ignore', ingest: 'ignore' }
  return {
    jobId: args.jobId,
    jobSecretHash: args.jobSecretHash,
    job_type: args.mediaType,
    operation: 'transcribe',
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId: args.jobId,
      libraryId: args.libraryId,
      source: {
        mediaType: args.mediaType,
        mimeType: args.source.mimeType ?? `${args.mediaType}/*`,
        name: args.source.name,
        itemId: args.source.itemId,
        parentId: args.source.parentId,
      },
      options: { targetLanguage: args.targetLanguage ?? 'de', sourceLanguage: 'auto', useCache: true },
    },
    parameters: {
      ...(template ? { template } : {}),
      // Welle ST8 (Live-Befund 28.08.2026): Ohne dieses Feld faellt der
      // Secretary auf SEINEN Default zurueck — und der stand tagelang auf
      // `deepseek/deepseek-v4-flash-latest`, einer Modell-Id, die es bei
      // OpenRouter nicht gibt. Jede Transformation ueber die Bruecke starb
      // nach ~100 ms mit HTTP 400, waehrend derselbe Weg aus der Werkbank
      // lief: die gibt ein Modell mit. Ein stiller Rueckfall auf fremde
      // Konfiguration ist genau das, was `no-silent-fallbacks` verbietet.
      ...(llmModel ? { llmModel } : {}),
      policies,
      phases: {
        extract: true,
        template: Boolean(template),
        ingest: Boolean(template),
        images: false,
      },
    },
  }
}

/** Template-auf-Text-Job (Muster der text-Job-Route, extract wird gefuettert). */
export function buildTemplateOnTextJob(args: {
  jobId: string
  jobSecretHash: string
  libraryId: string
  userEmail: string
  /** Die QUELLE der Familie — dort landet die Transformation. */
  source: SourceRef
  template: string
  /** LLM-Modell fuer die Template-Transformation (siehe parameters unten). */
  llmModel?: string
  targetLanguage?: string
}): EnqueueJob {
  const template = args.template.trim()
  const llmModel = args.llmModel?.trim() || undefined
  if (!template) throw new Error('template ist Pflicht fuer Template-auf-Text-Jobs')
  return {
    jobId: args.jobId,
    jobSecretHash: args.jobSecretHash,
    job_type: 'text',
    operation: 'extract',
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    correlation: {
      jobId: args.jobId,
      libraryId: args.libraryId,
      source: {
        mediaType: 'markdown',
        mimeType: 'text/markdown',
        name: args.source.name,
        itemId: args.source.itemId,
        parentId: args.source.parentId,
      },
      options: { targetLanguage: args.targetLanguage ?? 'de', sourceLanguage: 'auto', useCache: true },
    },
    parameters: {
      template,
      // Welle ST8: siehe buildSourceTranscribeJob — ohne dieses Feld faellt
      // der Secretary auf seinen eigenen Default zurueck, und der war am
      // 28.08.2026 eine ungueltige Modell-Id.
      ...(llmModel ? { llmModel } : {}),
      policies: { extract: 'ignore', metadata: 'do', ingest: 'do' },
      phases: { extract: false, template: true, ingest: true, images: false },
    },
  }
}

/** Reiht einen Erschliessungs-Job ein; der Worker uebernimmt. */
export async function enqueueSourceTranscribeJob(args: {
  libraryId: string
  userEmail: string
  source: SourceRef
  mediaType: 'audio' | 'video'
  template?: string
  llmModel?: string
  targetLanguage?: string
  erzwingen?: boolean
}): Promise<{ jobId: string }> {
  const repo = new ExternalJobsRepository()
  const { jobId, jobSecretHash } = newJobIdentity(repo)
  const job = buildSourceTranscribeJob({ ...args, jobId, jobSecretHash })
  await repo.create(job)
  return { jobId }
}

/**
 * Fuettert den Text-Callback des Jobs — die Route rechnet dabei den GANZEN
 * Job (LLM, Einbettungen, Spiegel-Writes) und antwortet erst danach.
 *
 * Bewusst NICHT awaited vom Aufrufer (Befund 27.08.2026): Frueher wartete
 * `enqueueTemplateOnTextJob` hier ~36 s pro Datei. Ein Stapel von sechs
 * Quellen lief damit 3,6 Minuten und riss das 60-Sekunden-Limit der
 * MCP-Bruecke — obwohl die Werkzeug-Beschreibung „antwortet SOFORT mit
 * jobId" verspricht und der Job-Worker sechs Jobs parallel fahren koennte.
 *
 * Ein Fehlschlag wird darum HIER behandelt: Der Job faellt sichtbar auf
 * `failed` mit Begruendung, statt still `queued` zu bleiben.
 */
async function fuettereTextImHintergrund(args: {
  jobId: string
  jobSecret: string
  extractedText: string
}): Promise<void> {
  const callbackUrl = `${getSelfBaseUrl().replace(/\/$/, '')}/api/external/jobs/${args.jobId}`
  try {
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.jobSecret}`,
        'X-Internal-Token': process.env.INTERNAL_TEST_TOKEN || '',
      },
      body: JSON.stringify({ data: { extracted_text: args.extractedText } }),
    })
    if (response.ok) return
    const text = await response.text().catch(() => '')
    await meldeFuetterFehler(args.jobId, `Text-Feed schlug fehl (HTTP ${response.status}): ${text.slice(0, 200)}`)
  } catch (fehler) {
    await meldeFuetterFehler(
      args.jobId,
      `Text-Feed nicht zustellbar: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
    )
  }
}

/** Fehlschlag im Job festhalten — nichts bleibt still stehen. */
async function meldeFuetterFehler(jobId: string, meldung: string): Promise<void> {
  FileLogger.error('enqueue-secretary-job', 'Text-Feed fehlgeschlagen', { jobId, meldung })
  try {
    await new ExternalJobsRepository().setStatus(jobId, 'failed', {
      error: { code: 'text_feed_failed', message: meldung },
    })
  } catch (fehler) {
    FileLogger.error('enqueue-secretary-job', 'Job liess sich nicht auf failed setzen', {
      jobId,
      fehler: fehler instanceof Error ? fehler.message : String(fehler),
    })
  }
}

/**
 * Reiht einen Template-auf-Text-Job ein und stoesst das Fuettern an. Die
 * Funktion kehrt SOFORT mit der `jobId` zurueck; der Fortschritt steht in
 * `job_status`/`job_liste`.
 */
export async function enqueueTemplateOnTextJob(args: {
  libraryId: string
  userEmail: string
  source: SourceRef
  template: string
  llmModel?: string
  targetLanguage?: string
  extractedText: string
}): Promise<{ jobId: string }> {
  if (!args.extractedText.trim()) throw new Error('extractedText ist leer — nichts zu transformieren')
  const repo = new ExternalJobsRepository()
  const { jobId, jobSecret, jobSecretHash } = newJobIdentity(repo)
  const job = buildTemplateOnTextJob({ ...args, jobId, jobSecretHash })
  await repo.create(job)

  // Kein `await`: Der Aufrufer bekommt die jobId sofort, die Rechenarbeit
  // laeuft weiter. Fehler landen im Job, nicht in einer verlorenen Promise.
  void fuettereTextImHintergrund({ jobId, jobSecret, extractedText: args.extractedText })
  return { jobId }
}
