'use client'

/**
 * Die Perspektiv-Wahl als Dialog (09.10.2026) — ersetzt die fruehere
 * Perspektiv-Seite der App. Ohne Anmeldung, ohne Router: Der Montagepunkt
 * reicht den gespeicherten Wert herein und bekommt den neuen ueber
 * `onSpeichern` zurueck; wo und wie er ihn ablegt, ist seine Sache (App:
 * Story-Atome + localStorage, Embed: localStorage je Library).
 *
 * Sprache und Modell stehen nur zur Wahl, wenn der Montagepunkt sie mitgibt;
 * sonst bleiben sie, wie sie in `wert` stehen. Der Dialog rendert in den
 * Portal-Container (`PortalContainerProvider`) — im Embed also im Rahmen.
 *
 * `darstellung` (Welle N3): zentrierter Dialog (Default, Story-Modus/Embed)
 * oder Blatt von rechts (`blatt`) — dieselbe Wahl, dieselben Abschnitte, nur
 * die Huelle wechselt. Die Website-Story-Sektion nutzt `blatt`, damit die
 * Einstellungen wie die Belege von rechts hereinfliegen.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, Compass, Eye, Settings2, Users, X } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ks/ui'
import { useSetAtom } from 'jotai'
import { useTranslation } from '@ks/i18n/react'
import type { LlmModelDto, TargetLanguage } from '@ks/contracts'
import { ACCESS_PERSPECTIVE_VALUES, CHARACTER_VALUES, SOCIAL_CONTEXT_VALUES } from '@ks/contracts'
import { storyPerspektiveGespeichertAtom } from '../atoms'
import { Abschnitt, PlakettenWahl } from './abschnitt'
import { ModellAbschnitt, SprachAbschnitt } from './sprache-modell'
import { gesperrt, gewaehlt, kannSpeichern, modelleFuerSprache, modellNachSprachwechsel, umschalten, zumSpeichern, type PerspektivWahl } from './regeln'

export interface PerspektiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Die gespeicherte Perspektive; der Dialog startet bei jedem Oeffnen damit. */
  wert: PerspektivWahl
  onSpeichern: (wahl: PerspektivWahl) => void
  /** Sprache zur Wahl stellen (App). Ohne: fest, Abschnitt fehlt (Embed). */
  sprachwahl?: { sprachen: readonly TargetLanguage[]; labels: Record<TargetLanguage, string> }
  /** Modell zur Wahl stellen (App). Ohne: fest, Abschnitt fehlt (Embed). */
  modellwahl?: { modelle: readonly LlmModelDto[]; laedt: boolean }
  /** Zentrierter Dialog (Default) oder Blatt von rechts (Website-Story-Sektion, Welle N3). */
  darstellung?: 'dialog' | 'blatt'
}

