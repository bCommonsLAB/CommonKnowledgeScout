/**
 * @fileoverview Testimonial Writer - Synchrones Schreiben von Shadow-Twin-Artefakten
 * 
 * @description
 * Zentrale Funktion zum synchronen Schreiben von Testimonial-Artefakten.
 * Wenn Text vorhanden ist, wird nur das Transcript-Artefakt synchron erzeugt.
 * Das Transformation-Artefakt wird später im Finalisieren-Wizard erstellt (dort werden
 * alle Testimonial-Transcripte zusammen verarbeitet).
 * Nur bei Audio-only wird ein asynchroner Job gestartet.
 * 
 * @module testimonials
 * 
 * @exports
 * - writeTestimonialArtifacts: Hauptfunktion zum Schreiben von Testimonial-Artefakten
 * - WriteTestimonialArtifactsOptions: Optionen-Interface
 * - WriteTestimonialArtifactsResult: Ergebnis-Interface
 */

import type { StorageProvider } from '@/lib/storage/types'
import type { StorageItem } from '@/lib/storage/types'
import { writeArtifact, type WriteArtifactResult } from '@/lib/shadow-twin/artifact-writer'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import { FileLogger } from '@/lib/debug/logger'

/**
 * Optionen für das Schreiben von Testimonial-Artefakten.
 */
export interface WriteTestimonialArtifactsOptions {
  /** Storage-Provider */
  provider: StorageProvider
  /** Event-Datei-ID */
  eventFileId: string
  /** Testimonial-Ordner-ID (wo die Source-Datei liegt) */
  testimonialFolderId: string
  /** Source-Datei (Audio oder Text) */
  sourceFile: StorageItem
  /** Text-Inhalt (falls vorhanden) */
  text: string | null
  /** Zielsprache (z.B. 'de', 'en') */
  targetLanguage: string
  /** Template-Name für spätere Transformation (wird aktuell nicht verwendet, da nur Transcript erstellt wird) */
  templateName: string
  /** Library-ID */
  libraryId: string
  /** User-Email (für Template-Laden) */
  userEmail: string
  /** Metadaten für Template-Rendering (z.B. speakerName, createdAt) */
  metadata: Record<string, unknown>
}

/**
 * Ergebnis des Schreibens von Testimonial-Artefakten.
 */
export interface WriteTestimonialArtifactsResult {
  /** Transcript-Artefakt (falls geschrieben) */
  transcript?: WriteArtifactResult
  /** Transformation-Artefakt (falls geschrieben) */
  transformation?: WriteArtifactResult
  /** Ob ein Job gestartet wurde (nur bei Audio-only) */
  jobStarted?: boolean
}

/**
 * Rendert den Template-Body mit Platzhaltern.
 * 
 * Ersetzt {{key|description}} und {{key}} Patterns durch Werte aus values.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function renderTemplateBody(args: { body: string; values: Record<string, unknown> }): string {
  const { body, values } = args
  
  function toRenderableString(value: unknown): string {
    if (value === null || value === undefined) return ""
    if (typeof value === "string") return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    return JSON.stringify(value, null, 2)
  }
  
  let result = body || ""
  
  // Ersetze {{key|description}} Patterns
  result = result.replace(/\{\{([^}|]+)\|([\s\S]*?)\}\}/g, (_m, rawKey: string) => {
    const key = String(rawKey || "").trim()
    return toRenderableString(values[key])
  })
  
  // Ersetze auch {{key}} Patterns ohne Pipe (für einfache Variablen-Substitution)
  result = result.replace(/\{\{([^}]+)\}\}/g, (_m, rawKey: string) => {
    const key = String(rawKey || "").trim()
    // Überspringe, wenn bereits durch vorheriges Pattern ersetzt
    if (rawKey.includes('|')) return _m
    return toRenderableString(values[key])
  })
  
  return result
}

/**
 * Erstellt Frontmatter aus Metadaten.
 */
