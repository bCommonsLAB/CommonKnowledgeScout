import { normalizeChatConfig } from '@/lib/chat/config'
import { Library } from '@/types/library'
import { bufferLog } from '@/lib/external-jobs-log-buffer'

export type FacetType = 'string' | 'number' | 'boolean' | 'string[]' | 'date' | 'integer-range'

/**
 * Cache für parseFacetDefs Ergebnisse
 * Verhindert wiederholtes Parsen der gleichen Library-Konfiguration
 */
const facetDefsCache = new Map<string, { defs: FacetDef[]; timestamp: number }>()
const FACET_DEFS_CACHE_TTL_MS = 5 * 60 * 1000 // 5 Minuten (entspricht Library Context Cache)

export interface FacetDef {
  metaKey: string
  label?: string
  type: FacetType
  multi: boolean
  visible: boolean
  // Zusatzattribute für Anzeige/Aggregation
  sort?: 'alpha' | 'count'
  max?: number
  columns?: number
  buckets?: Array<{ label: string; min: number; max: number }>
}

export function parseFacetDefs(library: Library): FacetDef[] {
  // Cache-Key basierend auf Library-ID und Config-Hash
  const cacheKey = `${library.id}:${JSON.stringify(library.config?.chat?.gallery?.facets || [])}`
  const cached = facetDefsCache.get(cacheKey)
  const now = Date.now()
  
  if (cached && (now - cached.timestamp) < FACET_DEFS_CACHE_TTL_MS) {
    return cached.defs
  }
  
  const cfg = normalizeChatConfig(library.config?.chat)
  const defs = Array.isArray(cfg.gallery?.facets) ? (cfg.gallery.facets as unknown as FacetDef[]) : []
  const seen = new Set<string>()
  const out: FacetDef[] = []
  for (const d of defs) {
    if (!d || typeof d !== 'object') continue
    if (!d.metaKey) continue
    if (seen.has(d.metaKey)) continue
    seen.add(d.metaKey)
    out.push({
      metaKey: d.metaKey,
      label: d.label || d.metaKey,
      type: (d.type || 'string') as FacetType,
      multi: typeof d.multi === 'boolean' ? d.multi : true,
      visible: typeof d.visible === 'boolean' ? d.visible : true,
      sort: (d as { sort?: unknown }).sort === 'count' ? 'count' : 'alpha',
      max: typeof (d as { max?: unknown }).max === 'number' ? Math.max(1, Math.floor((d as { max: number }).max)) : undefined,
      columns: typeof (d as { columns?: unknown }).columns === 'number' ? Math.min(3, Math.max(1, Math.floor((d as { columns: number }).columns))) : 1,
      buckets: Array.isArray(d.buckets) ? d.buckets.filter(b => b && typeof b.min === 'number' && typeof b.max === 'number') : undefined,
    })
  }
  
  // Cache speichern
  facetDefsCache.set(cacheKey, { defs: out, timestamp: now })
  
  // Alte Cache-Einträge aufräumen (alle 10 Minuten)
  if (facetDefsCache.size > 100) {
    for (const [key, entry] of facetDefsCache.entries()) {
      if (now - entry.timestamp > FACET_DEFS_CACHE_TTL_MS) {
        facetDefsCache.delete(key)
      }
    }
  }
  
  return out
}

export function getTopLevelValue(rawMeta: Record<string, unknown> | undefined, def: FacetDef): unknown {
  if (!rawMeta || typeof rawMeta !== 'object') return undefined
  const v = (rawMeta as Record<string, unknown>)[def.metaKey]
  switch (def.type) {
    case 'string': return typeof v === 'string' ? v : undefined
    case 'number': return typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : undefined)
    case 'boolean': return typeof v === 'boolean' ? v : undefined
    case 'string[]': return Array.isArray(v) ? v.filter(x => typeof x === 'string') : undefined
    case 'date': return typeof v === 'string' ? v : undefined
    case 'integer-range': return typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : undefined)
    default: return undefined
  }
}

