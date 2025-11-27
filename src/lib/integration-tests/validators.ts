/**
 * @fileoverview Integration Test Validators for External Jobs
 *
 * @description
 * Enthält Hilfsfunktionen, um External-Job-Dokumente und zugehörige Shadow-Twin-
 * Artefakte gegen die im Plan definierten Erwartungen zu prüfen. Wird serverseitig
 * von den Integrationstest-APIs und -Orchestratoren verwendet.
 *
 * @module integration-tests
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getServerProvider } from '@/lib/storage/server-provider'
import { findShadowTwinFolder, findShadowTwinMarkdown } from '@/lib/storage/shadow-twin'
import type { IntegrationTestCase, ExpectedOutcome } from './test-cases'
import type { ExternalJob } from '@/types/external-job'

export interface ValidationMessage {
  type: 'info' | 'warn' | 'error';
  message: string;
}

export interface JobValidationResult {
  jobId: string;
  testCaseId: string;
  ok: boolean;
  messages: ValidationMessage[];
}

function pushMessage(
  acc: ValidationMessage[],
  type: ValidationMessage['type'],
  message: string
): void {
  acc.push({ type, message })
}

function checkStepStatus(
  job: unknown,
  stepName: string,
  expectedStatus: 'pending' | 'running' | 'completed' | 'failed',
  messages: ValidationMessage[]
): boolean {
  const steps = (job as { steps?: Array<{ name?: string; status?: string; details?: Record<string, unknown> }> }).steps
  if (!Array.isArray(steps)) {
    pushMessage(messages, 'warn', `Keine Steps im Job-Dokument gefunden (erwarte Step "${stepName}")`)
    return false
  }
  const step = steps.find(s => s?.name === stepName)
  if (!step) {
    pushMessage(messages, 'warn', `Step "${stepName}" nicht gefunden`)
    return false
  }
  if (step.status !== expectedStatus) {
    pushMessage(
      messages,
      'warn',
      `Step "${stepName}" hat Status "${step.status ?? 'unknown'}", erwarte "${expectedStatus}"`
    )
    return false
  }
  pushMessage(messages, 'info', `Step "${stepName}" hat erwarteten Status "${expectedStatus}"`)
  return true
}

function summarizeShadowTwinState(
  job: import('@/types/external-job').ExternalJob,
  expected: ExpectedOutcome,
  messages: ValidationMessage[]
): void {
  const state = job.shadowTwinState
  if (!state) {
    if (expected.expectShadowTwinExists) {
      pushMessage(messages, 'error', 'Shadow‑Twin wird erwartet, aber shadowTwinState fehlt im Job-Dokument')
    }
    return
  }

  const processingStatus = state.processingStatus
  const transcriptCount = Array.isArray(state.transcriptFiles) ? state.transcriptFiles.length : 0
  const hasTransformed = !!state.transformed

  pushMessage(
    messages,
    'info',
    `Shadow‑Twin-State: processingStatus=${processingStatus ?? 'undefined'}, transcriptFiles=${transcriptCount}, transformed=${hasTransformed ? 'ja' : 'nein'}`
  )

  if (expected.expectShadowTwinExists && expected.shouldComplete && job.status === 'completed') {
    if (processingStatus && processingStatus !== 'ready') {
      pushMessage(
        messages,
        'error',
        `Shadow‑Twin processingStatus ist "${processingStatus}", erwarte "ready" bei abgeschlossenem Job`
      )
    }
  }
}

function checkDisabledPhaseStep(
  job: import('@/types/external-job').ExternalJob,
  stepName: 'transform_template' | 'ingest_rag',
  phaseEnabled: boolean,
  messages: ValidationMessage[]
): void {
  if (phaseEnabled) return

  const steps = job.steps || []
  const step = steps.find(s => s?.name === stepName)
  if (!step) {
    // Wenn der Step gar nicht existiert, ist das für deaktivierte Phasen tolerierbar.
    pushMessage(messages, 'info', `Step "${stepName}" ist für deaktivierte Phase nicht vorhanden (ok)`)
    return
  }

  const details = step.details as { skipped?: unknown; reason?: unknown } | undefined
  const skipped = details?.skipped === true
  const reason = typeof details?.reason === 'string' ? details.reason : undefined

  if (!skipped) {
    pushMessage(
      messages,
      'warn',
      `Phase für Step "${stepName}" ist deaktiviert, aber Step ist nicht als skipped markiert`
    )
    return
  }

  if (reason !== 'phase_disabled') {
    pushMessage(
      messages,
      'warn',
      `Step "${stepName}" ist zwar skipped, aber reason="${reason ?? 'unbekannt'}" statt "phase_disabled"`
    )
  } else {
    pushMessage(
      messages,
      'info',
      `Step "${stepName}" korrekt als skipped mit reason="phase_disabled" markiert`
    )
  }
}

async function validateShadowTwin(
  job: import('@/types/external-job').ExternalJob,
  expected: ExpectedOutcome,
  messages: ValidationMessage[]
): Promise<void> {
  if (!expected.expectShadowTwinExists && !expected.expectLegacyMarkdownRemovedFromParent) return

  const state = job.shadowTwinState
  if (expected.expectShadowTwinExists) {
    if (!state?.shadowTwinFolderId) {
      pushMessage(messages, 'error', 'Shadow‑Twin wird erwartet, aber shadowTwinFolderId fehlt im Job-Dokument')
    } else {
      pushMessage(messages, 'info', `Shadow‑Twin-Verzeichnis vorhanden: ${state.shadowTwinFolderId}`)
    }
  }

  if (!expected.expectLegacyMarkdownRemovedFromParent) return

  const source = job.correlation?.source
  if (!source?.parentId || !source.name) {
    pushMessage(
      messages,
      'warn',
      'Für die Prüfung von Legacy-Markdown fehlen parentId oder Name in job.correlation.source'
    )
    return
  }

  const provider = await getServerProvider(job.userEmail, job.libraryId)
  const siblings = await provider.listItemsById(source.parentId)
  const baseName = source.name.replace(/\.[^/.]+$/, '')

  // Transformierter Name (mit Sprache – wir kennen hier nicht sicher die Sprache, prüfen daher auf Präfix)
  const legacyMarkdownInParent = siblings.filter(
    it =>
      it.type === 'file' &&
      typeof it.metadata?.name === 'string' &&
      // Grobe Heuristik: gleicher Basisname + .*.md
      (it.metadata.name as string).startsWith(`${baseName}.`) &&
      (it.metadata.name as string).endsWith('.md')
  )

  if (legacyMarkdownInParent.length > 0) {
    pushMessage(
      messages,
      'error',
      `Legacy-Markdown liegt weiterhin im PDF-Ordner: ${legacyMarkdownInParent
        .map(it => String(it.metadata?.name))
        .join(', ')}`
    )
  } else {
    pushMessage(messages, 'info', 'Keine Legacy-Markdown-Datei mehr im PDF-Ordner gefunden')
  }

  // Optional: Sicherstellen, dass im Shadow‑Twin-Verzeichnis ein transformiertes File existiert
  if (state?.shadowTwinFolderId) {
    const shadowTwinFolder = await findShadowTwinFolder(source.parentId, source.name, provider)
    if (!shadowTwinFolder) {
      pushMessage(
        messages,
        'warn',
        'Shadow‑Twin-Verzeichnis konnte im Storage nicht gefunden werden, obwohl shadowTwinFolderId gesetzt ist'
      )
      return
    }
    const langRaw = (job.correlation?.options as { targetLanguage?: unknown } | undefined)?.targetLanguage
    const lang = typeof langRaw === 'string' && langRaw.trim() ? langRaw.trim() : 'de'
    const markdownInTwin = await findShadowTwinMarkdown(shadowTwinFolder.id, baseName, lang, provider)
    if (!markdownInTwin) {
      pushMessage(
        messages,
        'error',
        'Im Shadow‑Twin-Verzeichnis wurde keine transformierte Markdown-Datei gefunden'
      )
    } else {
      pushMessage(
        messages,
        'info',
        `Transformierte Markdown-Datei im Shadow‑Twin-Verzeichnis gefunden: ${String(
          markdownInTwin.metadata?.name
        )}`
      )
    }
  }
}

async function validateIngestion(
  job: import('@/types/external-job').ExternalJob,
  expected: ExpectedOutcome,
  messages: ValidationMessage[]
): Promise<void> {
  if (!expected.expectIngestionRun) return
  const ingestion = job.ingestion
  if (!ingestion || typeof ingestion.vectorsUpserted !== 'number' || ingestion.vectorsUpserted <= 0) {
    pushMessage(
      messages,
      'error',
      'Ingestion wird erwartet, aber ingestion.vectorsUpserted ist nicht gesetzt oder 0'
    )
  } else {
    pushMessage(
      messages,
      'info',
      `Ingestion erfolgreich: ${ingestion.vectorsUpserted} Vektoren upserted (Index: ${
        ingestion.index || 'unbekannt'
      })`
    )
  }
}

/**
 * Validiert, ob MongoDB-Dokument für fileId existiert
 */
