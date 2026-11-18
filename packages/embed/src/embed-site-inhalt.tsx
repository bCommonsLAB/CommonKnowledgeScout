'use client'

/**
 * Der Inhalt von `KnowledgeScoutSite` (WE4): eigener Speicher, Sprache,
 * Portal-Ort ueber dem Fenster, Tooltips, die Embed-Antworten der Galerie
 * (Karten brauchen ihre Navigation) — und die Startseite selbst.
 *
 * Laedt die oeffentliche Library ueber den Slug (wie `EmbedGalerie`), lehnt eine
 * geschuetzte oder eine ohne Website ab und montiert `WebsiteLanding` aus
 * `@ks/module-website/react` mit dem, was nur das Embed hat: Navigation aus
 * `hrefFor`, Schriften aus `styles.css`, der anonyme Gastgeber der Fragen-Sektion
 * (Modell und Perspektive wie im Story-Embed), Detailansicht ueber dem Fenster.
 */

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { Provider as JotaiProvider, createStore } from 'jotai'
import type { InstanceApi } from '@ks/api-client'
import type { DocCardMeta } from '@ks/contracts'
import type { Locale } from '@ks/i18n'
import { useTranslation } from '@ks/i18n/react'
import { PortalContainerProvider, TooltipProvider } from '@ks/ui'
import { EmbedGalleryProviders, useExplorerLibrary, type ExplorerLibraryPayload } from '@ks/module-explorer/react'
import { PerspektiveDialog } from '@ks/module-story/react'
import type { WebsiteSection } from '@ks/module-website'
import {
  WebsiteLanding,
  WebsiteStorySektion,
  WebsiteThemenSektion,
  type WebsiteSlotKontext,
  type WebsiteStoryGastgeber,
} from '@ks/module-website/react'
import { EmbedLocale } from './embed-locale'
import { useOeffentlichesModell } from './embed-story'
import { perspektiveFuer, useEigenePerspektive, wahlFuerDialog } from './embed-perspektive'
import { EMBED_SCHRIFTEN, embedSiteNavigation, type HrefFor } from './embed-site-navigation'
import { EmbedSiteDetail } from './embed-site-detail'
import { EmbedSiteMenue } from './embed-site-menue'

const ANONYM = { isLoaded: true, isSignedIn: false } as const

export interface EmbedSiteInhaltProps {
  library: string
  instanz: InstanceApi
  locale: Locale
  page: string | null
  hrefFor: HrefFor
  menu: boolean
  eigenerScroll: boolean
  /** Portal-Ort am `body` (Klasse `.ks-embed`) fuer Blaetter, Dialoge und Detailansicht. */
  portal: HTMLElement
}

export function EmbedSiteInhalt(p: EmbedSiteInhaltProps) {
  // Einmal je Montage: Die Atome kollidieren weder mit der Seite noch mit einem zweiten Embed.
  const [speicher] = useState(() => createStore())
  return (
    <JotaiProvider store={speicher}>
      <EmbedLocale locale={p.locale} />
      <PortalContainerProvider container={p.portal}>
        <TooltipProvider>
          <EmbedGalleryProviders instanz={p.instanz} initialParams={undefined}>
            <EmbedSite {...p} />
          </EmbedGalleryProviders>
        </TooltipProvider>
      </PortalContainerProvider>
    </JotaiProvider>
  )
}

function Hinweis({ children, alarm = false }: { children: string; alarm?: boolean }) {
  return <p role={alarm ? 'alert' : 'status'} className="p-4 text-sm text-muted-foreground">{children}</p>
}

