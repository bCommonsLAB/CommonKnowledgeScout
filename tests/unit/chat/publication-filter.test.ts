/**
 * @fileoverview Unit-Tests fuer publication-filter Helper.
 *
 * Getestet wird ausschliesslich das pure Filter-Fragment (`publicationVisibilityFilter`).
 * `canSeeDrafts` und `maybePublicationFilter` rufen `isModeratorOrOwner` auf,
 * das wiederum auf den `LibraryService` zugreift – das ist Integrationsumfang
 * und wird ueber die manuelle E2E-Sequenz abgedeckt, nicht hier.
 *
 * Wichtigster invarianter Check:
 *  - Das Fragment muss `$ne: 'draft'` verwenden, NICHT `'published'` oder
 *    eine Whitelist. Sonst wuerden Bestandsdokumente OHNE
 *    `publication.status` faelschlich rausgefiltert (lax/backwards-compatible
 *    Anforderung).
 */

import { describe, expect, test } from 'vitest'
import { publicationVisibilityFilter } from '@/lib/chat/publication-filter'

describe('publicationVisibilityFilter', () => {
  test('liefert ein Filter-Fragment auf docMetaJson.publication.status', () => {
    const f = publicationVisibilityFilter()
    expect(f).toHaveProperty('docMetaJson.publication.status')
  })

  test('verwendet $ne: "draft" – damit fehlende Felder NICHT gefiltert werden', () => {
    const f = publicationVisibilityFilter() as Record<
      string,
      { $ne?: unknown }
    >
    const condition = f['docMetaJson.publication.status']
    expect(condition).toBeDefined()
    expect(condition.$ne).toBe('draft')
    // Negative-Assertion: keine Whitelist via $eq oder $in, sonst kippt die
    // Backwards-Compat-Regel.
    expect(condition).not.toHaveProperty('$eq')
    expect(condition).not.toHaveProperty('$in')
  })

  test('liefert bei jedem Aufruf eine neue Objekt-Instanz (no shared mutation)', () => {
    const a = publicationVisibilityFilter()
    const b = publicationVisibilityFilter()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })
})
