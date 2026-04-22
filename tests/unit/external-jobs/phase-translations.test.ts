/**
 * @fileoverview Unit-Tests fuer phase-translations Helpers.
 *
 * Getestet wird die pure Funktion `splitByScope`, die ein flaches Translation-
 * Resultat (z.B. ein uebersetztes `BookDetailData`-Objekt) anhand der Scope-
 * Definition aus dem ViewType-Registry in `gallery`- und `detail`-Sub-Maps
 * teilt. Diese Funktion ist die zentrale Stelle, an der entschieden wird,
 * welche Felder in welcher Translation-Sub-Map landen – Fehler hier wuerden
 * bedeuten, dass entweder die Galerie zu viele Daten laedt oder die Detail-
 * Ansicht Felder vermisst.
 */

import { describe, expect, test } from 'vitest'
import { splitByScope } from '@/lib/external-jobs/phase-translations'
import type { TranslatableSpec } from '@/lib/detail-view-types/registry'

/** Hilfs-Spec mit minimalen Feldern fuer den Galerie-Scope. */
const gallerySpec: TranslatableSpec = {
  text: [
    { key: 'title', scope: 'both' },
    { key: 'shortTitle', scope: 'gallery' },
  ],
  arrayOfText: [{ key: 'authors', scope: 'gallery' }],
  topicLike: [],
}

/** Hilfs-Spec mit zusaetzlichen Feldern fuer den Detail-Scope. */
const detailSpec: TranslatableSpec = {
  text: [
    { key: 'title', scope: 'both' },
    { key: 'summary', scope: 'detail' },
  ],
  arrayOfText: [{ key: 'speakers', scope: 'detail' }],
  topicLike: [],
}

describe('splitByScope', () => {
  test('verteilt Felder gemaess Scope-Definition', () => {
    const translated: Record<string, unknown> = {
      title: 'Titel DE',
      shortTitle: 'Kurz DE',
      summary: 'Zusammenfassung DE',
      authors: ['A. Mustermann'],
      speakers: ['B. Vortragender'],
    }
    const { gallery, detail } = splitByScope(translated, gallerySpec, detailSpec)

    expect(gallery).toEqual({
      title: 'Titel DE',
      shortTitle: 'Kurz DE',
      authors: ['A. Mustermann'],
    })
    expect(detail).toEqual({
      title: 'Titel DE',
      summary: 'Zusammenfassung DE',
      speakers: ['B. Vortragender'],
    })
  })

  test('ignoriert Felder, die nicht in der Spec stehen', () => {
    const translated: Record<string, unknown> = {
      title: 'Titel',
      randomField: 'wird verworfen',
    }
    const { gallery, detail } = splitByScope(translated, gallerySpec, detailSpec)
    // randomField darf in keiner Sub-Map landen.
    expect(gallery).not.toHaveProperty('randomField')
    expect(detail).not.toHaveProperty('randomField')
  })

  test('arrayOfText: ignoriert Nicht-Arrays (defensive)', () => {
    const translated: Record<string, unknown> = {
      authors: 'Single String statt Array',
    }
    const { gallery } = splitByScope(translated, gallerySpec, detailSpec)
    // Da `authors` kein Array ist, wird es uebersprungen.
    expect(gallery).not.toHaveProperty('authors')
  })

  test('leeres Translation-Objekt liefert leere Sub-Maps', () => {
    const { gallery, detail } = splitByScope({}, gallerySpec, detailSpec)
    expect(gallery).toEqual({})
    expect(detail).toEqual({})
  })
})
