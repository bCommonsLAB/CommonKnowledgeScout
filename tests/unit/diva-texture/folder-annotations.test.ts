import { describe, expect, it } from 'vitest'
import { buildLiveFolderAnnotations } from '@/lib/diva-texture/folder-annotations'
import type { SupplierEntry } from '@/lib/diva-texture/types'

const ENTRY: SupplierEntry = {
  key: 'OPV1008_LIGHT_BLUE',
  entry: {
    IsTexture: 'True',
    PFTFile: '1008_light_blue',
    TextureName: '1008_light_blue',
    Name: '1008 light blue',
    GroupName: '',
    OPVGroupName: 'PERLA-Kollektion (Stoff)',
    Material: 'STOFF',
  },
}

describe('buildLiveFolderAnnotations', () => {
  it('annotiert nur Basecolor-Dateien, keine anderen Maps', () => {
    const annotations = buildLiveFolderAnnotations(
      [
        { id: '1', name: '1008_light_blue_basecolor.jpg' },
        { id: '2', name: '1008_light_blue_normal.jpg' },
        { id: '3', name: '1008_light_blue_roughness.jpg' },
        { id: '4', name: 'other_thing_basecolor.jpg' },
      ],
      [ENTRY],
    )
    expect(annotations).toHaveLength(1)
    expect(annotations[0].fileName).toBe('1008_light_blue_basecolor.jpg')
    expect(annotations[0].itemKey).toBe('1008_light_blue')
    expect(annotations[0].attributes.opv_group_name).toBe('PERLA-Kollektion (Stoff)')
    expect(annotations[0].attributes.textur_name).toBe('1008 light blue')
  })

  it('gibt leere Liste zurueck, wenn keine Sidecar-Eintraege da sind', () => {
    expect(
      buildLiveFolderAnnotations([{ id: '1', name: '1008_light_blue_basecolor.jpg' }], []),
    ).toEqual([])
  })
})
