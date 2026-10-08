'use client'

/**
 * @fileoverview `<KnowledgeScoutExplorer>` — die Galerie einer oeffentlichen Library in einer fremden Seite.
 *
 * @description
 * Die Huelle des Embeds (M5, ADR 0008). Sie montiert die Galerie aus
 * `@ks/module-explorer` mit den drei Embed-Antworten (`EmbedGalleryProviders`:
 * anonymer Betrachter, stiller Gastgeber, Adressierung im Speicher) gegen die
 * zentrale Instanz (`baseUrl`) — nur oeffentliche Libraries, kein Site-Token,
 * keine Anmeldung.
 *
 * Was die Huelle selbst mitbringt, weil die fremde Seite es nicht hat:
 * - einen eigenen Jotai-Speicher: Die Galerie-Atome kollidieren weder mit der
 *   Seite noch mit einem zweiten Embed,
 * - die Sprache als Prop — fuer die Oberflaeche und, als `Accept-Language`,
 *   fuer die Inhalte der Instanz,
 * - den Rahmen `.ks-embed`: Unter ihm liegen alle Stile (`@ks/embed/styles.css`),
 *   und in ihn rendern Dialoge und Menues (`PortalContainerProvider`),
 * - den `TooltipProvider`, den die Anwendung im Wurzel-Layout setzt: Ohne ihn
 *   stuerzt jede Galerie-Komponente ab, die einen Tooltip ohne eigenen Provider
 *   zeigt (Quellenverzeichnis beim Wechsel Story → Galerie, 08.10.2026).
 *
 * Falsche Props werden im Rahmen gemeldet, nicht still ersetzt. Die
 * oeffentlichen Typen stehen in `typen.ts`.
 */

import { useEffect, useMemo, useState } from 'react'
import { Provider as JotaiProvider, createStore } from 'jotai'
import { createInstanceApi, type InstanceApi } from '@ks/api-client'
import { SUPPORTED_LOCALES, type Locale } from '@ks/i18n'
import { PortalContainerProvider, TooltipProvider } from '@ks/ui'
import { EmbedGalleryProviders } from '@ks/module-explorer/react'
import { EmbedGalerie } from './embed-galerie'
import { EmbedLocale } from './embed-locale'
import type {
  KnowledgeScoutExplorer as OeffentlicheErklaerung,
  KnowledgeScoutExplorerProps,
  KnowledgeScoutLocale,
} from './typen'

type Ansicht = KnowledgeScoutExplorerProps['view']
const ANSICHTEN: readonly Ansicht[] = ['gallery', 'story']
type Aufbau = { instanz: InstanceApi; locale: Locale; view: Ansicht; story: boolean } | { fehler: string }

/** Prueft die Props und baut die Instanz — oder sagt, was nicht stimmt. */
function aufbauen(baseUrl: string, view: string, locale: string, enableStory: boolean | undefined): Aufbau {
  if (!(ANSICHTEN as readonly string[]).includes(view)) {
    return { fehler: `Ansicht "${view}" gibt es im Embed nicht — erlaubt: ${ANSICHTEN.join(', ')}.` }
  }
  // Die Story-Ansicht ohne Story-Modus widerspricht sich — melden statt still eins von beiden nehmen.
  if (view === 'story' && enableStory === false) {
    return { fehler: 'view="story" und enableStory={false} widersprechen sich — fuer die Galerie ohne Story view="gallery" nehmen.' }
  }
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return { fehler: `Sprache "${locale}" wird nicht unterstuetzt — erlaubt: ${SUPPORTED_LOCALES.join(', ')}.` }
  }
  try {
    return {
      instanz: createInstanceApi({ baseUrl, acceptLanguage: locale }),
      locale: locale as Locale,
      view: view as Ansicht,
      story: view === 'story' || enableStory === true,
    }
  } catch (e) {
    return { fehler: e instanceof Error ? e.message : String(e) }
  }
}

export function KnowledgeScoutExplorer({
  baseUrl,
  library,
  view,
  locale,
  enableStory,
  height = '80vh',
  className,
}: KnowledgeScoutExplorerProps) {
  // Der Rahmen ist zugleich das Ziel fuer Dialoge und Menues (Radix-Portale).
  const [rahmen, setRahmen] = useState<HTMLDivElement | null>(null)
  const store = useMemo(() => createStore(), [])
  const aufbau = useMemo(() => aufbauen(baseUrl, view, locale, enableStory), [baseUrl, view, locale, enableStory])
  const fehler = 'fehler' in aufbau ? aufbau.fehler : null

  useEffect(() => {
    if (fehler) console.error(`[KnowledgeScoutExplorer] ${fehler}`)
  }, [fehler])

  // Die Galerie montiert erst im Browser, wenn der Rahmen steht. Sie laedt ihre
  // Daten ohnehin dort; auf dem Server entstuende nur ein Ladezustand, dessen
  // Sprache beim Hydrieren nicht zum Browser passt (Hydrierungsfehler im
  // Nachweis in einer Next-16-App, 10.09.2026). Der Rahmen selbst steht sofort
  // da, mit seiner Hoehe — die fremde Seite springt nicht.
  //
  // `contain: layout` macht den Rahmen zum Bezug fuer alles, was in ihm `fixed`
  // steht: Die Detailansicht der Galerie (`fixed inset-0`) deckte sonst das
  // ganze Fenster der fremden Seite zu (Nachweis, 10.09.2026). Ihr z-index
  // zaehlt so nur im Rahmen; Radix-Menues (floating-ui) kennen den Bezug.
  return (
    <div
      ref={setRahmen}
      className={className ? `ks-embed ${className}` : 'ks-embed'}
      style={{ display: 'flex', flexDirection: 'column', position: 'relative', height, contain: 'layout' }}
    >
      {'fehler' in aufbau ? (
        <p role="alert" className="p-4 text-sm text-destructive">
          KnowledgeScoutExplorer: {aufbau.fehler}
        </p>
      ) : rahmen === null ? null : (
        <JotaiProvider store={store}>
          <EmbedLocale locale={aufbau.locale} />
          <PortalContainerProvider container={rahmen}>
            <TooltipProvider>
              {/* D6b: Die Story-Ansicht startet im Story-Modus der Galerie (Adressierung im Speicher). */}
              <EmbedGalleryProviders instanz={aufbau.instanz} initialParams={aufbau.view === 'story' ? 'mode=story' : undefined}>
                <EmbedGalerie slug={library} instanz={aufbau.instanz} story={aufbau.story} locale={aufbau.locale} />
              </EmbedGalleryProviders>
            </TooltipProvider>
          </PortalContainerProvider>
        </JotaiProvider>
      )}
    </div>
  )
}

// Im Typecheck geprueft, nicht zur Laufzeit: Die Umsetzung passt zur
// oeffentlichen Erklaerung (`dist/index.d.ts`), und die Sprachen des Embeds
// sind genau die von `@ks/i18n` — in beide Richtungen.
type Gleich<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const passtZurErklaerung: typeof OeffentlicheErklaerung = KnowledgeScoutExplorer
const sprachenPassen: Gleich<KnowledgeScoutLocale, Locale> = true
void passtZurErklaerung
void sprachenPassen
