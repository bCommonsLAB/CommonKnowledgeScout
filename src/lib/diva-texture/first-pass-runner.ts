/**
 * @fileoverview Orchestrierung des 1. LLM-Passes (Stufe 3, Update 2).
 *
 * @description
 * Bindet Sidecar-Loader/Matcher + Basecolor-Crop + Multi-Image-LLM-Call +
 * deterministische Nachbearbeitung zusammen. `analyzeImages` wird als
 * Abhaengigkeit injiziert (Mock-LLM-testbar).
 *
 * Ablauf (Update 2): Sidecar laden+matchen → LIEFERSYSTEM-Block →
 * Basecolor-Crop ZUR LAUFZEIT (Lea-Regel #13, cropCm in CONTEXT) →
 * Supplier-Preview best-effort laden → 1- oder 2-Bild-LLM-Call →
 * Postprocessor (Color-Match + Override-Schutz, Lea-Regeln #11/#12).
 *
 * Lea-Regel #11: die Bildwahl `analysisSourceImage` aus Stufe 1 wird
 * IGNORIERT — Bild 1 ist immer der Basecolor-Crop. Der Snapshot im
 * Frontmatter steht entsprechend fix auf `'basecolor'`.
 */

import type { StorageProvider } from '@/lib/storage/types'
import { FileLogger } from '@/lib/debug/logger'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { patchFrontmatter } from '@/lib/markdown/frontmatter-patch'
import { loadSupplierData } from './load-supplier-data'
import { matchTextureCode } from './match-texture-code'
import { logMatchAttempts } from './diva-texture-logger'
import { buildLiefersystemBlock } from './liefersystem-context'
import { buildFirstPassFrontmatter } from './first-pass'
import { isReviewStatus, type ReviewStatus } from './review-status'
import { buildBasecolorCrop } from './basecolor-crop'
import { llmFieldsForPass } from './material-field-sources'
import type { OptionvalueEntry } from './types'

/** Marker im Template-Frontmatter, der eine DIVA-Texturanalyse kennzeichnet. */
const DIVA_TEXTURE_MARKER = /detailViewType\s*:\s*divaTexture/i

/** Prueft, ob ein Template-Inhalt eine DIVA-Texturanalyse ist. */
export function isDivaTextureTemplate(templateContent: string): boolean {
  return DIVA_TEXTURE_MARKER.test(templateContent)
}

/** Ein Bild fuer den LLM-Call (Crop, Original-Basecolor oder Supplier-Preview). */
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
  /** Original-Basecolor-Bild (wird zur Laufzeit zugeschnitten). */
  baseImage: FirstPassImage
  /** Bereits aufgebauter CONTEXT-Block (fileName, filePath, …). */
  baseContext: Record<string, unknown>
  /** Bestehender review_status aus dem Frontmatter (Override-Schutz). */
  existingReviewStatus?: ReviewStatus
  /** Laedt das Liefersystem-Preview-Bild serverseitig (Stolperfalle #5). */
  fetchPreviewImage?: (url: string) => Promise<FirstPassImage>
  /**
   * Fuehrt den eigentlichen Multi-Image-LLM-Bild-Analyse-Call aus.
   * Erwartet 1 oder 2 Bilder; die Reihenfolge ist semantisch:
   * 1 = Basecolor-Crop, 2 (optional) = Supplier-Preview.
   */
  analyzeImages: (args: { images: FirstPassImage[]; context: Record<string, unknown> }) => Promise<string>
}

export interface RunFirstPassResult {
  /** Markdown mit deterministisch nachbearbeitetem Pass-1-Frontmatter. */
  markdown: string
  /** true, wenn ein Sidecar-Eintrag gematcht wurde. */
  supplierMatched: boolean
  /**
   * true, wenn der Lauf tatsaechlich eine Supplier-Preview ans LLM gesendet
   * hat (Sidecar-Treffer + Image-URL + Fetch erfolgreich).
   */
  supplierPreviewSent: boolean
  /** Lauf-Metadaten des Basecolor-Crops (fuer Stufe 6 analysisRuns). */
  basecolorCrop: {
    crop_px: string
    crop_cm: string
    dpi_used: number
    dpi_fallback: boolean
  }
}

