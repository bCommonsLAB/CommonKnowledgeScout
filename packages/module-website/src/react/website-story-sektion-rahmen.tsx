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
  /** Unter dem Chat (die Eingabe). */
  fuss?: React.ReactNode
}

/**
 * Mit Teppich ist die Antwort kein eigenes Fenster: kein Hintergrund, kein Rand, kein Schatten;
 * auch die Flaechen der Antwort werden durchsichtig, die Punktwolke liegt sichtbar dahinter
 * (Owner 22.11.2026). Klicks nimmt nur, was im Inhalt steht.
 */
const TEPPICH_KARTE = "pointer-events-auto bg-transparent [&_[data-antwort]_div]:!bg-transparent [&_[data-antwort]_div]:!shadow-none [&_[data-antwort]_div]:!border-transparent"

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
  kopf,
  children,
  teppich,
  abgetaucht = false,
  fragt = false,
  hinweis = false,
  fuss,
}: WebsiteStorySektionRahmenProps): React.ReactElement {
  const { t } = useTranslation()
  const flaeche = surfaceStyle(section.bg, theme)
  const { vor, fragen, nach } = React.useMemo(() => storyBloecke(section), [section])

  return (
    <section className={cn("relative isolate px-6 py-14", flaeche.className)} style={flaeche.style} data-website-story>
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
        {section.kicker && <p className={KICKER_CLASS}>{section.kicker}</p>}
        <div className={cn("overflow-hidden text-neutral-900", teppich ? TEPPICH_KARTE : "rounded-3xl border border-black/10 bg-white shadow-lg")}>
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
            {fuss}
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
      {hinweis && (
        // An der Oberkante der Wolke (`--teppich-oben` aus `useTeppichHalt`): dort, wo man hinsieht.
        <p className="pointer-events-none absolute left-1/2 top-[calc(var(--teppich-oben,0px)+0.75rem)] z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-neutral-600 shadow-sm" data-teppich-hinweis>
          {t("website.story.teppichZurueck")}
        </p>
      )}
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
