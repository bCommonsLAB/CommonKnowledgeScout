/**
 * @fileoverview Unit-Tests: patchFrontmatter — Erhalt unbekannter Felder + Body
 *
 * Twin-Datei-Contract §4.2: "Unbekannte Frontmatter-Felder und der Body werden
 * beim Schreiben erhalten." patchFrontmatter ist der Mechanismus hinter
 * `ShadowTwinService.patchArtifactFrontmatter` (Load → Patch → Upsert) — diese
 * Garantie wird hier auf der reinen Funktionsebene festgenagelt.
 */

import { describe, it, expect } from 'vitest'
import { patchFrontmatter } from '@/lib/markdown/frontmatter-patch'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

const BODY = '# Titel\n\nAbsatz eins.\n\n---\n\nAbsatz nach Trennlinie mit `code`.'

const MARKDOWN = [
  '---',
  'title: "Bericht"',
  'custom_note: "handgeschrieben, unbekanntes Feld"',
  'pages: 2',
  '---',
  '',
  BODY,
].join('\n')

describe('patchFrontmatter — Erhalt (Contract §4.2)', () => {
  it('erhaelt unbekannte Felder und den Body beim Patchen einzelner Felder', () => {
    const patched = patchFrontmatter(MARKDOWN, { twin_status: 'stable', verified_by: 'human:peter' })
    const { meta, body } = parseFrontmatter(patched)
    expect(meta.twin_status).toBe('stable')
    expect(meta.verified_by).toBe('human:peter')
    // Unbekannte/typisierte Felder bleiben unveraendert
    expect(meta.title).toBe('Bericht')
    expect(meta.custom_note).toBe('handgeschrieben, unbekanntes Feld')
    expect(meta.pages).toBe(2)
    expect(body.trim()).toBe(BODY.trim())
  })

  it('entfernt Felder nur explizit (undefined/null), nie still', () => {
    const patched = patchFrontmatter(MARKDOWN, { custom_note: undefined })
    const { meta } = parseFrontmatter(patched)
    expect(meta.custom_note).toBeUndefined()
    expect(meta.title).toBe('Bericht')
  })

  it('legt bei Markdown ohne Frontmatter einen Block an, ohne den Body anzutasten', () => {
    const patched = patchFrontmatter(BODY, { twin_status: 'draft' })
    const { meta, body } = parseFrontmatter(patched)
    expect(meta.twin_status).toBe('draft')
    expect(body.trim()).toBe(BODY.trim())
  })
})
