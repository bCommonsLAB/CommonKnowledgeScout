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
 *   Binary selbst aus dem Storage. Mit `template` laeuft danach auch die
 *   Template-Phase; Ingest nur mit `ingest: true` (Welle I, Owner 11.10.2026:
 *   nie automatisch). Ohne Template bleibt es Transcript-only.
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
import type { PhasePolicies } from '@/lib/processing/phase-policy'
import type { ExternalJob } from '@/types/external-job'
import { fuettereTextImHintergrund } from './text-feed'
import { transformParameter, type TransformOptionen } from './transform-optionen'

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
  /**
   * Welle B: Audio-Kontext als Job-Optionen (Schluessel AUDIO_CONTEXT_OPTION_KEYS,
   * typgeprueft ueber readAudioContextOptions). Nur Audio: die Start-Route
   * loest den Kontext nur fuer job_type audio auf — bei Video waere er still
   * verloren, deshalb ein Fehler statt eines stummen Jobs.
   */
  audioContext?: Record<string, unknown>
  /** Welle B: Lauf-Optionen der Transformation (P6), nur mit Template sinnvoll. */
  optionen?: TransformOptionen
  /**
   * Welle I (Owner 11.10.2026): Ingest ist ein eigener, bewusster Schritt —
   * KEIN Default im Bauer. Der Aufrufer entscheidet sichtbar (`ingest-entscheidung.ts`);
   * `true` ohne Template ist ein Widerspruch und wird abgewiesen.
   */
  ingest: boolean
}): EnqueueJob {
  const template = args.template?.trim() || undefined
  const llmModel = args.llmModel?.trim() || undefined
  const extractPolicy = args.erzwingen === true ? 'force' : 'do'
  const audioContext = args.audioContext ?? {}
  if (Object.keys(audioContext).length > 0 && args.mediaType !== 'audio') {
    throw new Error(`Sprecher-Erkennung, Kontext und Begriffe gibt es nur fuer Audio — "${args.source.name}" ist ${args.mediaType}`)
  }
  if (args.ingest && !template) {
    throw new Error(`ingest: true ohne Vorlage — "${args.source.name}" wuerde nur transkribiert, es gaebe nichts zu ingestieren`)
  }
  const policies: PhasePolicies = template
    ? { extract: extractPolicy, metadata: 'do', ingest: args.ingest ? 'do' : 'ignore' }
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
      options: { targetLanguage: args.targetLanguage ?? 'de', sourceLanguage: 'auto', useCache: true, ...audioContext },
    },
    parameters: {
      ...(template ? { template } : {}),
      ...transformParameter(args.optionen),
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
        ingest: Boolean(template) && args.ingest,
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
  /** Template-Gate uebergehen (`policies.metadata: 'force'`) — siehe enqueue-markdown-job. */
  erzwingen?: boolean
  /** Welle B: Lauf-Optionen der Transformation (P6). */
  optionen?: TransformOptionen
  /** Welle I: Ingest nur auf ausdruecklichen Wunsch — siehe buildSourceTranscribeJob. */
  ingest: boolean
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
    // Welle I2: Der Job wird nicht vom Worker gefahren, sondern von der
    // Callback-Route, die der Text-Feed gleich anstoesst. Als `queued` koennte
    // ihn der Worker parallel claimen und ueber /start ein zweites Mal
    // starten (Befund 11.10.2026) — darum von Anfang an `running`.
    status: 'running',
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
    // Schritte wie beim Markdown-Job (Welle I): ohne sie blieb bei diesem
    // Job unsichtbar, ob der Ingest lief oder bewusst aus war, und der
    // Text-Feed konnte nicht erkennen, ob die Route schon gearbeitet hat.
    steps: [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ],
    parameters: {
      template,
      ...transformParameter(args.optionen),
      // Welle ST8: siehe buildSourceTranscribeJob — ohne dieses Feld faellt
      // der Secretary auf seinen eigenen Default zurueck, und der war am
      // 28.08.2026 eine ungueltige Modell-Id.
      ...(llmModel ? { llmModel } : {}),
      policies: { extract: 'ignore', metadata: args.erzwingen === true ? 'force' : 'do', ingest: args.ingest ? 'do' : 'ignore' },
      phases: { extract: false, template: true, ingest: args.ingest, images: false },
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
  audioContext?: Record<string, unknown>
  optionen?: TransformOptionen
  ingest: boolean
}): Promise<{ jobId: string }> {
  const repo = new ExternalJobsRepository()
  const { jobId, jobSecretHash } = newJobIdentity(repo)
  const job = buildSourceTranscribeJob({ ...args, jobId, jobSecretHash })
  await repo.create(job)
  return { jobId }
}

/**
 * Reiht einen Template-auf-Text-Job ein und stoesst das Fuettern an. Die
 * Funktion kehrt SOFORT mit der `jobId` zurueck; der Fortschritt steht in
 * `job_status`/`job_liste`. Den Feed selbst (Zeitgrenze, bedingtes
 * `failed`, Trace-Ereignisse) beschreibt `text-feed.ts` (Welle I2).
 */
export async function enqueueTemplateOnTextJob(args: {
  libraryId: string
  userEmail: string
  source: SourceRef
  template: string
  llmModel?: string
  targetLanguage?: string
  erzwingen?: boolean
  optionen?: TransformOptionen
  ingest: boolean
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
