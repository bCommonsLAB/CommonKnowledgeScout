import type { DocCardMeta } from '@/lib/gallery/types'

/**
 * Extrahiert einen vergleichbaren Wert für die Tabellen-Sortierung.
 * Titel/Arrays/Datum/Zahlen werden so aufbereitet, dass compareSortValues stabil sortiert.
 */
export function getDocSortValue(doc: DocCardMeta, key: string): number | string | null {
  if (key === 'title') {
    const s = doc.shortTitle || doc.title || doc.fileName
    return s ? s.toLowerCase() : null
  }
  if (key === 'upsertedAt') {
    const t = doc.upsertedAt
    if (!t) return null
    const ms = Date.parse(t)
    return Number.isNaN(ms) ? t : ms
  }

  const raw = (doc as unknown as Record<string, unknown>)[key]
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'boolean') return raw ? 1 : 0
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null
    return raw.map((x) => String(x)).join(', ').toLowerCase()
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const ms = Date.parse(trimmed)
    // Nur echte Datums-/Zeitstrings als Zeit vergleichen (nicht kurze Zahlstrings)
    if (!Number.isNaN(ms) && trimmed.length >= 8) return ms
    const n = Number(trimmed)
    if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(trimmed)) return n
    return trimmed.toLowerCase()
  }
  return String(raw)
}

function isEmptySortValue(v: number | string | null): boolean {
  return v === null || v === ''
}

/**
 * Vergleicht zwei Dokumente nach einer Spalte. Leere Werte sortieren ans Ende (aufsteigend).
 */
export function compareDocCardMetaForColumn(
  a: DocCardMeta,
  b: DocCardMeta,
  key: string,
  dir: 'asc' | 'desc'
): number {
  const va = getDocSortValue(a, key)
  const vb = getDocSortValue(b, key)
  const emptyA = isEmptySortValue(va)
  const emptyB = isEmptySortValue(vb)
  if (emptyA && emptyB) return 0
  if (emptyA) return 1
  if (emptyB) return -1

  let cmp = 0
  if (typeof va === 'number' && typeof vb === 'number') {
    cmp = va - vb
  } else {
    const sa = String(va)
    const sb = String(vb)
    const na = Number(sa)
    const nb = Number(sb)
    if (!Number.isNaN(na) && !Number.isNaN(nb) && sa.trim() !== '' && sb.trim() !== '') {
      cmp = na - nb
    } else {
      cmp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' })
    }
  }
  return dir === 'asc' ? cmp : -cmp
}

/** Sortiert eine Dokumentenliste innerhalb einer Gruppe (z. B. ein Jahres-Block). */
export function sortDocsByTableColumn(docs: DocCardMeta[], key: string, dir: 'asc' | 'desc'): DocCardMeta[] {
  return [...docs].sort((x, y) => compareDocCardMetaForColumn(x, y, key, dir))
}
