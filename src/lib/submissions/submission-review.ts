/**
 * @fileoverview Abnahme-Hilfen fuer Submissions (ADR-0004, W4) - reine Funktionen.
 *
 * @description
 * Confidence-Ton (Muster aus `diva-texture-card.tsx`) + Feld-Modell fuer die
 * Abnahme: verbindet die INHALTLICHEN Pflichtfelder (B6,
 * `contentRequiredFields`) mit Werten + Confidence, damit die UI unsichere und
 * fehlende Felder generisch hervorheben kann - ohne Domaenenwissen pro docType.
 *
 * @see docs/wizards/abnahme-inbox-plan.md (Baustein W4 + B6)
 * @see src/components/library/gallery/document-card/diva-texture-card.tsx
 * @module lib/submissions
 */

import { contentRequiredFields } from '@/lib/detail-view-types/content-fields';

export type ConfidenceTone = 'high' | 'medium' | 'low';

/** Schwellen wie diva-texture-card: >=0.9 hoch, >=0.7 mittel, sonst niedrig. */
export function confidenceTone(value: number): ConfidenceTone {
  if (value >= 0.9) return 'high';
  if (value >= 0.7) return 'medium';
  return 'low';
}

/** Badge-Klassen je Ton (Tailwind), analog diva-texture-card. */
export const CONFIDENCE_TONE_BADGE: Readonly<Record<ConfidenceTone, string>> = {
  high: 'bg-emerald-600/85 text-white',
  medium: 'bg-amber-500/85 text-white',
  low: 'bg-rose-600/85 text-white',
};

/** "87%" aus 0.87. */
export function confidencePercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Ein Feld in der Abnahme-Ansicht. */
export interface ReviewField {
  key: string;
  value: unknown;
  /** Confidence 0..1, falls die Analyse einen Wert lieferte. */
  confidence?: number;
  tone?: ConfidenceTone;
  /** Inhaltliches Pflichtfeld (B6) des detailViewType. */
  isRequired: boolean;
  /** Pflichtfeld, aber leer -> die Abnahme muss es ergaenzen. */
  isMissing: boolean;
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * Baut das Abnahme-Feld-Modell: Vereinigung aus inhaltlichen Pflichtfeldern (B6)
 * und vorhandenen Metadaten-Feldern, jeweils mit Confidence + Ton + Pflicht/Fehlt.
 * Pflichtfelder zuerst (in Registry-Reihenfolge), dann uebrige Felder.
 */
export function buildReviewFields(
  detailViewType: string,
  metadata: Record<string, unknown>,
  confidence: Record<string, number> = {},
): ReviewField[] {
  const required = contentRequiredFields(detailViewType);
  const requiredSet = new Set(required);
  const extras = Object.keys(metadata).filter((key) => !requiredSet.has(key));
  return [...required, ...extras].map((key) => {
    const value = metadata[key];
    const conf = typeof confidence[key] === 'number' ? confidence[key] : undefined;
    const isRequired = requiredSet.has(key);
    return {
      key,
      value,
      confidence: conf,
      tone: conf !== undefined ? confidenceTone(conf) : undefined,
      isRequired,
      isMissing: isRequired && isEmpty(value),
    };
  });
}

/** Hat die Submission offene Pflichtfelder (B6), die vor Freigabe fehlen? */
export function hasMissingRequiredFields(fields: ReviewField[]): boolean {
  return fields.some((field) => field.isMissing);
}
