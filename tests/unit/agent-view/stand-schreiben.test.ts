/**
 * @fileoverview Unit-Tests: Stand-Schreiben (F8, Welle W7) an den Ports.
 *
 * Geprueft wird die §F8-Reihenfolge der Schutzstufen (bei Befund wird NICHTS
 * geschrieben, der Teilbaum-Scan laeuft NUR fuer die unbestaetigte Abnahme),
 * der Erhalt von Body + unbekannten Frontmatter-Feldern beim Patch und der
 * Wiederherstellungs-Pfad, wenn der Upload nach dem Loeschen scheitert —
 * `_INDEX.md` ist Menschen-Inhalt, kein Derivat.
 */

import { describe, it, expect, vi } from 'vitest'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { OrdnerNichtGefundenError } from '@/lib/agent-view/bericht-laden'
import { KeinIndexError, NichtBereitError, ReportVeraltetError, StandGeaendertError } from '@/lib/agent-view/stand-plan'
import { setzeStand, type StandSchreibenPorts } from '@/lib/agent-view/stand-schreiben'
import { StorageError, type StorageItem } from '@/lib/storage/types'
import type { CoverageGap } from '@/lib/agent-view/types'

const INDEX_MD = [
  '---',
  'bearbeitungsstand: berichtet',
  'bearbeitungsstand_seit: 2026-08-18',
  'projekt: Pilotprojekt Klima',
  '---',
  '',
  '# Pilot',
  '',
  'Handgeschriebener Inhalt bleibt.',
].join('\n')

function item(name: string): StorageItem {
  return {
    id: `id-${name}`, parentId: 'f-pilot', type: 'file',
    metadata: { name, size: INDEX_MD.length, modifiedAt: new Date('2026-08-20T10:00:00.000Z'), mimeType: 'text/markdown' },
  }
}

function maschinenGap(severity: CoverageGap['severity'] = 'error'): CoverageGap {
  return {
    type: 'report_missing', actor: 'cowork', zyklusSchritt: 3, severity, scope: 'folder',
    targetId: 'f-pilot', targetName: 'Pilot', folderId: 'f-pilot', path: '1. Arbeit/Pilot', message: 'Test',
  }
}

function fakePorts(overrides: Partial<{ [K in keyof StandSchreibenPorts]: ReturnType<typeof vi.fn> }> = {}) {
  return {
    listFolder: overrides.listFolder ?? vi.fn().mockResolvedValue([item('_INDEX.md'), item('BERICHT.md')]),
    readText: overrides.readText ?? vi.fn().mockResolvedValue(INDEX_MD),
    deleteFile: overrides.deleteFile ?? vi.fn().mockResolvedValue(undefined),
    uploadMarkdown: overrides.uploadMarkdown ?? vi.fn().mockResolvedValue({ fileId: 'id-neu' }),
  }
}

const REQUEST = {
  folderId: 'f-pilot', stand: 'abgenommen', erwarteterStand: 'berichtet',
  reportGeneratedAt: 'G1', bestaetigen: false,
} as const

function args(overrides: Partial<Parameters<typeof setzeStand>[0]> = {}) {
  return {
    request: { ...REQUEST },
    gespeicherterGeneratedAt: 'G1',
    scanTeilbaum: vi.fn().mockResolvedValue([]),
    now: () => '2026-08-24T09:30:00.000Z',
    ...overrides,
  }
}

