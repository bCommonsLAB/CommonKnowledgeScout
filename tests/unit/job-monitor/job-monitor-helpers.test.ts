/**
 * Char-Tests für job-monitor-panel.tsx Helper-Funktionen (Welle 3-V-a).
 *
 * Diese Funktionen sind derzeit inline in job-monitor-panel.tsx definiert.
 * Die Tests dokumentieren ihr Verhalten als Sicherheitsnetz vor dem
 * Modul-Split in Sub-Welle 3-V-b.
 *
 * Ziel-Modul nach Split: src/lib/job-monitor/format-helpers.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --------------------------------------------------------------------------
// Inline-Implementierungen der zu testenden Helper (Char-Tests).
// Diese werden in Sub-Welle 3-V-b in ein eigenes Modul extrahiert.
// --------------------------------------------------------------------------

function formatRelative(dateIso?: string): string {
  if (!dateIso) return '';
  const date = new Date(dateIso);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'jetzt';
  if (mins < 60) return `vor ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `vor ${days}d`;
}

function formatClock(dateIso?: string): string {
  if (!dateIso) return '';
  const d = new Date(dateIso);
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatDuration(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return '';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function truncateMiddle(input?: string, max: number = 40): string {
  if (!input) return '';
  if (input.length <= max) return input;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${input.slice(0, head)}…${input.slice(input.length - tail)}`;
}

// --------------------------------------------------------------------------
// formatRelative
// --------------------------------------------------------------------------

describe('formatRelative', () => {
  beforeEach(() => {
    // Fixer Zeitpunkt für deterministische Tests
    vi.setSystemTime(new Date('2026-05-03T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('gibt leeren String bei undefined zurück', () => {
    expect(formatRelative(undefined)).toBe('')
  })

  it('gibt "jetzt" für Datum < 1 Minute zurück', () => {
    const now = new Date('2026-05-03T11:59:30.000Z').toISOString()
    expect(formatRelative(now)).toBe('jetzt')
  })

  it('gibt "vor Xm" für Datum < 1 Stunde zurück', () => {
    const thirtyMinsAgo = new Date('2026-05-03T11:30:00.000Z').toISOString()
    expect(formatRelative(thirtyMinsAgo)).toBe('vor 30m')
  })

  it('gibt "vor Xh" für Datum < 24 Stunden zurück', () => {
    const twoHoursAgo = new Date('2026-05-03T10:00:00.000Z').toISOString()
    expect(formatRelative(twoHoursAgo)).toBe('vor 2h')
  })

  it('gibt "vor Xd" für Datum >= 24 Stunden zurück', () => {
    const threeDaysAgo = new Date('2026-04-30T12:00:00.000Z').toISOString()
    expect(formatRelative(threeDaysAgo)).toBe('vor 3d')
  })
})

// --------------------------------------------------------------------------
// formatClock
// --------------------------------------------------------------------------

describe('formatClock', () => {
  it('gibt leeren String bei undefined zurück', () => {
    expect(formatClock(undefined)).toBe('')
  })

  it('formatiert MM:SS korrekt', () => {
    const time = '2026-05-03T12:05:09.000Z'
    const result = formatClock(time)
    // Minuten und Sekunden sind zeitzonenabhängig; prüfe Format
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it('padded einstellige Minuten und Sekunden', () => {
    // Erstelle ein Datum mit bekannten UTC-Minuten und Sekunden
    const d = new Date('2026-05-03T10:03:07.000Z')
    const result = formatClock(d.toISOString())
    // Die lokale Zeit kann von UTC abweichen; prüfe nur das Format
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })
})

// --------------------------------------------------------------------------
// formatDuration
// --------------------------------------------------------------------------

describe('formatDuration', () => {
  it('gibt leeren String zurück wenn start oder end fehlen', () => {
    expect(formatDuration(undefined, '2026-05-03T12:01:00Z')).toBe('')
    expect(formatDuration('2026-05-03T12:00:00Z', undefined)).toBe('')
    expect(formatDuration()).toBe('')
  })

  it('gibt leeren String zurück bei negativer Dauer', () => {
    expect(formatDuration('2026-05-03T12:01:00Z', '2026-05-03T12:00:00Z')).toBe('')
  })

  it('formatiert Sekunden korrekt als MM:SS', () => {
    const start = '2026-05-03T12:00:00.000Z'
    const end = '2026-05-03T12:02:35.000Z'
    expect(formatDuration(start, end)).toBe('02:35')
  })

  it('formatiert über 1 Stunde als H:MM:SS', () => {
    const start = '2026-05-03T10:00:00.000Z'
    const end = '2026-05-03T11:30:45.000Z'
    expect(formatDuration(start, end)).toBe('1:30:45')
  })

  it('formatiert exakt 1 Stunde als 1:00:00', () => {
    const start = '2026-05-03T10:00:00.000Z'
    const end = '2026-05-03T11:00:00.000Z'
    expect(formatDuration(start, end)).toBe('1:00:00')
  })
})

// --------------------------------------------------------------------------
// truncateMiddle
// --------------------------------------------------------------------------

describe('truncateMiddle', () => {
  it('gibt leeren String bei undefined zurück', () => {
    expect(truncateMiddle(undefined)).toBe('')
  })

  it('gibt kurzen String unverändert zurück', () => {
    expect(truncateMiddle('kurzer-name.txt', 40)).toBe('kurzer-name.txt')
  })

  it('kürzt langen String mit … in der Mitte', () => {
    const long = 'sehr-langer-datei-name-der-definitiv-zu-lang-ist.txt'
    const result = truncateMiddle(long, 20)
    expect(result).toContain('…')
    expect(result.length).toBeLessThanOrEqual(21) // max + ellipsis
  })

  it('kürzt auf head + … + tail Zeichen', () => {
    const input = 'a'.repeat(10)
    const result = truncateMiddle(input, 5)
    // max=5: head=ceil((5-1)/2)=2, tail=floor((5-1)/2)=2
    // Ergebnis: "aa" + "…" + "aa" = 5 Zeichen (ellipsis zählt als 1)
    expect(result.length).toBe(5)
    expect(result).toContain('…')
  })

  it('verwendet default max=40', () => {
    const exactly40 = 'x'.repeat(40)
    expect(truncateMiddle(exactly40)).toBe(exactly40)

    const fortyone = 'x'.repeat(41)
    const result = truncateMiddle(fortyone)
    expect(result).toContain('…')
  })
})
