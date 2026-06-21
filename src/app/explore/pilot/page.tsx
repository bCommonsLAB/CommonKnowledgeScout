/**
 * Phase-0-Pilot: Landingpage „Oldies for Future" hardcodiert, um UX und
 * Ladezeit fuer den geplanten detailViewType `website` zu testen.
 *
 * - Oeffentlich erreichbar unter /explore/pilot (Middleware: /explore(.*)),
 *   d. h. OHNE Login-Block. Server-Component, kein Daten-Fetch.
 * - Bild-URLs zeigen auf die Storage-Web-Route der Quell-Library (Azure dahinter).
 *   Fuer die spaetere oeffentliche Version werden das direkte Azure-URLs.
 *   Alle Bild-Quellen liegen hier zentral in `IMG` und sind in einem Griff
 *   austauschbar.
 *
 * Konzept: docs/analysis/landingpage-vereinfachung-webseite-detailviewtype.md (§15)
 */

import * as React from 'react'
import type { Metadata } from 'next'
import { WebsiteLandingView } from '@/components/library/website/website-landing-view'
import type { WebsiteLandingData } from '@/lib/website/types'

const IMG = '/api/library/eec9f788-880a-41c5-a668-f325c4a0039b/web/web/images'

const BODY = `
<!-- section layout=image-right bg=light -->
## Wer sind wir?
![Gruppenfoto Oldies for Future](${IMG}/IMG-20230419-WA0003.jpg)

Wir „Oldies for Future" wollen uns mit den jungen Menschen solidarisieren und sie in ihren Anliegen und Forderungen nach einer lebenswerten Zukunft unterstützen.

Die Jugend findet mit ihren Zukunftsängsten bei unserer Generation der Verursacher dieser bedrohenden Entwicklung zu wenig Gehör. Wir möchten dabei nicht tatenlos zusehen und unseren Ruhestand genießen, sondern unsere Erfahrung und unser Engagement mit einbringen.
<!-- /section -->

<!-- section layout=image-left bg=brand -->
## Warum machen wir das?
![](${IMG}/oldies-for-future-warum_web.jpg)

Das gegebene kapitalistische Wirtschaftssystem weckt im Menschen unersättliche Bedürfnisse nach Konsum und Reichtum.

Dies kann nur durch grenzenloses Wachstum, Ausbeutung von menschlichen und natürlichen Ressourcen befriedigt werden. Wir leben in einem Teufelskreis von manipulativen Einflüssen, gedankenlosem Konsumwahn und Konkurrenzdenken.
<!-- /section -->

<!-- section layout=image-right bg=light -->
## Was ist die Lösung?
![](${IMG}/oldies-for-future-loesung-2K_web.webp)

Es braucht ein neues Bewusstsein von einem gerechten Leben für alle im Einklang mit Umwelt und Natur.

Dem Menschen muss bewusst werden, dass er Teil der Natur ist und nicht über ihr steht. Die dringendsten Maßnahmen sind der Ausstieg aus den fossilen Energieträgern und der Erhalt der Biodiversität.
<!-- /section -->

<!-- section layout=text-only bg=dark -->
> Was wir heute tun, entscheidet darüber, wie die Welt morgen aussieht.
> — Marie von Ebner-Eschenbach
<!-- /section -->
`

const PILOT_DATA: WebsiteLandingData = {
  title: 'Oldies for Future',
  heroSubtitle:
    'Wir solidarisieren uns mit jungen Menschen für eine lebenswerte Zukunft – und werden gemeinsam aktiv.',
  heroImageUrl: `${IMG}/oldies-for-future-headimage-2_web.jpg`,
  heroImageAlt: '2 Hände',
  videoUrl: 'https://peertube.uno/videos/embed/aCkAAGUmJPd8XujxU7gZJq',
  ctaLabel: 'Jetzt mitmachen',
  ctaUrl: '#mitmachen',
  body: BODY,
  menu: [
    { label: 'Home', href: '#' },
    { label: 'Über uns', href: '#ueber-uns' },
    { label: 'Aktionen', href: '#aktionen' },
    { label: 'Galerie', href: '#galerie' },
    { label: 'Story', href: '#story' },
  ],
  bannerTitle: 'Aktuelles aus unserer Library',
  galleryHref: '#galerie',
  bannerItems: [
    {
      title: 'Petition Stop Transit – Walli Klapfer',
      href: '#doc-1',
      imageUrl: `${IMG}/oldies-for-future-gemeinsamaktiv_web.jpg`,
    },
    {
      title: 'Aktionsbericht: Gemeinsam aktiv',
      href: '#doc-2',
      imageUrl: `${IMG}/IMG-20230419-WA0003.jpg`,
    },
    {
      title: 'Warum wir handeln',
      href: '#doc-3',
      imageUrl: `${IMG}/oldies-for-future-warum_web.jpg`,
    },
  ],
}

export const metadata: Metadata = {
  title: PILOT_DATA.title,
  description: PILOT_DATA.heroSubtitle,
}

export default function LandingPagePilotPage(): React.ReactElement {
  return <WebsiteLandingView data={PILOT_DATA} />
}
