/**
 * Tests der Analyse-Medien-Weiche (U5b): contentType -> Pipeline-Identitaet +
 * medienspezifische correlation.options. Pinnt PDF/Audio-Support und den
 * expliziten Fehler bei nicht unterstuetzten Typen (no-silent-fallbacks).
 */

import { describe, expect, it } from 'vitest';
import {
  buildAnalysisMediaOptions,
  resolveAnalyzableMedia,
  type AnalyzableJobType,
} from '@/lib/submissions/submission-media';

describe('resolveAnalyzableMedia', () => {
  it('mappt PDF auf den extract_pdf-Pfad', () => {
    expect(resolveAnalyzableMedia('application/pdf')).toEqual({
      jobType: 'pdf',
      mediaType: 'pdf',
      extractStepName: 'extract_pdf',
    });
  });

  it('mappt jeden audio/*-Typ auf den extract_audio-Pfad', () => {
    for (const ct of ['audio/mpeg', 'audio/wav', 'audio/x-m4a']) {
      expect(resolveAnalyzableMedia(ct)).toMatchObject({ jobType: 'audio', extractStepName: 'extract_audio' });
    }
  });

  it('ist case-insensitiv und tolerant gegen Whitespace', () => {
    expect(resolveAnalyzableMedia('  Application/PDF  ')?.jobType).toBe('pdf');
    expect(resolveAnalyzableMedia('AUDIO/MPEG')?.jobType).toBe('audio');
  });

  it('liefert null bei nicht unterstuetztem Typ (Aufrufer entscheidet ueber Fehler)', () => {
    expect(resolveAnalyzableMedia('image/png')).toBeNull();
    expect(resolveAnalyzableMedia('text/plain')).toBeNull();
    expect(resolveAnalyzableMedia('')).toBeNull();
  });
});

describe('buildAnalysisMediaOptions', () => {
  it('PDF: Mistral-OCR + Bild-Flags', () => {
    expect(buildAnalysisMediaOptions('pdf')).toEqual({
      extractionMethod: 'mistral_ocr',
      includeOcrImages: true,
      includePreviewPages: true,
      includeHighResPages: true,
    });
  });

  it('Audio: nur Quellsprache, keine OCR-Optionen', () => {
    expect(buildAnalysisMediaOptions('audio')).toEqual({ sourceLanguage: 'auto' });
  });

  it('wirft bei unbehandeltem jobType (kein stiller Fallback)', () => {
    const bogus = 'video' as unknown as AnalyzableJobType;
    expect(() => buildAnalysisMediaOptions(bogus)).toThrow(/unbehandelter jobType/);
  });
});
