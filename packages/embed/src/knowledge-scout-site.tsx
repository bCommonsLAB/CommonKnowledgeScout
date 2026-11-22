'use client'

/**
 * `<KnowledgeScoutSite>` — die Startseite einer oeffentlichen Library in einer
 * fremden Seite (Plan `startseite-als-embed`, WE4).
 *
 * Die Seite selbst — Kopf, Sektionen, Kacheln, Fragen-Sektion mit Antwort und
 * Belegen, Galerie-Band, Fusszeile — kommt aus `@ks/module-website/react`; die
 * Huelle bringt mit, was die fremde Seite nicht hat:
 * - die Navigation aus `hrefFor`: jeder Weg hinaus ist ein Link der
 *   Container-Anwendung, `null` laesst das Element weg (Entscheid E),
 * - einen Portal-Ort am `body` mit Klasse `.ks-embed`: Blaetter, Dialoge und die
 *   Detailansicht liegen ueber dem FENSTER. Anders als beim Explorer hat der
 *   Rahmen kein `contain: layout` — bei natuerlicher Hoehe ist er hoeher als
 *   das Fenster, und `fixed` muss sich auf das Fenster beziehen (Plan 3.3),
 * - Sprache, eigenen Speicher, Tooltips (`embed-site-inhalt.tsx`).
 *
 * Falsche Props werden im Rahmen gemeldet, nicht still ersetzt. Die
 * oeffentlichen Typen stehen in `typen.ts`.
 */

import { useEffect, useMemo, useState } from 'react'
import { createInstanceApi, type InstanceApi } from '@ks/api-client'
import { SUPPORTED_LOCALES, type Locale } from '@ks/i18n'
import { EmbedSiteInhalt } from './embed-site-inhalt'
import type { KnowledgeScoutSite as OeffentlicheErklaerung, KnowledgeScoutSiteProps } from './typen'

type Aufbau = { instanz: InstanceApi; locale: Locale } | { fehler: string }

/** Prueft `hrefFor` und `page` — `null`, wenn sie passen. */
export function sitePropsFehler(hrefFor: unknown, page: unknown): string | null {
  if (typeof hrefFor !== 'function') {
    return 'hrefFor fehlt — die Startseite braucht die Adressen der Container-Anwendung (Ziel → Adresse oder null).'
  }
  if (page !== undefined && (typeof page !== 'string' || page.trim() === '')) {
    return `page ist leer oder kein Text (${JSON.stringify(page)}) — weglassen fuer die Startseite.`
  }
  return null
}

/**
 * Baut die Instanz — oder sagt, was nicht stimmt. Nur aus `baseUrl` und
 * `locale`: Die Container-Seite reicht `hrefFor` oft je Render neu, die
 * Instanz (und mit ihr jeder Abruf) bleibt dieselbe.
 */
export function siteAufbauen(baseUrl: string, locale: string): Aufbau {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return { fehler: `Sprache "${locale}" wird nicht unterstuetzt — erlaubt: ${SUPPORTED_LOCALES.join(', ')}.` }
  }
  try {
    return { instanz: createInstanceApi({ baseUrl, acceptLanguage: locale }), locale: locale as Locale }
  } catch (e) {
    return { fehler: e instanceof Error ? e.message : String(e) }
  }
}

/** Ein eigener Portal-Ort am `body`, solange die Komponente steht. */
function usePortalAmBody(): HTMLElement | null {
  const [knoten, setKnoten] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const div = document.createElement('div')
    div.className = 'ks-embed'
    div.setAttribute('data-ks-site-portal', '')
    document.body.appendChild(div)
    setKnoten(div)
    return () => {
      div.remove()
      setKnoten(null)
    }
  }, [])
  return knoten
}

export function KnowledgeScoutSite({ baseUrl, library, page, locale, hrefFor, documentsViaHrefFor = false, navigate, menu = true, height, className, carpet = true }: KnowledgeScoutSiteProps) {
  const aufbau = useMemo(() => siteAufbauen(baseUrl, locale), [baseUrl, locale])
  const portal = usePortalAmBody()
  const fehler = sitePropsFehler(hrefFor, page) ?? ('fehler' in aufbau ? aufbau.fehler : null)

  useEffect(() => {
    if (fehler) console.error(`[KnowledgeScoutSite] ${fehler}`)
  }, [fehler])

  // Wie beim Explorer erst im Browser montieren (Portal-Ort, Sprache beim Hydrieren).
  // Ohne `height`: natuerliche Hoehe, die Container-Seite scrollt; mit: eigener Scroll.
  return (
    <div
      className={className ? `ks-embed ${className}` : 'ks-embed'}
      style={height ? { position: 'relative', height, overflowY: 'auto' } : { position: 'relative' }}
      data-ks-site
    >
      {fehler !== null ? (
        <p role="alert" className="p-4 text-sm text-destructive">
          KnowledgeScoutSite: {fehler}
        </p>
      ) : portal === null || 'fehler' in aufbau ? null : (
        <EmbedSiteInhalt
          key={`${library}|${page ?? ''}`}
          library={library}
          instanz={aufbau.instanz}
          locale={aufbau.locale}
          page={page ?? null}
          hrefFor={hrefFor}
          dokumenteZuerstContainer={documentsViaHrefFor}
          navigate={navigate}
          menu={menu}
          teppichErlaubt={carpet}
          eigenerScroll={false}
          portal={portal}
        />
      )}
    </div>
  )
}

// Im Typecheck geprueft: Die Umsetzung passt zur oeffentlichen Erklaerung.
const passtZurErklaerung: typeof OeffentlicheErklaerung = KnowledgeScoutSite
void passtZurErklaerung
