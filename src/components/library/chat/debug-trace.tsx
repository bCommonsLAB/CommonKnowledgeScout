"use client"

import type { QueryLog } from '@/types/query-log'

interface DebugTraceProps {
  log: QueryLog
}

export function DebugTrace({ log }: DebugTraceProps) {
  const toMs = (v: unknown): number => {
    if (!v) return 0
    try { return new Date(v as string).getTime() } catch { return 0 }
  }
  const raw = (log.retrieval || []).map((s, i) => ({
    i,
    label: `${s.stage} [${s.level}]`,
    start: s.startedAt ? toMs(s.startedAt) : 0,
    end: s.endedAt ? toMs(s.endedAt) : 0,
    ms: s.timingMs || (s.startedAt && s.endedAt ? Math.max(0, toMs(s.endedAt) - toMs(s.startedAt)) : 0),
  }))
  const minStart = raw.reduce((m, s) => (m === 0 ? s.start : Math.min(m, s.start || m)), raw[0]?.start || 0)
  const maxEnd = raw.reduce((m, s) => Math.max(m, s.end || m), raw[0]?.end || 0)
  const total = Math.max(1, maxEnd - minStart)
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Trace</div>
      <div className="rounded border p-3">
        <div className="space-y-2">
          {raw.map(s => {
            const startPct = Math.max(0, Math.round(((s.start - minStart) / total) * 100))
            const widthPct = Math.max(2, Math.round((s.ms / total) * 100))
            return (
              <div key={s.i} className="flex items-center gap-2">
                <div className="w-40 text-xs truncate" title={s.label}>{s.label}</div>
                <div className="flex-1 bg-muted rounded h-3 relative overflow-hidden">
                  <div className="absolute h-3 bg-primary/70" style={{ left: `${startPct}%`, width: `${widthPct}%` }} />
                </div>
                <div className="w-16 text-right text-xs text-muted-foreground tabular-nums">{s.ms}ms</div>
              </div>
            )
          })}
          <div className="text-xs text-muted-foreground text-right">Spanne: {total}ms</div>
        </div>
      </div>
    </div>
  )
}


