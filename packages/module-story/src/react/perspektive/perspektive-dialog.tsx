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
 */

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Compass, Eye, Users } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import type { LlmModelDto, TargetLanguage } from '@ks/contracts'
import { ACCESS_PERSPECTIVE_VALUES, CHARACTER_VALUES, SOCIAL_CONTEXT_VALUES } from '@ks/contracts'
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
}

export function PerspektiveDialog({ open, onOpenChange, wert, onSpeichern, sprachwahl, modellwahl }: PerspektiveDialogProps) {
  const { t } = useTranslation()
  const [entwurf, setEntwurf] = useState<PerspektivWahl>(wert)
  const [modellGewechselt, setModellGewechselt] = useState(false)

  // Jedes Oeffnen beginnt beim gespeicherten Stand — Abbrechen verwirft den Entwurf.
  useEffect(() => {
    if (!open) return
    setEntwurf(wert)
    setModellGewechselt(false)
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
    onOpenChange(false)
  }

  const interessen = gewaehlt(entwurf.character).length
  const zugaenge = gewaehlt(entwurf.accessPerspective).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90%] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle>{t('chat.perspectivePage.title')}</DialogTitle>
          <DialogDescription>{t('chat.perspectivePage.subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {sprachwahl && (
            <SprachAbschnitt sprache={entwurf.targetLanguage} sprachen={sprachwahl.sprachen} labels={sprachwahl.labels} onWahl={spracheWaehlen} />
          )}
          {modellwahl && (
            <ModellAbschnitt
              modellId={entwurf.llmModel}
              modelle={modelle}
              laedt={modellwahl.laedt}
              gewechselt={modellGewechselt}
              spracheLabel={sprachwahl?.labels[entwurf.targetLanguage] ?? entwurf.targetLanguage}
              onWahl={(llmModel) => setEntwurf((e) => ({ ...e, llmModel }))}
            />
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
        </div>
        <div className="space-y-2 border-t p-4">
          <Button className="w-full gap-2" onClick={speichern} disabled={!kannSpeichern(entwurf)}>
            {t('chat.perspectivePage.saveButton')}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t('chat.perspectivePage.saveButtonFooter')}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
