/**
 * @fileoverview Basecolor-Crop fuer den Pass-1-LLM-Call (Stufe 3, Update 2).
 *
 * @description
 * Rechnet zur Laufzeit aus dem Original-Basecolor (oft 4K oder groesser)
 * einen LLM-tauglichen Center-Crop und berechnet die echte cm-Groesse
 * des Ausschnitts ueber die DPI aus dem Datei-Header (sharp via
 * `extractImageMetadata`). KEINE Persistenz — der Crop ist deterministisch
 * reproduzierbar; gibt es eh keinen Ort dafuer.
 *
 * Lea-Regel #13 (User-Entscheid 2026-05-28, Update 2): das LLM braucht eine
 * physikalische Referenz fuer pattern_scale (fein/klein/mittel/gross) — die
 * cm-Angabe geht als `basecolor_crop_cm` in den CONTEXT-Block.
 *
 * Token-Optimierung (User-Entscheid 2026-05-29): konstante physikalische
 * Crop-Groesse (4 x 4 cm) statt konstanter Pixel-Kante. Damit sieht das LLM
 * immer denselben Materialausschnitt, egal ob das Original 150 oder 600 DPI
 * hat — pattern_scale wird robust. Ausgabe wird auf max. 512 Pixel-Kante
 * gekappt (=> ~256 Image-Patches bei Claude); kleinere Source-Crops gehen
 * nativ raus (kein Upsample, weil Upsample nur Tokens kostet ohne Mehrinfo).
 *
 * Edge-Cases:
 *  - DPI fehlt im Header → Fallback 300 DPI + FileLogger-Warning + Flag
 *    `dpi_fallback: true` im Ergebnis (Edge-Case #19).
 *  - Original kleiner als 4 cm in mindestens einer Dimension → Voll-Bild
 *    zurueckgeben, cm-Wert anhand der vollen Pixel-Masse berechnen
 *    (Edge-Case #20). Voll-Bild wird ebenfalls auf 512 px gekappt.
 *
 * Rein deterministisch, KEIN LLM-Call.
 */

import sharp from 'sharp'
import { FileLogger } from '@/lib/debug/logger'
import { extractImageMetadata, type ImageTechnicalMetadata } from '@/lib/image/exif-metadata'

/** Physische Kantenlaenge des Ziel-Crops in cm (konstant fuer alle Bilder). */
const PHYSICAL_CROP_CM = 4

/**
 * Obere Schranke fuer die Pixel-Kante des ausgegebenen Bildes. Bei hohen
 * Source-DPIs (300+) wuerde der 4-cm-Crop sonst > 500 px werden — der Token-
 * Gewinn pro zusaetzlicher Pixel-Kante ist marginal, weil das LLM intern
 * sowieso in 32x32-Patches tokenisiert.
 */
const MAX_OUTPUT_PX = 512

/** Fallback-DPI, wenn der Bild-Header keine Aufloesung liefert. */
const FALLBACK_DPI = 300

/** Ausgabe-Format des Crops (JPEG fuer kleine Dateigroesse beim LLM). */
const OUTPUT_MIME_TYPE = 'image/jpeg'

/**
 * Crop-Plan: was bei einem gegebenen Original-Bild gecroppt WUERDE — ohne
 * den eigentlichen sharp-Roundtrip. Wird von UI + LLM-Pipeline geteilt,
 * damit die Vorschau (DivaSupplierDataView) die gleichen Masse anzeigt
 * wie der Pass-1-Lauf tatsaechlich verwendet.
 */
export interface BasecolorCropPlan {
  /** Tatsaechliche Pixel-Maesse des ausgegebenen Crops als "BxH"-String. */
  cropPx: string
  /** Realgroesse des Crops in cm als "B.Bx H.H"-String. */
  cropCm: string
  /** Verwendete DPI (Original-DPI oder Fallback). */
  dpiUsed: number
  /** True, wenn der DPI-Fallback greifen musste. */
  dpiFallback: boolean
  /**
   * True, wenn das Original kleiner als 4 cm in mindestens einer Dimension
   * ist und das Voll-Bild statt eines echten Ausschnitts ans LLM gegeben
   * wird (Edge-Case #20).
   */
  fullImage: boolean
}