function EmbedSite({ library: slug, instanz, locale, page, hrefFor, menu, eigenerScroll, portal }: EmbedSiteInhaltProps) {
  const { t } = useTranslation()
  const texte = useMemo(
    () => ({ slugMissing: t('explore.slugMissing'), libraryNotFound: t('explore.libraryNotFound'), errorLoadingLibrary: t('explore.errorLoadingLibrary') }),
    [t],
  )
  const { library, loading, error } = useExplorerLibrary(slug, ANONYM, texte, instanz)
  // Die Container-Seite reicht `hrefFor` oft je Render neu — die Navigation bleibt dieselbe.
  const hrefForAktuell = useRef(hrefFor)
  hrefForAktuell.current = hrefFor
  const navigation = useMemo(
    () => embedSiteNavigation((ziel) => hrefForAktuell.current(ziel), (href) => window.location.assign(href)),
    [],
  )
  const [detail, setDetail] = useState<{ doc: DocCardMeta; page?: number } | null>(null)
  const schliessen = useCallback(() => setDetail(null), [])
  const gastgeber = useEmbedGastgeber(library, instanz, locale, navigation, portal)

  const storySlot = useCallback(
    (section: WebsiteSection, { headingCase, theme }: WebsiteSlotKontext): ReactNode =>
      gastgeber === null ? null : section.layout === 'topics' ? (
        <WebsiteThemenSektion libraryId={gastgeber.libraryId} section={section} headingCase={headingCase} theme={theme} gastgeber={gastgeber.story} />
      ) : (
        <WebsiteStorySektion libraryId={gastgeber.libraryId} section={section} headingCase={headingCase} theme={theme} gastgeber={gastgeber.story} navigation={navigation} galleryTexte={library?.gallery} />
      ),
    [gastgeber, navigation, library?.gallery],
  )

  if (loading) return <Hinweis>{t('gallery.loading')}</Hinweis>
  if (error || !library) return <Hinweis alarm>{error ?? t('explore.libraryNotFound')}</Hinweis>
  if (library.requiresAuth) return <Hinweis alarm>{t('embed.libraryNotPublic', { defaultValue: 'Diese Library ist nicht öffentlich und kann nicht eingebettet werden.' })}</Hinweis>
  if (!library.siteEnabled) return <Hinweis alarm>{`KnowledgeScoutSite: Die Library "${slug}" hat keine Website (siteEnabled ist aus).`}</Hinweis>

  return (
    <>
      <WebsiteLanding
        instanz={instanz}
        libraryId={library.id}
        seite={page}
        unbekannteSeite="fehler"
        navigation={navigation}
        schriften={EMBED_SCHRIFTEN}
        siteTheme={library.siteTheme}
        moreLinkLabel={library.gallery?.moreLinkLabel || t('gallery.mehrInhalte', { defaultValue: 'mehr Inhalte' })}
        // Kontaktformular im Embed: zunaechst nicht (Entscheid C) — die Sektion zeigt den Deaktiviert-Hinweis.
        contactApiSlug={null}
        sterneAnKarten={false}
        eigenerScroll={eigenerScroll}
        menue={menu ? (m) => <EmbedSiteMenue {...m} navigation={navigation} galerieLabel={library.gallery?.menuLabel} /> : undefined}
        onDokument={(doc) => setDetail({ doc })}
        storySlot={storySlot}
      />
      {detail && <EmbedSiteDetail library={library} doc={detail.doc} page={detail.page} onClose={schliessen} navigation={navigation} portal={portal} />}
    </>
  )
}

/** Der anonyme Gastgeber der Fragen- und Themen-Sektion: Modell und Perspektive wie im Story-Embed. */
function useEmbedGastgeber(
  library: ExplorerLibraryPayload | null,
  instanz: InstanceApi,
  locale: Locale,
  navigation: ReturnType<typeof embedSiteNavigation>,
  portal: HTMLElement,
): { libraryId: string; story: WebsiteStoryGastgeber } | null {
  const { t } = useTranslation()
  const modell = useOeffentlichesModell(instanz, library !== null)
  const [eigene, speichern] = useEigenePerspektive(library?.id ?? '', library !== null)
  const chat = library?.chat
  const perspektive = useMemo(() => perspektiveFuer(chat, locale, modell ?? '', eigene), [chat, locale, modell, eigene])
  return useMemo(() => {
    if (library === null) return null
    const wahl = modell ? wahlFuerDialog(perspektive) : null
    const story: WebsiteStoryGastgeber = {
      instanz,
      angemeldet: false,
      perspektive,
      eingabe: {
        platzhalter: chat?.placeholder,
        maxZeichen: chat?.maxChars,
        maxZeichenHinweis: chat?.maxCharsWarningMessage,
        laedt: modell === null,
        fehler: modell === '' ? t('story.modelMissing') : null,
      },
      perspektiveDialog: wahl
        ? ({ offen, onOpenChange }) => <PerspektiveDialog open={offen} onOpenChange={onOpenChange} wert={wahl} onSpeichern={speichern} />
        : undefined,
      detail: ({ doc, page, onClose }) => (
        <EmbedSiteDetail library={library} doc={doc} page={page} onClose={onClose} navigation={navigation} portal={portal} />
      ),
    }
    return { libraryId: library.id, story }
  }, [library, modell, perspektive, instanz, chat, t, speichern, navigation, portal])
}
