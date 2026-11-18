'use client'

/**
 * Die Sektion `layout=topics` der Website-Landingpage (Owner 18.11.2026):
 * das Inhaltsverzeichnis des Story-Modus als Uebersicht der Inhalte. Eine
 * gewaehlte Frage geht als Auftrag an die Story-Sektion derselben Seite
 * (`websiteStoryFrageAtom`) — dort wird sie gestellt und die Seite rollt
 * hinauf. Der Parser stellt sicher, dass es diese Story-Sektion gibt.
 */

import { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { useTranslation } from '@ks/i18n/react'
import type { HeadingCase, WebsiteSection } from '@/lib/website/types'
import type { SiteThemeResolved } from '@/lib/website/site-theme'
import { websiteStoryFrageAtom } from '@/atoms/website-story-frage-atom'
import { ThemenKarten, WebsiteThemenRahmen } from './website-themen-rahmen'
import { useWebsiteThemen } from './use-website-themen'

export interface WebsiteThemenSektionProps {
  libraryId: string
  section: WebsiteSection
  headingCase?: HeadingCase
  theme?: SiteThemeResolved
}

export function WebsiteThemenSektion(p: WebsiteThemenSektionProps) {
  const { t } = useTranslation()
  const s = useWebsiteThemen(p.libraryId)
  const setAuftrag = useSetAtom(websiteStoryFrageAtom)
  const frageStellen = useCallback((text: string) => setAuftrag({ text }), [setAuftrag])

  let inhalt
  if (s.fehler) inhalt = <p className="mt-6 text-sm text-destructive" role="alert">{s.fehler}</p>
  else if (s.laedt || !s.gliederung) inhalt = <p className="mt-6 text-sm opacity-70" data-themen-laden>{t('website.story.themenLaden')}</p>
  else {
    inhalt = (
      <>
        <ThemenKarten themen={s.gliederung.topics} onFrage={frageStellen} />
        <p className="mt-4 text-xs opacity-70">{t('website.story.themenKiHinweis')}</p>
      </>
    )
  }

  return (
    <WebsiteThemenRahmen section={p.section} headingCase={p.headingCase} theme={p.theme}>
      {inhalt}
    </WebsiteThemenRahmen>
  )
}
