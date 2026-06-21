/**
 * Tests fuer die reine Frontmatter-Helper-Funktion (Variante A):
 * System-Felder (docType/detailViewType) werden deterministisch erzwungen.
 */

import { describe, it, expect } from 'vitest';
import { buildPublishFrontmatter } from '@/lib/submissions/publish-frontmatter';

describe('buildPublishFrontmatter', () => {
  it('ergaenzt fehlende System-Felder (Bug-Lage: detailViewType fehlt in metadata)', () => {
    const result = buildPublishFrontmatter({
      metadata: { title: 'Mein Event' },
      docType: 'event',
      detailViewType: 'session',
    });
    expect(result).toEqual({
      title: 'Mein Event',
      docType: 'event',
      detailViewType: 'session',
    });
  });

  it('System-Felder gewinnen ueber abweichende metadata-Werte (kein LLM-Leak)', () => {
    const result = buildPublishFrontmatter({
      metadata: { title: 'X', detailViewType: 'video', docType: 'irgendwas' },
      docType: 'event',
      detailViewType: 'session',
    });
    expect(result.detailViewType).toBe('session');
    expect(result.docType).toBe('event');
  });

  it('laesst uebrige metadata-Felder unveraendert', () => {
    const result = buildPublishFrontmatter({
      metadata: { title: 'T', summary: 'S', tags: ['a', 'b'] },
      docType: 'book',
      detailViewType: 'book',
    });
    expect(result.title).toBe('T');
    expect(result.summary).toBe('S');
    expect(result.tags).toEqual(['a', 'b']);
  });

  it('mutiert das Eingabe-metadata-Objekt nicht (reine Funktion)', () => {
    const metadata = { title: 'T' };
    buildPublishFrontmatter({ metadata, docType: 'event', detailViewType: 'session' });
    expect(metadata).toEqual({ title: 'T' });
  });
});
