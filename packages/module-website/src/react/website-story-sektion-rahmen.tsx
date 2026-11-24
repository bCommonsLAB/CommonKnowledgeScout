"use client"

/**
 * Rahmen der Story-Sektion (Welle N1, Plan website-story-sektion): die Karte
 * auf der Flaeche der Sektion mit der Status-Plakette, dem Markdown VOR dem Block `questions`, der Fragebox,
 * dem Chat und dem Markdown DANACH darunter. Der Chat selbst kommt als Kinder vom
 * Live-Baustein (`website-story-sektion.tsx`); ohne Kinder (Archiv-Vorschau,
 * kein Slot) stehen die Fragen als Liste mit Hinweis.
 *
 * Die Karte ist immer weiss mit dunkler Schrift (wie `box kind=card`), die
 * Flaeche dahinter kommt aus dem Design-Profil; Akzente nur ueber `--site-*`.
 */

import * as React from "react"
import { X } from "lucide-react"
import { useTranslation } from "@ks/i18n/react"
import {
  type HeadingCase,
  type WebsiteSection,
  storyBloecke,
  OLDIES_THEME,
  type SiteThemeResolved,
  KICKER_CLASS,
  surfaceStyle,
} from ".."
import { SectionContent } from "./section-content"
import { cn } from "@ks/util"
import { StoryVorschau } from "./website-story-kacheln"

export { StoryFragenKacheln } from "./website-story-kacheln"

export interface WebsiteStorySektionRahmenProps {
  section: WebsiteSection
  headingCase?: HeadingCase
  theme?: SiteThemeResolved
  /** Status-Plakette, klein ueber dem Markdown der Sektion. */
  status?: React.ReactNode
  /** Der Chat (Kacheln, Konversation, Eingabe). Ohne Kinder: Vorschau mit den Fragen als Liste. */
  children?: React.ReactNode
  /**
   * Teppich der Dokumente (Plan `teppich-der-dokumente`, T2): eine Ebene hinter der Sektion, die
   * Wolke liegt hinter der Antwort (Owner 23.11.2026). Sie nimmt Klicks an, wo keine Karte liegt.
   */
  teppich?: React.ReactNode
  /** Erkunden (Graph-Ansicht): die Zone der Antwort weicht, die Wolke liegt frei (`ERKUNDEN`). */
  abgetaucht?: boolean
  /** Eine Frage laeuft: nur die Teile der Antwort sind verborgen, danach blenden sie ein. */
  fragt?: boolean
  /** Den Hinweis „Klick auf eine freie Stelle …" zeigen (nur beim Erkunden). */
  hinweis?: boolean
  /** Die Fragebox: ueber dem Chat, direkt unter dem Markdown der Sektion (R1, 24.11.2026). */
  eingabe?: React.ReactNode
  /**
   * Telefon (R3, 24.11.2026): Die Sektion liegt fest ueber dem Bildschirm — oben die Fragebox mit
   * Schliessen-Knopf, darunter nur Wolke und Antwort; Kopfzeile, Markdown und Legende ruhen.
   */
  vollbild?: boolean
  onVollbildZu?: () => void
}

/**
 * Mit Teppich ist die Antwort kein eigenes Fenster: kein Hintergrund, kein Rand, kein Schatten;
 * auch die Flaechen der Antwort werden durchsichtig, die Punktwolke liegt sichtbar dahinter
 * (Owner 22.11.2026). Klicks nimmt nur, was im Inhalt steht. Auf dem Telefon (R2, 24.11.2026)
 * faellt auch der Innenabstand weg: keine Karte in der Karte, die Lesebreite ist die der Sektion.
 */
const TEPPICH_KARTE = "pointer-events-auto bg-transparent [&_[data-antwort]>div:last-child]:!px-0 sm:[&_[data-antwort]>div:last-child]:!px-5 [&_[data-antwort]_div]:!bg-transparent [&_[data-antwort]_div]:!shadow-none [&_[data-antwort]_div]:!border-transparent"

/**
 * Ruhiges Layout beim Fragen (Owner 23.11.2026: „es baut sich nach unten die Antwort auf"): Die
 * Zone der Antwort haelt den Platz der Wolke frei (`--teppich-platz`, gesetzt von `useTeppichHalt`),
 * die Seite waechst nur nach unten. Die Teile der Antwort blenden weich ein und aus.
 */
const TEPPICH_ZONE = "[&_[data-story-karten-modus]]:min-h-[var(--teppich-platz,0px)]"
/**
 * Die Antwort blendet fliessend ein, nicht auf einen Schlag (Owner 23.11.2026): erst der Text, kurz
 * danach die Karten. Als Animation, damit es auch gilt, wenn die Teile erst in diesem Moment entstehen
 * (ein Uebergang der Deckkraft greift bei frisch eingehaengten Elementen nicht).
 */
const ANTWORT_EIN = "@keyframes ks-antwort-ein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"
const ANTWORT_SICHTBAR = "[&_[data-antwort]]:[animation:ks-antwort-ein_1400ms_ease_both] [&_[data-story-karten]]:[animation:ks-antwort-ein_1400ms_ease_500ms_both] [&_[data-story-fruehere-fragen]]:[animation:ks-antwort-ein_1400ms_ease_500ms_both]"
/**
 * Erkunden (Owner 23.11.2026: „der Graph beginnt erst ab der Frage, was drueber ist, kann stehen
 * bleiben"): nur die Zone der Antwort weicht; gibt es noch keine, der ganze Vordergrund.
 */