/**
 * Versucht, das Supplier-Preview-Bild zu laden. Bei Fehler wird die Exception
 * geschluckt und null zurueckgegeben — der Lauf laeuft dann mit nur einem
 * Bild und der Postprocessor erzwingt `color_match_supplier=null`.
 * Hinweis: Das ist KEIN stiller Fallback im Sinne der no-silent-fallbacks-
 * Regel — das Verhalten ist explizit dokumentiert (Edge-Case #21) und der
 * Fehler wird via FileLogger sichtbar gemacht.
 */
async function tryFetchSupplierPreview(
  params: RunFirstPassParams,
  entry: OptionvalueEntry | null,
): Promise<FirstPassImage | null> {
  if (!entry || !params.fetchPreviewImage) return null
  const previewUrl = typeof entry.Image === 'string' ? entry.Image.trim() : ''
  if (previewUrl === '') return null
  try {
    return await params.fetchPreviewImage(previewUrl)
  } catch (error) {
    FileLogger.warn('diva-texture-first-pass', 'Supplier-Preview konnte nicht geladen werden — Lauf mit nur einem Bild', {
      previewUrl,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Fuehrt den 1. LLM-Pass aus und liefert das nachbearbeitete Markdown.
 *
 * Sendet immer den Basecolor-Crop; bei verfuegbarer Supplier-Preview
 * zusaetzlich ein 2. Bild + den Farbtonabgleich-Auftrag im System-Prompt.
 */
export async function runDivaTextureFirstPass(params: RunFirstPassParams): Promise<RunFirstPassResult> {
  // 1. Sidecar laden + matchen
  const supplier = await loadSupplierData(params.provider, params.parentId)
  const matchResult = supplier
    ? matchTextureCode(params.fileName, supplier.entries)
    : { match: null, attempts: [] }
  logMatchAttempts(params.fileName, matchResult)
  const entry = matchResult.match?.entry ?? null

  // 2. Basecolor zur Laufzeit zuschneiden (Update 2, Lea-Regel #13)
  const crop = await buildBasecolorCrop(params.baseImage.buffer)
  const baseColorCropFileName = params.baseImage.fileName.replace(/\.[^.]+$/, '') + '-crop.jpg'
  const baseCropImage: FirstPassImage = {
    buffer: crop.buffer,
    fileName: baseColorCropFileName,
    mimeType: crop.mimeType,
  }

  // 3. Supplier-Preview serverseitig laden (best effort)
  const supplierPreview = await tryFetchSupplierPreview(params, entry)

  // 4. CONTEXT + LIEFERSYSTEM + Pass-Metadaten + Crop-Info
  const context: Record<string, unknown> = {
    ...params.baseContext,
    pass: 1,
    expectedFields: llmFieldsForPass(1),
    basecolor_crop_cm: crop.cropCm,
    basecolor_crop_px: crop.cropPx,
    supplier_preview_sent: supplierPreview !== null,
  }
  const liefersystem = buildLiefersystemBlock(entry)
  if (liefersystem) context.LIEFERSYSTEM = liefersystem

  // 5. LLM-Call (1 oder 2 Bilder) + deterministische Nachbearbeitung
  const images: FirstPassImage[] = supplierPreview ? [baseCropImage, supplierPreview] : [baseCropImage]
  const markdownText = await params.analyzeImages({ images, context })
  const { meta } = parseFrontmatter(markdownText)

  // Bestehenden review_status aus dem Frontmatter lesen (Override-Schutz):
  // primaer aus params.existingReviewStatus (Aufrufer kennt den Vorzustand),
  // sekundaer aus der LLM-Antwort (falls das Template das Feld zurueckspiegelt).
  const existingFromArgs = params.existingReviewStatus
  const existingFromMeta = isReviewStatus(meta.review_status) ? meta.review_status : undefined
  const existingReviewStatus: ReviewStatus = existingFromArgs ?? existingFromMeta ?? 'nicht_geprueft'

  const pass1Fields = buildFirstPassFrontmatter({
    llmFields: meta,
    supplierEntry: entry,
    filePath: params.filePath,
    // Snapshot ins Frontmatter: Bild 1 ist immer der Basecolor-Crop.
    sourceImage: 'basecolor',
    supplierPreviewSent: supplierPreview !== null,
    existingReviewStatus,
  })
  const markdown = patchFrontmatter(markdownText, pass1Fields)

  return {
    markdown,
    supplierMatched: entry !== null,
    supplierPreviewSent: supplierPreview !== null,
    basecolorCrop: {
      crop_px: crop.cropPx,
      crop_cm: crop.cropCm,
      dpi_used: crop.dpiUsed,
      dpi_fallback: crop.dpiFallback,
    },
  }
}
