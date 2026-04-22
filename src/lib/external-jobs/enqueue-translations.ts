/**
 * @fileoverview Helfer zum Anlegen von Translation-External-Jobs
 *
 * @description
 * Wird von der Publish-API aufgerufen, sobald ein Dokument auf
 * `published` gesetzt wird. Pro Ziel-Locale wird genau EIN External Job
 * (`operation: 'translate'`, `phase: 'phase-translations'`) erzeugt.
 * Der Worker (siehe `phase-translations.ts`) konsumiert die Jobs und
 * schreibt das Ergebnis in `docMetaJson.translations.gallery|detail.<locale>`.
 *
 * Damit bleibt die Publish-API selbst sehr schmal: keine LLM-Calls,
 * kein direkter Schreibzugriff auf Translations – nur Job-Erzeugung.
 *
 * @module external-jobs/enqueue-translations
 */

import crypto from 'crypto'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { ExternalJob } from '@/types/external-job'

/**
 * Argumente fuer das Enqueueing eines Translation-Jobs.
 */
export interface EnqueueTranslationJobArgs {
  libraryId: string
  fileId: string
  /** Quelle: Sprache des Original-Dokuments (z.B. 'de'). */
  sourceLocale: string
  /** Ziel-Locale (z.B. 'en') – ein Job pro Ziel-Locale. */
  targetLocale: string
  /** UI-Detail-Ansicht (steuert die uebersetzbaren Felder via Registry). */
  detailViewType?: string
  /** Aufrufender User (fuer Auditing) */
  userEmail: string
  /**
   * Optional: Re-Translate-Flag. Wenn true, soll der Worker die bestehende
   * Translation-Sub-Map ueberschreiben (sonst kann er sie ueberspringen).
   */
  force?: boolean
  /**
   * Optional: Sprechender Quell-Titel des Dokuments (z.B. docMetaJson.title
   * oder originalFilename). Wird in `correlation.source.name` gespeichert
   * und dient ausschliesslich als Anzeige-Label im Job-Monitor-Panel.
   * Faellt der Wert weg, wird als Fallback `fileId` verwendet (kryptischer
   * base64-Hash) – das ist die Quelle der unleserlichen Job-Titel.
   */
  sourceName?: string
}

export interface EnqueueTranslationJobResult {
  jobId: string
  jobSecret: string
}

/**
 * Erzeugt einen einzelnen Translation-Job in der `external_jobs`-Collection.
 *
 * Bewusste Designentscheidungen:
 * - 1 Job pro Locale: erlaubt parallele Verarbeitung und granulares Retrying.
 * - `correlation.source.itemId = fileId`: erlaubt es dem Worker und der UI,
 *   alle Jobs zu einem Dokument zu finden (Status-Spalten, Re-Translate).
 * - `parameters.targetLocale` statt `targetLanguage`: trennt UI-Locale klar
 *   vom secretary-spezifischen `targetLanguage`-Feld der Extract-Jobs.
 */
export async function enqueueTranslationJob(
  args: EnqueueTranslationJobArgs,
): Promise<EnqueueTranslationJobResult> {
  const repo = new ExternalJobsRepository()
  const jobId = crypto.randomUUID()
  const jobSecret = crypto.randomBytes(24).toString('base64url')
  const jobSecretHash = repo.hashSecret(jobSecret)

  const job: ExternalJob = {
    jobId,
    jobSecretHash,
    job_type: 'translation',
    operation: 'translate',
    worker: 'secretary',
    status: 'queued',
    libraryId: args.libraryId,
    userEmail: args.userEmail,
    // Anzeige-Name fuer das Job-Monitor-Panel: "<DocTitel> → <LOCALE>".
    // Locale gross, damit man sofort sieht, in welche Sprache uebersetzt wird.
    // Faellt sourceName weg (z.B. weil Doc keinen Titel hat), nehmen wir
    // bewusst den fileId – der Job ist dann zwar haesslich beschriftet,
    // bleibt aber eindeutig zuordenbar.
    correlation: {
      jobId,
      libraryId: args.libraryId,
      // itemId = fileId, damit Worker und UI Jobs pro Dokument finden koennen.
      source: {
        itemId: args.fileId,
        name: args.sourceName
          ? `${args.sourceName} → ${args.targetLocale.toUpperCase()}`
          : args.fileId,
        mediaType: 'document',
      },
      // Phase-spezifische Optionen (Worker liest sie in phase-translations).
      options: {
        phase: 'phase-translations',
        sourceLocale: args.sourceLocale,
        targetLocale: args.targetLocale,
        detailViewType: args.detailViewType,
        force: args.force ?? false,
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: [
      // Initialer Step. Worker erzeugt weitere Steps (z.B. fetch_meta, translate, write_back).
      { name: 'phase-translations', status: 'pending' },
    ],
    parameters: {
      sourceLocale: args.sourceLocale,
      targetLocale: args.targetLocale,
      detailViewType: args.detailViewType,
      force: args.force ?? false,
    },
  }

  await repo.create(job)
  return { jobId, jobSecret }
}

/**
 * Bequemer Wrapper: enqueued einen Job pro Ziel-Locale parallel und liefert
 * Map locale -> jobId zurueck. Schluesselt die Jobs an `correlation.source.itemId`.
 */
export async function enqueueTranslationJobsForLocales(
  base: Omit<EnqueueTranslationJobArgs, 'targetLocale'>,
  targetLocales: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  // Bewusst sequenziell: ExternalJobsRepository legt zudem Indexe an, das soll
  // beim ersten Aufruf nur einmal passieren. Der eigentliche LLM-Call laeuft
  // spaeter parallel im Worker (1 Job pro Locale).
  for (const locale of targetLocales) {
    const { jobId } = await enqueueTranslationJob({ ...base, targetLocale: locale })
    out[locale] = jobId
  }
  return out
}
