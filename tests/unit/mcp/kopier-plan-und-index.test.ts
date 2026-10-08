/**
 * Handover Library-Anlage (08.10.): Auswahlregeln von `kopieren` (W3),
 * `index_aktualisieren` (W4) und die Frontmatter-Kuerzung von `artefakt_lesen` (T5).
 */
import { describe, it, expect } from 'vitest'
import { istArtefaktSpiegel, waehleImOrdner } from '@/lib/mcp/storage/kopier-plan'
import { waehleFuerIndex } from '@/lib/mcp/index-quellen'
import { kuerzeFrontmatter } from '@/lib/mcp/artefakt-auswahl'

const datei = (name: string) => ({ name, typ: 'file' as const, groesse: 10 })
const ordner = (name: string) => ({ name, typ: 'folder' as const, groesse: 0 })

describe('istArtefaktSpiegel', () => {
  it('erkennt <Quelle>.<…>.md neben einer Nicht-md-Quelle', () => {
    expect(istArtefaktSpiegel('Vortrag.de.md', ['Vortrag.m4a', 'Vortrag.de.md'])).toBe(true)
    expect(istArtefaktSpiegel('Vortrag.vortrag-session-de.de.md', ['Vortrag.m4a'])).toBe(true)
  })
  it('laesst Sammeldateien und Notizen stehen', () => {
    expect(istArtefaktSpiegel('02 Vortrag.md', ['02 Vortrag.md', 'Audio.m4a'])).toBe(false)
    expect(istArtefaktSpiegel('Notiz.md', ['Notiz.md'])).toBe(false)
    expect(istArtefaktSpiegel('Liste.de.md', ['Liste.md'])).toBe(false)
  })
})

describe('waehleImOrdner', () => {
  const eintraege = [datei('A.m4a'), datei('A.de.md'), datei('Notiz.md'), ordner('_A.m4a'), ordner('test'), ordner('Unter')]

  it('laesst Twin-Ordner immer weg, sonst alles', () => {
    const { nehmen, ausgelassen } = waehleImOrdner({ eltern: '', eintraege, nurQuellen: false, ausschliessen: [] })
    expect(nehmen.map((n) => n.name)).toEqual(['A.m4a', 'A.de.md', 'Notiz.md', 'test', 'Unter'])
    expect(ausgelassen).toEqual([{ relativ: '_A.m4a', grund: expect.stringContaining('Twin-Ordner') }])
  })
  it('nurQuellen nimmt auch test/ und erzeugte Seiten heraus', () => {
    const { nehmen } = waehleImOrdner({ eltern: 'x', eintraege, nurQuellen: true, ausschliessen: [] })
    expect(nehmen.map((n) => n.relativ)).toEqual(['x/A.m4a', 'x/Notiz.md', 'x/Unter'])
  })
  it('ausschliessen greift auf Namen und relative Pfade', () => {
    const { nehmen } = waehleImOrdner({ eltern: 'x', eintraege, nurQuellen: true, ausschliessen: ['Notiz.md', 'x/Unter'] })
    expect(nehmen.map((n) => n.name)).toEqual(['A.m4a'])
  })
})

describe('waehleFuerIndex', () => {
  it('nimmt per Vorgabe nur Publiziertes (Befund T9)', () => {
    expect(waehleFuerIndex({ publiziert: false, nurPublizierte: true, vorlagenDesTwins: ['standard-meeting'] }).nehmen).toBe(false)
    expect(waehleFuerIndex({ publiziert: false, nurPublizierte: false, vorlagenDesTwins: ['standard-meeting'] }).nehmen).toBe(true)
  })
  it('filtert nach Vorlage und nennt die vorhandenen', () => {
    const wahl = waehleFuerIndex({ publiziert: true, nurPublizierte: true, vorlagenDesTwins: ['standard-meeting'], vorlage: 'vortrag-session-de' })
    expect(wahl).toEqual({ nehmen: false, grund: expect.stringContaining('standard-meeting') })
    expect(waehleFuerIndex({ publiziert: true, nurPublizierte: true, vorlagenDesTwins: ['Vortrag-Session-DE'], vorlage: 'vortrag-session-de' }).nehmen).toBe(true)
  })
})

describe('kuerzeFrontmatter', () => {
  it('kuerzt lange Strings und grosse Objekte und nennt die Felder', () => {
    const { meta, gekuerzt } = kuerzeFrontmatter({ title: 'kurz', summary: 'x'.repeat(50), slides: [{ t: 'y'.repeat(50) }] }, 20)
    expect(meta.title).toBe('kurz')
    expect(String(meta.summary)).toMatch(/^x{20}… \[50 Zeichen\]$/)
    expect(gekuerzt).toEqual(['summary', 'slides'])
  })
})
