"use client"

/**
 * @fileoverview Statuszeile der Live-Transkription
 *
 * @description
 * Zeigt in einer Zeile, was gerade passiert: Verbindung, Puffer, Sessionwechsel,
 * Nacharbeit. Wichtig ist die Aussage bei Stoerungen — der Sprechende soll sehen, dass
 * weiter mitgeschnitten wird und nichts verloren geht, statt ins Leere zu reden.
 *
 * @module shared
 *
 * @exports
 * - LiveStatusLine: Komponente - einzeiliger Zustand einer Live-Aufnahme
 */

import * as React from "react"
import { Loader2, Mic, WifiOff } from "lucide-react"
import type { LiveTranscriptionSnapshot } from "@/lib/live-transcription/types"

function formatDuration(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

export function LiveStatusLine(props: { snapshot: LiveTranscriptionSnapshot }) {
  const { snapshot } = props
  const openGaps = snapshot.gaps.filter((gap) => gap.state !== "geschlossen")
  const duration = formatDuration(snapshot.elapsedMs)

  if (snapshot.status === "arbeitet-nach") {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Ein Abschnitt wird nachgearbeitet — der Text vervollständigt sich gleich.</span>
      </div>
    )
  }

  if (snapshot.connection === "puffert" || snapshot.connection === "verbindet") {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
        <WifiOff className="h-3.5 w-3.5" />
        <span>
          Verbindung unterbrochen — es wird weiter aufgenommen
          {snapshot.bufferedSeconds > 1 ? ` (${Math.round(snapshot.bufferedSeconds)} s gepuffert)` : ""}
          . Nichts geht verloren.
        </span>
      </div>
    )
  }

  if (snapshot.connection === "wechselt-session") {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Sitzung wird erneuert ({duration}) — die Aufnahme läuft weiter.</span>
      </div>
    )
  }

  if (snapshot.connection === "verbunden") {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Mic className="h-3.5 w-3.5 text-red-500" />
        <span>
          Nimmt auf ({duration})
          {openGaps.length > 0 ? ` · ${openGaps.length} Abschnitt(e) in Nacharbeit` : ""}
        </span>
      </div>
    )
  }

  return null
}
