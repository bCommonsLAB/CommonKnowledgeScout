/**
 * Tests fuer die reinen Inbox-Binaer-Helfer (ADR-0004).
 * Endungs-Normalisierung + Aufbau der `SubmissionBinaryRef` (inkl. expliziter
 * Pflichtfeld-Fehler). Die Pfad-Adressierung gehoert seit Welle II-A dem
 * InboxBlobProvider (siehe tests/unit/storage/inbox/, tests/unit/submissions/inbox-upload).
 */

import { describe, expect, it } from 'vitest';
import {
  buildInboxBinaryRef,
  extractFileExtension,
} from '@/lib/submissions/inbox-blob';

describe('extractFileExtension', () => {
  it('liefert die normalisierte (lowercase) Endung', () => {
    expect(extractFileExtension('report.PDF')).toBe('pdf');
    expect(extractFileExtension('archive.tar.gz')).toBe('gz');
    expect(extractFileExtension('photo.JPEG')).toBe('jpeg');
  });

  it('ohne erkennbare Endung -> leerer String (kein stiller Fehler)', () => {
    expect(extractFileExtension('noext')).toBe('');
    expect(extractFileExtension('endetMitPunkt.')).toBe('');
  });
});

describe('buildInboxBinaryRef', () => {
  it('baut die Referenz und nimmt size nur bei vorhandenem Wert auf', () => {
    const withSize = buildInboxBinaryRef({
      hash: 'abc',
      url: 'https://blob/abc.pdf',
      fileName: 'Quelle.pdf',
      contentType: 'application/pdf',
      size: 1234,
    });
    expect(withSize).toEqual({
      hash: 'abc',
      url: 'https://blob/abc.pdf',
      fileName: 'Quelle.pdf',
      contentType: 'application/pdf',
      size: 1234,
    });

    const withoutSize = buildInboxBinaryRef({
      hash: 'abc',
      url: 'https://blob/abc.pdf',
      fileName: 'Quelle.pdf',
      contentType: 'application/pdf',
    });
    expect(withoutSize).not.toHaveProperty('size');
  });

  it('wirft bei fehlenden Pflichtangaben (kein stiller Fallback)', () => {
    const ok = { hash: 'h', url: 'u', fileName: 'f', contentType: 'c' };
    expect(() => buildInboxBinaryRef({ ...ok, hash: '' })).toThrow(/hash/);
    expect(() => buildInboxBinaryRef({ ...ok, url: '' })).toThrow(/url/);
    expect(() => buildInboxBinaryRef({ ...ok, fileName: '' })).toThrow(/fileName/);
    expect(() => buildInboxBinaryRef({ ...ok, contentType: '' })).toThrow(/contentType/);
  });
});
