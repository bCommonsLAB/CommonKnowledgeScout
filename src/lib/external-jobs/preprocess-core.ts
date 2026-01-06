/**
 * @fileoverview Kern-Hilfsfunktionen für PDF-Preprocessing (phasenunabhängig)
 *
 * @description
 * Enthält reine Funktionen für:
 * - Finden von Markdown-Dateien zu einem PDF
 * - Extrahieren und Validieren von Frontmatter
 * - Ableiten von needExtract / needTemplate / needIngest
 *
 * Diese Datei kennt keinen Request/Response, nur fachliche Logik.
 *
 * @module external-jobs
 */

import type { StorageProvider } from '@/lib/storage/types'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { LibraryService } from '@/lib/services/library-service'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import type { Library } from '@/types/library'

export interface FoundMarkdown {
  hasMarkdown: boolean;
  fileId?: string;
  fileName?: string;
  text?: string;
}

export interface FrontmatterAnalysis {
  hasFrontmatter: boolean;
  meta: Record<string, unknown>;
  body: string;
}

export interface FrontmatterValidation {
  hasCore: boolean;
  typeErrors: number;
  frontmatterValid: boolean;
  reasons: string[];
}

export async function findPdfMarkdown(
  provider: StorageProvider,
  parentId: string,
  baseName: string,
  lang: string,
  _library?: Library | null,
  sourceItemId?: string,
  sourceName?: string
): Promise<FoundMarkdown> {
  const originalName = sourceName || `${baseName}.pdf` // Annahme: Original ist PDF

  // v2-only: Primär über Resolver (dotFolder + sibling, deterministisch)
  if (sourceItemId) {
    const resolved = await resolveArtifact(provider, {
      sourceItemId,
      sourceName: originalName,
      parentId,
      targetLanguage: lang,
      preferredKind: 'transcript',
    })
    
    if (resolved) {
      try {
        const bin = await provider.getBinary(resolved.fileId)
        const text = await bin.blob.text()
        return {
          hasMarkdown: true,
          fileId: resolved.fileId,
          fileName: resolved.fileName,
          text,
        }
      } catch {
        // Fallback zu Legacy bei Fehler
      }
    }
  }

  // Fallback (v2-only, ohne sourceItemId): deterministischer Name im Parent-Verzeichnis
  const expectedFileName = `${baseName}.${lang}.md`
  const siblings = await provider.listItemsById(parentId)

  const twin = siblings.find(
    it => it.type === 'file' && String(it.metadata?.name || '') === expectedFileName
  )

  if (!twin) return { hasMarkdown: false }

  const bin = await provider.getBinary(twin.id)
  const text = await bin.blob.text()

  return {
    hasMarkdown: true,
    fileId: twin.id,
    fileName: String(twin.metadata?.name || expectedFileName),
    text,
  }
}

export function analyzeFrontmatter(text: string): FrontmatterAnalysis {
  const parsed = parseFrontmatter(text)
  const meta = (parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta))
    ? (parsed.meta as Record<string, unknown>)
    : {}
  const body = parsed?.body || text
  const hasFrontmatter = Object.keys(meta).length > 0

  return { hasFrontmatter, meta, body }
}

function isPrimitiveOrStringArray(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.every(v => typeof v === 'string')
  return false
}

export async function validateFrontmatter(
  meta: Record<string, unknown>,
  userEmail: string,
  libraryId: string
): Promise<FrontmatterValidation> {
  const reasons: string[] = []
  let hasCore = false
  let typeErrors = 0

  const pagesRaw = (meta as { pages?: unknown }).pages
  const pages = typeof pagesRaw === 'number'
    ? pagesRaw
    : (typeof pagesRaw === 'string' ? Number(pagesRaw) : undefined)

  const chaptersRaw = (meta as { chapters?: unknown }).chapters
  const chapters = Array.isArray(chaptersRaw) ? chaptersRaw : undefined

  hasCore = typeof pages === 'number' && Number.isFinite(pages) && pages > 0 && chapters !== undefined

  try {
    const lib = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!lib) {
      reasons.push('library_not_found')
    } else {
      const defs = parseFacetDefs(lib)
      for (const d of defs) {
        const v = meta[d.metaKey]
        if (v === undefined || v === null) continue
        if (!isPrimitiveOrStringArray(v)) typeErrors++
      }
    }
  } catch {
    reasons.push('facet_validation_error')
  }

  const frontmatterValid = hasCore && typeErrors === 0
  if (!hasCore) reasons.push('frontmatter_core_incomplete')
  if (typeErrors > 0) reasons.push('frontmatter_type_errors')

  return { hasCore, typeErrors, frontmatterValid, reasons }
}

export function decideNeedExtract(hasMarkdown: boolean): boolean {
  return !hasMarkdown
}

export function decideNeedTemplate(hasFrontmatter: boolean, frontmatterValid: boolean): boolean {
  return !hasFrontmatter || !frontmatterValid
}

export function decideNeedIngest(hasMarkdown: boolean, frontmatterValid: boolean): boolean {
  return hasMarkdown ? frontmatterValid : true
}