function buildFrontmatter(metadata: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string') {
      // Escape Anführungszeichen
      lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`)
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${key}: ${value}`)
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`)
    }
  }
  return `---\n${lines.join('\n')}\n---`
}

/**
 * Schreibt Testimonial-Artefakte synchron (wenn Text vorhanden) oder startet Job (bei Audio-only).
 * 
 * WICHTIG: Bei Text-Eingabe wird nur das Transcript-Artefakt erstellt.
 * Das Transformation-Artefakt wird später im Finalisieren-Wizard erstellt,
 * wo alle Testimonial-Transcripte zusammen verarbeitet werden.
 * 
 * @param options Schreiboptionen
 * @returns WriteTestimonialArtifactsResult mit Details zu geschriebenen Artefakten
 */
export async function writeTestimonialArtifacts(
  options: WriteTestimonialArtifactsOptions
): Promise<WriteTestimonialArtifactsResult> {
  const {
    provider,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    eventFileId: _eventFileId,
    testimonialFolderId,
    sourceFile,
    text,
    targetLanguage,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    templateName: _templateName,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    libraryId: _libraryId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    userEmail: _userEmail,
    metadata,
  } = options

  const result: WriteTestimonialArtifactsResult = {}

  // Wenn Text vorhanden: synchron schreiben
  if (text && text.trim().length > 0) {
    FileLogger.info('testimonial-writer', 'Text vorhanden, schreibe Transcript-Artefakt mit Metadaten', {
      sourceFileId: sourceFile.id,
      sourceFileName: sourceFile.metadata.name,
      speakerName: metadata.speakerName || null,
    })

    // Erstelle Transcript-Artefakt mit minimalem Frontmatter (nur Metadaten)
    // Transformation-Artefakt wird später im Finalisieren-Wizard erstellt
    // WICHTIG: Frontmatter enthält nur Metadaten (speakerName, createdAt, etc.), kein Template-Body
    const transcriptKey: ArtifactKey = {
      sourceId: sourceFile.id,
      kind: 'transcript',
      targetLanguage,
    }

    // Erstelle minimales Frontmatter nur mit Metadaten (kein Template-Body)
    const transcriptMeta: Record<string, unknown> = {}
    
    // Füge wichtige Metadaten hinzu
    if (metadata.speakerName && typeof metadata.speakerName === 'string' && metadata.speakerName.trim()) {
      transcriptMeta.speakerName = metadata.speakerName.trim()
    }
    if (metadata.createdAt) {
      transcriptMeta.createdAt = metadata.createdAt
    }
    if (metadata.testimonialId) {
      transcriptMeta.testimonialId = metadata.testimonialId
    }
    if (metadata.eventFileId) {
      transcriptMeta.eventFileId = metadata.eventFileId
    }
    if (metadata.consent !== null && metadata.consent !== undefined) {
      transcriptMeta.consent = metadata.consent
    }

    // Erstelle Content: Frontmatter + Text-Body
    const frontmatter = buildFrontmatter(transcriptMeta)
    const transcriptContent = `${frontmatter}\n\n${text.trim()}`

    const transcriptResult = await writeArtifact(provider, {
      key: transcriptKey,
      sourceName: sourceFile.metadata.name,
      parentId: testimonialFolderId,
      content: transcriptContent,
      createFolder: true, // Testimonials werden in eigenem Ordner gespeichert
    })

    result.transcript = transcriptResult

    FileLogger.info('testimonial-writer', 'Transcript-Artefakt mit Metadaten synchron geschrieben', {
      transcriptFileId: transcriptResult.file.id,
      hasSpeakerName: !!transcriptMeta.speakerName,
    })
  } else {
    // Audio-only: Job starten (wird später implementiert)
    FileLogger.info('testimonial-writer', 'Nur Audio vorhanden, Job wird gestartet', {
      sourceFileId: sourceFile.id,
      sourceFileName: sourceFile.metadata.name,
    })
    
    // TODO: Job starten für Transcript → Transformation
    // result.jobStarted = true
  }

  return result
}
