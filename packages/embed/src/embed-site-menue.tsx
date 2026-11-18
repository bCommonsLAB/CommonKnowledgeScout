'use client'

/**
 * Die schlanke Menuezeile der eingebetteten Startseite (WE4, Entscheid B): die
 * Website-Seiten nach `menu_order`, „Inhalte" und „Story" — jeder Punkt ein
 * Link der Container-Anwendung ueber `hrefFor`. Ein Punkt ohne Adresse
 * entfaellt (gemeldet). `menu={false}` blendet die Zeile aus.
 */

import { useTranslation } from '@ks/i18n/react'
import type { DocCardMeta } from '@ks/contracts'
import { getSiteParamForDoc, wegFehltMelden, type WebsiteNavigation, type WebsiteZiel } from '@ks/module-website'
import { WegLink } from '@ks/module-website/react'

export interface EmbedSiteMenueProps {
  hauptmenue: DocCardMeta[]
  aktivFileId: string | null
  navigation: WebsiteNavigation
  /** Beschriftung des Galerie-Punkts (`gallery.menuLabel` der Library); fehlt = „Inhalte". */
  galerieLabel?: string
}

interface Punkt {
  schluessel: string
  label: string
  ziel: WebsiteZiel
  aktiv: boolean
}

export function EmbedSiteMenue({ hauptmenue, aktivFileId, navigation, galerieLabel }: EmbedSiteMenueProps) {
  const { t } = useTranslation()
  const punkte: Punkt[] = []
  for (const d of hauptmenue) {
    const seite = getSiteParamForDoc(d)
    if (!seite) continue
    punkte.push({ schluessel: d.fileId ?? d.id ?? seite, label: d.title ?? d.fileName ?? seite, ziel: { art: 'seite', seite }, aktiv: d.fileId === aktivFileId })
  }
  punkte.push({ schluessel: 'galerie', label: galerieLabel || t('gallery.gallery'), ziel: { art: 'galerie' }, aktiv: false })
  punkte.push({ schluessel: 'story', label: t('gallery.story'), ziel: { art: 'story' }, aktiv: false })

  return (
    <nav className="border-b border-black/10 bg-[color:var(--site-bg,transparent)] px-4" data-ks-site-menue>
      <ul className="mx-auto flex max-w-5xl gap-5 overflow-x-auto py-2 text-sm">
        {punkte.map((p) => {
          const weg = navigation.weg(p.ziel)
          if (weg === null) {
            wegFehltMelden(`Menuepunkt „${p.label}" (Ziel ${p.ziel.art}) hat in dieser Seite keine Adresse — entfaellt`)
            return null
          }
          return (
            <li key={p.schluessel} className="shrink-0">
              <WegLink
                weg={weg}
                aria-current={p.aktiv ? 'page' : undefined}
                className={p.aktiv ? 'whitespace-nowrap font-semibold underline underline-offset-4' : 'whitespace-nowrap hover:underline'}
              >
                {p.label}
              </WegLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
