/**
 * @fileoverview Orchestrierung des 1. LLM-Passes (Stufe 3).
 *
 * @description
 * Bindet Sidecar-Loader (Stufe 1) + Matcher + DE→EN-Mapping + LLM-Call +
 * deterministische Nachbearbeitung zusammen. Der eigentliche LLM-Call wird als
 * Abhaengigkeit injiziert (`analyzeImage`) — dadurch ist die Pipeline mit
 * Mock-LLM testbar und unabhaengig vom Secretary-Service/Route-Code.
 *
 * Ablauf:
 *  1. Sidecar laden + Dateiname matchen (Treffer = OptionvalueEntry | null).
 *  2. LIEFERSYSTEM-Block bauen (DE→EN-Mapping) und neben CONTEXT ans LLM geben.
 *  3. Quellbild-Wahl (basecolor | supplier-preview) lesen; bei supplier-preview
 *     das Liefersystem-Bild serverseitig laden (Stolperfalle #5).
 *  4. LLM-Call ausfuehren, Antwort deterministisch nachbearbeiten
 *     (buildFirstPassFrontmatter) und ins Markdown patchen.
 *
 * KEIN direkter Storage-Backend-Zugriff (nur ueber StorageProvider).
 */

import type { StorageProvider } from '@/lib/storage/types'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { patchFrontmatter } from '@/lib/markdown/frontmatter-patch'
import { loadSupplierData } from './load-supplier-data'
import { matchTextureCode } from './match-texture-code'
import { logMatchAttempts } from './diva-texture-logger'
import { buildLiefersystemBlock } from './liefersystem-context'
import { buildFirstPassFrontmatter } from './first-pass'
import { llmFieldsForPass } from './material-field-sources'
import type { AnalysisSourceImage, OptionvalueEntry } from './types'

/** Marker im Template-Frontmatter, der eine DIVA-Texturanalyse kennzeichnet. */
const DIVA_TEXTURE_MARKER = /detailViewType\s*:\s*divaTexture/i

/** Prueft, ob ein Template-Inhalt eine DIVA-Texturanalyse ist. */
export function isDivaTextureTemplate(templateContent: string): boolean {
  return DIVA_TEXTURE_MARKER.test(templateContent)
}

/** Ein Bild fuer den LLM-Call (Quelle: Basecolor oder Liefersystem-Preview). */
export interface FirstPassImage {
  buffer: Buffer
  fileName: string
  mimeType: string
}

export interface RunFirstPassParams {
  provider: StorageProvider
  /** Ordner-ID der Textur (fuer den Sidecar-Lookup). */
  parentId: string
  /** Dateiname der Textur (fuer den Matcher). */
  fileName: string
  /** Voller Pfad der Textur (fuer availability/retailer_iln). */
  filePath: string
  /** Basecolor-Bild + Default-Quelle. */
  baseImage: FirstPassImage
  /** Bereits aufgebauter CONTEXT-Block (fileName, filePath, …). */
  baseContext: Record<string, unknown>
  /** Liest die persistierte Quellbild-Wahl anhand der Material-ID (VCodex). */
  getImageChoice?: (materialId: string) => Promise<AnalysisSourceImage | null>
  /** Laedt das Liefersystem-Preview-Bild serverseitig (Stolperfalle #5). */
  fetchPreviewImage?: (url: string) => Promise<FirstPassImage>
  /** Fuehrt den eigentlichen LLM-Bild-Analyse-Call aus, liefert Markdown. */
  analyzeImage: (args: { image: FirstPassImage; context: Record<string, unknown> }) => Promise<string>
}

export interface RunFirstPassResult {
  /** Markdown mit deterministisch nachbearbeitetem Pass-1-Frontmatter. */
  markdown: string
  /** true, wenn ein Sidecar-Eintrag gematcht wurde. */
  supplierMatched: boolean
  /** Welches Quellbild tatsaechlich an das LLM ging. */
  sourceImage: AnalysisSourceImage
}

/**
 * Ermittelt das zu verwendende Quellbild (Default: basecolor).
 * Bei `supplier-preview` mit erreichbarem Liefersystem-Bild wird dieses
 * serverseitig geladen; faellt es aus, bleibt basecolor (explizit, geloggt).
 */
async function resolveSourceImage(
  params: RunFirstPassParams,
  entry: OptionvalueEntry | null,
): Promise<{ image: FirstPassImage; sourceImage: AnalysisSourceImage }> {
  const fallback = { image: params.baseImage, sourceImage: 'basecolor' as const }
  if (!entry || !params.getImageChoice) return fallback

  const choice = await params.getImageChoice(entry.VCodex)
  if (choice !== 'supplier-preview') return fallback

  const previewUrl = typeof entry.Image === 'string' ? entry.Image.trim() : ''
  if (previewUrl === '' || !params.fetchPreviewImage) return fallback

  const preview = await params.fetchPreviewImage(previewUrl)
  return { image: preview, sourceImage: 'supplier-preview' }
}

/**
 * Fuehrt den 1. LLM-Pass aus und liefert das nachbearbeitete Markdown.
 */
export async function runDivaTextureFirstPass(params: RunFirstPassParams): Promise<RunFirstPassResult> {
  // 1. Sidecar laden + matchen
  const supplier = await loadSupplierData(params.provider, params.parentId)
  const matchResult = supplier
    ? matchTextureCode(params.fileName, supplier.entries)
    : { match: null, attempts: [] }
  logMatchAttempts(params.fileName, matchResult)
  const entry = matchResult.match?.entry ?? null

  // 2. LIEFERSYSTEM-Block + Pass-Metadaten in den Kontext
  const context: Record<string, unknown> = {
    ...params.baseContext,
    pass: 1,
    expectedFields: llmFieldsForPass(1),
  }
  const liefersystem = buildLiefersystemBlock(entry)
  if (liefersystem) context.LIEFERSYSTEM = liefersystem

  // 3. Quellbild bestimmen (basecolor | supplier-preview serverseitig)
  const { image, sourceImage } = await resolveSourceImage(params, entry)

  // 4. LLM-Call + deterministische Nachbearbeitung
  const markdownText = await params.analyzeImage({ image, context })
  const { meta } = parseFrontmatter(markdownText)
  const pass1Fields = buildFirstPassFrontmatter({
    llmFields: meta,
    supplierEntry: entry,
    filePath: params.filePath,
  })
  const markdown = patchFrontmatter(markdownText, pass1Fields)

  return { markdown, supplierMatched: entry !== null, sourceImage }
}
