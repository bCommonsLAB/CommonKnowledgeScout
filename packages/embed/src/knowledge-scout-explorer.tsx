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
 *   und in ihn rendern Dialoge und Menues (`PortalContainerProvider`).
 *
 * Falsche Props werden im Rahmen gemeldet, nicht still ersetzt. Die
 * oeffentlichen Typen stehen in `typen.ts`.
 */

import { useEffect, useMemo, useState } from 'react'
import { Provider as JotaiProvider, createStore } from 'jotai'
import { createInstanceApi, type InstanceApi } from '@ks/api-client'
import { SUPPORTED_LOCALES, type Locale } from '@ks/i18n'
import { PortalContainerProvider } from '@ks/ui'
import { EmbedGalleryProviders } from '@ks/module-explorer/react'
import { EmbedGalerie } from './embed-galerie'
import { EmbedLocale } from './embed-locale'
import type {
  KnowledgeScoutExplorer as OeffentlicheErklaerung,
  KnowledgeScoutExplorerProps,
  KnowledgeScoutLocale,
} from './typen'

type Aufbau = { instanz: InstanceApi; locale: Locale } | { fehler: string }

/** Prueft die Props und baut die Instanz — oder sagt, was nicht stimmt. */
function aufbauen(baseUrl: string, view: string, locale: string): Aufbau {
  if (view !== 'gallery') {
    return { fehler: `Ansicht "${view}" gibt es im Embed noch nicht — bisher nur "gallery".` }
  }
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return { fehler: `Sprache "${locale}" wird nicht unterstuetzt — erlaubt: ${SUPPORTED_LOCALES.join(', ')}.` }
  }
  try {
    return { instanz: createInstanceApi({ baseUrl, acceptLanguage: locale }), locale: locale as Locale }
  } catch (e) {
    return { fehler: e instanceof Error ? e.message : String(e) }
  }
}

export function KnowledgeScoutExplorer({
  baseUrl,
  library,
  view,
  locale,
  height = '80vh',
  className,
}: KnowledgeScoutExplorerProps) {
  // Der Rahmen ist zugleich das Ziel fuer Dialoge und Menues (Radix-Portale).
  const [rahmen, setRahmen] = useState<HTMLDivElement | null>(null)
  const store = useMemo(() => createStore(), [])
  const aufbau = useMemo(() => aufbauen(baseUrl, view, locale), [baseUrl, view, locale])
  const fehler = 'fehler' in aufbau ? aufbau.fehler : null

  useEffect(() => {
    if (fehler) console.error(`[KnowledgeScoutExplorer] ${fehler}`)
  }, [fehler])

  return (
    <div
      ref={setRahmen}
      className={className ? `ks-embed ${className}` : 'ks-embed'}
      style={{ display: 'flex', flexDirection: 'column', position: 'relative', height }}
    >
      {'fehler' in aufbau ? (
        <p role="alert" className="p-4 text-sm text-destructive">
          KnowledgeScoutExplorer: {aufbau.fehler}
        </p>
      ) : (
        <JotaiProvider store={store}>
          <EmbedLocale locale={aufbau.locale} />
          <PortalContainerProvider container={rahmen}>
            <EmbedGalleryProviders instanz={aufbau.instanz}>
              <EmbedGalerie slug={library} instanz={aufbau.instanz} />
            </EmbedGalleryProviders>
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
