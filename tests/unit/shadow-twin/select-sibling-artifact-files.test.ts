/**
 * @fileoverview Unit-Tests: Sidecar-Artefakt-Auswahl (Welle 0c)
 *
 * Der PLANER (`collectStorageArtifactsForSource`) kannte Sidecar-Artefakte
 * neben der Quelle schon immer; der EXECUTOR lud nur den `_`-Twin-Ordner und
 * uebersprang sie deshalb — die Adoption meldete Erfolg, uebernahm aber nichts.
 * Diese Auswahl schliesst die Luecke und muss dieselben Regeln befolgen.
 */

import { describe, it, expect } from 'vitest'
import { selectSiblingArtifactFiles } from '@/lib/shadow-twin/shadow-twin-migration-writer'
import type { StorageItem } from '@/lib/storage/types'

const item = (id: string, name: string, type: 'file' | 'folder' = 'file'): StorageItem =>
  ({ id, name, type, parentId: 'p-1', metadata: { name, mimeType: undefined } }) as unknown as StorageItem

const SOURCE = item('src-1', 'Besprechung.m4a')

describe('selectSiblingArtifactFiles', () => {
  it('waehlt Markdown-Artefakte der Quelle (kanonisch und Legacy-Sprachform)', () => {
    const picked = selectSiblingArtifactFiles(SOURCE, [
      item('a-1', 'Besprechung.md'),
      item('a-2', 'Besprechung.de.md'),
      item('a-3', 'Besprechung.standard-meeting.de.md'),
    ])
    expect(picked.map((i) => i.metadata.name)).toEqual([
      'Besprechung.md', 'Besprechung.de.md', 'Besprechung.standard-meeting.de.md',
    ])
  })

  it('ignoriert fremde Dateien, die Quelle selbst, Ordner und Nicht-Markdown', () => {
    const picked = selectSiblingArtifactFiles(SOURCE, [
      SOURCE,                                   // die Quelle ist nie ihr eigenes Artefakt
      item('x-1', 'Andere Besprechung.md'),     // fremder Basisname
      item('x-2', 'BesprechungExtra.md'),       // Praefix ohne Punkt -> kein Artefakt
      item('x-3', 'Besprechung.jpg'),           // Bild: gehoert in den Twin-Ordner
      item('x-4', 'Besprechung.pdf'),           // andere Quelle, kein Markdown
      item('x-5', 'Besprechung.notizen', 'folder'), // Ordner
      item('a-1', 'Besprechung.md'),
    ])
    expect(picked.map((i) => i.id)).toEqual(['a-1'])
  })

  it('vergleicht Basisnamen ohne Ruecksicht auf Gross-/Kleinschreibung', () => {
    const picked = selectSiblingArtifactFiles(SOURCE, [item('a-1', 'BESPRECHUNG.DE.MD')])
    expect(picked).toHaveLength(1)
  })

  it('leere oder fehlende Ordnerliste: keine Auswahl, kein Fehler', () => {
    expect(selectSiblingArtifactFiles(SOURCE, [])).toEqual([])
    expect(selectSiblingArtifactFiles(SOURCE, undefined)).toEqual([])
  })
})
