'use client'

/**
 * Fragen- und Themen-Sektion der Startseite in der App (Plan
 * `startseite-als-embed`, WE3).
 *
 * Die Sektionen selbst liegen in `@ks/module-website/react` und kennen die App
 * nicht. Hier baut die App ihren Gastgeber (`WebsiteStoryGastgeber`):
 *  - Anmeldung aus Clerk,
 *  - Perspektive aus dem Story-Kontext (`use-website-perspektive.ts`),
 *  - Platzhalter und Zeichengrenze aus der Library-Konfig,
 *  - Dialog „Antworten anpassen" (`PerspektiveDialogApp`, speichert ins Profil),
 *  - Fuss der Antwort: Konfig-Anzeige, Verbrauchsseite der Sitzung,
 *    Berechnungsschritte fuer Angemeldete,
 *  - das Logo neben der Antwort und die Detailansicht mit den App-Renderern,
 *  - der Teppich der Dokumente, wenn die Library ihn eingeschaltet hat (`carpetEnabled`).
 *
 * `website-landing-live.tsx` laedt diese Datei faul (`next/dynamic`), damit nur
 * Seiten mit `layout=story` oder `layout=topics` Story-Paket und Clerk ziehen.
 */

import * as React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { SAME_ORIGIN_API } from '@ks/api-client'
import { useLibraries } from '@ks/shell/react'
import { useTranslation } from '@ks/i18n/react'
import type { Nachricht } from '@ks/module-story/react'
import {
  WebsiteStorySektion,
  WebsiteThemenSektion,
  type WebsiteStoryGastgeber,
  type WebsiteStorySektionProps,
  type WebsiteThemenSektionProps,
} from '@ks/module-website/react'
import { ChatConfigDisplay } from '@/components/library/chat/chat-config-display'
import { PerspektiveDialogApp } from '@/components/library/story/perspektive-dialog-app'
import { StoryVerarbeitungAufklapper } from '@/components/library/story/story-verarbeitung-aufklapper'
import { AppLogo } from '@/components/shared/app-logo'
import { useLibraryConfig } from '@/hooks/use-library-config'
import { useProfilPerspektive } from '@/hooks/use-profil-perspektive'
import { useWebsitePerspektive } from './use-website-perspektive'
import { zurueckTaste } from './zurueck-taste'

// Die Detailansicht zieht die Renderer aller Typen nach — erst laden, wenn jemand einen Eintrag oeffnet.
const WebsiteStoryDetail = dynamic(() => import('./website-story-detail').then((m) => ({ default: m.WebsiteStoryDetail })), { ssr: false })

/** Der Gastgeber der Fragen-Sektion in der App. */
export function useWebsiteStoryGastgeber(libraryId: string): WebsiteStoryGastgeber {
  const { t } = useTranslation()
  const { isSignedIn } = useUser()
  const angemeldet = isSignedIn === true
  // Antwortsprache und uebrige Perspektive: geteilt mit der Themen-Sektion.
  const perspektive = useWebsitePerspektive()
  const { cfg, loading, error } = useLibraryConfig(libraryId)
  const { speichern } = useProfilPerspektive()
  // Teppich T2: Schalter je Library. Die Library steht im Atom (Site-Modus) oder kommt mit der Chat-Konfig (Root-Modus).
  const imAtom = useLibraries().find((lib) => lib.id === libraryId)
  const teppich = (imAtom ? imAtom.config?.publicPublishing?.carpetEnabled : cfg?.publicPublishing?.carpetEnabled) === true
  const slug = cfg?.publicPublishing?.slugName
  // 10.11.2026: was diese Sitzung kostet — die Verbrauchsseite, vorgefiltert auf die eigene Sitzung.
  const verbrauchHref = slug ? `/explore/${encodeURIComponent(slug)}/verbrauch?sicht=session` : null

  return React.useMemo<WebsiteStoryGastgeber>(
    () => ({
      instanz: SAME_ORIGIN_API,
      angemeldet,
      perspektive,
      eingabe: {
        platzhalter: cfg?.config.placeholder,
        maxZeichen: cfg?.config.maxChars,
        maxZeichenHinweis: cfg?.config.maxCharsWarningMessage,
        laedt: loading,
        fehler: error,
      },
      zurueckTaste,
      perspektiveDialog: ({ offen, onOpenChange }) => (
        <PerspektiveDialogApp open={offen} onOpenChange={onOpenChange} onProfil={speichern} darstellung="blatt" />
      ),
      antwortFuss: (a: Nachricht) => (
        <>
          {a.queryId && <ChatConfigDisplay libraryId={libraryId} queryId={a.queryId} llmModel={perspektive.llmModel} />}
          {verbrauchHref && (
            <Link href={verbrauchHref} className="mt-1 inline-block underline-offset-2 hover:underline" data-story-verbrauch-link>
              {t('verbrauch.ansehen')} →
            </Link>
          )}
          {/* N5: die Berechnungsschritte bleiben an der fertigen Antwort einsehbar (dezent, nur fuer Angemeldete). */}
          {a.queryId && angemeldet && <StoryVerarbeitungAufklapper libraryId={libraryId} queryId={a.queryId} />}
        </>
      ),
      antwortAvatar: <AppLogo size={32} />,
      detail: ({ doc, page, onClose }) => <WebsiteStoryDetail libraryId={libraryId} doc={doc} page={page} onClose={onClose} />,
      teppich,
    }),
    [libraryId, angemeldet, perspektive, cfg, loading, error, speichern, verbrauchHref, t, teppich],
  )
}

export function WebsiteStorySektionApp(p: Omit<WebsiteStorySektionProps, 'gastgeber'>) {
  const gastgeber = useWebsiteStoryGastgeber(p.libraryId)
  return <WebsiteStorySektion {...p} gastgeber={gastgeber} />
}

/** Die Themen-Sektion braucht nur Instanz, Anmeldung und Perspektive (dieselbe wie die Fragen). */
export function WebsiteThemenSektionApp(p: Omit<WebsiteThemenSektionProps, 'gastgeber'>) {
  const { isSignedIn } = useUser()
  const perspektive = useWebsitePerspektive()
  const gastgeber = React.useMemo(
    () => ({ instanz: SAME_ORIGIN_API, angemeldet: isSignedIn === true, perspektive }),
    [isSignedIn, perspektive],
  )
  return <WebsiteThemenSektion {...p} gastgeber={gastgeber} />
}
