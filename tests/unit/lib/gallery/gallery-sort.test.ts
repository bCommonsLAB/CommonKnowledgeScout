/**
 * Tests fuer die Default-Sortierung der Galerie (buildGallerySort):
 * URL-Sorts (stars/rating) haben Vorrang, konfigurierte Default-Sortierung
 * (defaultSortField/-Direction) greift sonst, unbekannte Felder fallen laut
 * auf den Standard zurueck.
 */
import { describe, it, expect, vi } from 'vitest'
import { buildGallerySort } from '@/lib/gallery/gallery-sort'

const DEFS = [{ metaKey: 'date' }, { metaKey: 'year' }, { metaKey: 'event' }]

describe('buildGallerySort', () => {
  it('Standard ohne Config: year + upsertedAt absteigend', () => {
    expect(buildGallerySort({ rawSort: null, isMember: false, facetDefs: DEFS })).toEqual({
      year: -1,
      upsertedAt: -1,
    })
  })

  it('sort=stars nur fuer Member', () => {
    expect(buildGallerySort({ rawSort: 'stars', isMember: true, facetDefs: DEFS })).toEqual({
      favoriteCount: -1,
      year: -1,
      upsertedAt: -1,
    })
    // Gaeste: kein stars-Sort (Default), auch mit konfigurierter Sortierung.
    expect(buildGallerySort({ rawSort: 'stars', isMember: false, facetDefs: DEFS })).toEqual({
      year: -1,
      upsertedAt: -1,
    })
  })

  it('sort=rating ist oeffentlich und hat Vorrang vor der Config', () => {
    const result = buildGallerySort({
      rawSort: 'rating',
      isMember: false,
      config: { defaultSortField: 'date' },
      facetDefs: DEFS,
    })
    expect(result).toEqual({ 'docMetaJson.prioritaets_index': -1, year: -1, upsertedAt: -1 })
  })

  it('konfiguriertes Feld sortiert auf docMetaJson.<feld> (Default desc)', () => {
    const result = buildGallerySort({
      rawSort: null,
      isMember: false,
      config: { defaultSortField: 'date' },
      facetDefs: DEFS,
    })
    expect(result).toEqual({ 'docMetaJson.date': -1, upsertedAt: -1 })
  })

  it('Richtung asc wird uebernommen', () => {
    const result = buildGallerySort({
      rawSort: null,
      isMember: false,
      config: { defaultSortField: 'date', defaultSortDirection: 'asc' },
      facetDefs: DEFS,
    })
    expect(result).toEqual({ 'docMetaJson.date': 1, upsertedAt: -1 })
  })

  it('upsertedAt als Feld = Standard-Verhalten', () => {
    const result = buildGallerySort({
      rawSort: null,
      isMember: false,
      config: { defaultSortField: 'upsertedAt', defaultSortDirection: 'asc' },
      facetDefs: DEFS,
    })
    expect(result).toEqual({ year: -1, upsertedAt: -1 })
  })

  it('unbekanntes Feld: lauter Fallback auf Standard', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = buildGallerySort({
      rawSort: null,
      isMember: false,
      config: { defaultSortField: 'gibt_es_nicht' },
      facetDefs: DEFS,
    })
    expect(result).toEqual({ year: -1, upsertedAt: -1 })
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
