'use client'

/**
 * Die Story-Sektion der Website-Landingpage (Welle N1, Plan
 * website-story-sektion): der Chat der Library auf der Startseite —
 * Beispielfragen als Kacheln, immer sichtbare Eingabe, die Konversation
 * waechst nach unten. „Erst fragen, dann einstellen": kein Dialog beim
 * Betreten; die Perspektive oeffnet nur der Knopf im Kopf der Karte, die
 * Belege einer Antwort kommen als Blatt von rechts.
 *
 * Dritter Gastgeber der Story-Bausteine (nach Galerie-Mitte und Embed):
 * komponiert `@ks/module-story`, kopiert nichts aus `StoryRoot`.
 */

import { useCallback, useMemo, useState } from 'react'
import { useSetAtom } from 'jotai'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { chatReferencesAtom } from '@ks/module-explorer/react'
import { StoryEingabeInline, StoryKonversation, type Nachricht } from '@ks/module-story/react'
import type { HeadingCase, WebsiteSection } from '@/lib/website/types'
import type { SiteThemeResolved } from '@/lib/website/site-theme'
import { storyBloecke } from '@/lib/website/story-section'
import { PerspektiveDialogApp } from '@/components/library/story/perspektive-dialog-app'
import { StoryAntwortFuss } from '@/components/library/story/story-fuss'
import { useProfilPerspektive } from '@/hooks/use-profil-perspektive'
import { StoryFragenKacheln, WebsiteStorySektionRahmen } from './website-story-sektion-rahmen'
import { WebsiteStoryBelege, type WebsiteStoryNavigation } from './website-story-belege'
import { useBelegDokumente, useWebsiteStory, type BelegeBlatt } from './use-website-story'

export interface WebsiteStorySektionProps {
  libraryId: string
  section: WebsiteSection
  headingCase?: HeadingCase
  theme?: SiteThemeResolved
  navigation: WebsiteStoryNavigation
}

export function WebsiteStorySektion(p: WebsiteStorySektionProps) {
  const { t } = useTranslation()
  const s = useWebsiteStory(p.libraryId)
  const profil = useProfilPerspektive()
  const setChatReferences = useSetAtom(chatReferencesAtom)
  const [text, setText] = useState('')
  const [perspektiveOffen, setPerspektiveOffen] = useState(false)
  const [blatt, setBlatt] = useState<BelegeBlatt | null>(null)
  const [blattOffen, setBlattOffen] = useState(false)
  const belegDocs = useBelegDokumente(p.libraryId, blatt?.references ?? [], s.sessionHeaders)
  const fragen = useMemo(() => storyBloecke(p.section).fragen, [p.section])

  const senden = useCallback(
    (frage: string) => {
      const f = frage.trim()
      if (!f || s.k.laeuft) return
      setText('')
      void s.k.frageSenden(f)
    },
    [s.k],
  )

  const belegeOeffnen = useCallback(
    (antwort: Nachricht) => {
      const references = antwort.belege ?? []
      setBlatt({ references, queryId: antwort.queryId ?? null })
      setBlattOffen(true)
      // Die Galerie laedt die zitierten Dokumente nach (additionalDocs), damit `?doc=` sie findet.
      setChatReferences({ references, queryId: antwort.queryId })
    },
    [setChatReferences],
  )

  const fuss = useCallback(
    (antwort: Nachricht) => {
      const dokumente = new Set((antwort.belege ?? []).map((b) => b.fileId)).size
      return (
        <div className="mt-3 space-y-2">
          {dokumente > 0 && (
            <Button variant="outline" size="sm" onClick={() => belegeOeffnen(antwort)} data-story-belege-knopf>
              {t('website.story.quellenAnzeigen', { count: dokumente })}
            </Button>
          )}
          <StoryAntwortFuss libraryId={p.libraryId} antwort={antwort} llmModel={s.llmModel} />
        </div>
      )
    },
    [belegeOeffnen, p.libraryId, s.llmModel, t],
  )

  const anzahl = s.paare.length
  const status = (
    <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700">
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--site-accent)]" aria-hidden="true" />
      {anzahl === 0 ? t('website.story.bereit') : anzahl === 1 ? t('website.story.fragenInSitzung.one') : t('website.story.fragenInSitzung.many', { count: anzahl })}
    </span>
  )
  const kopf = (
    <Button variant="outline" size="sm" className="gap-2" onClick={() => setPerspektiveOffen(true)} data-story-perspektive-knopf>
      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
      {t('website.story.anpassen')}
    </Button>
  )

  let inhalt
  if (s.loading) inhalt = <p className="mt-4 text-sm text-neutral-500">{t('website.story.laden')}</p>
  else if (s.error) inhalt = <p className="mt-4 text-sm text-destructive" role="alert">{s.error}</p>
  else {
    const konversation = anzahl > 0 || s.k.laeuft || s.k.fehler
    inhalt = (
      <>
        <StoryFragenKacheln fragen={fragen} onFrage={senden} gesperrt={s.k.laeuft} />
        {konversation && (
          <div className="mt-6" data-story-konversation>
            <StoryKonversation
              paare={s.paare}
              laeuft={s.k.laeuft}
              schritte={s.k.schritte}
              fehler={s.k.fehler}
              fehlerDetail={s.k.fehlerDetail}
              onFrage={setText}
              onErneut={setText}
              fuss={fuss}
            />
          </div>
        )}
        <StoryEingabeInline
          className="mt-6"
          text={text}
          setText={setText}
          onSenden={() => senden(text)}
          laeuft={s.k.laeuft}
          antwortLaenge={s.k.antwortLaenge}
          setAntwortLaenge={s.k.setAntwortLaenge}
          placeholder={p.section.placeholder ?? s.cfg?.config.placeholder}
        />
      </>
    )
  }

  return (
    <>
      <WebsiteStorySektionRahmen section={p.section} headingCase={p.headingCase} theme={p.theme} status={status} kopf={kopf}>
        {inhalt}
      </WebsiteStorySektionRahmen>
      {perspektiveOffen && <PerspektiveDialogApp open={perspektiveOffen} onOpenChange={setPerspektiveOffen} onProfil={profil.speichern} darstellung="blatt" />}
      {blatt && (
        <WebsiteStoryBelege
          libraryId={p.libraryId}
          offen={blattOffen}
          onOpenChange={setBlattOffen}
          references={blatt.references}
          usedDocs={belegDocs}
          katalogAnzahl={s.katalogAnzahl}
          navigation={p.navigation}
        />
      )}
    </>
  )
}
