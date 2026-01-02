/**
 * @fileoverview Shadow-Twin Konvertierung - Pure Utilities
 *
 * @description
 * Reine Hilfsfunktionen für Phase 5 (MongoDB Backfill/Normalisierung).
 * Enthält keine DB- oder Storage-Operationen und ist daher gut unit-testbar.
 */

import type { ArtifactKind } from '@/lib/shadow-twin/artifact-types'

export interface VectorMetaDocForConversion {
  _id: string
  kind: 'meta'
  libraryId: string
  user: string
  fileId: string
  fileName?: string
  docMetaJson?: Record<string, unknown>
}

export interface ConversionUpdate {
  /** Mongo $set Update-Paths (z.B. "docMetaJson.sourceFileId") */
  $set: Record<string, unknown>
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeLanguage(value: string): string {
  // Minimaler Normalizer: trim + lower + entferne umschließende Quotes
  const trimmed = value.trim().replace(/^["']|["']$/g, '')
  return trimmed.toLowerCase()
}

function pickFirstString(meta: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = meta[key]
    if (isNonEmptyString(v)) return v.trim()
  }
  return undefined
}

function parseLanguageFromFileName(fileName: string): string | undefined {
  const withoutExt = fileName.replace(/\.md$/i, '')
  const parts = withoutExt.split('.')
  if (parts.length < 2) return undefined
  const maybeLang = parts[parts.length - 1]
  // Accept: de, en, de-at, de_at (legacy)
  if (!/^[A-Za-z]{2,3}([_-][A-Za-z]{2,4})?$/.test(maybeLang)) return undefined
  return normalizeLanguage(maybeLang.replace('_', '-'))
}

function deriveArtifactKind(meta: Record<string, unknown>): ArtifactKind {
  // Wenn Template vorhanden ist → Transformation. Sonst Transcript.
  const template = meta['template']
  const templateName = meta['templateName']
  const templateNameAlt = meta['template_name']
  if (isNonEmptyString(template) || isNonEmptyString(templateName) || isNonEmptyString(templateNameAlt)) return 'transformation'
  return 'transcript'
}

function deriveTemplateName(meta: Record<string, unknown>): string | undefined {
  const raw = pickFirstString(meta, ['templateName', 'template', 'template_name'])
  return raw ? raw.trim() : undefined
}

function deriveTargetLanguage(meta: Record<string, unknown>, fileName: string | undefined): string | undefined {
  const raw = pickFirstString(meta, [
    'targetLanguage',
    'target_language',
    'summary_language',
    'summaryLanguage',
    'lang',
    'language',
  ])
  const lang = raw ? normalizeLanguage(raw) : undefined
  return lang || (fileName ? parseLanguageFromFileName(fileName) : undefined)
}

function deriveSourceFileId(meta: Record<string, unknown>, fallbackFileId: string): string {
  const raw = pickFirstString(meta, ['sourceFileId', 'source_file_id', 'source_fileId'])
  return raw ? raw.trim() : fallbackFileId
}

/**
 * Ermittelt ein minimal notwendiges MongoDB $set Update für ein Meta-Dokument.
 *
 * Phase 5 Ziel: docMetaJson um stabile, explizite Felder ergänzen:
 * - sourceFileId
 * - artifactKind (transcript/transformation)
 * - targetLanguage
 * - templateName (nur für transformation)
 */
export function buildConversionUpdate(
  doc: VectorMetaDocForConversion
): ConversionUpdate | null {
  const meta = (doc.docMetaJson && typeof doc.docMetaJson === 'object' && !Array.isArray(doc.docMetaJson))
    ? doc.docMetaJson
    : {}

  const $set: Record<string, unknown> = {}

  const existingSourceFileId = pickFirstString(meta, ['sourceFileId', 'source_file_id', 'source_fileId'])
  if (!existingSourceFileId) $set['docMetaJson.sourceFileId'] = deriveSourceFileId(meta, doc.fileId)

  const existingArtifactKind = pickFirstString(meta, ['artifactKind', 'artifact_kind'])
  if (!existingArtifactKind) $set['docMetaJson.artifactKind'] = deriveArtifactKind(meta)

  // WICHTIG: Wir wollen docMetaJson.targetLanguage als explizites, stabiles Feld.
  // Auch wenn legacy/frontmatter nur "language" oder "summary_language" enthält,
  // schreiben wir targetLanguage nach, solange es noch nicht existiert.
  const existingTargetLanguage = pickFirstString(meta, ['targetLanguage', 'target_language'])
  const derivedTargetLanguage = deriveTargetLanguage(meta, doc.fileName)
  if (!existingTargetLanguage && derivedTargetLanguage) {
    $set['docMetaJson.targetLanguage'] = derivedTargetLanguage
  }

  const kind = (existingArtifactKind === 'transformation' || existingArtifactKind === 'transcript')
    ? (existingArtifactKind as ArtifactKind)
    : deriveArtifactKind(meta)

  const existingTemplateName = pickFirstString(meta, ['templateName', 'template_name'])
  if (kind === 'transformation' && !existingTemplateName) {
    const templateName = deriveTemplateName(meta)
    if (templateName) $set['docMetaJson.templateName'] = templateName
  }

  return Object.keys($set).length > 0 ? { $set } : null
}


