/**
 * Pure-Helper-Funktionen fuer PerspectivePageContent.
 *
 * Keine React-Hooks, keine Seiteneffekte — nur reine Berechnungen.
 * Diese Funktionen sind unabhaengig testbar.
 */

import type { TargetLanguage } from '@/lib/chat/constants'
import { TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants'

/**
 * Konvertiert einen UI-Locale-String in eine TargetLanguage-Kennung.
 * Unbekannte Locales werden auf TARGET_LANGUAGE_DEFAULT abgebildet.
 */
export function localeToTargetLanguage(locale: string): TargetLanguage {
  const mapping: Record<string, TargetLanguage> = {
    de: 'de',
    en: 'en',
    it: 'it',
    fr: 'fr',
    es: 'es',
    pt: 'pt',
    nl: 'nl',
    no: 'no',
    da: 'da',
    sv: 'sv',
    fi: 'fi',
    pl: 'pl',
    cs: 'cs',
    hu: 'hu',
    ro: 'ro',
    bg: 'bg',
    el: 'el',
    tr: 'tr',
    ru: 'ru',
    uk: 'uk',
    zh: 'zh',
    ko: 'ko',
    ja: 'ja',
    hr: 'hr',
    sr: 'sr',
    bs: 'bs',
    sl: 'sl',
    sk: 'sk',
    lt: 'lt',
    lv: 'lv',
    et: 'et',
    id: 'id',
    ms: 'ms',
    hi: 'hi',
    sw: 'sw',
    yo: 'yo',
    zu: 'zu',
  }
  return mapping[locale] ?? TARGET_LANGUAGE_DEFAULT
}

/** Modell-Daten, die vom API-Endpoint zurueckgegeben werden */
export interface LlmModelData {
  _id: string
  modelId: string
  name: string
  strengths: string
  supportedLanguages: TargetLanguage[]
  url?: string
  order: number
}

/** Abgeleitete, normierte Version von LlmModelData (ohne MongoDB-_id) */
export interface MappedLlmModel {
  modelId: string
  name: string
  strengths: string
  supportedLanguages: TargetLanguage[]
  url?: string
  order: number
}

/**
 * Normiert die Rohdaten der Modell-API-Antwort:
 * - Filtert Eintraege mit fehlender oder leerer modelId
 * - Trimmt modelId (verhindert Konflikte mit fuehrenden/nachgestellten Spaces)
 */
export function mapLlmModels(models: LlmModelData[]): MappedLlmModel[] {
  return models
    .filter((m) => typeof m.modelId === 'string' && m.modelId.trim().length > 0)
    .map((m) => ({
      modelId: m.modelId.trim(),
      name: m.name,
      strengths: m.strengths,
      supportedLanguages: m.supportedLanguages,
      url: m.url,
      order: m.order,
    }))
}

/**
 * Filtert und sortiert Modelle basierend auf der gewaehlten Zielsprache.
 * Bei 'global' werden alle Modelle angezeigt.
 */
export function filterModelsByLanguage(
  models: MappedLlmModel[],
  language: TargetLanguage,
): MappedLlmModel[] {
  if (language === 'global') {
    return [...models].sort((a, b) => a.order - b.order)
  }
  return models
    .filter((m) => m.supportedLanguages.includes(language))
    .sort((a, b) => a.order - b.order)
}
