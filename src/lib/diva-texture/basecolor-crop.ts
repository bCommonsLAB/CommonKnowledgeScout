/**
 * @fileoverview Basecolor-Crop fuer den Pass-1-LLM-Call (Stufe 3, Update 2).
 *
 * @description
 * Rechnet zur Laufzeit aus dem Original-Basecolor (oft 4K oder groesser)
 * einen LLM-tauglichen Center-Crop (~360x360 px) und berechnet die echte
 * cm-Groesse des Ausschnitts ueber die DPI aus dem Datei-Header (sharp via
 * `extractImageMetadata`). KEINE Persistenz — der Crop ist deterministisch
 * reproduzierbar; gibt es eh keinen Ort dafuer.
 *
 * Lea-Regel #13 (User-Entscheid 2026-05-28, Update 2): das LLM braucht eine
 * physikalische Referenz fuer pattern_scale (fein/klein/mittel/gross) — die
 * cm-Angabe geht als `basecolor_crop_cm` in den CONTEXT-Block.
 *
 * Edge-Cases:
 *  - DPI fehlt im Header → Fallback 300 DPI + FileLogger-Warning + Flag
 *    `dpi_fallback: true` im Ergebnis (Edge-Case #19).
 *  - Original kleiner als Ziel-Crop (z.B. 256x256) → Voll-Bild zurueckgeben,
 *    cm-Wert anhand der vollen Pixel-Masse berechnen (Edge-Case #20).
 *
 * Rein deterministisch, KEIN LLM-Call.
 */

import sharp from 'sharp'
import { FileLogger } from '@/lib/debug/logger'
import { extractImageMetadata, type ImageTechnicalMetadata } from '@/lib/image/exif-metadata'

/** Ziel-Kantenlaenge des Crops in Pixeln. */
const TARGET_CROP_PX = 360

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
  /** Tatsaechliche Pixel-Maesse des Crops als "BxH"-String. */
  cropPx: string
  /** Realgroesse des Crops in cm als "B.Bx H.H"-String. */
  cropCm: string
  /** Verwendete DPI (Original-DPI oder Fallback). */
  dpiUsed: number
  /** True, wenn der DPI-Fallback greifen musste. */
  dpiFallback: boolean
  /**
   * True, wenn das Original kleiner als der Ziel-Crop ist und das Voll-Bild
   * statt eines echten Ausschnitts ans LLM gegeben wird (Edge-Case #20).
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
 * Reine Berechnung des Crop-Plans aus den Bild-Metadaten — ohne sharp-
 * Roundtrip. Wird von `buildBasecolorCrop` UND vom UI-Info-Endpoint
 * geteilt (Lea-Regel: keine doppelte Logik fuer "was waere der Crop").
 */
export function planBasecolorCrop(meta: ImageTechnicalMetadata): BasecolorCropPlan {
  const widthPx = meta.breite_px
  const heightPx = meta.hoehe_px

  let dpiUsed = meta.dpi_horizontal ?? FALLBACK_DPI
  let dpiFallback = false
  if (meta.dpi_horizontal === null || meta.dpi_horizontal <= 0) {
    dpiUsed = FALLBACK_DPI
    dpiFallback = true
  }

  if (widthPx <= TARGET_CROP_PX || heightPx <= TARGET_CROP_PX) {
    return {
      cropPx: `${widthPx}x${heightPx}`,
      cropCm: formatCropCm(widthPx, heightPx, dpiUsed),
      dpiUsed,
      dpiFallback,
      fullImage: true,
    }
  }

  return {
    cropPx: `${TARGET_CROP_PX}x${TARGET_CROP_PX}`,
    cropCm: formatCropCm(TARGET_CROP_PX, TARGET_CROP_PX, dpiUsed),
    dpiUsed,
    dpiFallback,
    fullImage: false,
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
  const plan = planBasecolorCrop(meta)

  if (plan.dpiFallback) {
    FileLogger.warn('diva-texture-basecolor-crop', 'DPI fehlt im Bild-Header — Fallback 300 DPI', {
      widthPx: meta.breite_px,
      heightPx: meta.hoehe_px,
      fallbackDpi: FALLBACK_DPI,
    })
  }

  // Edge-Case #20: Voll-Bild senden, sharp re-enkodiert nur als JPEG.
  if (plan.fullImage) {
    const fullBuffer = await sharp(sourceBuffer).jpeg({ quality: 85 }).toBuffer()
    return { ...plan, buffer: fullBuffer, mimeType: OUTPUT_MIME_TYPE }
  }

  // Center-Crop: links/oben so setzen, dass der Ausschnitt mittig im Bild liegt.
  const left = Math.floor((meta.breite_px - TARGET_CROP_PX) / 2)
  const top = Math.floor((meta.hoehe_px - TARGET_CROP_PX) / 2)

  const croppedBuffer = await sharp(sourceBuffer)
    .extract({ left, top, width: TARGET_CROP_PX, height: TARGET_CROP_PX })
    .jpeg({ quality: 85 })
    .toBuffer()

  return { ...plan, buffer: croppedBuffer, mimeType: OUTPUT_MIME_TYPE }
}
