import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { selectSiblingArtifactFiles } from '@/lib/shadow-twin/shadow-twin-migration-writer'
import { baueVerweisMarkdown, verweisDateiName, type VerweisAngaben } from '@/lib/shadow-twin/verweis-datei'
import type { StorageItem } from '@/lib/storage/types'

const KENNUNG = { sourceContentHash: 'a'.repeat(64), sourceSize: 3, sourceHashedAt: '2026-10-13T12:00:00.000Z' }

function angaben(ueber: Partial<VerweisAngaben> = {}): VerweisAngaben {
  return {
    sourceName: 'Flyer.pdf', nachLibraryId: 'lib-neu', nachLibraryName: 'Dachverband Neuaufbau',
    nachPfad: 'events/Journalisten Schulung/Flyer.pdf', adresse: '@dv-neu/events/Journalisten Schulung/Flyer.pdf',
    herkunft: 'behalten', quellkennung: KENNUNG, jetzt: '2026-10-13T12:00:00.000Z', ...ueber,
  }
}

function item(id: string, name: string): StorageItem {
  return { id, type: 'file', parentId: 'p', metadata: { name, size: 1, mimeType: name.endsWith('.md') ? 'text/markdown' : 'application/pdf' } } as unknown as StorageItem
}

describe('verweisDateiName', () => {
  it('beginnt NICHT mit dem Stamm der Quelle — sonst liest der Import sie als Twin-Artefakt', () => {
    const quelle = item('q', 'Flyer.pdf')
    const verweis = item('v', verweisDateiName('Flyer.pdf'))
    const legacy = item('l', 'Flyer.de.md')
    expect(verweis.metadata.name).toBe('Verweis – Flyer.pdf.md')
    expect(selectSiblingArtifactFiles(quelle, [quelle, verweis, legacy]).map((i) => i.id)).toEqual(['l'])
  })

  it('weist einen leeren Quellnamen ab', () => {
    expect(() => verweisDateiName('  ')).toThrow(/leer/)
  })
})

describe('baueVerweisMarkdown', () => {
  it('schreibt flaches Frontmatter mit Adresse und den Link [[@slug/pfad]]', () => {
    const md = baueVerweisMarkdown(angaben())
    const { meta } = parseFrontmatter(md)
    expect(meta).toMatchObject({
      type: 'verweis', source_file: 'Flyer.pdf', uebergeben_nach_library: 'Dachverband Neuaufbau',
      uebergeben_nach_adresse: '@dv-neu/events/Journalisten Schulung/Flyer.pdf', uebergeben_am: '2026-10-13',
      herkunft: 'behalten', source_content_hash: 'a'.repeat(64), generated_by: 'knowledgescout/familie_uebergeben',
    })
    expect(meta).not.toHaveProperty('uebergeben_nach_library_id')
    expect(Object.values(meta ?? {}).every((wert) => typeof wert !== 'object')).toBe(true)
    expect(md).toContain('[[@dv-neu/events/Journalisten Schulung/Flyer.pdf|Flyer.pdf]]')
  })

  it('nennt ohne Slug die Library-Id als Rueckfallebene und sagt, was fehlt', () => {
    const md = baueVerweisMarkdown(angaben({ adresse: null, herkunft: 'verwerfen' }))
    const { meta } = parseFrontmatter(md)
    expect(meta).toMatchObject({ uebergeben_nach_library_id: 'lib-neu', herkunft: 'verwerfen' })
    expect(md).toContain('adresse_setzen')
    expect(md).toContain('„zu klären"')
  })
})

describe('checkBegleitKern — type: verweis', () => {
  it('verlangt generated_by/at auch bei verweis, und die erzeugte Datei erfuellt es', async () => {
    const { checkBegleitKern } = await import('@/lib/agent-view/verlauf-regel')
    const folder = {
      folderId: 'f', name: 'Ereignis', path: 'Ereignis', parentFolderId: null, depth: 1,
      files: [], twinFolders: [], index: null, bericht: null, bearbeitungsstand: null, bearbeitungsstandSeit: null,
    }
    const doc = (meta: Record<string, unknown>) => ({
      fileId: 'v', name: 'Verweis – Flyer.pdf.md', path: 'Ereignis/Verweis – Flyer.pdf.md', modifiedAt: null, meta, body: '',
    })
    const ohne = checkBegleitKern(folder, [doc({ type: 'verweis' })])
    expect(ohne.map((g) => g.detail)).toEqual(['generated_by, generated_at'])
    const erzeugt = parseFrontmatter(baueVerweisMarkdown(angaben())).meta ?? {}
    expect(checkBegleitKern(folder, [doc(erzeugt)])).toEqual([])
  })
})