/** Ergebnis des Basecolor-Crops: Plan + erzeugter Bild-Buffer. */
export interface BasecolorCropResult extends BasecolorCropPlan {
  /** JPEG-Buffer des Crops (oder Voll-Bild bei kleinem Original). */
  buffer: Buffer
  /** MIME-Type des Crops (immer JPEG). */
  mimeType: string
}

/**
 * Internes Plan-Detail mit Pixel-Massen fuer Extraktion + Output. Wird nur
 * von `buildBasecolorCrop` verwendet — die oeffentliche `BasecolorCropPlan`-
 * Schnittstelle (UI + Pipeline-Logger) braucht nur die Stringform.
 */
interface InternalCropPlan extends BasecolorCropPlan {
  /** Pixel-Breite der zu extrahierenden Region; 0 wenn fullImage. */
  extractWidthPx: number
  /** Pixel-Hoehe der zu extrahierenden Region; 0 wenn fullImage. */
  extractHeightPx: number
  /** Pixel-Breite des finalen Ausgabe-Bildes (nach optionalem Downsample). */
  outputWidthPx: number
  /** Pixel-Hoehe des finalen Ausgabe-Bildes (nach optionalem Downsample). */
  outputHeightPx: number
}

/** Rundet auf 1 Nachkommastelle (3.04 → 3.0, 2.87 → 2.9). */
function roundTo1Decimal(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Berechnet aus Pixel-Masse + DPI die Realgroesse in cm und liefert sie
 * als "B.Bx H.H"-String (eine Nachkommastelle).
 */
function formatCropCm(widthPx: number, heightPx: number, dpi: number): string {
  const widthCm = roundTo1Decimal((widthPx / dpi) * 2.54)
  const heightCm = roundTo1Decimal((heightPx / dpi) * 2.54)
  return `${widthCm.toFixed(1)}x${heightCm.toFixed(1)}`
}

/**
 * Interne Plan-Berechnung mit Pixel-Massen fuer Extraktion + Output.
 * Wird sowohl von `planBasecolorCrop` (UI) als auch von `buildBasecolorCrop`
 * (Pipeline) genutzt — eine Quelle, keine Drift.
 */
function computeInternalPlan(meta: ImageTechnicalMetadata): InternalCropPlan {
  const widthPx = meta.breite_px
  const heightPx = meta.hoehe_px

  let dpiUsed = meta.dpi_horizontal ?? FALLBACK_DPI
  let dpiFallback = false
  if (meta.dpi_horizontal === null || meta.dpi_horizontal <= 0) {
    dpiUsed = FALLBACK_DPI
    dpiFallback = true
  }

  // Pixel-Kante, die in der Quell-DPI 4 cm entspricht.
  const physicalCropEdgePx = Math.round((PHYSICAL_CROP_CM * dpiUsed) / 2.54)

  // Edge-Case #20: Source ist kleiner als 4 cm in mindestens einer Dimension
  // → ganzes Bild senden, ggf. proportional auf MAX_OUTPUT_PX kappen.
  if (physicalCropEdgePx > widthPx || physicalCropEdgePx > heightPx) {
    const maxSide = Math.max(widthPx, heightPx)
    const scale = maxSide > MAX_OUTPUT_PX ? MAX_OUTPUT_PX / maxSide : 1
    const outputWidthPx = Math.round(widthPx * scale)
    const outputHeightPx = Math.round(heightPx * scale)
    return {
      cropPx: `${outputWidthPx}x${outputHeightPx}`,
      cropCm: formatCropCm(widthPx, heightPx, dpiUsed),
      dpiUsed,
      dpiFallback,
      fullImage: true,
      extractWidthPx: 0,
      extractHeightPx: 0,
      outputWidthPx,
      outputHeightPx,
    }
  }

  // Regulaerer 4x4-cm Center-Crop, ggf. Downsample auf MAX_OUTPUT_PX.
  const outputEdgePx = Math.min(physicalCropEdgePx, MAX_OUTPUT_PX)
  return {
    cropPx: `${outputEdgePx}x${outputEdgePx}`,
    cropCm: `${PHYSICAL_CROP_CM.toFixed(1)}x${PHYSICAL_CROP_CM.toFixed(1)}`,
    dpiUsed,
    dpiFallback,
    fullImage: false,
    extractWidthPx: physicalCropEdgePx,
    extractHeightPx: physicalCropEdgePx,
    outputWidthPx: outputEdgePx,
    outputHeightPx: outputEdgePx,
  }
}

/**
 * Reine Berechnung des Crop-Plans aus den Bild-Metadaten — ohne sharp-
 * Roundtrip. Wird von `buildBasecolorCrop` UND vom UI-Info-Endpoint
 * geteilt (Lea-Regel: keine doppelte Logik fuer "was waere der Crop").
 */
export function planBasecolorCrop(meta: ImageTechnicalMetadata): BasecolorCropPlan {
  const internal = computeInternalPlan(meta)
  return {
    cropPx: internal.cropPx,
    cropCm: internal.cropCm,
    dpiUsed: internal.dpiUsed,
    dpiFallback: internal.dpiFallback,
    fullImage: internal.fullImage,
  }
}

/**
 * Optionale Injektion des Metadaten-Readers (fuer Tests, damit der
 * DPI-Fallback-Pfad ohne reales Bild ohne Density-Tag abgedeckt werden kann).
 * Default: `extractImageMetadata` aus `@/lib/image/exif-metadata`.
 */
export type ReadImageMetadataFn = (buffer: Buffer) => Promise<ImageTechnicalMetadata>

/**
 * Rechnet aus dem Original-Basecolor einen Center-Crop fuer den LLM-Call.
 *
 * @param sourceBuffer Original-Basecolor-Buffer (z.B. 4K-JPEG).
 * @param readMetadata Optional injizierter Metadaten-Reader (Default sharp via
 *   `extractImageMetadata`). Hauptsaechlich fuer Tests gedacht.
 * @returns Crop-Buffer + cm-Groesse + DPI-Metadaten.
 */
export async function buildBasecolorCrop(
  sourceBuffer: Buffer,
  readMetadata: ReadImageMetadataFn = extractImageMetadata,
): Promise<BasecolorCropResult> {
  const meta = await readMetadata(sourceBuffer)
  const plan = computeInternalPlan(meta)

  if (plan.dpiFallback) {
    FileLogger.warn('diva-texture-basecolor-crop', 'DPI fehlt im Bild-Header — Fallback 300 DPI', {
      widthPx: meta.breite_px,
      heightPx: meta.hoehe_px,
      fallbackDpi: FALLBACK_DPI,
    })
  }

  // Edge-Case #20: Voll-Bild senden, ggf. proportional auf MAX_OUTPUT_PX skaliert.
  if (plan.fullImage) {
    let pipeline = sharp(sourceBuffer)
    if (plan.outputWidthPx < meta.breite_px || plan.outputHeightPx < meta.hoehe_px) {
      pipeline = pipeline.resize({ width: plan.outputWidthPx, height: plan.outputHeightPx, fit: 'fill' })
    }
    const fullBuffer = await pipeline.jpeg({ quality: 85 }).toBuffer()
    return {
      cropPx: plan.cropPx,
      cropCm: plan.cropCm,
      dpiUsed: plan.dpiUsed,
      dpiFallback: plan.dpiFallback,
      fullImage: plan.fullImage,
      buffer: fullBuffer,
      mimeType: OUTPUT_MIME_TYPE,
    }
  }

  // Center-Crop: links/oben so setzen, dass der Ausschnitt mittig im Bild liegt.
  const left = Math.floor((meta.breite_px - plan.extractWidthPx) / 2)
  const top = Math.floor((meta.hoehe_px - plan.extractHeightPx) / 2)

  let pipeline = sharp(sourceBuffer).extract({
    left,
    top,
    width: plan.extractWidthPx,
    height: plan.extractHeightPx,
  })
  if (plan.outputWidthPx < plan.extractWidthPx) {
    pipeline = pipeline.resize({ width: plan.outputWidthPx, height: plan.outputHeightPx, fit: 'fill' })
  }
  const croppedBuffer = await pipeline.jpeg({ quality: 85 }).toBuffer()

  return {
    cropPx: plan.cropPx,
    cropCm: plan.cropCm,
    dpiUsed: plan.dpiUsed,
    dpiFallback: plan.dpiFallback,
    fullImage: plan.fullImage,
    buffer: croppedBuffer,
    mimeType: OUTPUT_MIME_TYPE,
  }
}
