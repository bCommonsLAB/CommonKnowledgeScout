/**
 * @fileoverview Unit-Tests für electron/stream-resolver.js (SharePoint stream.aspx)
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { parseStreamAspxUrl } = require('../../../electron/stream-resolver.js') as {
  parseStreamAspxUrl: (u: string) => {
    hostname: string
    serverRelativePath: string
    graphRootPath: string
  }
}

describe('parseStreamAspxUrl', () => {
  it('parst typische Teams-Recording-URL und liefert Graph-Pfad unter Documents/', () => {
    const url =
      'https://crystaldesign-my.sharepoint.com/personal/fritz_aichner_crystal-design_com/_layouts/15/stream.aspx?id=%2Fpersonal%2Ffritz%5Faichner%5Fcrystal%2Ddesign%5Fcom%2FDocuments%2FRecordings%2FDIVA%20Governance%20M%C3%A4rz%2D20260316%5F091506%2DBesprechungsaufzeichnung%2Emp4'
    const r = parseStreamAspxUrl(url)
    expect(r.hostname).toBe('crystaldesign-my.sharepoint.com')
    expect(r.serverRelativePath).toContain('/Documents/Recordings/')
    expect(r.graphRootPath).toBe(
      'Documents/Recordings/DIVA Governance März-20260316_091506-Besprechungsaufzeichnung.mp4'
    )
  })

  it('wirft bei fehlendem id-Parameter', () => {
    expect(() =>
      parseStreamAspxUrl(
        'https://tenant-my.sharepoint.com/personal/x/_layouts/15/stream.aspx'
      )
    ).toThrow(/missing_id/)
  })

  it('wirft bei nicht-Documents-Pfad', () => {
    expect(() =>
      parseStreamAspxUrl(
        'https://tenant-my.sharepoint.com/x/_layouts/15/stream.aspx?id=%2Fpersonal%2Fa%2FOther%2Ffile.mp4'
      )
    ).toThrow(/unknown_path_pattern/)
  })
})
