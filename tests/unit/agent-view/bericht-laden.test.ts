/**
 * @fileoverview Unit-Tests: Bericht-Laden (F9, Werkbank W2).
 *
 * Die §F9-Semantik als Vertrag: `kein_bericht` und `zu_gross` sind benannte
 * Domaenenzustaende (kein Fehler), unbekannte Ordner werfen typisiert, der
 * `kopf` kommt aus den vorhandenen Lesern (kein zweiter Parser) und das
 * Not-Found-Mapping kennt die Signale der drei Backends explizit.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  istStorageNotFound,
  ladeBericht,
  OrdnerNichtGefundenError,
  type BerichtLadenPorts,
} from '@/lib/agent-view/bericht-laden'
import { MAX_DOC_BYTES } from '@/lib/agent-view/archive-scan-readers'
import { StorageError, type StorageItem } from '@/lib/storage/types'

function item(name: string, overrides: Partial<StorageItem['metadata']> & { type?: StorageItem['type']; id?: string } = {}): StorageItem {
  const { type, id, ...metadata } = overrides
  return {
    id: id ?? `id-${name}`,
    parentId: 'f-1',
    type: type ?? 'file',
    metadata: {
      name,
      size: 100,
      modifiedAt: new Date('2026-08-21T07:30:00.000Z'),
      mimeType: 'text/markdown',
      ...metadata,
    },
  }
}

function ports(items: StorageItem[], text = ''): BerichtLadenPorts & { readText: ReturnType<typeof vi.fn> } {
  return {
    listFolder: vi.fn().mockResolvedValue(items),
    readText: vi.fn().mockResolvedValue(text),
  }
}

const BERICHT = `---\nstatus: aktiv\nthemen: [Commoning]\n---\n# Pilotprojekt Klima\n\nKurzbeschreibung des Vorhabens.\n\n## Nächste Schritte\n\n- [ ] Bericht pruefen\n- [x] Quellen sichten\n`

describe('ladeBericht', () => {
  it('liefert Body ohne Frontmatter und den serverseitig geparsten kopf', async () => {
    const p = ports([item('BERICHT.md', { id: 'id-b1' })], BERICHT)
    const antwort = await ladeBericht('f-1', p)
    expect(antwort.grund).toBeUndefined()
    expect(antwort.bericht).toMatchObject({
      fileId: 'id-b1',
      name: 'BERICHT.md',
      modifiedAt: '2026-08-21T07:30:00.000Z',
      sizeBytes: 100,
    })
    expect(antwort.bericht?.body).not.toContain('status: aktiv')
    expect(antwort.bericht?.body).toContain('# Pilotprojekt Klima')
    expect(antwort.bericht?.kopf).toEqual({
      titel: 'Pilotprojekt Klima',
      ersterAbsatz: 'Kurzbeschreibung des Vorhabens.',
      offenePunkte: ['Bericht pruefen'],
    })
  })

  it('benennt Ordner ohne BERICHT.md als kein_bericht — und laedt nichts', async () => {
    const p = ports([item('_INDEX.md'), item('Notizen.md')])
    expect(await ladeBericht('f-1', p)).toEqual({ bericht: null, grund: 'kein_bericht' })
    expect(p.readText).not.toHaveBeenCalled()
  })

  it('matcht EXAKT wie der Scan: bericht.md (klein) und ein Ordner BERICHT.md zaehlen nicht', async () => {
    const p = ports([item('bericht.md'), item('BERICHT.md', { type: 'folder' })])
    expect((await ladeBericht('f-1', p)).grund).toBe('kein_bericht')
  })

  it('verweigert den Body ueber dem Budget (zu_gross) OHNE die Datei zu laden', async () => {
    const p = ports([item('BERICHT.md', { size: MAX_DOC_BYTES + 1 })])
    const antwort = await ladeBericht('f-1', p)
    expect(antwort.grund).toBe('zu_gross')
    expect(antwort.bericht).toMatchObject({ sizeBytes: MAX_DOC_BYTES + 1, body: null, kopf: null })
    expect(p.readText).not.toHaveBeenCalled()
  })

  it('misst nach dem Laden nach: luegende Provider-Groesse wird zu_gross mit echter Groesse', async () => {
    const riesig = 'x'.repeat(MAX_DOC_BYTES + 1)
    const p = ports([item('BERICHT.md', { size: 5 })], riesig)
    const antwort = await ladeBericht('f-1', p)
    expect(antwort.grund).toBe('zu_gross')
    expect(antwort.bericht?.sizeBytes).toBe(MAX_DOC_BYTES + 1)
    expect(antwort.bericht?.body).toBeNull()
  })

  it('wirft OrdnerNichtGefundenError bei Not-Found-Signal, reicht andere Fehler durch', async () => {
    const notFound: BerichtLadenPorts = {
      listFolder: vi.fn().mockRejectedValue(new StorageError('weg', 'NOT_FOUND', 'onedrive')),
      readText: vi.fn(),
    }
    await expect(ladeBericht('f-x', notFound)).rejects.toBeInstanceOf(OrdnerNichtGefundenError)

    const authError = new StorageError('kein Token', 'AUTH_ERROR', 'onedrive')
    const kaputt: BerichtLadenPorts = {
      listFolder: vi.fn().mockRejectedValue(authError),
      readText: vi.fn(),
    }
    await expect(ladeBericht('f-x', kaputt)).rejects.toBe(authError)
  })
})

describe('istStorageNotFound', () => {
  it('kennt die Not-Found-Signale der drei Backends explizit', () => {
    expect(istStorageNotFound(new StorageError('x', 'NOT_FOUND', 'onedrive'))).toBe(true)
    expect(istStorageNotFound(new StorageError('x', 'FILE_NOT_FOUND', 'filesystem'))).toBe(true)
    expect(istStorageNotFound(new StorageError('x', 'FOLDER_NOT_FOUND', 'filesystem'))).toBe(true)
    expect(istStorageNotFound({ status: 404 })).toBe(true)
  })

  it('verkleidet andere Fehler NICHT als 404', () => {
    expect(istStorageNotFound(new StorageError('x', 'AUTH_ERROR', 'onedrive'))).toBe(false)
    expect(istStorageNotFound(new StorageError('x', 'UNKNOWN', 'p'))).toBe(false)
    expect(istStorageNotFound({ status: 500 })).toBe(false)
    expect(istStorageNotFound(new Error('irgendwas'))).toBe(false)
    expect(istStorageNotFound(null)).toBe(false)
  })
})

describe('ladeBericht — datei=index (A3, Ordner-Beschreibung)', () => {
  it('liest den _INDEX.md statt des BERICHT.md', async () => {
    const p = ports([item('BERICHT.md'), item('_INDEX.md')], '# Ordner-Beschreibung\n\nSelbstdeklaration.')
    const antwort = await ladeBericht('f-1', p, 'index')
    expect(antwort.bericht?.name).toBe('_INDEX.md')
    expect(p.readText).toHaveBeenCalledWith('id-_INDEX.md')
    expect(antwort.bericht?.kopf?.titel).toBe('Ordner-Beschreibung')
  })

  it('fehlender _INDEX.md ist der benannte Zustand kein_bericht, kein Fehler', async () => {
    const antwort = await ladeBericht('f-1', ports([item('BERICHT.md')]), 'index')
    expect(antwort).toEqual({ bericht: null, grund: 'kein_bericht' })
  })
})
