"use client"

import type { QueryRetrievalStep } from '@/types/query-log'
import { useMemo, useState } from 'react'

function normalizeString(v: unknown): string {
  return typeof v === 'string' ? v : v === undefined || v === null ? '' : JSON.stringify(v)
}

export function DebugStepTable({ step }: { step: QueryRetrievalStep }) {
  const [q, setQ] = useState('')
  const [uniqueByFile, setUniqueByFile] = useState(true)
  const rows = useMemo(() => {
    const base = (step.results || []).map(r => {
      const md = r.metadata || {}
      const fileId = typeof (md as { fileId?: unknown }).fileId === 'string' ? (md as { fileId: string }).fileId : undefined
      const fileName = typeof (md as { fileName?: unknown }).fileName === 'string' ? (md as { fileName: string }).fileName : undefined
      const chapter = typeof (md as { chapterTitle?: unknown }).chapterTitle === 'string' ? (md as { chapterTitle: string }).chapterTitle : undefined
      const chunkIndex = typeof (md as { chunkIndex?: unknown }).chunkIndex === 'number' ? (md as { chunkIndex: number }).chunkIndex : undefined
      return { id: r.id, score: r.score, fileId, fileName, chunkIndex, chapter }
    })
    let filtered = base
    if (q.trim()) {
      const s = q.toLowerCase()
      filtered = base.filter(r =>
        normalizeString(r.fileName).toLowerCase().includes(s) ||
        normalizeString(r.id).toLowerCase().includes(s) ||
        normalizeString(r.chapter).toLowerCase().includes(s)
      )
    }
    if (uniqueByFile) {
      const map = new Map<string, { id: string; score?: number; fileId?: string; fileName?: string; chunkIndex?: number; chapter?: string }>()
      for (const r of filtered) {
        const key = r.fileId || r.fileName || r.id
        if (!map.has(key)) map.set(key, r)
      }
      return Array.from(map.values())
    }
    return filtered
  }, [step, q, uniqueByFile])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input className="h-8 px-2 border rounded text-sm" placeholder="Suche…" value={q} onChange={e => setQ(e.target.value)} />
        <label className="text-xs flex items-center gap-1 select-none">
          <input type="checkbox" checked={uniqueByFile} onChange={e => setUniqueByFile(e.target.checked)} /> nur unique Datei
        </label>
        <div className="text-xs text-muted-foreground ml-auto">{rows.length} Zeilen</div>
      </div>
      {/* Zusatzmetriken falls vorhanden */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>candidates: {(step as any).candidatesCount ?? '-'}</span>
        <span>used: {(step as any).usedInPrompt ?? '-'}</span>
        {typeof (step as any).decision === 'string' && <span>decision: {(step as any).decision}</span>}
      </div>
      <div className="overflow-auto max-h-72 border rounded">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="text-left p-2">id</th>
              <th className="text-left p-2">file</th>
              <th className="text-left p-2">chunk</th>
              <th className="text-left p-2">score</th>
              <th className="text-left p-2">chapter</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="odd:bg-muted/20">
                <td className="p-2 font-mono break-all">{r.id}</td>
                <td className="p-2 break-all">{r.fileName || r.fileId}</td>
                <td className="p-2">{typeof r.chunkIndex === 'number' ? r.chunkIndex : ''}</td>
                <td className="p-2">{typeof r.score === 'number' ? r.score.toFixed(3) : ''}</td>
                <td className="p-2 break-all">{r.chapter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


