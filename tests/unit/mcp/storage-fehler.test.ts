/**
 * Welle ST4 — einheitliche Fehlerbilder (Q5).
 *
 * Die eine Frage, die der Agent beantwortet haben muss: Hat ein zweiter
 * Versuch Sinn? Beim Versionskonflikt ja, bei `pfad_zu_lang` nie.
 */
import { describe, expect, it } from 'vitest'
import { ordneFehlerZu } from '@/lib/mcp/storage/fehler'
import { StorageError, StorageVersionConflictError } from '@/lib/storage/types'
import { FolderPathNotFoundError } from '@/lib/mcp/resolve-folder'
import { SchreibschutzError } from '@/lib/mcp/storage/schreibschutz'

/** WebDAV/Graph werfen Objekte mit `status`. */
function httpFehler(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { status })
}
/** Node wirft Fehler mit `code`. */
function fsFehler(code: string): Error {
  return Object.assign(new Error(code), { code })
}

describe('ordneFehlerZu', () => {
  it('erkennt den Versionskonflikt und laesst ihn wiederholen', () => {
    const bild = ordneFehlerZu(new StorageVersionConflictError('x', 'v1', 'v2', 'lib'))
    expect(bild.code).toBe('konflikt')
    expect(bild.wiederholbar).toBe(true)
  })

  it('erkennt „zu lang" und laesst es NICHT wiederholen', () => {
    const bild = ordneFehlerZu(fsFehler('ENAMETOOLONG'))
    expect(bild.code).toBe('pfad_zu_lang')
    expect(bild.wiederholbar).toBe(false)
  })

  it('ordnet HTTP-Status ueber alle Provider gleich zu', () => {
    expect(ordneFehlerZu(httpFehler(404)).code).toBe('nicht_gefunden')
    expect(ordneFehlerZu(httpFehler(412)).code).toBe('konflikt')
    expect(ordneFehlerZu(httpFehler(413)).code).toBe('zu_gross')
    expect(ordneFehlerZu(httpFehler(403)).code).toBe('kein_zugriff')
    expect(ordneFehlerZu(httpFehler(423)).code).toBe('gesperrt')
    expect(ordneFehlerZu(httpFehler(429)).code).toBe('zeitueberschreitung')
  })

  it('ordnet Node-Fehlercodes gleichwertig zu', () => {
    expect(ordneFehlerZu(fsFehler('ENOENT')).code).toBe('nicht_gefunden')
    expect(ordneFehlerZu(fsFehler('EACCES')).code).toBe('kein_zugriff')
    expect(ordneFehlerZu(fsFehler('EROFS')).code).toBe('nur_lesen')
  })

  it('kennt die eigenen Fehlertypen der Bruecke', () => {
    expect(ordneFehlerZu(new SchreibschutzError('a/_INDEX.md', {
      trifft: () => true, stattdessen: 'stand_setzen', grund: 'x',
    })).code).toBe('nicht_unterstuetzt')
    expect(ordneFehlerZu(new FolderPathNotFoundError('weg')).code).toBe('nicht_gefunden')
  })

  it('gibt den vorhergesehenen Faellen eigene Codes statt "unbekannt" (ST5)', () => {
    // Beide kamen im Live-Test als `unbekannt` heraus — der Agent musste die
    // deutsche Meldung parsen, um sie von einem echten Ausfall zu trennen.
    expect(ordneFehlerZu(new Error('"a/b.md" existiert bereits (id x, version v1)')).code)
      .toBe('existiert_bereits')
    expect(ordneFehlerZu(new Error('`altText` kommt 2-mal vor — nichts geaendert.')).code)
      .toBe('nicht_eindeutig')
    expect(ordneFehlerZu(new Error('`altText` kommt in der Datei nicht vor')).code)
      .toBe('nicht_eindeutig')
    // Beide sind nicht durch blosses Wiederholen zu beheben.
    expect(ordneFehlerZu(new Error('existiert bereits')).wiederholbar).toBe(false)
  })

  it('sortiert Unbekanntes NICHT wohlwollend ein', () => {
    const bild = ordneFehlerZu(new Error('irgendwas ganz anderes'))
    expect(bild.code).toBe('unbekannt')
    expect(bild.wiederholbar).toBe(false)
    // Die Originalmeldung bleibt erhalten — sie ist die einzige Spur.
    expect(bild.meldung).toBe('irgendwas ganz anderes')
  })

  it('laesst einen generischen StorageError nicht als Konflikt durchgehen', () => {
    expect(ordneFehlerZu(new StorageError('Auth kaputt', 'API_ERROR', 'lib')).code).toBe('unbekannt')
  })
})
