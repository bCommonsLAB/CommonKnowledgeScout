/**
 * @fileoverview Unit-Tests: Themen-Schreiben ins _INDEX.md (Welle A6).
 *
 * Vertrag: Themen werden geprueft (leer/doppelt/mehrzeilig = benannter
 * Fehler, nichts geschrieben), zeilen-chirurgisch als JSON-Flow-Liste
 * gesetzt (fremde Zeilen Byte fuer Byte unveraendert), handgeschriebene
 * Block-Listen werden eingedampft statt Zeilen zu verwaisen, und die
 * Ruecklese-Pruefung bricht VOR dem Schreiben ab.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  eindampfeThemenBlockliste,
  pruefeThemen,
  setzeThemen,
  ThemaUngueltigError,
  ThemenWiderspruchError,
} from '@/lib/agent-view/themen-schreiben'
import { KeinIndexError } from '@/lib/agent-view/stand-plan'
import type { StandSchreibenPorts } from '@/lib/agent-view/stand-schreiben'
import type { StorageItem } from '@/lib/storage/types'

function indexItem(): StorageItem {
  return {
    id: 'id-index', parentId: 'f-1', type: 'file',
    metadata: { name: '_INDEX.md', size: 100, modifiedAt: new Date('2026-08-20T09:00:00.000Z'), mimeType: 'text/markdown' },
  }
}

function ports(markdown: string): StandSchreibenPorts & {
  readText: ReturnType<typeof vi.fn>
  deleteFile: ReturnType<typeof vi.fn>
  uploadMarkdown: ReturnType<typeof vi.fn>
} {
  return {
    listFolder: vi.fn().mockResolvedValue([indexItem()]),
    readText: vi.fn().mockResolvedValue(markdown),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    uploadMarkdown: vi.fn().mockResolvedValue({ fileId: 'id-neu' }),
    folderName: vi.fn().mockResolvedValue('26.01 Klima'),
  }
}

function hochgeladen(p: ReturnType<typeof ports>): string {
  return p.uploadMarkdown.mock.calls[0][2] as string
}

describe('pruefeThemen', () => {
  it('trimmt und weist Leeres, Doppeltes und Mehrzeiliges benannt zurueck', () => {
    expect(pruefeThemen([' Commoning ', 'KI'])).toEqual(['Commoning', 'KI'])
    expect(() => pruefeThemen([''])).toThrow(ThemaUngueltigError)
    expect(() => pruefeThemen(['A', 'A'])).toThrow(/Doppeltes Thema/)
    expect(() => pruefeThemen(['Zeile\nUmbruch'])).toThrow(/Zeilenumbruch/)
    expect(() => pruefeThemen(['A, B'])).toThrow(/Komma/)
  })
})

describe('eindampfeThemenBlockliste', () => {
  it('dampft eine Block-Liste unter themen: auf die nackte Zeile ein', () => {
    const markdown = '---\ntitel: X\nthemen:\n  - Alt A\n  - Alt B\nbearbeitungsstand: berichtet\n---\n\nBody.'
    expect(eindampfeThemenBlockliste(markdown)).toBe(
      '---\ntitel: X\nthemen:\nbearbeitungsstand: berichtet\n---\n\nBody.',
    )
  })

  it('laesst Dateien ohne Block-Liste unveraendert', () => {
    const markdown = '---\nthemen: [A]\n---\nBody.'
    expect(eindampfeThemenBlockliste(markdown)).toBe(markdown)
  })
})

describe('setzeThemen', () => {
  it('ersetzt eine bestehende themen-Zeile als Flow-Liste — fremde Zeilen unveraendert', async () => {
    const p = ports('---\ntitel: Klima  \nthemen: [Alt]\nbearbeitungsstand: berichtet\n---\n\nBody.')
    const ergebnis = await setzeThemen('f-1', ['Commoning', 'KI'], p)
    expect(ergebnis.themen).toEqual(['Commoning', 'KI'])
    expect(hochgeladen(p)).toBe(
      '---\ntitel: Klima  \nthemen: [Commoning, KI]\nbearbeitungsstand: berichtet\n---\n\nBody.',
    )
  })

  it('ersetzt eine handgeschriebene Block-Liste ohne verwaiste Zeilen', async () => {
    const p = ports('---\nthemen:\n  - Alt A\n  - Alt B\n---\nBody.')
    await setzeThemen('f-1', ['Neu'], p)
    expect(hochgeladen(p)).toBe('---\nthemen: [Neu]\n---\nBody.')
  })

  it('ergaenzt die Zeile, wenn das Feld fehlt; leere Liste schreibt []', async () => {
    const p = ports('---\nbearbeitungsstand: berichtet\n---\nBody.')
    await setzeThemen('f-1', [], p)
    expect(hochgeladen(p)).toBe('---\nbearbeitungsstand: berichtet\nthemen: []\n---\nBody.')
  })

  it('Themen mit Doppelpunkt und Umlauten ueberleben die Ruecklese-Pruefung', async () => {
    const p = ports('---\nthemen: []\n---\n')
    const ergebnis = await setzeThemen('f-1', ['Klima: Massnahmen fuer Suedtirol'], p)
    expect(ergebnis.themen).toEqual(['Klima: Massnahmen fuer Suedtirol'])
    expect(p.uploadMarkdown).toHaveBeenCalledTimes(1)
  })

  it('ohne _INDEX.md: KeinIndexError, nichts geloescht, nichts geschrieben', async () => {
    const p = ports('')
    ;(p.listFolder as ReturnType<typeof vi.fn>).mockResolvedValue([])
    await expect(setzeThemen('f-1', ['A'], p)).rejects.toThrow(KeinIndexError)
    expect(p.deleteFile).not.toHaveBeenCalled()
    expect(p.uploadMarkdown).not.toHaveBeenCalled()
  })

  it('unabgrenzbares Frontmatter bricht VOR dem Schreiben ab', async () => {
    const p = ports('---\nkaputt ohne Ende')
    await expect(setzeThemen('f-1', ['A'], p)).rejects.toThrow(/nicht eindeutig abgrenzbar/)
    expect(p.deleteFile).not.toHaveBeenCalled()
  })
})

describe('setzeThemen mit erwarteteThemen (Riegel der MCP-Bruecke)', () => {
  it('schreibt, wenn die gesehenen Themen dem Ist-Stand entsprechen', async () => {
    const p = ports('---\nthemen: [Alt A, Alt B]\n---\nBody.')
    await setzeThemen('f-1', ['Neu'], p, { erwarteteThemen: ['Alt A', 'Alt B'] })
    expect(hochgeladen(p)).toBe('---\nthemen: [Neu]\n---\nBody.')
  })

  it('null heisst: der Ordner deklariert keine Themen', async () => {
    const p = ports('---\nbearbeitungsstand: berichtet\n---\nBody.')
    await setzeThemen('f-1', ['Neu'], p, { erwarteteThemen: null })
    expect(hochgeladen(p)).toBe('---\nbearbeitungsstand: berichtet\nthemen: [Neu]\n---\nBody.')
  })

  it('abweichender Ist-Stand: ThemenWiderspruchError, nichts geschrieben', async () => {
    const p = ports('---\nthemen: [Konkurrent]\n---\nBody.')
    await expect(
      setzeThemen('f-1', ['Neu'], p, { erwarteteThemen: ['Alt A'] }),
    ).rejects.toThrow(ThemenWiderspruchError)
    expect(p.deleteFile).not.toHaveBeenCalled()
    expect(p.uploadMarkdown).not.toHaveBeenCalled()
  })

  it('erwartet null, aber der Ordner traegt Themen: Widerspruch', async () => {
    const p = ports('---\nthemen: [Konkurrent]\n---\nBody.')
    await expect(
      setzeThemen('f-1', ['Neu'], p, { erwarteteThemen: null }),
    ).rejects.toThrow(/traegt aktuell \[Konkurrent\]/)
    expect(p.uploadMarkdown).not.toHaveBeenCalled()
  })

  it('ohne Optionen greift kein Riegel (UI-Weg unveraendert)', async () => {
    const p = ports('---\nthemen: [Konkurrent]\n---\nBody.')
    await setzeThemen('f-1', ['Neu'], p)
    expect(hochgeladen(p)).toBe('---\nthemen: [Neu]\n---\nBody.')
  })
})
