/**
 * Tests fuer src/lib/diva-texture/supplier-properties.ts (Performance-Welle).
 *
 * Deckt den puren Property-Builder + die Record-Extraktion ab (kein DB-Zugriff).
 */

import { describe, expect, it } from 'vitest'
import {
  buildDivaTextureProperties,
  toDivaTextureRecord,
  DIVA_PROPERTY_KEYS,
  DIVA_ATTRIBUTE_KEYS,
} from '@/lib/diva-texture/supplier-properties'
import type { ArchiveItemPropertiesDocument } from '@/lib/repositories/archive-item-properties-repo'
import type { OptionvalueEntry } from '@/lib/diva-texture/types'

const ENTRY: OptionvalueEntry = {
  VCodex: 'ST_2031-0332',
  IsTexture: 'True',
  Material: 'STOFF',
  GroupName: 'Feincord',
  Name: 'Feincord gold',
  RGB: 'C78E33',
}

const NOW = '2026-05-27T10:00:00.000Z'

function buildArgs() {
  return {
    entry: ENTRY,
    file: { id: 'f1', name: '3_ST_2031_0332_basecolor.jpg' },
    parentId: 'folder-1',
    sourceFile: 'api2_GetJsonOptionValues.json',
    strategy: 'pftfile-exact',
    now: NOW,
  }
}

describe('buildDivaTextureProperties', () => {
  it('erzeugt flache Properties + Snapshot (idempotent bei gesetztem now)', () => {
    const props = buildDivaTextureProperties(buildArgs())
    expect(props[DIVA_PROPERTY_KEYS.isTexture]).toBe(true)
    expect(props[DIVA_PROPERTY_KEYS.fileName]).toBe('3_ST_2031_0332_basecolor.jpg')
    expect(props[DIVA_PROPERTY_KEYS.fileId]).toBe('f1')
    expect(props[DIVA_PROPERTY_KEYS.parentId]).toBe('folder-1')
    expect(props[DIVA_PROPERTY_KEYS.strategy]).toBe('pftfile-exact')
    expect(props[DIVA_PROPERTY_KEYS.preprocessedAt]).toBe(NOW)
    expect(props[DIVA_PROPERTY_KEYS.snapshot]).toEqual({
      sourceFile: 'api2_GetJsonOptionValues.json',
      fetchedAt: NOW,
      entry: ENTRY,
    })
    // Idempotenz
    expect(buildDivaTextureProperties(buildArgs())).toEqual(props)
  })

  it('speichert flache, gruppier-/filterbare Attribute (snake_case)', () => {
    const props = buildDivaTextureProperties(buildArgs())
    expect(props[DIVA_ATTRIBUTE_KEYS.stoffgruppe]).toBe('Feincord')
    expect(props[DIVA_ATTRIBUTE_KEYS.material]).toBe('STOFF')
    expect(props[DIVA_ATTRIBUTE_KEYS.texturName]).toBe('Feincord gold')
    expect(props[DIVA_ATTRIBUTE_KEYS.farbeHex]).toBe('#C78E33') // Sidecar liefert ohne "#"
  })

  it('nimmt den optionalen sourceFileHash in den Snapshot auf', () => {
    const props = buildDivaTextureProperties({ ...buildArgs(), sourceFileHash: 'sha256:abc' })
    expect((props[DIVA_PROPERTY_KEYS.snapshot] as { sourceFileHash?: string }).sourceFileHash).toBe('sha256:abc')
  })
})

describe('toDivaTextureRecord', () => {
  function docFromProps(props: Record<string, unknown>, itemKey = ENTRY.VCodex): ArchiveItemPropertiesDocument {
    return { libraryId: 'lib', itemKey, properties: props, createdAt: NOW, updatedAt: NOW }
  }

  it('extrahiert den Laufzeit-Record inkl. Snapshot + generische Attribute', () => {
    const record = toDivaTextureRecord(docFromProps(buildDivaTextureProperties(buildArgs())))
    expect(record).not.toBeNull()
    expect(record!.vcodex).toBe('ST_2031-0332')
    expect(record!.fileName).toBe('3_ST_2031_0332_basecolor.jpg')
    expect(record!.fileId).toBe('f1')
    expect(record!.parentId).toBe('folder-1')
    expect(record!.snapshot?.entry.Name).toBe('Feincord gold')
    // attributes enthaelt die flachen Attribute + divaTexture, NICHT die internen Keys.
    expect(record!.attributes[DIVA_ATTRIBUTE_KEYS.stoffgruppe]).toBe('Feincord')
    expect(record!.attributes[DIVA_PROPERTY_KEYS.isTexture]).toBe(true)
    expect(record!.attributes[DIVA_PROPERTY_KEYS.fileId]).toBeUndefined()
    expect(record!.attributes[DIVA_PROPERTY_KEYS.snapshot]).toBeUndefined()
  })

  it('liefert null, wenn das Dokument keine DIVA-Textur ist', () => {
    expect(toDivaTextureRecord(docFromProps({ analysisSourceImage: 'basecolor' }))).toBeNull()
  })

  it('liefert snapshot=null bei beschaedigtem Snapshot, aber gueltigem Flag', () => {
    const record = toDivaTextureRecord(
      docFromProps({ [DIVA_PROPERTY_KEYS.isTexture]: true, [DIVA_PROPERTY_KEYS.fileName]: 'x_basecolor.jpg', [DIVA_PROPERTY_KEYS.snapshot]: { broken: true } }),
    )
    expect(record).not.toBeNull()
    expect(record!.snapshot).toBeNull()
    expect(record!.fileName).toBe('x_basecolor.jpg')
  })
})
