/**
 * Tests fuer die reinen Abnahme-Hilfen (ADR-0004, W4):
 * Confidence-Ton/-Prozent + `buildReviewFields` (B6-Pflichtfelder + Confidence).
 */

import { describe, expect, it } from 'vitest';
import {
  buildReviewFields,
  confidencePercent,
  confidenceTone,
  hasMissingRequiredFields,
} from '@/lib/submissions/submission-review';

describe('confidenceTone', () => {
  it('bildet die Schwellen aus diva-texture-card ab', () => {
    expect(confidenceTone(0.95)).toBe('high');
    expect(confidenceTone(0.9)).toBe('high');
    expect(confidenceTone(0.89)).toBe('medium');
    expect(confidenceTone(0.7)).toBe('medium');
    expect(confidenceTone(0.69)).toBe('low');
    expect(confidenceTone(0)).toBe('low');
  });
});

describe('confidencePercent', () => {
  it('rundet auf ganze Prozent', () => {
    expect(confidencePercent(0.87)).toBe('87%');
    expect(confidencePercent(1)).toBe('100%');
    expect(confidencePercent(0.005)).toBe('1%');
  });
});

describe('buildReviewFields', () => {
  it('listet Pflichtfelder (B6) zuerst, dann uebrige Felder; haengt Confidence + Ton an', () => {
    // testimonial -> inhaltliche Pflichtfelder: title, author_name
    const fields = buildReviewFields(
      'testimonial',
      { author_name: 'Anna', title: 'Mein Titel', note: 'extra' },
      { title: 0.95, author_name: 0.6 },
    );
    expect(fields.map((f) => f.key)).toEqual(['title', 'author_name', 'note']);

    const title = fields[0];
    expect(title).toMatchObject({ isRequired: true, isMissing: false, confidence: 0.95, tone: 'high' });
    const author = fields[1];
    expect(author).toMatchObject({ isRequired: true, isMissing: false, confidence: 0.6, tone: 'low' });
    const note = fields[2];
    expect(note).toMatchObject({ isRequired: false, isMissing: false });
    expect(note.confidence).toBeUndefined();
    expect(note.tone).toBeUndefined();
  });

  it('markiert leere Pflichtfelder als fehlend', () => {
    const fields = buildReviewFields('testimonial', { title: 'X' });
    const author = fields.find((f) => f.key === 'author_name');
    expect(author).toMatchObject({ isRequired: true, isMissing: true });
    expect(hasMissingRequiredFields(fields)).toBe(true);

    const complete = buildReviewFields('testimonial', { title: 'X', author_name: 'Anna' });
    expect(hasMissingRequiredFields(complete)).toBe(false);
  });

  it('unbekannter ViewType -> nur die vorhandenen Metadaten-Felder (kein Pflichtfeld)', () => {
    const fields = buildReviewFields('gibtsnicht', { foo: 'bar' });
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ key: 'foo', isRequired: false, isMissing: false });
  });
});