export function buildFilterFromQuery(query: URL, defs: FacetDef[]): Record<string, unknown> {
  const filter: Record<string, unknown> = {}
  for (const def of defs) {
    const values = query.searchParams.getAll(def.metaKey)
    if (values.length === 0) continue
    switch (def.type) {
      case 'string':
      case 'date':
      case 'boolean':
        filter[def.metaKey] = { $in: values.map(v => def.type === 'boolean' ? v === 'true' : v) }
        break
      case 'number':
        filter[def.metaKey] = { $in: values.map(v => Number(v)) }
        break
      case 'string[]':
        filter[def.metaKey] = { $in: values }
        break
      case 'integer-range': {
        // Falls Buckets definiert sind, erwarten wir Label-Werte; alternativ erwarten wir konkrete min/max in Query nicht
        // Vereinfachung: map auf numerische year-Werte falls übergeben
        const nums = values.map(v => Number(v)).filter(n => !Number.isNaN(n))
        if (nums.length > 0) filter[def.metaKey] = { $in: nums }
        break
      }
    }
  }
  
  // shortTitle-Filter hinzufügen (wenn vorhanden) - nicht Teil der Facetten-Definitionen
  // Wird später zu fileIds gemappt über MongoDB
  const shortTitleValues = query.searchParams.getAll('shortTitle')
  if (shortTitleValues.length > 0) {
    filter.shortTitle = { $in: shortTitleValues }
  }
  
  // Legacy: fileId-Filter für Rückwärtskompatibilität (wird später zu shortTitle konvertiert)
  const fileIdValues = query.searchParams.getAll('fileId')
  if (fileIdValues.length > 0) {
    filter.fileId = { $in: fileIdValues }
  }
  
  return filter
}

export function aggregateFacetCounts(
  vectors: Array<{ metadata?: Record<string, unknown> }>,
  defs: FacetDef[]
): Record<string, Array<{ value: string; count: number }>> {
  const out: Record<string, Map<string, number>> = {}
  for (const def of defs) out[def.metaKey] = new Map<string, number>()
  for (const v of vectors) {
    const md = v.metadata || {}
    for (const def of defs) {
      const raw = md[def.metaKey]
      if (raw === undefined) continue
      if (def.type === 'string[]' && Array.isArray(raw)) {
        for (const s of raw) if (typeof s === 'string' && s) out[def.metaKey].set(s, (out[def.metaKey].get(s) || 0) + 1)
        continue
      }
      if (def.type === 'number' && (typeof raw === 'number' || typeof raw === 'string')) {
        const sv = String(typeof raw === 'number' ? raw : Number(raw))
        if (sv) out[def.metaKey].set(sv, (out[def.metaKey].get(sv) || 0) + 1)
        continue
      }
      if (def.type === 'boolean' && typeof raw === 'boolean') {
        const sv = raw ? 'true' : 'false'
        out[def.metaKey].set(sv, (out[def.metaKey].get(sv) || 0) + 1)
        continue
      }
      if ((def.type === 'string' || def.type === 'date' || def.type === 'integer-range') && (typeof raw === 'string' || typeof raw === 'number')) {
        const sv = String(raw)
        if (sv) out[def.metaKey].set(sv, (out[def.metaKey].get(sv) || 0) + 1)
        continue
      }
    }
  }
  const result: Record<string, Array<{ value: string; count: number }>> = {}
  for (const def of defs) {
    result[def.metaKey] = Array.from(out[def.metaKey].entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => String(a.value).localeCompare(String(b.value)))
  }
  return result
}

/**
 * Entfernt Anführungszeichen am Anfang und Ende eines Strings.
 */
export function stripWrappingQuotes(s: string): string {
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim()
  }
  return t
}

/**
 * Konvertiert verschiedene Formate zu einem String-Array.
 * Unterstützt: Arrays, JSON-Array-Strings, Komma-separierte Strings.
 */
