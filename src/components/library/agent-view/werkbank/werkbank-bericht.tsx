'use client'

/**
 * @fileoverview Bericht-Abschnitt des Werkbank-Details (F9, Welle W4).
 *
 * @description
 * Laedt den BERICHT.md lazy ueber die W2-Lese-Route (`use-bericht`, TanStack
 * Query) und rendert ihn mit der BESTEHENDEN `MarkdownPreview` (compact) —
 * bewusst KEIN eigener Markdown-Renderer (Peters Vorgabe + §F9). Jeder
 * Zustand ist benannt: `kein_bericht` ist ein Cowork-Befund (Bericht
 * beauftragen), `zu_gross` verweist ins Archiv statt abgeschnittener
 * Vorschau, ein `bericht_veraltet`-Befund traegt das „veraltet"-Badge.
 *
 * @module components/library/agent-view
 */

import { ExternalLink, FileText, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { MarkdownPreview } from '@/components/library/markdown-preview'
import { useBericht } from '@/hooks/agent-view/use-bericht'

function archivHref(libraryId: string, folderId: string, openFileId?: string): string {
  const openTeil = openFileId === undefined ? '' : `&openFileId=${encodeURIComponent(openFileId)}`
  return `/library?activeLibraryId=${encodeURIComponent(libraryId)}&folderId=${encodeURIComponent(folderId)}${openTeil}`
}

export function WerkbankBericht({
  libraryId,
  folderId,
  veraltet,
}: {
  libraryId: string
  folderId: string
  /** `bericht_veraltet`-Befund am Vorhabensordner (aus dem Report). */
  veraltet: boolean
}) {
  const { data, isLoading, error } = useBericht(libraryId, folderId)

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Lade Bericht...
      </p>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Bericht nicht ladbar</AlertTitle>
        <AlertDescription>{error instanceof Error ? error.message : String(error)}</AlertDescription>
      </Alert>
    )
  }
  if (!data) return null

  if (data.grund === 'kein_bericht' || data.bericht === null) {
    return (
      <Alert>
        <AlertTitle>Kein BERICHT.md</AlertTitle>
        <AlertDescription>
          Dieses Vorhaben hat noch keinen Bericht — Cowork-Arbeit: unten in der Cowork-Gruppe den Auftrag
          fuer dieses Vorhaben kopieren und den Bericht schreiben lassen.
        </AlertDescription>
      </Alert>
    )
  }

  const kopfzeile = (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <FileText className="h-3.5 w-3.5" aria-hidden />
      <span className="font-medium text-foreground">{data.bericht.name}</span>
      {data.bericht.modifiedAt && <span>geaendert {data.bericht.modifiedAt.slice(0, 10)}</span>}
      {veraltet && (
        <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
          veraltet
        </Badge>
      )}
      <a
        href={archivHref(libraryId, folderId, data.bericht.fileId)}
        className="ml-auto inline-flex items-center gap-1 underline-offset-2 hover:underline"
      >
        im Archiv oeffnen <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
    </div>
  )

  if (data.grund === 'zu_gross' || data.bericht.body === null) {
    return (
      <div className="space-y-2">
        {kopfzeile}
        <Alert>
          <AlertTitle>Bericht zu gross fuer die Vorschau</AlertTitle>
          <AlertDescription>
            {Math.round(data.bericht.sizeBytes / 1024)} KB ueberschreiten das Vorschau-Budget (512 KB) —
            &bdquo;im Archiv oeffnen&ldquo; zeigt die vollstaendige Datei.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {kopfzeile}
      <div className="rounded-md border p-2">
        {/* Bestehender Markdown-Viewer, kompakt — kein zweiter Renderer. */}
        <MarkdownPreview content={data.bericht.body} compact />
      </div>
    </div>
  )
}
