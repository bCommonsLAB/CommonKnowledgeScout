"use client"

/**
 * shared/artifact-info-panel/binary-fragments-section.tsx
 *
 * Zeigt die in MongoDB registrierten Binaer-Fragmente (Bilder, Seiten-Renderings,
 * Previews) einer Quelldatei an — analog zur Debug-Ansicht. Laedt ueber die
 * bestehende Route POST /shadow-twins/binary-fragments (Mongo-Modus).
 *
 * Bewusst als eigene Datei, damit `artifact-info-panel.tsx` schlank bleibt
 * (Welle 3-II Dateigroessen-Vertrag).
 */

import * as React from "react"
import { ImageIcon } from "lucide-react"

/** Reduziertes DTO der binary-fragments-Route (nur Anzeige-relevante Felder). */
interface BinaryFragmentInfo {
  sourceId: string
  name: string
  kind?: string
  variant?: string
  size?: number
  resolvedUrl?: string
}

interface BinaryFragmentsSectionProps {
  libraryId: string
  sourceId: string
  /** Aenderung dieses Wertes erzwingt ein erneutes Laden (z.B. nach Import/Loeschen). */
  reloadSignal: number
}

/** Formatiert eine Byte-Groesse menschenlesbar. */
function formatSize(bytes?: number): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BinaryFragmentsSection({ libraryId, sourceId, reloadSignal }: BinaryFragmentsSectionProps) {
  const [fragments, setFragments] = React.useState<BinaryFragmentInfo[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!libraryId || !sourceId) return
      setIsLoading(true)
      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/binary-fragments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceIds: [sourceId] }),
          }
        )
        if (!res.ok) {
          // 400 = nicht im Mongo-Modus; dann gibt es hier nichts anzuzeigen.
          if (!cancelled) setFragments([])
          return
        }
        const data = (await res.json()) as { fragments?: BinaryFragmentInfo[] }
        const onlyThisSource = (data.fragments || []).filter((f) => f.sourceId === sourceId)
        if (!cancelled) setFragments(onlyThisSource)
      } catch {
        // Anzeige optional: bei Fehler leer lassen (kein harter Fehler im Panel).
        if (!cancelled) setFragments([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [libraryId, sourceId, reloadSignal])

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Lade Binärdateien...</div>
  }

  if (fragments.length === 0) {
    return <div className="text-sm text-muted-foreground">Keine Bilder/Binärdateien im Cache.</div>
  }

  return (
    <div className="space-y-1">
      {fragments.map((fragment) => (
        <div key={`${fragment.name}::${fragment.variant ?? ""}`} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate text-xs text-muted-foreground">{fragment.name}</span>
            {fragment.variant ? (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                {fragment.variant}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground tabular-nums">{formatSize(fragment.size)}</span>
            {fragment.resolvedUrl ? (
              <a
                href={fragment.resolvedUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                öffnen
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
