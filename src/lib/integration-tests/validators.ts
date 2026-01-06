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
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import type { IntegrationTestCase, ExpectedOutcome } from './test-cases'
import type { ExternalJob } from '@/types/external-job'
import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import path from 'path'

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
  if (!expected.expectShadowTwinExists) return

  const state = job.shadowTwinState
  if (expected.expectShadowTwinExists) {
    if (!state?.shadowTwinFolderId) {
      pushMessage(messages, 'error', 'Shadow‑Twin wird erwartet, aber shadowTwinFolderId fehlt im Job-Dokument')
    } else {
      pushMessage(messages, 'info', `Shadow‑Twin-Verzeichnis vorhanden: ${state.shadowTwinFolderId}`)
    }
  }

  // Optional: Sicherstellen, dass im Shadow‑Twin-Verzeichnis ein transformiertes File existiert
  // (bei v2-only prüfen wir über resolveArtifact(), nicht über legacy Parent-Heuristiken)
  const source = job.correlation?.source
  if (!source?.parentId || !source.name || !source.itemId) return

  const provider = await getServerProvider(job.userEmail, job.libraryId)
  const langRaw = (job.correlation?.options as { targetLanguage?: unknown } | undefined)?.targetLanguage
  const lang = typeof langRaw === 'string' && langRaw.trim() ? langRaw.trim() : 'de'

  const templateRaw = (job.parameters as { template?: unknown } | undefined)?.template
  const templateName = typeof templateRaw === 'string' && templateRaw.trim().length > 0
    ? templateRaw.trim()
    : undefined

  const resolved = await resolveArtifact(provider, {
    sourceItemId: source.itemId,
    sourceName: source.name,
    parentId: source.parentId,
    targetLanguage: lang,
    templateName,
    preferredKind: 'transformation',
  })

  if (!resolved) {
    pushMessage(messages, 'error', 'Im Shadow‑Twin wurde keine transformierte Markdown-Datei gefunden')
  } else {
    pushMessage(messages, 'info', `Transformierte Markdown-Datei gefunden: ${resolved.fileName}`)
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
 * Validiert MongoDB Vector Search: Meta-Dokument, Chunk-Vektoren, Vector Search Index und Queries
 * Ersetzt die alte validateMongoUpsert() Funktion nach MongoDB-Migration
 */
async function validateMongoVectorUpsert(
  job: import('@/types/external-job').ExternalJob,
  expected: ExpectedOutcome,
  messages: ValidationMessage[]
): Promise<void> {
  // Prüfe ob Validierung erwartet wird (neue oder alte Felder)
  if (!expected.expectMongoUpsert && !expected.expectMetaDocument && !expected.expectChunkVectors) return

  const fileId = job.correlation?.source?.itemId
  if (!fileId) {
    pushMessage(messages, 'warn', 'Keine fileId im Job gefunden, kann MongoDB Vector Search nicht prüfen')
    return
  }

  try {
    const { loadLibraryChatContext } = await import('@/lib/chat/loader')
    const { getCollectionNameForLibrary, getMetaByFileId, getVectorCollection, VECTOR_SEARCH_INDEX_NAME } = await import('@/lib/repositories/vector-repo')
    const { getEmbeddingDimensionForModel } = await import('@/lib/chat/config')

    const ctx = await loadLibraryChatContext(job.userEmail, job.libraryId)
    if (!ctx) {
      pushMessage(messages, 'error', 'Bibliothek nicht gefunden, kann MongoDB Vector Search nicht prüfen')
      return
    }

    const libraryKey = getCollectionNameForLibrary(ctx.library)
    const dimension = getEmbeddingDimensionForModel(ctx.library.config?.chat)

    // 1. Prüfe Meta-Dokument (kind: 'meta')
    if (expected.expectMetaDocument || expected.expectMongoUpsert) {
      const metaDoc = await getMetaByFileId(libraryKey, fileId)
      if (!metaDoc) {
        pushMessage(
          messages,
          'error',
          `Meta-Dokument wird erwartet, aber nicht gefunden für fileId "${fileId}"`
        )
      } else {
        const chunkCount = typeof metaDoc.chunkCount === 'number' ? metaDoc.chunkCount : 0
        const chaptersCount = typeof metaDoc.chaptersCount === 'number' ? metaDoc.chaptersCount : 0
        pushMessage(
          messages,
          'info',
          `Meta-Dokument gefunden: fileId="${fileId}", chunkCount=${chunkCount}, chaptersCount=${chaptersCount}`
        )
      }
    }

    // 2. Prüfe Chunk-Vektoren (kind: 'chunk')
    if (expected.expectChunkVectors || expected.expectMongoUpsert) {
      // Verwende direkte MongoDB-Query statt Vector Search für Validierung
      const { findVectorsByFilter } = await import('@/lib/repositories/vector-repo')
      const chunkVectors = await findVectorsByFilter(
        libraryKey,
        {
          libraryId: job.libraryId,
          user: job.userEmail,
          fileId,
          kind: 'chunk',
        },
        100
      )

      if (chunkVectors.length === 0) {
        pushMessage(
          messages,
          'error',
          `Keine Chunk-Vektoren gefunden für fileId "${fileId}"`
        )
      } else {
        pushMessage(
          messages,
          'info',
          `${chunkVectors.length} Chunk-Vektoren gefunden`
        )

        // Prüfe Facetten-Metadaten in Chunks
        if (expected.expectFacetMetadataInChunks && chunkVectors.length > 0) {
          const firstChunk = chunkVectors[0]
          const hasFacets = firstChunk.year !== undefined || 
                            firstChunk.authors !== undefined || 
                            firstChunk.region !== undefined ||
                            firstChunk.docType !== undefined ||
                            firstChunk.source !== undefined ||
                            firstChunk.tags !== undefined
          if (hasFacets) {
            pushMessage(messages, 'info', 'Chunk-Vektoren enthalten Facetten-Metadaten (für Filterung)')
          } else {
            pushMessage(messages, 'warn', 'Chunk-Vektoren enthalten keine Facetten-Metadaten')
          }
        }

        // Prüfe Vector Search Query (falls erwartet)
        if (expected.expectVectorSearchQuery && chunkVectors[0].embedding) {
          try {
            const collection = await getVectorCollection(libraryKey, dimension, ctx.library)
            const queryVector = chunkVectors[0].embedding
            
            // Direkte Vector Search Aggregation für bessere Kontrolle
            const testResults = await collection.aggregate([
              {
                $vectorSearch: {
                  index: VECTOR_SEARCH_INDEX_NAME,
                  path: 'embedding',
                  queryVector: queryVector,
                  numCandidates: Math.max(10 * 10, 100), // Mindestens 100 Kandidaten
                  limit: 10,
                  filter: {
                    kind: 'chunk',
                    libraryId: job.libraryId,
                    // user und fileId weglassen, um mehr Ergebnisse zu bekommen
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  score: { $meta: 'vectorSearchScore' },
                  fileId: 1,
                  kind: 1,
                },
              },
            ]).toArray()
            
            if (testResults.length > 0) {
              pushMessage(messages, 'info', `Vector Search Query erfolgreich: ${testResults.length} Ergebnisse`)
              
              // Prüfe ob die Ergebnisse zum erwarteten fileId gehören
              const matchingResults = testResults.filter((r: { fileId?: unknown }) => r.fileId === fileId)
              if (matchingResults.length > 0) {
                pushMessage(messages, 'info', `${matchingResults.length} Ergebnisse gehören zum erwarteten fileId`)
              } else {
                pushMessage(messages, 'warn', `Vector Search Query lieferte ${testResults.length} Ergebnisse, aber keine für das erwartete fileId "${fileId}"`)
              }
            } else {
              pushMessage(messages, 'warn', 'Vector Search Query lieferte keine Ergebnisse (möglicherweise Index noch nicht bereit oder keine passenden Dokumente)')
            }
          } catch (queryError) {
            const errorMsg = queryError instanceof Error ? queryError.message : String(queryError)
            pushMessage(
              messages,
              'warn',
              `Vector Search Query fehlgeschlagen: ${errorMsg}`
            )
          }
        }
      }
    }

    // 3. Prüfe Chapter-Summaries (falls erwartet)
    if (expected.expectChapterSummaries) {
      // Chapter-Summaries werden nicht als separate Vektoren gespeichert,
      // sondern nur im Meta-Dokument im chapters-Array
      const metaDoc = await getMetaByFileId(libraryKey, fileId)
      
      if (!metaDoc) {
        pushMessage(messages, 'error', 'Meta-Dokument nicht gefunden, kann Chapter-Summaries nicht prüfen')
      } else {
        const chapters = Array.isArray(metaDoc.chapters) ? metaDoc.chapters : []
        const chaptersWithSummary = chapters.filter(ch => 
          ch && typeof ch === 'object' && 
          'summary' in ch && 
          typeof (ch as { summary?: unknown }).summary === 'string' &&
          (ch as { summary: string }).summary.trim().length > 0
        )
        
        if (chapters.length === 0) {
          pushMessage(messages, 'warn', 'Keine Chapters im Meta-Dokument gefunden')
        } else if (chaptersWithSummary.length === 0) {
          pushMessage(messages, 'warn', `${chapters.length} Chapters gefunden, aber keine mit Summary`)
        } else {
          pushMessage(messages, 'info', `${chaptersWithSummary.length} Chapter-Summaries im Meta-Dokument gefunden (von ${chapters.length} Chapters)`)
        }
      }
    }

    // 4. Prüfe Vector Search Index (falls erwartet)
    if (expected.expectVectorSearchIndex) {
      const collection = await getVectorCollection(libraryKey, dimension, ctx.library)
      
      // Prüfe ob Index existiert durch Versuch einer minimalen Vector Search Aggregation
      // (robuster als listSearchIndexes, das nicht immer verfügbar ist)
      try {
        const zeroVector = new Array<number>(dimension).fill(0)
        await collection.aggregate([
          {
            $vectorSearch: {
              index: VECTOR_SEARCH_INDEX_NAME,
              path: 'embedding',
              queryVector: zeroVector,
              numCandidates: 1,
              limit: 1,
            },
          },
        ]).toArray()
        
        pushMessage(messages, 'info', 'Vector Search Index existiert und ist funktionsfähig')
      } catch (indexError) {
        const errorMsg = indexError instanceof Error ? indexError.message : String(indexError)
        if (errorMsg.includes('index') || errorMsg.includes('Index')) {
          pushMessage(messages, 'error', `Vector Search Index nicht gefunden oder nicht bereit: ${errorMsg}`)
        } else {
          pushMessage(messages, 'warn', `Vector Search Index-Prüfung fehlgeschlagen: ${errorMsg}`)
        }
      }
    }
  } catch (error) {
    pushMessage(
      messages,
      'error',
      `Fehler beim Prüfen von MongoDB Vector Search: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * @deprecated Verwende validateMongoVectorUpsert() statt validateMongoUpsert()
 * Alte Funktion für Rückwärtskompatibilität
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function validateMongoUpsert(
  job: import('@/types/external-job').ExternalJob,
  expected: ExpectedOutcome,
  messages: ValidationMessage[]
): Promise<void> {
  await validateMongoVectorUpsert(job, expected, messages)
}


/**
 * Globale Contract-Validatoren: Diese Regeln gelten für ALLE UseCases.
 * Sie werden vor den UseCase-spezifischen Validierungen ausgeführt.
 */
function validateGlobalContracts(
  job: import('@/types/external-job').ExternalJob,
  messages: ValidationMessage[]
): void {
  // Contract 1: completed ⇒ result.savedItemId existiert
  if (job.status === 'completed') {
    const savedItemId = job.result?.savedItemId
    if (!savedItemId || typeof savedItemId !== 'string' || savedItemId.trim().length === 0) {
      pushMessage(
        messages,
        'error',
        `Global Contract verletzt: Job ist completed, aber result.savedItemId fehlt oder ist leer`
      )
    } else {
      pushMessage(messages, 'info', `Global Contract: result.savedItemId vorhanden: ${savedItemId}`)
    }
  }

  // Contract 2: completed ⇒ kein step.status === 'pending'
  if (job.status === 'completed') {
    const steps = Array.isArray(job.steps) ? job.steps : []
    const pendingSteps = steps.filter(s => s?.status === 'pending')
    if (pendingSteps.length > 0) {
      const pendingStepNames = pendingSteps.map(s => s?.name || 'unknown').join(', ')
      pushMessage(
        messages,
        'error',
        `Global Contract verletzt: Job ist completed, aber ${pendingSteps.length} Step(s) haben Status "pending": ${pendingStepNames}`
      )
    } else {
      pushMessage(messages, 'info', 'Global Contract: Keine pending Steps bei completed Job')
    }
  }

  // Contract 3: Policy/Step-Konsistenz
  // Wenn eine Phase auf 'ignore' gesetzt ist, sollte der entsprechende Step skipped/completed sein (nicht pending/running)
  const policies = job.parameters?.policies as
    | { extract?: string; metadata?: string; ingest?: string }
    | undefined

  if (policies) {
    const steps = Array.isArray(job.steps) ? job.steps : []

    // Extract-Policy prüfen
    if (policies.extract === 'ignore') {
      const extractStep = steps.find(s => s?.name === 'extract_pdf')
      if (extractStep && extractStep.status !== 'skipped' && extractStep.status !== 'completed') {
        pushMessage(
          messages,
          'warn',
          `Policy/Step-Inkonsistenz: extract=ignore, aber extract_pdf Step hat Status "${extractStep.status}" (erwarte skipped/completed)`
        )
      }
    }

    // Template/Metadata-Policy prüfen
    if (policies.metadata === 'ignore') {
      const templateStep = steps.find(s => s?.name === 'transform_template')
      if (templateStep && templateStep.status !== 'skipped' && templateStep.status !== 'completed') {
        pushMessage(
          messages,
          'warn',
          `Policy/Step-Inkonsistenz: metadata=ignore, aber transform_template Step hat Status "${templateStep.status}" (erwarte skipped/completed)`
        )
      }
    }

    // Ingest-Policy prüfen
    if (policies.ingest === 'ignore') {
      const ingestStep = steps.find(s => s?.name === 'ingest_rag')
      if (ingestStep && ingestStep.status !== 'skipped' && ingestStep.status !== 'completed') {
        pushMessage(
          messages,
          'warn',
          `Policy/Step-Inkonsistenz: ingest=ignore, aber ingest_rag Step hat Status "${ingestStep.status}" (erwarte skipped/completed)`
        )
      }
    }
  }
}

async function validateSavedItemIdKindContract(
  job: import('@/types/external-job').ExternalJob,
  messages: ValidationMessage[]
): Promise<void> {
  if (job.status !== 'completed') return

  const savedItemId = job.result?.savedItemId
  if (!savedItemId || typeof savedItemId !== 'string' || savedItemId.trim().length === 0) return

  const phases = (job.parameters as { phases?: { template?: boolean } } | undefined)?.phases
  const templateEnabled = phases ? phases.template !== false : true
  const expectedKind: 'transcript' | 'transformation' = templateEnabled ? 'transformation' : 'transcript'

  const sourceName = String(job.correlation?.source?.name || '')
  const sourceBaseName = sourceName ? path.parse(sourceName).name : ''
  const templateNameRaw = (job.parameters as { template?: unknown } | undefined)?.template
  const templateName = typeof templateNameRaw === 'string' && templateNameRaw.trim().length > 0 ? templateNameRaw.trim() : undefined

  try {
    const provider = await getServerProvider(job.userEmail, job.libraryId)
    const it = await provider.getItemById(savedItemId)
    const candidateName = String(it?.metadata?.name || '')
    const parsed = parseArtifactName(candidateName, sourceBaseName || undefined)

    if (parsed.kind !== expectedKind) {
      pushMessage(
        messages,
        'error',
        `Global Contract verletzt: result.savedItemId zeigt auf "${candidateName}" (${parsed.kind ?? 'unknown'}), erwarte "${expectedKind}"`
      )
      return
    }

    if (expectedKind === 'transformation' && templateName) {
      const parsedTemplate = typeof parsed.templateName === 'string' ? parsed.templateName : ''
      if (!parsedTemplate || parsedTemplate.toLowerCase() !== templateName.toLowerCase()) {
        pushMessage(
          messages,
          'error',
          `Global Contract verletzt: Transformation hat templateName="${parsedTemplate || 'leer'}", erwarte "${templateName}"`
        )
        return
      }
    }

    pushMessage(messages, 'info', `Global Contract: savedItemId Artefakt-Typ ok (${expectedKind})`)
  } catch (error) {
    pushMessage(
      messages,
      'warn',
      `Global Contract: savedItemId Artefakt-Typ konnte nicht validiert werden: ${error instanceof Error ? error.message : String(error)}`
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

  // Globale Contracts zuerst prüfen (gelten für alle UseCases)
  validateGlobalContracts(job, messages)
  await validateSavedItemIdKindContract(job, messages)

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
  await validateMongoVectorUpsert(job, testCase.expected, messages)

  const hasError = messages.some(m => m.type === 'error')
  return {
    jobId,
    testCaseId: testCase.id,
    ok: !hasError,
    messages,
  }
}


