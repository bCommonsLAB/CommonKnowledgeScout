'use client'

/**
 * @fileoverview Tab „Original" des Artefakt-Details (Welle A3).
 *
 * @description
 * Entscheidung 4 (24.08.2026): Das Original ist der erste Tab und traegt
 * KEIN Haekchen — es ist die Referenz, gegen die geprueft wird. Je nach Art
 * (pur entschieden in `artefakt-vorschau.ts`): Audio/Video-Abspieler,
 * PDF-/Bild-Einbettung oder Rohtext; alles andere — auch Word — hat im
 * Browser keine eingebettete Vorschau und sagt das, mit Archiv-Link, statt
 * leer zu bleiben. Die Binary-URL kommt aus der bestehenden
 * provider-agnostischen Streaming-Route (`storage-abstraction.mdc`).
 *
 * @module components/library/agent-view
 */

import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@ks/ui'
import { originalUrl, vorschauArt } from '@/lib/agent-view/artefakt-vorschau'
import type { TwinFamilySummary } from '@/lib/agent-view/types'

function Rohtext({ url }: { url: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-view-original-text', url],
    queryFn: async () => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Original nicht ladbar (HTTP ${response.status})`)
      return response.text()
    },
    staleTime: 30_000,
    retry: 1,
  })
  if (isLoading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Lade Original...</p>
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Original nicht ladbar</AlertTitle>
        <AlertDescription>{error instanceof Error ? error.message : String(error)}</AlertDescription>
      </Alert>
    )
  }
  return <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs">{data ?? ''}</pre>
}

export function WerkbankOriginal({ libraryId, familie, archivHref }: {
  libraryId: string
  familie: TwinFamilySummary
  archivHref: string
}) {
  const art = vorschauArt(familie.sourceName)
  const url = originalUrl(libraryId, familie.sourceId)

  if (art === 'audio') {
    // eslint-disable-next-line jsx-a11y/media-has-caption -- Das Original IST die Quelle; das Transkript ist der eigene Tab daneben.
    return <audio controls preload="none" src={url} className="w-full" />
  }
  if (art === 'video') {
    // eslint-disable-next-line jsx-a11y/media-has-caption -- Das Original IST die Quelle; das Transkript ist der eigene Tab daneben.
    return <video controls preload="none" src={url} className="max-h-[70vh] w-full rounded-md border" />
  }
  if (art === 'pdf') {
    return <iframe src={url} title={`PDF-Vorschau: ${familie.sourceName}`} className="h-[70vh] w-full rounded-md border" />
  }
  if (art === 'bild') {
    // eslint-disable-next-line @next/next/no-img-element -- Streaming-Route mit Redirect; next/image optimiert hier nichts.
    return <img src={url} alt={familie.sourceName} className="max-h-[70vh] max-w-full rounded-md border" />
  }
  if (art === 'text') {
    return <Rohtext url={url} />
  }
  return (
    <Alert>
      <AlertTitle>Keine eingebettete Vorschau</AlertTitle>
      <AlertDescription className="space-y-1">
        <p>
          Fuer <span className="font-medium">{familie.sourceName}</span> gibt es im Browser keine eingebettete
          Vorschau (z. B. Word) — das Original bleibt die Referenz im Archiv.
        </p>
        <a href={archivHref} className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
          Im Archiv oeffnen <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </AlertDescription>
    </Alert>
  )
}
