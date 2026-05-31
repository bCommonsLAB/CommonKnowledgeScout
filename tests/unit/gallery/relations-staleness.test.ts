import { describe, it, expect } from 'vitest'
import { computeCatalogHash } from '@/lib/gallery/relations-staleness'

describe('computeCatalogHash — Staleness über den Katalog-Stand', () => {
  it('ist reihenfolge-unabhängig (sortiert intern)', () => {
    const a = computeCatalogHash([
      { fileId: 'f1', updatedAt: '2026-01-01' },
      { fileId: 'f2', updatedAt: '2026-01-02' },
    ])
    const b = computeCatalogHash([
      { fileId: 'f2', updatedAt: '2026-01-02' },
      { fileId: 'f1', updatedAt: '2026-01-01' },
    ])
    expect(a).toBe(b)
  })

  it('ändert sich, wenn ein Dokument geändert wurde (neuer updatedAt)', () => {
    const before = computeCatalogHash([{ fileId: 'f1', updatedAt: '2026-01-01' }])
    const after = computeCatalogHash([{ fileId: 'f1', updatedAt: '2026-02-01' }])
    expect(before).not.toBe(after)
  })

  it('ändert sich, wenn ein Dokument hinzukommt oder wegfällt', () => {
    const one = computeCatalogHash([{ fileId: 'f1', updatedAt: 'x' }])
    const two = computeCatalogHash([
      { fileId: 'f1', updatedAt: 'x' },
      { fileId: 'f2', updatedAt: 'y' },
    ])
    expect(one).not.toBe(two)
  })

  it('behandelt fehlenden updatedAt deterministisch (leerer Stempel)', () => {
    const a = computeCatalogHash([{ fileId: 'f1' }])
    const b = computeCatalogHash([{ fileId: 'f1', updatedAt: '' }])
    expect(a).toBe(b)
  })
})
