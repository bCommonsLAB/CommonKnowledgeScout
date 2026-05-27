/**
 * Tests fuer src/lib/diva-texture/preprocess-folder.ts (Performance-Welle).
 *
 * Deckt Basecolor-Erkennung + die Ordner-Planung ab: Treffer, Basecolor ohne
 * Treffer, Ignorieren von Nicht-Basecolor-Maps, Sidecar-Eintraege ohne Datei.
 */

import { describe, expect, it } from 'vitest'
import {
  isBasecolorFileName,
  buildFolderPreprocessPlan,
  type PreprocessFile,
} from '@/lib/diva-texture/preprocess-folder'
import type { SupplierEntry } from '@/lib/diva-texture/types'

describe('isBasecolorFileName', () => {
  it('erkennt Basecolor-/Albedo-Maps', () => {
    expect(isBasecolorFileName('3_ST_2031_0332_basecolor.jpg')).toBe(true)
    expect(isBasecolorFileName('x_base_color.png')).toBe(true)
    expect(isBasecolorFileName('y-albedo.jpg')).toBe(true)
    expect(isBasecolorFileName('z_diffuse.jpg')).toBe(true)
    expect(isBasecolorFileName('w_color.jpg')).toBe(true)
  })

  it('lehnt andere PBR-Maps + normale Dateien ab', () => {
    expect(isBasecolorFileName('3_ST_2031_0332_normal.jpg')).toBe(false)
    expect(isBasecolorFileName('3_ST_2031_0332_roughness.jpg')).toBe(false)
    expect(isBasecolorFileName('3_ST_2031_0332_metallic.jpg')).toBe(false)
    expect(isBasecolorFileName('readme.txt')).toBe(false)
  })
})

function entry(key: string, vcodex: string): SupplierEntry {
  return { key, entry: { VCodex: vcodex, IsTexture: 'True', Material: 'STOFF' } }
}

describe('buildFolderPreprocessPlan', () => {
  const entries: SupplierEntry[] = [
    entry('OPV_A', 'ST_2031-0332'),
    entry('OPV_B', 'ST_9999-0001'), // kein File dazu → unmatchedEntry
  ]

  const files: PreprocessFile[] = [
    { id: 'f1', name: '3_ST_2031_0332_basecolor.jpg' }, // matcht OPV_A
    { id: 'f2', name: '3_ST_2031_0332_normal.jpg' }, // Nicht-Basecolor → ignoriert
    { id: 'f3', name: '3_ST_2031_0332_roughness.jpg' }, // ignoriert
    { id: 'f4', name: '5_UNKNOWN_0000_basecolor.jpg' }, // Basecolor ohne Treffer
  ]

  it('matcht nur Basecolor-Dateien und ignoriert andere Maps', () => {
    const plan = buildFolderPreprocessPlan(files, entries)
    expect(plan.basecolorFileCount).toBe(2)
    expect(plan.matches).toHaveLength(1)
    expect(plan.matches[0]!.file.id).toBe('f1')
    expect(plan.matches[0]!.entry.VCodex).toBe('ST_2031-0332')
    expect(plan.matches[0]!.entryKey).toBe('OPV_A')
  })

  it('sammelt Basecolor-Dateien ohne Treffer', () => {
    const plan = buildFolderPreprocessPlan(files, entries)
    expect(plan.unmatchedFiles.map((f) => f.id)).toEqual(['f4'])
  })

  it('sammelt Sidecar-Eintraege ohne passende Datei', () => {
    const plan = buildFolderPreprocessPlan(files, entries)
    expect(plan.unmatchedEntries.map((e) => e.key)).toEqual(['OPV_B'])
  })

  it('leerer Ordner → leerer Plan', () => {
    const plan = buildFolderPreprocessPlan([], entries)
    expect(plan.matches).toHaveLength(0)
    expect(plan.basecolorFileCount).toBe(0)
    expect(plan.unmatchedEntries).toHaveLength(2)
  })
})
