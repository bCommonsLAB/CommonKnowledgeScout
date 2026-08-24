/**
 * @fileoverview Unit-Tests: unerschlossene Quellen aus dem Archiv-Scan (W1-Nachzug).
 *
 * Positiv- und Negativfall je Regel (Akzeptanzkriterium 2): Quell-Klassifikation
 * eng am Contract §1, Dedup gegen Engine-Zeilen und Mongo-Familien.
 */

import { describe, it, expect } from 'vitest'
import { filesWithoutExtension, isSourceFile, sourcesWithoutTwin } from '@/lib/agent-view/source-gaps'
import type { ArchiveFolderNode } from '@/lib/agent-view/archive-types'

function folder(files: Array<{ fileId: string; name: string }>): ArchiveFolderNode {
  return {
    folderId: 'f1', name: 'Projekt', path: 'Projekt', parentFolderId: 'root', depth: 1,
    files: files.map((file) => ({ ...file, path: `Projekt/${file.name}`, modifiedAt: null })),
    twinFolders: [], index: null, bericht: null,
    bearbeitungsstand: null, bearbeitungsstandSeit: null,
  }
}

describe('isSourceFile — was als Quelle zaehlt (Contract §1)', () => {
  it('PDF, DOCX, Audio und Video zaehlen', () => {
    expect(isSourceFile('Buch.pdf')).toBe(true)
    expect(isSourceFile('Protokoll.docx')).toBe(true)
    expect(isSourceFile('Aufnahme.m4a')).toBe(true)
    expect(isSourceFile('Vortrag.mp4')).toBe(true)
  })

  it('Notizen, Bilder und Unbekanntes zaehlen NICHT (sonst flutet jede Notiz den Report)', () => {
    expect(isSourceFile('Notiz.md')).toBe(false)
    expect(isSourceFile('_INDEX.md')).toBe(false)
    expect(isSourceFile('Foto.png')).toBe(false)
    expect(isSourceFile('Archiv.zip')).toBe(false)
    expect(isSourceFile('ohne-endung')).toBe(false)
  })
})

describe('sourcesWithoutTwin — die stille skippedWithoutDoc-Menge', () => {
  it('meldet eine Quelle, die weder Engine-Zeile noch Mongo-Familie hat (Positivfall)', () => {
    const gaps = sourcesWithoutTwin({
      folders: [folder([{ fileId: 's1', name: 'Buch.pdf' }])],
      engineSourceIds: new Set(),
      familySourceIds: new Set(),
    })
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({
      type: 'source_without_twin', targetId: 's1', folderId: 'f1', path: 'Projekt/Buch.pdf',
    })
  })

  it('ueberlaesst das Urteil der Engine bzw. Mongo, wenn die Quelle dort bekannt ist (Dedup)', () => {
    const folders = [folder([
      { fileId: 's-engine', name: 'A.pdf' },
      { fileId: 's-mongo', name: 'B.m4a' },
    ])]
    expect(
      sourcesWithoutTwin({
        folders,
        engineSourceIds: new Set(['s-engine']),
        familySourceIds: new Set(['s-mongo']),
      }),
    ).toEqual([])
  })

  it('ignoriert Nicht-Quell-Dateien vollstaendig (Negativfall)', () => {
    const gaps = sourcesWithoutTwin({
      folders: [folder([
        { fileId: 'n1', name: 'BERICHT.md' },
        { fileId: 'n2', name: 'Skizze.png' },
      ])],
      engineSourceIds: new Set(),
      familySourceIds: new Set(),
    })
    expect(gaps).toEqual([])
  })
})

describe('filesWithoutExtension — abgeschnittene Sync-Reste (Cowork-Befund)', () => {
  it('meldet endungslose Dateien (Positivfall)', () => {
    const gaps = filesWithoutExtension([folder([{ fileId: 'r1', name: 'Vorstellung Klimamassnahm' }])])
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({ type: 'datei_ohne_endung', targetId: 'r1', actor: 'mensch' })
    expect(gaps[0].message).toContain('Sync')
  })

  it('Dotfiles und Dateien mit Endung sind keine Befunde (Negativfall)', () => {
    const gaps = filesWithoutExtension([
      folder([
        { fileId: 'n1', name: '.gitignore' },
        { fileId: 'n2', name: 'BERICHT.md' },
        { fileId: 'n3', name: 'Archiv.tar.gz' },
      ]),
    ])
    expect(gaps).toEqual([])
  })
})
