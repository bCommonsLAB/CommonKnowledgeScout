"use client"

/**
 * Rahmen der Sektion `layout=topics` (Owner 18.11.2026): Flaeche und
 * Kennzeile der Sektion, ihr Markdown (Ueberschrift, Einleitung), darunter
 * eine Karte je Thema der Themenuebersicht des Story-Modus — Titel, Kurztext
 * und die vorgeschlagenen Fragen. Die Karten kommen als Kinder vom
 * Live-Baustein (`website-themen-sektion.tsx`); ohne Kinder (Archiv-Vorschau,
 * kein Slot) steht ein Hinweis.
 *
 * Karten weiss mit dunkler Schrift wie die Story-Karte; Akzente nur ueber `--site-*`.
 */

import * as React from "react"
import { ArrowUpRight } from "lucide-react"
import { useTranslation } from "@ks/i18n/react"
import type { StoryTopic } from "@ks/contracts"
import {
  type HeadingCase,
  type WebsiteSection,
  OLDIES_THEME,
  type SiteThemeResolved,
  KICKER_CLASS,
  surfaceStyle,
} from "@ks/module-website"
import { SectionContent } from "@/components/library/website/section-content"
import { cn } from "@/lib/utils"

export interface WebsiteThemenRahmenProps {
  section: WebsiteSection
  headingCase?: HeadingCase
  theme?: SiteThemeResolved
  /** Die Themenkarten (Live-Seite). Ohne Kinder: Hinweis fuer die Vorschau. */
  children?: React.ReactNode
}

export function WebsiteThemenRahmen({ section, headingCase = "capitalize", theme = OLDIES_THEME, children }: WebsiteThemenRahmenProps): React.ReactElement {
  const { t } = useTranslation()
  const flaeche = surfaceStyle(section.bg, theme)
  return (
    <section className={cn("px-6 py-14", flaeche.className)} style={flaeche.style} data-website-themen>
      <div className="mx-auto max-w-5xl">
        {section.kicker && <p className={KICKER_CLASS}>{section.kicker}</p>}
        {section.blocks.length > 0 && <SectionContent blocks={section.blocks} bg={section.bg} headingCase={headingCase} theme={theme} />}
        {children ?? (
          <p className="mt-6 rounded-lg border border-dashed border-current/20 px-4 py-3 text-sm opacity-70" data-themen-vorschau>
            {t("website.story.themenVorschauHinweis")}
          </p>
        )}
      </div>
    </section>
  )
}

/** Eine Karte je Thema; Klick auf eine Frage uebergibt sie an die Story-Sektion. */
export function ThemenKarten({ themen, onFrage }: { themen: StoryTopic[]; onFrage: (frage: string) => void }): React.ReactElement {
  const { t } = useTranslation()
  return (
    <ul className="not-prose mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-themen-karten={themen.length}>
      {themen.map((thema) => (
        <li key={thema.id} className="flex flex-col rounded-2xl border border-black/10 bg-white p-5 text-neutral-900 shadow-sm">
          <h3 className="text-base font-semibold leading-snug">{thema.title}</h3>
          {thema.summary && <p className="mt-2 text-sm leading-relaxed text-neutral-600">{thema.summary}</p>}
          {thema.questions.length > 0 && (
            <div className="mt-4 flex flex-col gap-2" role="group" aria-label={t("website.story.themenFragen", { title: thema.title })}>
              {thema.questions.map((frage) => (
                <button
                  key={frage.id}
                  type="button"
                  onClick={() => onFrage(frage.text)}
                  className="flex items-start justify-between gap-2 rounded-lg border border-[color:color-mix(in_srgb,var(--site-accent,#16a34a)_18%,white)] bg-[color:color-mix(in_srgb,var(--site-accent,#16a34a)_4%,white)] px-3 py-2 text-left text-sm leading-snug text-neutral-800 transition-colors hover:border-[color:var(--site-accent)] hover:bg-[color:color-mix(in_srgb,var(--site-accent,#16a34a)_10%,white)]"
                >
                  <span>{frage.text}</span>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--site-accent)]" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