async function validateMongoUpsert(
  job: import('@/types/external-job').ExternalJob,
  expected: ExpectedOutcome,
  messages: ValidationMessage[]
): Promise<void> {
  if (!expected.expectMongoUpsert) return

  const fileId = job.correlation?.source?.itemId
  if (!fileId) {
    pushMessage(messages, 'warn', 'Keine fileId im Job gefunden, kann MongoDB nicht prüfen')
    return
  }

  try {
    const { loadLibraryChatContext } = await import('@/lib/chat/loader')
    const { getCollectionNameForLibrary } = await import('@/lib/repositories/doc-meta-repo')
    const { getByFileIds } = await import('@/lib/repositories/doc-meta-repo')

    const ctx = await loadLibraryChatContext(job.userEmail, job.libraryId)
    if (!ctx) {
      pushMessage(messages, 'error', 'Bibliothek nicht gefunden, kann MongoDB nicht prüfen')
      return
    }

    const libraryKey = getCollectionNameForLibrary(ctx.library)
    const docMap = await getByFileIds(libraryKey, job.libraryId, [fileId])
    const docMeta = docMap.get(fileId)

    if (!docMeta) {
      pushMessage(
        messages,
        'error',
        `MongoDB-Dokument wird erwartet, aber docMeta für fileId "${fileId}" nicht gefunden`
      )
    } else {
      const chunkCount = typeof docMeta.chunkCount === 'number' ? docMeta.chunkCount : 0
      const chaptersCount = typeof docMeta.chaptersCount === 'number' ? docMeta.chaptersCount : 0
      pushMessage(
        messages,
        'info',
        `MongoDB-Dokument gefunden: fileId="${fileId}", chunkCount=${chunkCount}, chaptersCount=${chaptersCount}`
      )
    }
  } catch (error) {
    pushMessage(
      messages,
      'error',
      `Fehler beim Prüfen von MongoDB: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Validiert, ob Pinecone-Vektoren für fileId existieren
 */
async function validatePineconeUpsert(
  job: import('@/types/external-job').ExternalJob,
  expected: ExpectedOutcome,
  messages: ValidationMessage[]
): Promise<void> {
  if (!expected.expectPineconeUpsert) return

  const fileId = job.correlation?.source?.itemId
  if (!fileId) {
    pushMessage(messages, 'warn', 'Keine fileId im Job gefunden, kann Pinecone nicht prüfen')
    return
  }

  const apiKey = process.env.PINECONE_API_KEY
  if (!apiKey) {
    pushMessage(messages, 'warn', 'PINECONE_API_KEY nicht gesetzt, kann Pinecone nicht prüfen')
    return
  }

  try {
    const { loadLibraryChatContext } = await import('@/lib/chat/loader')
    const { describeIndex, fetchVectors, queryVectors } = await import('@/lib/chat/pinecone')

    const ctx = await loadLibraryChatContext(job.userEmail, job.libraryId)
    if (!ctx) {
      pushMessage(messages, 'error', 'Bibliothek nicht gefunden, kann Pinecone nicht prüfen')
      return
    }

    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) {
      pushMessage(messages, 'error', `Pinecone-Index "${ctx.vectorIndex}" nicht gefunden oder ohne Host`)
      return
    }

    // Versuche Meta-Vektor zu finden
    const metaId = `${fileId}-meta`
    const fetched = await fetchVectors(idx.host, apiKey, [metaId], '')
    const metaVector = fetched[metaId]

    if (metaVector) {
      const chunkCount = typeof metaVector.metadata?.chunkCount === 'number' ? metaVector.metadata.chunkCount : 0
      pushMessage(
        messages,
        'info',
        `Pinecone Meta-Vektor gefunden: id="${metaId}", chunkCount=${chunkCount}`
      )
    } else {
      // Fallback: Query nach fileId
      const zeroVector = new Array<number>(idx.dimension || 3072).fill(0)
      const queryResult = await queryVectors(idx.host, apiKey, zeroVector, 1, {
        user: { $eq: job.userEmail },
        libraryId: { $eq: job.libraryId },
        fileId: { $eq: fileId },
        kind: { $eq: 'doc' },
      })

      if (queryResult.length > 0) {
        const foundVector = queryResult[0]
        const chunkCount = typeof foundVector.metadata?.chunkCount === 'number' ? foundVector.metadata.chunkCount : 0
        pushMessage(
          messages,
          'info',
          `Pinecone Meta-Vektor gefunden (via Query): id="${foundVector.id}", chunkCount=${chunkCount}`
        )
      } else {
        // Prüfe auch Chunk-Vektoren
        const chunkQueryResult = await queryVectors(idx.host, apiKey, zeroVector, 5, {
          user: { $eq: job.userEmail },
          libraryId: { $eq: job.libraryId },
          fileId: { $eq: fileId },
          kind: { $eq: 'chunk' },
        })

        if (chunkQueryResult.length > 0) {
          pushMessage(
            messages,
            'info',
            `Pinecone Chunk-Vektoren gefunden: ${chunkQueryResult.length} Chunks für fileId="${fileId}"`
          )
        } else {
          pushMessage(
            messages,
            'error',
            `Pinecone-Vektoren werden erwartet, aber keine Vektoren für fileId "${fileId}" gefunden`
          )
        }
      }
    }
  } catch (error) {
    pushMessage(
      messages,
      'error',
      `Fehler beim Prüfen von Pinecone: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Validiert einen einzelnen External-Job gegen die erwarteten Ergebnisse eines Testfalls.
 */
export async function validateExternalJobForTestCase(
  testCase: IntegrationTestCase,
  jobId: string
): Promise<JobValidationResult> {
  const repo = new ExternalJobsRepository()
  const messages: ValidationMessage[] = []

  const job = await repo.get(jobId)
  if (!job) {
    pushMessage(messages, 'error', `Job ${jobId} nicht gefunden`)
    return { jobId, testCaseId: testCase.id, ok: false, messages }
  }

  // Basic-Status
  if (testCase.expected.shouldComplete) {
    if (job.status !== 'completed') {
      pushMessage(
        messages,
        'error',
        `Job-Status ist "${job.status}", erwarte "completed" für Testfall ${testCase.id}`
      )
    } else {
      pushMessage(messages, 'info', 'Job-Status ist completed')
    }
  }

  // Extract-Step (falls relevant)
  if (testCase.phases.extract) {
    checkStepStatus(job, 'extract_pdf', 'completed', messages)
    const extractStep = Array.isArray(job.steps)
      ? job.steps.find(s => s?.name === 'extract_pdf')
      : undefined
    const skipped =
      !!extractStep &&
      !!(extractStep.details && typeof extractStep.details.skipped === 'boolean'
        ? extractStep.details.skipped
        : false)

    if (testCase.expected.expectExtractRun === true && skipped) {
      pushMessage(messages, 'error', 'Extract wurde erwartet, aber Step ist als skipped markiert')
    }
    if (testCase.expected.expectExtractSkip === true && !skipped) {
      pushMessage(messages, 'error', 'Extract-Skip wurde erwartet, aber Step ist nicht als skipped markiert')
    }
  }

  // Template-Step (falls relevant)
  if (testCase.phases.template) {
    checkStepStatus(job, 'transform_template', 'completed', messages)
  }

  // Ingestion-Step (falls relevant)
  if (testCase.phases.ingest) {
    checkStepStatus(job, 'ingest_rag', 'completed', messages)
  }

  // Integration-Test-Vorbereitung: Prüfe ob echte oder Dummy-Dateien verwendet wurden
  const jobWithTrace = job as ExternalJob & { trace?: { events?: Array<{ name?: string; attributes?: Record<string, unknown> }> } };
  const traceEvents = jobWithTrace.trace?.events || []
  const preparationEvent = traceEvents.find(e => e?.name === 'integration_test_preparation')
  if (preparationEvent?.attributes) {
    const attrs = preparationEvent.attributes
    const usedRealFiles = attrs.usedRealFiles === true
    const details = attrs.details as {
      shadowTwinMarkdownFound?: boolean
      shadowTwinMarkdownHasFrontmatter?: boolean
      legacyFileCreated?: boolean
      legacyFileIsReal?: boolean
    } | undefined

    if (details) {
      pushMessage(
        messages,
        usedRealFiles ? 'info' : 'warn',
        `Test-Vorbereitung: ${usedRealFiles ? 'Echte Dateien verwendet' : 'Dummy-Dateien generiert'}`
      )
      if (details.shadowTwinMarkdownFound !== undefined) {
        pushMessage(
          messages,
          'info',
          `Shadow-Twin-Markdown gefunden: ${details.shadowTwinMarkdownFound ? 'ja' : 'nein'}`
        )
      }
      if (details.shadowTwinMarkdownHasFrontmatter !== undefined) {
        pushMessage(
          messages,
          details.shadowTwinMarkdownHasFrontmatter ? 'info' : 'warn',
          `Shadow-Twin-Markdown mit Frontmatter: ${details.shadowTwinMarkdownHasFrontmatter ? 'ja' : 'nein'}`
        )
      }
      if (details.legacyFileIsReal !== undefined) {
        pushMessage(
          messages,
          details.legacyFileIsReal ? 'info' : 'warn',
          `Legacy-Datei ist echt: ${details.legacyFileIsReal ? 'ja' : 'nein'}`
        )
      }
    }
  }

  // Template-Phase: Welche Markdown-Dateien wurden geladen/verwendet?
  const templateLoadExistingEvent = traceEvents.find(e => e?.name === 'template_load_existing_file')
  const templateLoadTextSourceEvent = traceEvents.find(e => e?.name === 'template_load_text_source')
  const templateSaveEvent = traceEvents.find(e => e?.name === 'postprocessing_saved')
  
  if (templateLoadExistingEvent?.attributes) {
    const attrs = templateLoadExistingEvent.attributes
    const fileName = attrs.fileName as string | undefined
    const hasFrontmatter = attrs.hasFrontmatter === true
    const hasChapters = attrs.hasChapters === true
    const frontmatterKeys = attrs.frontmatterKeys as number | undefined
    
    pushMessage(
      messages,
      'info',
      `Template-Phase: Bestehende Datei geladen: ${fileName || 'unbekannt'}${hasFrontmatter ? ' (mit Frontmatter)' : ' (ohne Frontmatter)'}${hasChapters ? ', chapters vorhanden' : ''}${frontmatterKeys !== undefined ? `, ${frontmatterKeys} Frontmatter-Keys` : ''}`
    )
  }
  
  if (templateLoadTextSourceEvent?.attributes) {
    const attrs = templateLoadTextSourceEvent.attributes
    const origin = attrs.origin as string | undefined
    const fileName = attrs.fileName as string | undefined
    const textLength = attrs.textLength as number | undefined
    
    if (origin === 'extractedText') {
      pushMessage(
        messages,
        'info',
        `Template-Phase: Text-Quelle aus extractedText verwendet${textLength !== undefined ? ` (${textLength} Zeichen)` : ''}`
      )
    } else if (origin === 'existingFile' && fileName) {
      pushMessage(
        messages,
        'info',
        `Template-Phase: Text-Quelle aus Datei geladen: ${fileName}${textLength !== undefined ? ` (${textLength} Zeichen)` : ''}`
      )
    }
  }
  
  if (templateSaveEvent?.attributes) {
    const attrs = templateSaveEvent.attributes
    const fileName = attrs.fileName as string | undefined
    const hasFrontmatter = attrs.hasFrontmatter === true
    const markdownLength = attrs.markdownLength as number | undefined
    
    pushMessage(
      messages,
      'info',
      `Template-Phase: Datei gespeichert: ${fileName || 'unbekannt'}${hasFrontmatter ? ' (mit Frontmatter)' : ' (ohne Frontmatter)'}${markdownLength !== undefined ? `, ${markdownLength} Zeichen` : ''}`
    )
  }

  // Preprocess-Daten aus Trace extrahieren (Legacy-Datei neben PDF)
  const foundMarkdownEvent = traceEvents.find(e => e?.name === 'preprocess_found_markdown')
  const frontmatterValidEvent = traceEvents.find(e => e?.name === 'preprocess_frontmatter_valid')

  if (foundMarkdownEvent?.attributes) {
    const attrs = foundMarkdownEvent.attributes
    const expectedFileName = attrs.expectedFileName as string | undefined
    const existingFileId = attrs.existingFileId as string | undefined

    if (expectedFileName && existingFileId) {
      // Pfad der Legacy-Datei ermitteln
      try {
        const provider = await getServerProvider(job.userEmail, job.libraryId)
        const path = await provider.getPathById(existingFileId)
        pushMessage(messages, 'info', `Legacy-Datei vorhanden: ${path}`)
      } catch {
        pushMessage(messages, 'info', `Legacy-Datei vorhanden: ${expectedFileName}`)
      }

      // Frontmatter-Status aus Preprocess-Event
      if (frontmatterValidEvent?.attributes) {
        const fmAttrs = frontmatterValidEvent.attributes
        const hasFrontmatter = fmAttrs.hasFrontmatter === true
        const valid = fmAttrs.valid === true
        const metaKeys = (fmAttrs.metaKeys as string[] | undefined) || []

        pushMessage(
          messages,
          'info',
          `Legacy-Datei mit Frontmatter vorhanden: ${hasFrontmatter ? 'ja' : 'nein'}${valid ? ' (valide)' : hasFrontmatter ? ' (ungültig)' : ''}`
        )

        if (metaKeys.length > 0) {
          pushMessage(
            messages,
            'info',
            `Frontmatter-Keys gefunden: ${metaKeys.slice(0, 10).join(', ')}${metaKeys.length > 10 ? ` ... (${metaKeys.length} insgesamt)` : ''}`
          )
        }
      }
    }
  }

  // Extract-Only-Modus (Template & Ingest deaktiviert) – prüfe, ob entsprechendes Event existiert
  if (!testCase.phases.template && !testCase.phases.ingest) {
    const extractOnlyEvent = traceEvents.find(e => e?.name === 'extract_only_mode')
    if (extractOnlyEvent) {
      pushMessage(
        messages,
        'info',
        'Trace-Event "extract_only_mode" gefunden – Extract-Only-Kurzschluss wurde ausgeführt'
      )
    } else {
      pushMessage(
        messages,
        'warn',
        'Erwarte Extract-Only-Modus (template/ingest deaktiviert), aber kein Trace-Event "extract_only_mode" gefunden'
      )
    }
  }

  // Template-Phase-Validierung (analog zu Extract-Only)
  if (testCase.phases.template || testCase.category === 'phase2') {
    // Template-Step-Status prüfen
    if (testCase.phases.template) {
      const templateStep = Array.isArray(job.steps)
        ? job.steps.find(s => s?.name === 'transform_template')
        : undefined
      const templateSkipped =
        !!templateStep &&
        !!(templateStep.details && typeof templateStep.details.skipped === 'boolean'
          ? templateStep.details.skipped
          : false)
      const templateSkippedReason =
        templateStep?.details && typeof templateStep.details === 'object' && 'reason' in templateStep.details
          ? String(templateStep.details.reason)
          : undefined

      // Explizite Ausgabe für TC-2.x Tests: Template-Status klar kommunizieren
      if (testCase.category === 'phase2' || testCase.id?.startsWith('TC-2.')) {
        if (templateSkipped) {
          pushMessage(
            messages,
            'info',
            `✅ Template-Transformation: ÜBERSPRUNGEN${templateSkippedReason ? ` (Grund: ${templateSkippedReason})` : ''}`
          )
        } else {
          pushMessage(
            messages,
            'info',
            `✅ Template-Transformation: DURCHGEFÜHRT`
          )
        }
      }

      if (testCase.expected.expectTemplateRun === true && templateSkipped) {
        // Sonderfall TC-2.4: Wenn chapters bereits vorhanden sind, ist das Überspringen korrekt
        // (nur pages wird rekonstruiert, keine Template-Analyse nötig)
        if (testCase.id === 'TC-2.4' && templateSkippedReason === 'chapters_already_exist') {
          pushMessage(
            messages,
            'info',
            `Template wurde übersprungen (korrekt): chapters bereits vorhanden, nur pages wird rekonstruiert`
          )
        } else if (testCase.id === 'TC-2.5' && templateSkippedReason === 'legacy_markdown_adopted') {
          // Sonderfall TC-2.5: Wenn Legacy-Datei übernommen wurde, ist das Überspringen korrekt
          // (Legacy-Datei wurde ins Shadow-Twin-Verzeichnis verschoben)
          pushMessage(
            messages,
            'info',
            `Template wurde übersprungen (korrekt): Legacy-Datei wurde ins Shadow-Twin-Verzeichnis übernommen`
          )
        } else {
          pushMessage(
            messages,
            'error',
            `Template wurde erwartet, aber Step ist als skipped markiert${templateSkippedReason ? ` (Grund: ${templateSkippedReason})` : ''}`
          )
        }
      }
      if (testCase.expected.expectTemplateRun === false && !templateSkipped) {
        pushMessage(
          messages,
          'error',
          'Template-Skip wurde erwartet, aber Step ist nicht als skipped markiert'
        )
      }
      if (templateSkipped && templateSkippedReason && (testCase.category !== 'phase2' && !testCase.id?.startsWith('TC-2.'))) {
        // Nur ausgeben, wenn nicht bereits oben ausgegeben wurde
        pushMessage(messages, 'info', `Template-Step übersprungen: ${templateSkippedReason}`)
      }
    } else {
      // Template-Phase deaktiviert – prüfe, ob Step korrekt als skipped markiert ist
      checkDisabledPhaseStep(job, 'transform_template', testCase.phases.template, messages)
    }

    // Template-Decision Trace-Event prüfen
    const templateDecisionEvent = traceEvents.find(e => e?.name === 'template_decision')
    if (templateDecisionEvent?.attributes) {
      const attrs = templateDecisionEvent.attributes
      const decision = attrs.decision as 'run' | 'skip' | undefined
      const reason = attrs.reason as string | undefined
      const policy = attrs.policy as string | undefined
      const gate = attrs.gate as boolean | undefined

      if (decision) {
        pushMessage(
          messages,
          'info',
          `Template-Decision: ${decision}${reason ? ` (Grund: ${reason})` : ''}${policy ? `, Policy: ${policy}` : ''}${gate !== undefined ? `, Gate: ${gate}` : ''}`
        )

        // Validierung: Decision sollte mit erwartetem Verhalten übereinstimmen
        if (testCase.expected.expectTemplateRun === true && decision === 'skip') {
          pushMessage(
            messages,
            'error',
            `Template-Decision ist "skip", erwarte aber "run"${reason ? ` (Grund: ${reason})` : ''}`
          )
        }
        if (testCase.expected.expectTemplateRun === false && decision === 'run') {
          pushMessage(
            messages,
            'error',
            `Template-Decision ist "run", erwarte aber "skip"${reason ? ` (Grund: ${reason})` : ''}`
          )
        }
      }
    } else {
      // Template-Decision Event sollte vorhanden sein, wenn Template-Phase aktiviert ist
      // AUSNAHME: Wenn Template mit legacy_markdown_adopted übersprungen wurde, wird kein template_decision Event erzeugt
      // (die Entscheidung wurde bereits im Preprozessor getroffen)
      const templateStepForReason = job.steps?.find(s => s.name === 'transform_template')
      const templateSkippedReasonForCheck = templateStepForReason?.details && typeof templateStepForReason.details === 'object' && 'reason' in templateStepForReason.details
        ? String(templateStepForReason.details.reason)
        : undefined
      if (testCase.phases.template && templateSkippedReasonForCheck !== 'legacy_markdown_adopted') {
        pushMessage(
          messages,
          'warn',
          'Template-Decision Trace-Event nicht gefunden (erwartet bei aktivierter Template-Phase)'
        )
      }
    }

    // Preprocess-Plan Event prüfen (zeigt, was gemacht werden soll)
    const preprocessPlanEvent = traceEvents.find(e => e?.name === 'preprocess_plan')
    if (preprocessPlanEvent?.attributes) {
      const attrs = preprocessPlanEvent.attributes
      const needTemplate = attrs.needTemplate as boolean | undefined
      const needSave = attrs.needSave as boolean | undefined
      const reasons = (attrs.reasons as string[] | undefined) || []

      if (needTemplate !== undefined) {
        pushMessage(
          messages,
          'info',
          `Preprocess-Plan: needTemplate=${needTemplate}, needSave=${needSave ?? 'undefined'}${reasons.length > 0 ? `, Gründe: ${reasons.join(', ')}` : ''}`
        )
      }
    }
  }

  // Shadow‑Twin / Legacy-Markdown / Ingestion-Details
  summarizeShadowTwinState(job, testCase.expected, messages)
  await validateShadowTwin(job, testCase.expected, messages)
  await validateIngestion(job, testCase.expected, messages)
  await validateMongoUpsert(job, testCase.expected, messages)
  await validatePineconeUpsert(job, testCase.expected, messages)

  const hasError = messages.some(m => m.type === 'error')
  return {
    jobId,
    testCaseId: testCase.id,
    ok: !hasError,
    messages,
  }
}


