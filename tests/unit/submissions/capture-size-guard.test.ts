/**
 * Tests fuer den Groessen-Guard der Erfassung (Crash-Haertung 1b, Variante A):
 * verhindert das vollstaendige In-Memory-Puffern grosser/mehrerer Dateien, das
 * den Dev-Server per OOM toetet. Reine Funktionen, keine Seiteneffekte.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_MAX_TOTAL_BYTES,
  resolveCaptureSizeLimits,
  checkDeclaredTotalSize,
  checkParsedFileSizes,
  type CaptureSizeLimits,
} from '@/lib/submissions/capture-size-guard';

const SMALL: CaptureSizeLimits = { maxFileBytes: 100, maxTotalBytes: 250 };

describe('resolveCaptureSizeLimits', () => {
  it('nutzt die dokumentierten Defaults, wenn keine ENV gesetzt ist', () => {
    expect(resolveCaptureSizeLimits({})).toEqual({
      maxFileBytes: DEFAULT_MAX_FILE_BYTES,
      maxTotalBytes: DEFAULT_MAX_TOTAL_BYTES,
    });
  });

  it('liest gueltige ENV-Overrides', () => {
    expect(
      resolveCaptureSizeLimits({ SUBMISSION_MAX_FILE_BYTES: '10', SUBMISSION_MAX_TOTAL_BYTES: '20' }),
    ).toEqual({ maxFileBytes: 10, maxTotalBytes: 20 });
  });

  it('wirft bei ungueltigem ENV-Wert (kein stiller Fallback auf den Default)', () => {
    expect(() => resolveCaptureSizeLimits({ SUBMISSION_MAX_FILE_BYTES: 'viel' })).toThrow(
      /SUBMISSION_MAX_FILE_BYTES muss eine positive Ganzzahl/,
    );
    expect(() => resolveCaptureSizeLimits({ SUBMISSION_MAX_TOTAL_BYTES: '0' })).toThrow(
      /SUBMISSION_MAX_TOTAL_BYTES muss eine positive Ganzzahl/,
    );
    expect(() => resolveCaptureSizeLimits({ SUBMISSION_MAX_FILE_BYTES: '-5' })).toThrow(
      /positive Ganzzahl/,
    );
  });
});

describe('checkDeclaredTotalSize', () => {
  it('liefert null, wenn der Content-Length-Header fehlt (Post-Parse-Guard greift)', () => {
    expect(checkDeclaredTotalSize(null, SMALL)).toBeNull();
  });

  it('liefert null bei unbrauchbarem Header (fallthrough auf autoritative Pruefung)', () => {
    expect(checkDeclaredTotalSize('kaputt', SMALL)).toBeNull();
  });

  it('liefert null, wenn die deklarierte Groesse im Limit liegt', () => {
    expect(checkDeclaredTotalSize('250', SMALL)).toBeNull();
  });

  it('meldet declared-total-too-large oberhalb des Summen-Limits', () => {
    const v = checkDeclaredTotalSize('251', SMALL);
    expect(v?.reason).toBe('declared-total-too-large');
    expect(v?.limitBytes).toBe(250);
    expect(v?.actualBytes).toBe(251);
  });
});

describe('checkParsedFileSizes', () => {
  it('liefert null, wenn alle Dateien + Summe im Limit liegen', () => {
    expect(checkParsedFileSizes([{ name: 'a', size: 100 }, { name: 'b', size: 100 }], SMALL)).toBeNull();
  });

  it('meldet file-too-large bei einer zu grossen Einzeldatei', () => {
    const v = checkParsedFileSizes([{ name: 'gross.mp4', size: 101 }], SMALL);
    expect(v?.reason).toBe('file-too-large');
    expect(v?.message).toContain('gross.mp4');
    expect(v?.limitBytes).toBe(100);
  });

  it('meldet total-too-large, wenn die Summe (nicht die Einzeldatei) das Limit sprengt', () => {
    const v = checkParsedFileSizes(
      [{ name: 'a', size: 100 }, { name: 'b', size: 100 }, { name: 'c', size: 100 }],
      SMALL,
    );
    expect(v?.reason).toBe('total-too-large');
    expect(v?.actualBytes).toBe(300);
  });

  it('liefert null fuer eine leere Liste', () => {
    expect(checkParsedFileSizes([], SMALL)).toBeNull();
  });
});
