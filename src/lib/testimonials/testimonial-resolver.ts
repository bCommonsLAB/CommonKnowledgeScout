/**
 * @fileoverview Testimonial Resolver - Auflösung von Testimonial-Artefakten
 * 
 * @description
 * Nutzt resolveArtifact() für Transformation-Lookup.
 * Gibt "pending" Status zurück, wenn Transformation fehlt.
 * 
 * @module testimonials
 * 
 * @exports
 * - resolveTestimonialArtifact: Hauptfunktion zur Artefakt-Auflösung
 * - ResolvedTestimonialArtifact: Ergebnis-Interface
 */

import type { StorageProvider } from '@/lib/storage/types'
import { resolveArtifact, type ResolvedArtifact } from '@/lib/shadow-twin/artifact-resolver'
import { FileLogger } from '@/lib/debug/logger'

/**
 * Ergebnis der Testimonial-Artefakt-Auflösung.
 */
export interface ResolvedTestimonialArtifact {
  /** Transformation-Artefakt (falls gefunden) */
  transformation: ResolvedArtifact | null
  /** Status: 'ready' (Transformation vorhanden) oder 'pending' (Transformation fehlt) */
  status: 'ready' | 'pending'
}

/**
 * Optionen für die Testimonial-Artefakt-Auflösung.
 */
export interface ResolveTestimonialArtifactOptions {
  /** Storage-Provider */
  provider: StorageProvider
  /** Source-Datei-ID */
  sourceItemId: string
  /** Source-Dateiname */
  sourceName: string
  /** Parent-Ordner-ID */
  parentId: string
  /** Zielsprache (z.B. 'de', 'en') */
  targetLanguage: string
  /** Template-Name für Transformation (z.B. 'event-testimonial-creation-de') */
  templateName: string
}

/**
 * Löst ein Testimonial-Transformation-Artefakt auf.
 * 
 * @param options Auflösungsoptionen
 * @returns ResolvedTestimonialArtifact mit Status
 */
export async function resolveTestimonialArtifact(
  options: ResolveTestimonialArtifactOptions
): Promise<ResolvedTestimonialArtifact> {
  const {
    provider,
    sourceItemId,
    sourceName,
    parentId,
    targetLanguage,
    templateName,
  } = options

  FileLogger.info('testimonial-resolver', 'Löse Testimonial-Artefakt auf', {
    sourceId: sourceItemId,
    sourceName,
    templateName,
  })

  // Suche Transformation-Artefakt
  const transformation = await resolveArtifact(provider, {
    sourceItemId,
    sourceName,
    parentId,
    targetLanguage,
    templateName,
    preferredKind: 'transformation',
  })

  if (transformation) {
    FileLogger.info('testimonial-resolver', 'Transformation-Artefakt gefunden', {
      fileId: transformation.fileId,
      fileName: transformation.fileName,
      location: transformation.location,
    })

    return {
      transformation,
      status: 'ready',
    }
  } else {
    FileLogger.info('testimonial-resolver', 'Transformation-Artefakt nicht gefunden (pending)', {
      sourceId: sourceItemId,
    })

    return {
      transformation: null,
      status: 'pending',
    }
  }
}
