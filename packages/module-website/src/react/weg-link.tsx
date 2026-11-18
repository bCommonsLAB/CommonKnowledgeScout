/**
 * Links der Startseite ueber die Navigation-Schnittstelle (WE2).
 *
 * `WegLink` rendert einen Weg als gewoehnlichen Link: die Adresse fuer
 * Mittelklick, Kontextmenue und Browser ohne JS, der Wechsel ohne Neuladen nur
 * beim normalen Linksklick. `AutorenLink` tut dasselbe fuer eine Adresse, die
 * der Autor geschrieben hat (Kopf-CTA): Ziel des Vokabulars ueber
 * `navigation.weg`, absolute Adresse unveraendert, fremde relative Adresse
 * ueber `navigation.fremd`. Ohne Navigation (Archiv-Vorschau) bleibt es der
 * rohe Link wie vor WE2.
 */

import * as React from 'react'
import { autorenLink, wegFehltMelden, type WebsiteNavigation, type WebsiteWeg } from '..'

/** Normaler Linksklick (ohne Umschalt-, Strg-, Alt-, Meta-Taste): den Rueckruf nehmen, sonst folgt der Browser dem Link. */
export function istPlainClick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

type AnkerAttribute = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>

export function WegLink({ weg, children, ...attribute }: { weg: WebsiteWeg; children: React.ReactNode } & AnkerAttribute): React.ReactElement {
  const { ausfuehren } = weg
  return (
    <a
      {...attribute}
      href={weg.href}
      onClick={ausfuehren ? (e) => { if (istPlainClick(e)) { e.preventDefault(); ausfuehren() } } : undefined}
    >
      {children}
    </a>
  )
}

/** Der Weg zu einer Autoren-Adresse; `null` = entfaellt (gemeldet). */
export function autorenWeg(href: string, navigation: WebsiteNavigation | undefined): WebsiteWeg | null {
  const link = autorenLink(href)
  if (link.art === 'extern') return { href: link.url }
  if (!navigation) return { href }
  if (link.art === 'fremd') {
    const ziel = navigation.fremd ? navigation.fremd(link.href) : null
    if (ziel === null) wegFehltMelden(`Link "${href}" hat in dieser Seite keine Adresse — entfaellt`)
    return ziel === null ? null : { href: ziel }
  }
  const weg = navigation.weg(link.ziel)
  if (weg === null) wegFehltMelden(`Link "${href}" (Ziel ${link.ziel.art}) hat in dieser Seite keine Adresse — entfaellt`)
  return weg
}

export function AutorenLink({ href, navigation, children, ...attribute }: {
  href: string
  navigation?: WebsiteNavigation
  children: React.ReactNode
} & AnkerAttribute): React.ReactElement | null {
  const weg = autorenWeg(href, navigation)
  return weg ? <WegLink weg={weg} {...attribute}>{children}</WegLink> : null
}
