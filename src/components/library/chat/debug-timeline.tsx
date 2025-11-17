"use client"

import type { QueryLog } from '@/types/query-log'

interface DebugTimelineProps {
  log: QueryLog
}

export function DebugTimeline({ log }: DebugTimelineProps) {
  const steps = (log.retrieval || []).map((s, i) => ({
    i,
    stage: s.stage,
    level: s.level,
    ms: s.timingMs || 0,
    count: (s.results ? s.results.length : s.topKReturned) || 0,
  }))
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map(s => (
        <div key={s.i} className="px-2 py-1 rounded border text-xs bg-muted/40">
          <span className="font-mono mr-1">{s.stage}</span>
          <span className="opacity-80 mr-1">[{s.level}]</span>
          <span className="opacity-70 mr-1">{s.ms}ms</span>
          <span className="opacity-70">{s.count}</span>
        </div>
      ))}
    </div>
  )
}

















































