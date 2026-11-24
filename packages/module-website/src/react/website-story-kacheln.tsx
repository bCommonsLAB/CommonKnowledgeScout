"use client"

/**
 * Die Beispielfragen der Story-Sektion als Kacheln und die Archiv-Vorschau ohne Chat
 * (aus `website-story-sektion-rahmen.tsx` herausgeloest, 24.11.2026, Dateigrenze).
 */

import * as React from "react"
import { ArrowUpRight } from "lucide-react"
import { useTranslation } from "@ks/i18n/react"
import { cn } from "@ks/util"

/** Die Beispielfragen als Kacheln; Klick stellt die Frage sofort. */
export function StoryFragenKacheln({
  fragen,
  onFrage,
  gesperrt = false,
}: {
  fragen: string[]
  onFrage: (frage: string) => void
  gesperrt?: boolean
}): React.ReactElement | null {
  const { t } = useTranslation()
  if (fragen.length === 0) return null
  return (
    <div
      // Telefon (R2): eine waagrechte Reihe zum Wischen statt gestapelter Kacheln — das Fragefeld bleibt im Blick.
      className="not-prose mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0"
      role="group"
      aria-label={t("website.story.beispielfragen")}
      data-story-fragen
      // N5: zartes Gruen der Site, damit die Beispielfragen sich abheben; die gewaehlte
      // Frage traegt dann das kraeftigere „Deine Frage"-Gruen.
      style={{
        ['--kachel-bg' as string]: 'color-mix(in srgb, var(--site-accent, #16a34a) 4%, white)',
        ['--kachel-bg-hover' as string]: 'color-mix(in srgb, var(--site-accent, #16a34a) 10%, white)',
        ['--kachel-border' as string]: 'color-mix(in srgb, var(--site-accent, #16a34a) 18%, white)',
      }}
    >
      {fragen.map((frage, i) => (
        <button
          key={i}
          type="button"
          disabled={gesperrt}
          onClick={() => onFrage(frage)}
          className={cn(fragen.length > 1 ? "w-[82%]" : "w-full", "flex shrink-0 snap-start items-center justify-between gap-3 sm:w-auto rounded-xl border border-[color:var(--kachel-border)] bg-[color:var(--kachel-bg)] px-4 py-3 text-left text-sm leading-snug text-neutral-800 transition-colors hover:border-[color:var(--site-accent)] hover:bg-[color:var(--kachel-bg-hover)] disabled:opacity-60")}
        >
          <span>{frage}</span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-[color:var(--site-accent)]" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

/** Archiv-Vorschau ohne Chat: Fragen als Liste, Hinweis statt Eingabe. */
export function StoryVorschau({ fragen, hinweis }: { fragen: string[]; hinweis: string }): React.ReactElement {
  return (
    <div className="not-prose mt-4" data-story-vorschau>
      {fragen.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-800">
          {fragen.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}
      <p className="mt-4 rounded-lg border border-dashed border-black/15 px-4 py-3 text-sm text-neutral-500">{hinweis}</p>
    </div>
  )
}
