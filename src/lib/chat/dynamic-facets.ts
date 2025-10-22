import { normalizeChatConfig } from '@/lib/chat/config'
import { Library } from '@/types/library'

export type FacetType = 'string' | 'number' | 'boolean' | 'string[]' | 'date' | 'integer-range'

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