describe('setzeStand — Schutzstufen in §F8-Reihenfolge', () => {
  it('unbekannter Ordner wird zum benannten 404-Fehler', async () => {
    const ports = fakePorts({ listFolder: vi.fn().mockRejectedValue(new StorageError('weg', 'FILE_NOT_FOUND')) })
    await expect(setzeStand(args(), ports)).rejects.toBeInstanceOf(OrdnerNichtGefundenError)
  })

  it('Stufe 1: ohne _INDEX.md wirft kein_index — gelesen/geschrieben wird nichts', async () => {
    const ports = fakePorts({ listFolder: vi.fn().mockResolvedValue([item('BERICHT.md')]) })
    await expect(setzeStand(args(), ports)).rejects.toBeInstanceOf(KeinIndexError)
    expect(ports.readText).not.toHaveBeenCalled()
    expect(ports.deleteFile).not.toHaveBeenCalled()
  })

  it('Stufe 2: fremder Storage-Stand wirft stand_geaendert mit dem aktuellen Stand', async () => {
    const ports = fakePorts()
    const a = args({ request: { ...REQUEST, erwarteterStand: 'erschlossen' } })
    await expect(setzeStand(a, ports)).rejects.toSatisfy(
      (e) => e instanceof StandGeaendertError && e.aktuellerStand === 'berichtet',
    )
    expect(ports.deleteFile).not.toHaveBeenCalled()
  })

  it('Stufe 3 kommt VOR dem Scan: veralteter Report wirft, ohne Stufe 4 zu rechnen', async () => {
    const ports = fakePorts()
    const a = args({ gespeicherterGeneratedAt: 'G2' })
    await expect(setzeStand(a, ports)).rejects.toBeInstanceOf(ReportVeraltetError)
    expect(a.scanTeilbaum).not.toHaveBeenCalled()
  })

  it('Stufe 4 blockiert die Abnahme bei frischen Maschinen-Befunden — nichts geloescht', async () => {
    const ports = fakePorts()
    const a = args({ scanTeilbaum: vi.fn().mockResolvedValue([maschinenGap('warning')]) })
    await expect(setzeStand(a, ports)).rejects.toBeInstanceOf(NichtBereitError)
    expect(ports.deleteFile).not.toHaveBeenCalled()
  })

  it('Zurueckstufen und Bestaetigen rechnen KEINEN Scan (reine Selbstauskunft)', async () => {
    const zurueck = args({ request: { ...REQUEST, stand: 'strukturiert' } })
    await setzeStand(zurueck, fakePorts())
    expect(zurueck.scanTeilbaum).not.toHaveBeenCalled()

    const bestaetigt = args({ request: { ...REQUEST, stand: 'berichtet', bestaetigen: true } })
    await setzeStand(bestaetigt, fakePorts())
    expect(bestaetigt.scanTeilbaum).not.toHaveBeenCalled()
  })
})

describe('setzeStand — Schreiben', () => {
  it('patcht NUR die zwei Stand-Felder, erhaelt Body + fremde Felder, ersetzt die Datei', async () => {
    const ports = fakePorts()
    const ergebnis = await setzeStand(args(), ports)

    expect(ports.deleteFile).toHaveBeenCalledWith('id-_INDEX.md')
    expect(ports.uploadMarkdown).toHaveBeenCalledTimes(1)
    const [folderId, name, content] = ports.uploadMarkdown.mock.calls[0]
    expect(folderId).toBe('f-pilot')
    expect(name).toBe('_INDEX.md')
    const { meta, body } = parseFrontmatter(content)
    expect(meta.bearbeitungsstand).toBe('abgenommen')
    expect(String(meta.bearbeitungsstand_seit)).toBe('2026-08-24')
    expect(meta.projekt).toBe('Pilotprojekt Klima')
    expect(body).toContain('Handgeschriebener Inhalt bleibt.')

    // Antwort wie der Reader liest: Datum grosszuegig als Tagesende.
    expect(ergebnis).toEqual({ bearbeitungsstand: 'abgenommen', bearbeitungsstandSeit: '2026-08-24T23:59:59.999Z' })
  })

  it('stellt bei Upload-Fehler das Original wieder her und meldet beides laut', async () => {
    const uploadMarkdown = vi.fn()
      .mockRejectedValueOnce(new Error('Netz weg'))
      .mockResolvedValueOnce({ fileId: 'id-restore' })
    const ports = fakePorts({ uploadMarkdown })
    await expect(setzeStand(args(), ports)).rejects.toThrow(/Netz weg.*wiederhergestellt/)
    expect(uploadMarkdown.mock.calls[1][2]).toBe(INDEX_MD)
  })

  it('benennt den Datenverlust, wenn auch die Wiederherstellung scheitert', async () => {
    const uploadMarkdown = vi.fn().mockRejectedValue(new Error('Netz weg'))
    const ports = fakePorts({ uploadMarkdown })
    await expect(setzeStand(args(), ports)).rejects.toThrow(/_INDEX\.md fehlt jetzt/)
  })
})
