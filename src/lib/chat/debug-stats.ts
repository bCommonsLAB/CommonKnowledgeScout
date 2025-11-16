import type { QueryLog } from '@/types/query-log'

export interface Kpis {
  totalResults: number;
  uniqueFiles: number;
  usedSources: number;
  perLevel: Record<string, { requested: number; returned: number; steps: number }>;
  model?: string;
  temperature?: number;
}

export function computeKpis(log: QueryLog): Kpis {
  const perLevel: Record<string, { requested: number; returned: number; steps: number }> = {}
  let totalResults = 0
  const fileSet = new Set<string>()
  for (const step of log.retrieval || []) {
    const key = `${step.level}`
    if (!perLevel[key]) perLevel[key] = { requested: 0, returned: 0, steps: 0 }
    perLevel[key].requested += step.topKRequested || 0
    perLevel[key].returned += step.topKReturned || (Array.isArray(step.results) ? step.results.length : 0)
    perLevel[key].steps += 1
    const results = step.results || []
    totalResults += results.length
    for (const r of results) {
      const md = r.metadata || {}
      const fileId = typeof (md as { fileId?: unknown }).fileId === 'string' ? (md as { fileId: string }).fileId : undefined
      const fileName = typeof (md as { fileName?: unknown }).fileName === 'string' ? (md as { fileName: string }).fileName : undefined
      if (fileId) fileSet.add(fileId)
      else if (fileName) fileSet.add(fileName)
    }
  }
  return {
    totalResults,
    uniqueFiles: fileSet.size,
    usedSources: Array.isArray(log.sources) ? log.sources.length : 0,
    perLevel,
    model: log.prompt?.model,
    temperature: log.prompt?.temperature,
  }
}

export function groupResultsByFile(log: QueryLog): Array<{ fileKey: string; count: number; bestScore?: number; items: Array<{ id: string; score?: number; chunkIndex?: number; level: string }> }> {
  const map = new Map<string, { count: number; bestScore?: number; items: Array<{ id: string; score?: number; chunkIndex?: number; level: string }> }>()
  for (const step of log.retrieval || []) {
    for (const r of step.results || []) {
      const md = r.metadata || {}
      const fileId = typeof (md as { fileId?: unknown }).fileId === 'string' ? (md as { fileId: string }).fileId : undefined
      const fileName = typeof (md as { fileName?: unknown }).fileName === 'string' ? (md as { fileName: string }).fileName : undefined
      const key = fileId || fileName || r.id
      const entry = map.get(key) || { count: 0, bestScore: undefined, items: [] }
      entry.count += 1
      entry.bestScore = Math.max(entry.bestScore ?? -Infinity, r.score ?? -Infinity)
      const chunkIndex = typeof (md as { chunkIndex?: unknown }).chunkIndex === 'number' ? (md as { chunkIndex: number }).chunkIndex : undefined
      entry.items.push({ id: r.id, score: r.score, chunkIndex, level: step.level })
      map.set(key, entry)
    }
  }
  return Array.from(map.entries()).map(([fileKey, v]) => ({ fileKey, ...v })).sort((a, b) => (b.bestScore ?? 0) - (a.bestScore ?? 0))
}

export function hasFilterDiff(log: QueryLog): { diff: boolean; keys: string[] } {
  const a = log.filtersNormalized || {}
  const b = log.filtersPinecone || {}
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))
  const diffs: string[] = []
  for (const k of keys) {
    if (JSON.stringify((a as Record<string, unknown>)[k]) !== JSON.stringify((b as Record<string, unknown>)[k])) diffs.push(k)
  }
  return { diff: diffs.length > 0, keys: diffs }
}













































