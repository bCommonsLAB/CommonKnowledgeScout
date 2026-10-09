'use client'

/**
 * Sprache und Modell im Perspektiv-Dialog. Beide Abschnitte erscheinen nur,
 * wenn der Montagepunkt sie zur Wahl stellt — im Embed stehen Sprache
 * (`locale`) und Modell fest (Owner 08.10.2026).
 */

import { AlertCircle, ExternalLink, Globe, Sparkles } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import type { LlmModelDto, TargetLanguage } from '@ks/contracts'
import { getLanguageCategory } from '@ks/contracts'
import { Abschnitt } from './abschnitt'

/** Hinweis fuer Sprachen, die die Modelle nur gut bzw. grundlegend koennen. */
function SprachHinweis({ sprache }: { sprache: TargetLanguage }) {
  const { t } = useTranslation()
  const stufe = getLanguageCategory(sprache)
  if (stufe !== 'well' && stufe !== 'basic') return null
  const schluessel = stufe === 'well' ? 'wellSupported' : 'basicSupport'
  return (
    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
      <AlertTitle className="text-sm font-medium">{t(`chat.languageWarning.${schluessel}.title`)}</AlertTitle>
      <AlertDescription className="mt-1 text-sm">
        {t(`chat.languageWarning.${schluessel}.description`)}
        <span className="mt-1 block text-xs font-semibold">{t(`chat.languageWarning.${schluessel}.languages`)}</span>
      </AlertDescription>
    </Alert>
  )
}

export interface SprachAbschnittProps {
  sprache: TargetLanguage
  sprachen: readonly TargetLanguage[]
  labels: Record<TargetLanguage, string>
  onWahl: (sprache: TargetLanguage) => void
}

export function SprachAbschnitt({ sprache, sprachen, labels, onWahl }: SprachAbschnittProps) {
  const { t } = useTranslation()
  return (
    <Abschnitt symbol={Globe} titel={t('chat.perspectivePage.languageSectionTitle')} hilfe={t('chat.perspectivePage.languageSectionHelp')}>
      <Select value={sprache} onValueChange={(v) => onWahl(v as TargetLanguage)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sprachen.map((l) => (
            <SelectItem key={l} value={l}>
              {labels[l] ?? l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SprachHinweis sprache={sprache} />
    </Abschnitt>
  )
}

export interface ModellAbschnittProps {
  modellId: string
  modelle: readonly LlmModelDto[]
  laedt: boolean
  /** Das Modell wurde beim Sprachwechsel getauscht — sagen statt still tauschen. */
  gewechselt: boolean
  spracheLabel: string
  onWahl: (modellId: string) => void
}

export function ModellAbschnitt({ modellId, modelle, laedt, gewechselt, spracheLabel, onWahl }: ModellAbschnittProps) {
  const { t } = useTranslation()
  return (
    <Abschnitt symbol={Sparkles} titel={t('chat.perspectivePage.modelLabel')} hilfe={t('chat.perspectivePage.modelInfo')}>
      {laedt ? (
        <p className="text-sm text-muted-foreground">{t('gallery.loading')}</p>
      ) : modelle.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('chat.perspectivePage.noModelsAvailable')}</p>
      ) : (
        <Select value={modellId} onValueChange={onWahl}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modelle.map((m) => (
              <SelectItem key={m.modelId} value={m.modelId}>
                <span className="flex flex-col">
                  <span className="flex items-center gap-2">
                    {m.name}
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-primary">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{m.strengths}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {gewechselt && (
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-500" />
          <AlertDescription className="text-sm">
            {t('chat.perspectivePage.modelAutoSwitched', {
              model: modelle.find((m) => m.modelId === modellId)?.name ?? modellId,
              language: spracheLabel,
            })}
          </AlertDescription>
        </Alert>
      )}
    </Abschnitt>
  )
}
