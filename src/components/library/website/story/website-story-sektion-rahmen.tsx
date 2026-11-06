"use client"

/**
 * Rahmen der Story-Sektion (Welle N1, Plan website-story-sektion): die Karte
 * auf der Flaeche der Sektion mit Kopfzeile (Status links, „Antworten
 * anpassen" rechts), dem Markdown VOR dem Block `questions` ueber dem Chat
 * und dem Markdown DANACH darunter. Der Chat selbst kommt als Kinder vom
 * Live-Baustein (`website-story-sektion.tsx`); ohne Kinder (Archiv-Vorschau,
 * kein Slot) stehen die Fragen als Liste mit Hinweis.
 *
 * Die Karte ist immer weiss mit dunkler Schrift (wie `box kind=card`), die
 * Flaeche dahinter kommt aus dem Design-Profil; Akzente nur ueber `--site-*`.
 */

import * as React from "react"
import { ArrowUpRight } from "lucide-react"
import { useTranslation } from "@ks/i18n/react"
import type { HeadingCase, WebsiteSection } from "@/lib/website/types"
import { storyBloecke } from "@/lib/website/story-section"
import { OLDIES_THEME, type SiteThemeResolved } from "@/lib/website/site-theme"
import { KICKER_CLASS, surfaceStyle } from "@/lib/website/surface-style"
import { SectionContent } from "@/components/library/website/section-content"
import { cn } from "@/lib/utils"

export interface WebsiteStorySektionRahmenProps {
  section: WebsiteSection
  headingCase?: HeadingCase
  theme?: SiteThemeResolved
  /** Links im Kopf der Karte (Status-Plakette). */
  status?: React.ReactNode
  /** Rechts im Kopf der Karte („Antworten anpassen"). */
  kopf?: React.ReactNode
  /** Der Chat (Kacheln, Konversation, Eingabe). Ohne Kinder: Vorschau mit den Fragen als Liste. */
  children?: React.ReactNode
}

export function WebsiteStorySektionRahmen({
  section,
  headingCase = "capitalize",
  theme = OLDIES_THEME,
  status,
  kopf,
  children,
}: WebsiteStorySektionRahmenProps): React.ReactElement {
  const { t } = useTranslation()
  const flaeche = surfaceStyle(section.bg, theme)
  const { vor, fragen, nach } = React.useMemo(() => storyBloecke(section), [section])

  return (
    <section className={cn("px-6 py-14", flaeche.className)} style={flaeche.style} data-website-story>
      <div className="mx-auto max-w-5xl">
        {section.kicker && <p className={KICKER_CLASS}>{section.kicker}</p>}
        <div className="overflow-hidden rounded-3xl border border-black/10 bg-white text-neutral-900 shadow-lg">
          {(status || kopf) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-6 py-4">
              <div>{status}</div>
              <div>{kopf}</div>
            </div>
          )}
          <div className="px-6 pb-6 pt-8 sm:px-10">
            {/* Die Karte ist weiss: Markdown-Farben der Flaeche `default`, nicht der Sektions-Flaeche. */}
            {vor.length > 0 && <SectionContent blocks={vor} bg="default" headingCase={headingCase} theme={theme} />}
            {children ?? <StoryVorschau fragen={fragen} hinweis={t("website.story.vorschauHinweis")} />}
            {nach.length > 0 && (
              // Legende/Vertrauenszeile: klein und dezent (Vorlage) — ueberschreibt die
              // Prose-Groesse der Absaetze, die sonst 20 px betraegt.
              <div className="mt-6 [&_p]:mb-0 [&_p]:!text-xs [&_p]:leading-relaxed [&_p]:text-neutral-500 sm:[&_p]:!text-sm">
                <SectionContent blocks={nach} bg="default" headingCase={headingCase} theme={theme} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

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
      className="not-prose mt-6 grid gap-3 sm:grid-cols-2"
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
          className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--kachel-border)] bg-[color:var(--kachel-bg)] px-4 py-3 text-left text-sm leading-snug text-neutral-800 transition-colors hover:border-[color:var(--site-accent)] hover:bg-[color:var(--kachel-bg-hover)] disabled:opacity-60"
        >
          <span>{frage}</span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-[color:var(--site-accent)]" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

/** Archiv-Vorschau ohne Chat: Fragen als Liste, Hinweis statt Eingabe. */
function StoryVorschau({ fragen, hinweis }: { fragen: string[]; hinweis: string }): React.ReactElement {
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
