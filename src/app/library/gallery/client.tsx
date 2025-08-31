'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAtomValue } from 'jotai'
import { activeLibraryIdAtom } from '@/atoms/library-atom'
import { FileLogger } from '@/lib/debug/logger'

interface DocCardMeta {
  id: string
  fileId?: string
  fileName?: string
  title?: string
  shortTitle?: string
  authors?: string[]
  year?: number | string
}

export default function GalleryClient() {
  const libraryId = useAtomValue(activeLibraryIdAtom)
  const [docs, setDocs] = useState<DocCardMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!libraryId) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/docs`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Laden der Dokumente')
        if (!cancelled && Array.isArray(data?.items)) setDocs(data.items as DocCardMeta[])
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
        if (!cancelled) setError(msg)
        FileLogger.error('Gallery', 'Docs laden fehlgeschlagen', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [libraryId])

  if (!libraryId) return <div className="text-sm text-muted-foreground">Keine aktive Bibliothek.</div>
  if (loading) return <div className="text-sm text-muted-foreground">Lade Dokumente…</div>
  if (error) return <div className="text-sm text-destructive">{error}</div>
  if (docs.length === 0) return <div className="text-sm text-muted-foreground">Keine Dokumente gefunden.</div>

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {docs.map(d => (
        <a key={d.id} href={`/library?fileId=${encodeURIComponent(d.fileId || '')}`} className="rounded border bg-card text-card-foreground p-4 hover:shadow-sm transition-shadow">
          {d.fileName ? <div className="text-sm text-muted-foreground mb-1">{d.fileName}</div> : null}
          <div className="font-medium mb-1">{d.title || d.fileName || 'Dokument'}</div>
          {d.shortTitle ? <div className="text-xs text-muted-foreground mb-1">{d.shortTitle}</div> : null}
          {Array.isArray(d.authors) && d.authors.length > 0 ? (
            <div className="text-xs mb-1">{d.authors.join(', ')}</div>
          ) : null}
          {d.year ? <div className="text-xs text-muted-foreground">{String(d.year)}</div> : null}
        </a>
      ))}
    </div>
  )
}


