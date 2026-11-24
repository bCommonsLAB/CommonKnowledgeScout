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
import { ArrowUpRight, ChevronDown } from "lucide-react"
import { useTranslation } from "@ks/i18n/react"
import type { StoryTopic } from "@ks/contracts"
import {
  type HeadingCase,
  type WebsiteSection,
  OLDIES_THEME,
  type SiteThemeResolved,
  KICKER_CLASS,
  surfaceStyle,
} from ".."
import { SectionContent } from "./section-content"
import { cn } from "@ks/util"
import { useSchmal } from "./use-schmal"

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
    <section className={cn("px-4 py-10 sm:px-6 sm:py-14", flaeche.className)} style={flaeche.style} data-website-themen>
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

/**
 * Eine Karte je Thema; Klick auf eine Frage uebergibt sie an die Story-Sektion.
 * Telefon (R2, 24.11.2026): ein Akkordeon — der Titel klappt Kurztext und Fragen
 * auf, anfangs ist das erste Thema offen. So bleibt die Seite kurz.
 */
export function ThemenKarten({ themen, onFrage }: { themen: StoryTopic[]; onFrage: (frage: string) => void }): React.ReactElement {
  const { t } = useTranslation()
  const schmal = useSchmal()
  const [offen, setOffen] = React.useState<string | null>(themen[0]?.id ?? null)
  return (
    <ul className="not-prose mt-6 grid gap-2 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3" data-themen-karten={themen.length}>
      {themen.map((thema) => {
        const auf = offen === thema.id
        return (
          <li key={thema.id} className="flex flex-col rounded-2xl border border-black/10 bg-white p-4 text-neutral-900 shadow-sm sm:p-5" data-thema-offen={schmal ? auf : undefined}>
            <h3 className="text-base font-semibold leading-snug">
              {schmal ? (
                <button type="button" aria-expanded={auf} onClick={() => setOffen(auf ? null : thema.id)} className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left" data-thema-kopf>
                  <span>{thema.title}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-neutral-500 transition-transform", auf && "rotate-180")} aria-hidden="true" />
                </button>
              ) : thema.title}
            </h3>
            {/* Vor dem ersten Effekt entscheidet allein die Breite (`sm:`): kein Aufklappen-und-wieder-Zuklappen. */}
            <div className={auf ? "block" : "hidden sm:block"}>
              {thema.summary && <p className="mt-2 text-sm leading-relaxed text-neutral-600">{thema.summary}</p>}
              {thema.questions.length > 0 && (
                <div className="mt-4 flex flex-col gap-2" role="group" aria-label={t("website.story.themenFragen", { title: thema.title })}>
                  {thema.questions.map((frage) => (
                    <button
                      key={frage.id}
                      type="button"
                      onClick={() => onFrage(frage.text)}
                      className="flex items-start justify-between gap-2 rounded-lg border border-[color:color-mix(in_srgb,var(--site-accent,#16a34a)_18%,white)] bg-[color:color-mix(in_srgb,var(--site-accent,#16a34a)_4%,white)] px-3 py-2.5 text-left text-sm leading-snug text-neutral-800 transition-colors hover:border-[color:var(--site-accent)] hover:bg-[color:color-mix(in_srgb,var(--site-accent,#16a34a)_10%,white)] sm:py-2"
                    >
                      <span>{frage.text}</span>
                      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--site-accent)]" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
