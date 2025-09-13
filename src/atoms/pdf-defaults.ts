import { atom } from 'jotai'
import type { PdfTransformOptions } from '@/lib/transform/transform-service'

/**
 * Runtime-Overrides für PDF-Standardwerte pro Library (nicht persistent).
 * Lebensdauer: bis zum Reload. Vorrang vor DB-Defaults in der UI.
 */
export type PdfRuntimeOverrides = Partial<PdfTransformOptions>;

// Map: libraryId -> Overrides
export const pdfOverridesAtom = atom<Record<string, PdfRuntimeOverrides>>({})

export function getEffectivePdfDefaults(
  libraryId: string | undefined,
  dbDefaults: Partial<PdfTransformOptions> | undefined,
  overridesMap: Record<string, PdfRuntimeOverrides>
): Partial<PdfTransformOptions> {
  if (!libraryId) return { ...(dbDefaults || {}) }
  const ov = overridesMap[libraryId] || {}
  return { ...(dbDefaults || {}), ...ov }
}


