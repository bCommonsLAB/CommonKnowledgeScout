'use client'

/**
 * Body-Bereich der Perspektiv-Seite: die vier Auswahl-Cards
 *
 * Hinweis zur Dateigroesse (> 350 Zeilen):
 * Die 5 Auswahl-Cards (Sprache, Modell, Character, AccessPerspective, SocialContext)
 * teilen dieselbe Card-Struktur und zahlreiche Props. Eine weitere Aufteilung in
 * separate Card-Dateien wuerde die Props-Drilling-Kette verlangern ohne den
 * Render-Code wirklich zu vereinfachen. Die Datei bleibt als sinnvolle Einheit.
 * (Erlaeuterung gemaess Contracts §6: Ueberschreitungen mit Begruendungs-Kommentar.)
 * (Sprache, LLM-Modell, Interessenprofil, Zugangsperspektive, Sprachstil)
 * sowie der CTA-Button.
 */

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ArrowRight, Globe, Compass, Eye, Users, Sparkles, AlertCircle, ExternalLink } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/hooks'
import type { Character, SocialContext, TargetLanguage, AccessPerspective, LlmModelId } from '@/lib/chat/constants'
import { CHARACTER_VALUES, ACCESS_PERSPECTIVE_VALUES, getLanguageCategory } from '@/lib/chat/constants'
import type { MappedLlmModel } from './helpers'

interface PerspectiveBodyProps {
  // Sprache
  localLanguage: TargetLanguage
  sortedLanguages: TargetLanguage[]
  targetLanguageLabels: Record<TargetLanguage, string>
  onLanguageChange: (lang: TargetLanguage) => void
  // LLM-Modell
  localLlmModel: LlmModelId
  filteredModels: MappedLlmModel[]
  modelsLoading: boolean
  modelAutoSwitched: boolean
  onLlmModelChange: (model: string) => void
  // Interessenprofil
  localInterests: Character[]
  characterLabels: Record<Character, string>
  onToggleInterest: (value: Character) => void
  // Zugangsperspektive
  localAccessPerspective: AccessPerspective[]
  accessPerspectiveLabels: Record<AccessPerspective, string>
  onToggleAccessPerspective: (value: AccessPerspective) => void
  // Sprachstil
  localLanguageStyle: SocialContext
  socialContextLabels: Record<SocialContext, string>
  onLanguageStyleChange: (ctx: SocialContext) => void
}

/**
 * Rendert alle Auswahl-Sektionen der Perspektiv-Seite als einzelne Cards.
 */
