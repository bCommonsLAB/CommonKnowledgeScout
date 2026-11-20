/**
 * Unit-Tests fuer die gerechte Platzvergabe je Library (`external-jobs/fair-share.ts`).
 *
 * Regel: Den freien Platz bekommt die Library mit den wenigsten laufenden Jobs,
 * bei Gleichstand die, die am laengsten wartet, danach die libraryId.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  pickNextLibrary,
  toLibraryKey,
  type QueuedLibraryHead,
  type RunningLibraryCount,
} from '@/lib/external-jobs/fair-share'

function head(libraryId: string | null, jobId: string, iso: string): QueuedLibraryHead {
  return { libraryId, jobId, oldestQueuedAt: new Date(iso) }
}

describe('pickNextLibrary', () => {
  it('liefert null, wenn niemand wartet', () => {
    expect(pickNextLibrary([], [{ libraryId: 'lib-a', running: 3 }])).toBeNull()
  })

  it('eine Library allein bekommt den Platz, egal wie viele sie schon belegt', () => {
    const heads = [head('lib-a', 'a-1', '2026-11-20T08:00:00Z')]
    const running: RunningLibraryCount[] = [{ libraryId: 'lib-a', running: 5 }]
    expect(pickNextLibrary(heads, running)?.jobId).toBe('a-1')
  })

  it('eine neu hinzukommende Library gewinnt den naechsten Platz, obwohl sie spaeter kam', () => {
    // A wartet seit Stunden mit 2000 Jobs und belegt alle 6 Plaetze; B kommt spaeter.
    const heads = [
      head('lib-a', 'a-7', '2026-11-20T06:00:00Z'),
      head('lib-b', 'b-1', '2026-11-20T10:00:00Z'),
    ]
    const running: RunningLibraryCount[] = [{ libraryId: 'lib-a', running: 6 }]
    expect(pickNextLibrary(heads, running)?.jobId).toBe('b-1')
  })

  it('verteilt reihum, bis beide Libraries gleich viele Plaetze belegen', () => {
    const heads = [
      head('lib-a', 'a-9', '2026-11-20T06:00:00Z'),
      head('lib-b', 'b-2', '2026-11-20T10:00:00Z'),
    ]
    // B hat schon 2, A noch 3: B bekommt den Platz (2 < 3).
    expect(
      pickNextLibrary(heads, [
        { libraryId: 'lib-a', running: 3 },
        { libraryId: 'lib-b', running: 2 },
      ])?.jobId,
    ).toBe('b-2')
    // Gleichstand 3:3 — jetzt zaehlt die Wartezeit, A wartet laenger.
    expect(
      pickNextLibrary(heads, [
        { libraryId: 'lib-a', running: 3 },
        { libraryId: 'lib-b', running: 3 },
      ])?.jobId,
    ).toBe('a-9')
  })

  it('Gleichstand bei laufenden Jobs: die Library mit dem aeltesten wartenden Job', () => {
    const heads = [
      head('lib-b', 'b-1', '2026-11-20T09:00:00Z'),
      head('lib-c', 'c-1', '2026-11-20T07:00:00Z'),
      head('lib-a', 'a-1', '2026-11-20T08:00:00Z'),
    ]
    expect(pickNextLibrary(heads, [])?.jobId).toBe('c-1')
  })

  it('Gleichstand bei laufenden Jobs und Wartezeit: die libraryId entscheidet stabil', () => {
    const same = '2026-11-20T08:00:00Z'
    const heads = [head('lib-b', 'b-1', same), head('lib-a', 'a-1', same)]
    expect(pickNextLibrary(heads, [])?.jobId).toBe('a-1')
    expect(pickNextLibrary([...heads].reverse(), [])?.jobId).toBe('a-1')
  })

  it('Jobs ohne Library bilden eine eigene Gruppe und werden mitverteilt', () => {
    const heads = [
      head('lib-a', 'a-1', '2026-11-20T06:00:00Z'),
      head(null, 'legacy-1', '2026-11-20T09:00:00Z'),
    ]
    const running: RunningLibraryCount[] = [{ libraryId: 'lib-a', running: 4 }]
    expect(pickNextLibrary(heads, running)?.jobId).toBe('legacy-1')
    // Bei vollem Gleichstand kommt die echte Library vor der Gruppe ohne Library.
    const same = '2026-11-20T08:00:00Z'
    expect(pickNextLibrary([head(null, 'legacy-1', same), head('lib-a', 'a-1', same)], [])?.jobId).toBe('a-1')
  })

  it('zaehlt mehrere Running-Eintraege derselben Library zusammen', () => {
    const heads = [
      head('lib-a', 'a-1', '2026-11-20T06:00:00Z'),
      head('lib-b', 'b-1', '2026-11-20T07:00:00Z'),
    ]
    const running: RunningLibraryCount[] = [
      { libraryId: 'lib-a', running: 1 },
      { libraryId: 'lib-a', running: 2 },
      { libraryId: 'lib-b', running: 2 },
    ]
    expect(pickNextLibrary(heads, running)?.jobId).toBe('b-1')
  })
})

describe('toLibraryKey', () => {
  it('uebernimmt Strings unveraendert', () => {
    const onInvalid = vi.fn()
    expect(toLibraryKey('lib-a', onInvalid)).toBe('lib-a')
    expect(onInvalid).not.toHaveBeenCalled()
  })

  it('fehlendes Feld und null landen in der Gruppe null', () => {
    const onInvalid = vi.fn()
    expect(toLibraryKey(null, onInvalid)).toBeNull()
    expect(toLibraryKey(undefined, onInvalid)).toBeNull()
    expect(onInvalid).not.toHaveBeenCalled()
  })

  it('meldet einen Nicht-String laut und verteilt ihn als String weiter', () => {
    const onInvalid = vi.fn()
    expect(toLibraryKey(42, onInvalid)).toBe('42')
    expect(onInvalid).toHaveBeenCalledWith(42)
  })
})