export function toStringArrayFromUnknown(val: unknown): string[] | undefined {
  if (Array.isArray(val)) {
    return val.map(v => stripWrappingQuotes(typeof v === 'string' ? v : String(v))).filter(Boolean)
  }
  if (typeof val === 'string') {
    const t = val.trim()
    try {
      if (t.startsWith('[') && t.endsWith(']')) {
        const arr = JSON.parse(t)
        if (Array.isArray(arr)) {
          return arr.map(v => stripWrappingQuotes(typeof v === 'string' ? v : String(v))).filter(Boolean)
        }
      }
    } catch {
      // Fallback: Komma-separiert
    }
    return t.split(',').map(s => stripWrappingQuotes(s)).filter(Boolean)
  }
  return undefined
}

/**
 * Rekursive Bereinigung von Metadaten-Werten.
 * Entfernt null/undefined, bereinigt Strings, parst JSON-Arrays.
 */
export function deepCleanMeta(val: unknown): unknown {
  if (val === null || val === undefined) return undefined
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const arr = JSON.parse(trimmed)
        if (Array.isArray(arr)) {
          return arr.map(x => deepCleanMeta(x)).filter(v => v !== undefined)
        }
      } catch {
        // Fallback: String bereinigen
      }
    }
    return stripWrappingQuotes(trimmed)
  }
  if (Array.isArray(val)) {
    return val.map(x => deepCleanMeta(x)).filter(v => v !== undefined)
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      const cleaned = deepCleanMeta(v)
      if (cleaned !== undefined) out[k] = cleaned
    }
    return out
  }
  return val
}

export interface SanitizedMeta {
  sanitized: Record<string, unknown>
  jsonClean: Record<string, unknown>
  metaEffective: Record<string, unknown>
}

/**
 * Validiert und sanitized Frontmatter-Metadaten basierend auf Facetten-Definitionen.
 * Erstellt `sanitized` (nur Facetten-Felder) und `jsonClean` (vollständige bereinigte Kopie).
 */
export function validateAndSanitizeFrontmatter(
  metaEffective: Record<string, unknown>,
  facetDefs: FacetDef[],
  jobId?: string
): SanitizedMeta {
  const sanitized: Record<string, unknown> = { ...metaEffective }

  for (const def of facetDefs) {
    const raw = (metaEffective as Record<string, unknown>)[def.metaKey]
    let parsed = getTopLevelValue(metaEffective, def)

    if ((def.type === 'number' || def.type === 'integer-range') && typeof parsed === 'number') {
      if (!Number.isFinite(parsed)) parsed = undefined
    }
    if (def.type === 'string' && typeof parsed === 'string') {
      parsed = stripWrappingQuotes(parsed)
    }
    if (def.type === 'string[]') {
      const arr = toStringArrayFromUnknown(parsed === undefined ? raw : parsed)
      parsed = Array.isArray(arr) ? arr : undefined
    }

    if (parsed === undefined) {
      if (raw === undefined) {
        if (jobId) {
          bufferLog(jobId, { phase: 'facet_missing', message: `Meta fehlt: ${def.metaKey}` })
        }
      } else {
        if (jobId) {
          bufferLog(jobId, {
            phase: 'facet_type_mismatch',
            message: `Typfehler: ${def.metaKey}`,
            details: { expected: def.type, actual: typeof raw } as unknown as Record<string, unknown>,
          })
        }
      }
    } else {
      sanitized[def.metaKey] = parsed
    }
  }

  // null/undefined entfernen für docMetaJson
  for (const k of Object.keys(sanitized)) {
    if (sanitized[k] === null || sanitized[k] === undefined) {
      delete sanitized[k]
    }
  }

  // Intern: __sanitized für spätere Verwendung
  ;(metaEffective as Record<string, unknown>)['__sanitized'] = sanitized

  // Vollständige, bereinigte Kopie für docMetaJson (auch Keys außerhalb der Facetten)
  const mergedForJson: Record<string, unknown> = { ...(metaEffective as Record<string, unknown>) }
  delete mergedForJson['__sanitized']
  for (const [k, v] of Object.entries(sanitized)) {
    mergedForJson[k] = v
  }

  ;(metaEffective as Record<string, unknown>)['__jsonClean'] = deepCleanMeta(mergedForJson)

  return {
    sanitized,
    jsonClean: (metaEffective as Record<string, unknown>)['__jsonClean'] as Record<string, unknown>,
    metaEffective,
  }
}