const ERKUNDEN = "[&_[data-story-karten-modus]]:invisible [&:not(:has([data-story-karten-modus]))]:invisible"
const ANTWORT_VERBORGEN = "[&_[data-antwort]]:pointer-events-none [&_[data-antwort]]:opacity-0 [&_[data-antwort-laeuft]]:opacity-0 [&_[data-story-karten]]:pointer-events-none [&_[data-story-karten]]:opacity-0 [&_[data-story-fruehere-fragen]]:opacity-0"

export function WebsiteStorySektionRahmen({
  section,
  headingCase = "capitalize",
  theme = OLDIES_THEME,
  status,
  children,
  teppich,
  abgetaucht = false,
  fragt = false,
  hinweis = false,
  eingabe,
  vollbild = false,
  onVollbildZu,
}: WebsiteStorySektionRahmenProps): React.ReactElement {
  const { t } = useTranslation()
  const flaeche = surfaceStyle(section.bg, theme)
  const { vor, fragen, nach } = React.useMemo(() => storyBloecke(section), [section])

  return (
    <section
      className={cn(
        "isolate px-4 sm:px-6",
        // Vollbild: dieselbe Sektion, fest ueber dem Bildschirm; sie scrollt in sich (Leseansicht).
        // Solange die Frage laeuft, gehoert jede Fingerbewegung dem Schwarm.
        vollbild ? cn("fixed inset-0 z-50 overflow-y-auto overscroll-contain pb-8", fragt && "touch-none") : "relative py-8 sm:py-14",
        flaeche.className,
      )}
      style={flaeche.style}
      data-website-story
      data-story-vollbild={vollbild || undefined}
    >
      {teppich && <style>{ANTWORT_EIN}</style>}
      {teppich && <div className="absolute inset-0 z-0">{teppich}</div>}
      {/* Mit Teppich: Klicks gehen nur dort an die Karte, wo sie liegt; sonst an den Teppich. */}
      <div
        className={cn(
          "relative z-10 mx-auto max-w-5xl transition-opacity duration-300",
          teppich && "pointer-events-none",
          teppich && TEPPICH_ZONE,
          teppich && (fragt ? ANTWORT_VERBORGEN : ANTWORT_SICHTBAR),
          abgetaucht && ERKUNDEN,
        )}
      >
        {section.kicker && !vollbild && <p className={KICKER_CLASS}>{section.kicker}</p>}
        <div className={cn(vollbild ? "overflow-visible" : "overflow-hidden", "text-neutral-900", teppich ? TEPPICH_KARTE : "rounded-3xl border border-black/10 bg-white shadow-lg")}>
          <div className={cn("pb-5 sm:px-10 sm:pb-6 sm:pt-8", vollbild ? "pt-0" : "pt-6", teppich ? "px-0" : "px-4")}>
            {/* Die Karte ist weiss: Markdown-Farben der Flaeche `default`, nicht der Sektions-Flaeche. */}
            {/* Status-Plakette klein ueber der Ueberschrift (Owner 24.11.2026) — keine eigene Kopfzeile mehr. */}
            {status && !vollbild && <div className="mb-3" data-story-status>{status}</div>}
            {vor.length > 0 && !vollbild && <SectionContent blocks={vor} bg="default" headingCase={headingCase} theme={theme} />}
            {vollbild ? (
              // Kopf des Vollbilds: bleibt beim Lesen der Antwort oben stehen, deckend in der Farbe der Flaeche.
              <div
                className={cn("pointer-events-auto sticky top-0 z-20 -mx-4 mb-2 flex items-start gap-1 px-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]", teppich ? flaeche.className : "bg-white")}
                style={teppich ? flaeche.style : undefined}
                data-story-vollbild-kopf
              >
                <button type="button" onClick={onVollbildZu} aria-label={t("website.story.vollbildZu")} title={t("website.story.vollbildZu")} className="flex h-12 w-11 shrink-0 items-center justify-center rounded-full text-current" data-story-vollbild-zu>
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">{eingabe}</div>
              </div>
            ) : eingabe}
            {children ?? <StoryVorschau fragen={fragen} hinweis={t("website.story.vorschauHinweis")} />}
            {nach.length > 0 && !vollbild && (
              // Legende/Vertrauenszeile: klein und dezent (Vorlage) — ueberschreibt die
              // Prose-Groesse der Absaetze, die sonst 20 px betraegt.
              <div className="mt-6 [&_p]:mb-0 [&_p]:!text-xs [&_p]:leading-relaxed [&_p]:text-neutral-500 sm:[&_p]:!text-sm">
                <SectionContent blocks={nach} bg="default" headingCase={headingCase} theme={theme} />
              </div>
            )}
          </div>
        </div>
      </div>
      {hinweis && (
        // An der Oberkante der Wolke (`--teppich-oben` aus `useTeppichHalt`): dort, wo man hinsieht.
        <p className="pointer-events-none absolute left-1/2 top-[calc(var(--teppich-oben,0px)+0.75rem)] z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-neutral-600 shadow-sm" data-teppich-hinweis>
          {t("website.story.teppichZurueck")}
        </p>
      )}
    </section>
  )
}
