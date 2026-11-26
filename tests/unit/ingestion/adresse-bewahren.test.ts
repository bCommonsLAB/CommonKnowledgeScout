/**
 * @fileoverview Adresse eines Dokuments bleibt ueber spaetere Laeufe (Owner-Entscheid 26.11.2026):
 * Der Slug kam bei jeder Neuerzeugung neu aus dem Sprachmodell, weitergegebene Links liefen ins Leere.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const repo = vi.hoisted(() => ({ getMetaByFileId: vi.fn() }))

vi.mock('@/lib/repositories/vector-repo', () => repo)

import { entscheideSlug, ladeBestehendenSlug, slugAusMetaDokument } from '@/lib/ingestion/adresse-bewahren'

beforeEach(() => vi.clearAllMocks())

describe('entscheideSlug', () => {
  it('die bestehende Adresse gewinnt, der neue Vorschlag wird genannt', () => {
    expect(entscheideSlug('side-event-finance-outcomes', 'side-event-2026-11-09-beyond-numbers')).toEqual({
      slug: 'side-event-2026-11-09-beyond-numbers', herkunft: 'bestehend', verworfen: 'side-event-finance-outcomes',
    })
  })

  it('gleicher Vorschlag oder keiner: nichts verworfen', () => {
    expect(entscheideSlug('gleich', 'gleich')).toEqual({ slug: 'gleich', herkunft: 'bestehend', verworfen: null })
    expect(entscheideSlug(undefined, 'alt')).toEqual({ slug: 'alt', herkunft: 'bestehend', verworfen: null })
  })

  it('ohne bestehende Adresse gilt der neue Vorschlag; ohne beides bleibt sie leer (der Aufrufer setzt den Ersatz)', () => {
    expect(entscheideSlug(' neu ', null)).toEqual({ slug: 'neu', herkunft: 'neu', verworfen: null })
    expect(entscheideSlug('neu', '   ')).toEqual({ slug: 'neu', herkunft: 'neu', verworfen: null })
    expect(entscheideSlug(42, null)).toEqual({ slug: '', herkunft: 'keine', verworfen: null })
  })
})

describe('slugAusMetaDokument', () => {
  it('liest docMetaJson.slug (das oeffnet die Galerie), sonst das Feld slug', () => {
    expect(slugAusMetaDokument({ slug: 'oben', docMetaJson: { slug: 'im-json' } })).toBe('im-json')
    expect(slugAusMetaDokument({ slug: 'oben', docMetaJson: { title: 'x' } })).toBe('oben')
    expect(slugAusMetaDokument({ docMetaJson: { slug: '  ' } })).toBeNull()
    expect(slugAusMetaDokument(null)).toBeNull()
  })
})

describe('ladeBestehendenSlug', () => {
  it('fragt das Meta-Dokument der Quelle ab; nicht ingestiert heisst keine Adresse', async () => {
    repo.getMetaByFileId.mockResolvedValueOnce({ docMetaJson: { slug: 'bleibt' } })
    expect(await ladeBestehendenSlug('lib_key', 'quelle-1')).toBe('bleibt')
    expect(repo.getMetaByFileId).toHaveBeenCalledWith('lib_key', 'quelle-1')
    repo.getMetaByFileId.mockResolvedValueOnce(null)
    expect(await ladeBestehendenSlug('lib_key', 'quelle-2')).toBeNull()
  })

  it('ein Lesefehler wird nicht verschluckt', async () => {
    repo.getMetaByFileId.mockRejectedValueOnce(new Error('Mongo nicht erreichbar'))
    await expect(ladeBestehendenSlug('lib_key', 'quelle-1')).rejects.toThrow('Mongo nicht erreichbar')
  })
})