export function PerspectiveBody({
  localLanguage,
  sortedLanguages,
  targetLanguageLabels,
  onLanguageChange,
  localLlmModel,
  filteredModels,
  modelsLoading,
  modelAutoSwitched,
  onLlmModelChange,
  localInterests,
  characterLabels,
  onToggleInterest,
  localAccessPerspective,
  accessPerspectiveLabels,
  onToggleAccessPerspective,
  localLanguageStyle,
  socialContextLabels,
  onLanguageStyleChange,
}: PerspectiveBodyProps) {
  const { t } = useTranslation()

  return (
    <TooltipProvider>
      <div className="space-y-6">

        {/* 1. Sprache */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {t('chat.perspectivePage.languageSectionTitle')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('chat.perspectivePage.languageSectionHelp')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Select value={localLanguage} onValueChange={(v) => onLanguageChange(v as TargetLanguage)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedLanguages.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {targetLanguageLabels[lang]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Warnhinweis fuer eingeschraenkt unterstuetzte Sprachen */}
                {localLanguage !== 'global' && (() => {
                  const category = getLanguageCategory(localLanguage)
                  if (category === 'well') {
                    return (
                      <Alert className="mt-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                        <AlertTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          {t('chat.languageWarning.wellSupported.title')}
                        </AlertTitle>
                        <AlertDescription className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                          {t('chat.languageWarning.wellSupported.description')}
                          <br />
                          <span className="text-xs mt-1 block">
                            <strong>{t('chat.languageWarning.wellSupported.languages')}</strong>
                          </span>
                        </AlertDescription>
                      </Alert>
                    )
                  }
                  if (category === 'basic') {
                    return (
                      <Alert className="mt-4 border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
                        <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-500" />
                        <AlertTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">
                          {t('chat.languageWarning.basicSupport.title')}
                        </AlertTitle>
                        <AlertDescription className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                          {t('chat.languageWarning.basicSupport.description')}
                          <br />
                          <span className="text-xs mt-1 block">
                            <strong>{t('chat.languageWarning.basicSupport.languages')}</strong>
                          </span>
                        </AlertDescription>
                      </Alert>
                    )
                  }
                  return null
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. LLM-Modell */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {t('chat.perspectivePage.modelLabel')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('chat.perspectivePage.modelInfo')}
                  </p>
                </div>
                <div className="space-y-2">
                  {modelsLoading ? (
                    <div className="text-sm text-muted-foreground">Lade Modelle...</div>
                  ) : filteredModels.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      {t('chat.perspectivePage.noModelsAvailable')}
                    </div>
                  ) : (
                    <>
                      <Select value={localLlmModel || ''} onValueChange={onLlmModelChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredModels.map((model) => (
                            <SelectItem key={model.modelId} value={model.modelId}>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span>{model.name}</span>
                                  {model.url && (
                                    <a
                                      href={model.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs text-muted-foreground hover:text-primary"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {model.strengths}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {modelAutoSwitched && (
                        <Alert className="mt-2 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                          <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                            {t('chat.perspectivePage.modelAutoSwitched', {
                              model: filteredModels.find((m) => m.modelId === localLlmModel)?.name || '',
                              language: targetLanguageLabels[localLanguage],
                            })}
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Thematische Interessen (Character) */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Compass className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {t('chat.perspectivePage.characterSectionTitle')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('chat.perspectivePage.characterSectionHelp')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CHARACTER_VALUES.map((value) => {
                    const isSelected = localInterests.includes(value)
                    const currentValidCount = localInterests.filter((i) => i !== 'undefined').length
                    const isDisabled = value === 'undefined'
                      ? currentValidCount > 0
                      : !isSelected && currentValidCount >= 5
                    return (
                      <Tooltip key={value}>
                        <TooltipTrigger asChild>
                          <Badge
                            variant={isSelected ? 'default' : 'outline'}
                            className={`cursor-pointer transition-all text-sm py-2 px-4 ${
                              isSelected ? 'bg-primary text-primary-foreground' : ''
                            } ${
                              isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-primary/10'
                            }`}
                            onClick={() => !isDisabled && onToggleInterest(value)}
                          >
                            {characterLabels[value]}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{t(`chat.characterTooltips.${value}`)}</p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
                {localInterests.filter((i) => i !== 'undefined').length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t('chat.perspectivePage.characterSectionSelectedCount', {
                      count: localInterests.filter((i) => i !== 'undefined').length,
                    })}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Zugangsperspektive */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {t('chat.perspectivePage.accessPerspectiveSectionTitle')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('chat.perspectivePage.accessPerspectiveSectionHelp')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ACCESS_PERSPECTIVE_VALUES.map((value) => {
                    const isSelected = localAccessPerspective.includes(value)
                    const validCount = localAccessPerspective.filter((ap) => ap !== 'undefined').length
                    const isDisabled = value === 'undefined'
                      ? validCount > 0
                      : !isSelected && validCount >= 5
                    return (
                      <Tooltip key={value}>
                        <TooltipTrigger asChild>
                          <Badge
                            variant={isSelected ? 'default' : 'outline'}
                            className={`cursor-pointer transition-all text-sm py-2 px-4 ${
                              isSelected ? 'bg-primary text-primary-foreground' : ''
                            } ${
                              isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-primary/10'
                            }`}
                            onClick={() => !isDisabled && onToggleAccessPerspective(value)}
                          >
                            {accessPerspectiveLabels[value]}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{t(`chat.accessPerspectiveTooltips.${value}`)}</p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
                {localAccessPerspective.filter((ap) => ap !== 'undefined').length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t('chat.perspectivePage.accessPerspectiveSectionSelectedCount', {
                      count: localAccessPerspective.filter((ap) => ap !== 'undefined').length,
                    })}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. Sprachstil (SocialContext) */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {t('chat.perspectivePage.socialContextSectionTitle')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('chat.perspectivePage.socialContextSectionHelp')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(socialContextLabels).map(([value, label]) => {
                    const isSelected = localLanguageStyle === value
                    return (
                      <Tooltip key={value}>
                        <TooltipTrigger asChild>
                          <Badge
                            variant={isSelected ? 'default' : 'outline'}
                            className={`cursor-pointer transition-all text-sm py-2 px-4 ${
                              isSelected ? 'bg-primary text-primary-foreground hover:bg-primary' : 'hover:bg-primary/10'
                            }`}
                            onClick={() => onLanguageStyleChange(value as SocialContext)}
                          >
                            {label as string}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{t(`chat.socialContextTooltips.${value}`)}</p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('chat.perspectivePage.socialContextSectionNote')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </TooltipProvider>
  )
}

/** CTA-Bereich mit dem Speichern-Button */
interface PerspectiveCtaProps {
  canProceed: boolean
  onStart: () => void
}

export function PerspectiveCta({ canProceed, onStart }: PerspectiveCtaProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3 pt-6">
      <Button
        size="lg"
        className="w-full gap-2 text-base"
        onClick={onStart}
        disabled={!canProceed}
      >
        {t('chat.perspectivePage.saveButton')}
        <ArrowRight className="h-5 w-5" />
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {t('chat.perspectivePage.saveButtonFooter')}
      </p>
    </div>
  )
}
