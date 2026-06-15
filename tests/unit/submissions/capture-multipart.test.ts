/**
 * Tests fuer `parseMultipartCapture` (ADR-0004 II, Welle II-A):
 * extrahiert die Datei + validiert die Inhaltsfelder ueber parseCaptureBody.
 */

import { describe, expect, it } from 'vitest';
import { parseMultipartCapture } from '@/lib/submissions/capture-multipart';

function form(fields: Record<string, string>, ...files: File[]): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  for (const file of files) f.append('file', file);
  return f;
}

const VALID = {
  libraryId: 'lib-1',
  wizardId: 'pdf-upload',
  docType: 'pdfanalyse',
  detailViewType: 'book',
  markdownBody: '',
  metadata: JSON.stringify({ title: 'Quelle.pdf' }),
};

function pdf(name = 'Quelle.pdf'): File {
  return new File([Buffer.from('%PDF-1.4')], name, { type: 'application/pdf' });
}

describe('parseMultipartCapture', () => {
  it('liefert validierten CaptureBody + Datei (Einzeldatei)', () => {
    const { body, files } = parseMultipartCapture(form(VALID, pdf()));
    expect(body).toMatchObject({
      libraryId: 'lib-1',
      wizardId: 'pdf-upload',
      docType: 'pdfanalyse',
      detailViewType: 'book',
      markdownBody: '',
      metadata: { title: 'Quelle.pdf' },
    });
    expect(files.map((f) => f.name)).toEqual(['Quelle.pdf']);
  });

  it('nimmt mehrere Dateien auf (Ordner-Erfassung, U5e)', () => {
    const { files } = parseMultipartCapture(form(VALID, pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf')));
    expect(files.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
  });

  it('wirft, wenn keine Datei dabei ist', () => {
    expect(() => parseMultipartCapture(form(VALID))).toThrow(/Datei \(file\) fehlt/);
  });

  it('wirft bei ungueltigem metadata-JSON (kein stiller Fallback)', () => {
    expect(() => parseMultipartCapture(form({ ...VALID, metadata: '{kaputt' }, pdf()))).toThrow(
      /metadata ist kein gueltiges JSON/,
    );
  });

  it('reicht Validierungsfehler aus parseCaptureBody durch (z.B. leere docType)', () => {
    expect(() => parseMultipartCapture(form({ ...VALID, docType: '' }, pdf()))).toThrow(/docType/);
  });

  it('nimmt optionales target/confidence-JSON auf', () => {
    const { body } = parseMultipartCapture(
      form({ ...VALID, target: JSON.stringify({ slug: 's' }), confidence: JSON.stringify({ title: 0.7 }) }, pdf()),
    );
    expect(body.target).toEqual({ slug: 's' });
    expect(body.confidence).toEqual({ title: 0.7 });
  });
});