export function PerspektiveDialog({ open, onOpenChange, wert, onSpeichern, sprachwahl, modellwahl, darstellung = 'dialog' }: PerspektiveDialogProps) {
  const { t } = useTranslation()
  const perspektiveGespeichert = useSetAtom(storyPerspektiveGespeichertAtom)
  const [entwurf, setEntwurf] = useState<PerspektivWahl>(wert)
  const [modellGewechselt, setModellGewechselt] = useState(false)
  // Technik ans Ende und zugeklappt (Davids Vorlage): das Modell steht unter
  // „Erweiterte Einstellungen". Bei einem automatischen Modellwechsel aufklappen,
  // sonst sieht der Mensch den Hinweis nicht.
  const [erweitertOffen, setErweitertOffen] = useState(false)
  useEffect(() => {
    if (modellGewechselt) setErweitertOffen(true)
  }, [modellGewechselt])

  // Jedes Oeffnen beginnt beim gespeicherten Stand — Abbrechen verwirft den Entwurf.
  // Nur beim Uebergang zu → offen: Ein neues `wert`-Objekt des Elternteils
  // (jedes Rendern) darf den laufenden Entwurf nicht ueberschreiben.
  const warOffen = useRef(false)
  useEffect(() => {
    if (open && !warOffen.current) {
      setEntwurf(wert)
      setModellGewechselt(false)
    }
    warOffen.current = open
  }, [open, wert])

  // Noch kein Modell, die Liste ist da: das erste passende vorschlagen (sichtbar im Abschnitt).
  const modelle = useMemo(
    () => (modellwahl ? modelleFuerSprache(modellwahl.modelle, entwurf.targetLanguage) : []),
    [modellwahl, entwurf.targetLanguage],
  )
  useEffect(() => {
    if (!open || !modellwahl || modellwahl.laedt || entwurf.llmModel !== '' || modelle.length === 0) return
    setEntwurf((e) => ({ ...e, llmModel: modelle[0].modelId }))
  }, [open, modellwahl, modelle, entwurf.llmModel])

  function spracheWaehlen(sprache: TargetLanguage) {
    if (!modellwahl) {
      setEntwurf({ ...entwurf, targetLanguage: sprache })
      return
    }
    const { modellId, gewechselt } = modellNachSprachwechsel(entwurf.llmModel, modellwahl.modelle, sprache)
    setModellGewechselt(gewechselt)
    setEntwurf({ ...entwurf, targetLanguage: sprache, llmModel: modellId })
  }

  function speichern() {
    onSpeichern(zumSpeichern(entwurf))
    // Im selben Zug wie die neue Perspektive: die Mitte stellt die letzte Frage neu.
    perspektiveGespeichert((n) => n + 1)
    onOpenChange(false)
  }

  const interessen = gewaehlt(entwurf.character).length
  const zugaenge = gewaehlt(entwurf.accessPerspective).length

  const titel = t('chat.perspectivePage.title')
  const untertitel = t('chat.perspectivePage.subtitle')

  const koerper = (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      {sprachwahl && (
        <SprachAbschnitt sprache={entwurf.targetLanguage} sprachen={sprachwahl.sprachen} labels={sprachwahl.labels} onWahl={spracheWaehlen} />
      )}
      <Abschnitt symbol={Compass} titel={t('chat.perspectivePage.characterSectionTitle')} hilfe={t('chat.perspectivePage.characterSectionHelp')}>
        <PlakettenWahl
          werte={CHARACTER_VALUES}
          label={(v) => t(`chat.characterLabels.${v}`)}
          tooltip={(v) => t(`chat.characterTooltips.${v}`)}
          gewaehlt={(v) => entwurf.character.includes(v)}
          gesperrt={(v) => gesperrt(entwurf.character, v)}
          onWahl={(v) => setEntwurf((e) => ({ ...e, character: umschalten(e.character, v) }))}
        />
        {interessen > 0 && <p className="text-xs text-muted-foreground">{t('chat.perspectivePage.characterSectionSelectedCount', { count: interessen })}</p>}
      </Abschnitt>
      <Abschnitt symbol={Eye} titel={t('chat.perspectivePage.accessPerspectiveSectionTitle')} hilfe={t('chat.perspectivePage.accessPerspectiveSectionHelp')}>
        <PlakettenWahl
          werte={ACCESS_PERSPECTIVE_VALUES}
          label={(v) => t(`chat.accessPerspectiveLabels.${v}`)}
          tooltip={(v) => t(`chat.accessPerspectiveTooltips.${v}`)}
          gewaehlt={(v) => entwurf.accessPerspective.includes(v)}
          gesperrt={(v) => gesperrt(entwurf.accessPerspective, v)}
          onWahl={(v) => setEntwurf((e) => ({ ...e, accessPerspective: umschalten(e.accessPerspective, v) }))}
        />
        {zugaenge > 0 && <p className="text-xs text-muted-foreground">{t('chat.perspectivePage.accessPerspectiveSectionSelectedCount', { count: zugaenge })}</p>}
      </Abschnitt>
      <Abschnitt symbol={Users} titel={t('chat.perspectivePage.socialContextSectionTitle')} hilfe={t('chat.perspectivePage.socialContextSectionHelp')}>
        <PlakettenWahl
          werte={SOCIAL_CONTEXT_VALUES}
          label={(v) => t(`chat.socialContextLabels.${v}`)}
          tooltip={(v) => t(`chat.socialContextTooltips.${v}`)}
          gewaehlt={(v) => entwurf.socialContext === v}
          onWahl={(socialContext) => setEntwurf((e) => ({ ...e, socialContext }))}
        />
        <p className="text-xs text-muted-foreground">{t('chat.perspectivePage.socialContextSectionNote')}</p>
      </Abschnitt>
      {modellwahl && (
        <div className="space-y-2">
          <button
            type="button"
            aria-expanded={erweitertOffen}
            onClick={() => setErweitertOffen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('configPopover.advancedSettings')}
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${erweitertOffen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {erweitertOffen && (
            <ModellAbschnitt
              modellId={entwurf.llmModel}
              modelle={modelle}
              laedt={modellwahl.laedt}
              gewechselt={modellGewechselt}
              spracheLabel={sprachwahl?.labels[entwurf.targetLanguage] ?? entwurf.targetLanguage}
              onWahl={(llmModel) => setEntwurf((e) => ({ ...e, llmModel }))}
            />
          )}
        </div>
      )}
    </div>
  )

  const fuss = (
    <div className="space-y-1.5 border-t p-3">
      <Button className="w-full gap-2" onClick={speichern} disabled={!kannSpeichern(entwurf)}>
        {t('chat.perspectivePage.saveButton')}
        <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t('chat.perspectivePage.saveButtonFooter')}</p>
    </div>
  )

  if (darstellung === 'blatt') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" hideCloseButton className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="space-y-1 border-b p-3 text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <SheetTitle>{titel}</SheetTitle>
                <SheetDescription>{untertitel}</SheetDescription>
              </div>
              <SheetClose asChild>
                <Button variant="secondary" size="icon" className="-mr-1 -mt-1 h-8 w-8 shrink-0 rounded-full" aria-label="Schließen">
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>
          {koerper}
          {fuss}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90%] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b p-3">
          <DialogTitle>{titel}</DialogTitle>
          <DialogDescription>{untertitel}</DialogDescription>
        </DialogHeader>
        {koerper}
        {fuss}
      </DialogContent>
    </Dialog>
  )
}
