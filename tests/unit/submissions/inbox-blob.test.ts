/**
 * Tests fuer die reinen Azure-Blob-Inbox-Helfer (ADR-0004, W1).
 * Sichert die content-addressed Pfad-Konvention des Inbox-Bereichs und den
 * Aufbau der `SubmissionBinaryRef` (inkl. expliziter Pflichtfeld-Fehler).
 */

import { describe, expect, it } from 'vitest';
import {
  INBOX_SCOPE,
  buildInboxBinaryRef,
  extractFileExtension,
  getInboxBlobPath,
} from '@/lib/submissions/inbox-blob';

describe('INBOX_SCOPE', () => {
  it('ist der dedizierte Inbox-Pfadabschnitt', () => {
    expect(INBOX_SCOPE).toBe('inbox');
  });
});

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

describe('getInboxBlobPath', () => {
  it('baut den content-addressed Pfad library/inbox/hash.ext', () => {
    expect(getInboxBlobPath('lib-1', 'abc123', 'pdf')).toBe('lib-1/inbox/abc123.pdf');
  });

  it('sanitisiert die libraryId und normalisiert die Endung', () => {
    // sanitizeLibraryId: lowercase + Unterstrich->Bindestrich
    expect(getInboxBlobPath('Test_Lib', 'h1', '.PDF')).toBe('test-lib/inbox/h1.pdf');
  });

  it('ohne Endung kein abschliessender Punkt', () => {
    expect(getInboxBlobPath('lib-1', 'h2', '')).toBe('lib-1/inbox/h2');
  });

  it('wirft bei fehlender libraryId oder hash', () => {
    expect(() => getInboxBlobPath('', 'h', 'pdf')).toThrow(/libraryId/);
    expect(() => getInboxBlobPath('lib-1', '', 'pdf')).toThrow(/hash/);
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
