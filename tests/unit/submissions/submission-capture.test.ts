/**
 * Tests fuer die reine Capture->Submission-Logik (ADR-0004, W2):
 * `parseCaptureBody` (Validierung, explizite Fehler) + `buildCaptureSubmissionInput`
 * (Mapping, Status immer `pending`).
 */

import { describe, expect, it } from 'vitest';
import {
  buildCaptureSubmissionInput,
  parseCaptureBody,
  type CaptureBody,
} from '@/lib/submissions/submission-capture';

const VALID = {
  libraryId: 'lib-1',
  wizardId: 'w1',
  docType: 'testimonial',
  detailViewType: 'testimonial',
  markdownBody: '# Hallo',
  metadata: { title: 'X', author_name: 'Anna' },
};

describe('parseCaptureBody', () => {
  it('parst einen vollstaendigen Body inkl. optionaler Felder', () => {
    const body = parseCaptureBody({
      ...VALID,
      confidence: { title: 0.9 },
      binaryRefs: [{ hash: 'h', url: 'u', fileName: 'f.pdf', contentType: 'application/pdf', size: 12 }],
      target: { folderId: 'fold-1', slug: 'mein-slug' },
    });
    expect(body.libraryId).toBe('lib-1');
    expect(body.metadata).toEqual({ title: 'X', author_name: 'Anna' });
    expect(body.confidence).toEqual({ title: 0.9 });
    expect(body.binaryRefs).toEqual([
      { hash: 'h', url: 'u', fileName: 'f.pdf', contentType: 'application/pdf', size: 12 },
    ]);
    expect(body.target).toEqual({ folderId: 'fold-1', slug: 'mein-slug' });
  });

  it('laesst optionale Felder weg, wenn nicht gesetzt', () => {
    const body = parseCaptureBody(VALID);
    expect(body).not.toHaveProperty('confidence');
    expect(body).not.toHaveProperty('binaryRefs');
    expect(body).not.toHaveProperty('target');
  });

  it('erlaubt leeren markdownBody, aber kein Nicht-String', () => {
    expect(parseCaptureBody({ ...VALID, markdownBody: '' }).markdownBody).toBe('');
    expect(() => parseCaptureBody({ ...VALID, markdownBody: 42 })).toThrow(/markdownBody/);
  });

  it('wirft bei fehlenden Pflichtfeldern (kein stiller Fallback)', () => {
    expect(() => parseCaptureBody(null)).toThrow(/body/);
    for (const key of ['libraryId', 'wizardId', 'docType', 'detailViewType'] as const) {
      expect(() => parseCaptureBody({ ...VALID, [key]: '' })).toThrow(new RegExp(key));
    }
    expect(() => parseCaptureBody({ ...VALID, metadata: [] })).toThrow(/metadata/);
  });

  it('validiert confidence als 0..1-Zahlen', () => {
    expect(() => parseCaptureBody({ ...VALID, confidence: { a: 1.5 } })).toThrow(/confidence/);
    expect(() => parseCaptureBody({ ...VALID, confidence: { a: 'hoch' } })).toThrow(/confidence/);
  });

  it('validiert binaryRefs (Array + Pflichtangaben je Referenz)', () => {
    expect(() => parseCaptureBody({ ...VALID, binaryRefs: {} })).toThrow(/binaryRefs/);
    expect(() => parseCaptureBody({ ...VALID, binaryRefs: [{ url: 'u', fileName: 'f', contentType: 'c' }] })).toThrow(
      /hash/,
    );
  });

  it('validiert target-Felder als Strings', () => {
    expect(() => parseCaptureBody({ ...VALID, target: { folderId: 5 } })).toThrow(/target.folderId/);
    expect(parseCaptureBody({ ...VALID, target: { slug: 's' } }).target).toEqual({ slug: 's' });
  });
});

describe('buildCaptureSubmissionInput', () => {
  const body: CaptureBody = parseCaptureBody(VALID);

  it('setzt Status pending und uebernimmt Identitaet aus dem Kontext', () => {
    const input = buildCaptureSubmissionInput(body, { createdBy: 'anna@example.com', createdByRole: 'owner' });
    expect(input.status).toBe('pending');
    expect(input.createdBy).toBe('anna@example.com');
    expect(input.createdByRole).toBe('owner');
    expect(input.libraryId).toBe('lib-1');
    expect(input.wizardId).toBe('w1');
    expect(input.docType).toBe('testimonial');
    expect(input.detailViewType).toBe('testimonial');
    expect(input.markdownBody).toBe('# Hallo');
    expect(input.metadata).toEqual({ title: 'X', author_name: 'Anna' });
  });

  it('uebernimmt optionale Felder + writeKey nur, wenn gesetzt', () => {
    const full = parseCaptureBody({
      ...VALID,
      confidence: { title: 0.8 },
      binaryRefs: [{ hash: 'h', url: 'u', fileName: 'f', contentType: 'c' }],
      target: { slug: 's' },
    });
    const input = buildCaptureSubmissionInput(full, {
      createdBy: 'a@b.de',
      createdByRole: 'co-creator',
      writeKey: 'wk-1',
    });
    expect(input.confidence).toEqual({ title: 0.8 });
    expect(input.binaryRefs).toHaveLength(1);
    expect(input.target).toEqual({ slug: 's' });
    expect(input.writeKey).toBe('wk-1');

    const minimal = buildCaptureSubmissionInput(body, { createdBy: 'a@b.de', createdByRole: 'co-creator' });
    expect(minimal).not.toHaveProperty('confidence');
    expect(minimal).not.toHaveProperty('binaryRefs');
    expect(minimal).not.toHaveProperty('target');
    expect(minimal).not.toHaveProperty('writeKey');
  });
});
