/**
 * Die Regeln der Perspektiv-Wahl — reine Funktionen, ohne React.
 *
 * Abgelesen von der frueheren Perspektiv-Seite der App
 * (`perspective-page-content`, bis 09.10.2026): hoechstens fuenf Interessen
 * bzw. Zugaenge, „nicht festgelegt" (`undefined`) schliesst alle anderen aus,
 * eine leere Auswahl wird wieder „nicht festgelegt". Beim Sprachwechsel
 * bleibt das Modell, solange es die Sprache kann; sonst nimmt die Wahl das
 * erste passende und sagt das.
 */

import type { AccessPerspective, Character, LlmModelDto, SocialContext, TargetLanguage } from '@ks/contracts'
import { TARGET_LANGUAGE_VALUES } from '@ks/contracts'

/** Was die Person waehlt. `genderInclusive` gehoert nicht dazu — das legt die Library fest. */
export interface PerspektivWahl {
  targetLanguage: TargetLanguage
  character: Character[]
  accessPerspective: AccessPerspective[]
  socialContext: SocialContext
  llmModel: string
}

export const MAX_AUSWAHL = 5

const OFFEN = 'undefined'

/** Die gewaehlten Werte ohne „nicht festgelegt". */
export function gewaehlt<T extends string>(liste: readonly T[]): T[] {
  return liste.filter((w) => w !== OFFEN)
}

/** Ein Wert an oder aus; „nicht festgelegt" steht immer allein, hoechstens fuenf andere. */
export function umschalten<T extends string>(liste: readonly T[], wert: T): T[] {
  if (liste.includes(wert)) {
    const rest = liste.filter((w) => w !== wert)
    return rest.length === 0 ? [OFFEN as T] : rest
  }
  if (wert === OFFEN) return [wert]
  const andere = gewaehlt(liste)
  return andere.length < MAX_AUSWAHL ? [...andere, wert] : [...liste]
}

/** Ob ein Wert gerade nicht waehlbar ist (Hoechstzahl erreicht, oder „offen" neben einer Wahl). */
export function gesperrt<T extends string>(liste: readonly T[], wert: T): boolean {
  const zahl = gewaehlt(liste).length
  if (wert === OFFEN) return zahl > 0
  return !liste.includes(wert) && zahl >= MAX_AUSWAHL
}

/** Modelle, die eine Sprache koennen, nach ihrer Reihenfolge; `global` nimmt alle. */
export function modelleFuerSprache(modelle: readonly LlmModelDto[], sprache: TargetLanguage): LlmModelDto[] {
  const passend = sprache === 'global' ? [...modelle] : modelle.filter((m) => m.supportedLanguages.includes(sprache))
  return passend.sort((a, b) => a.order - b.order)
}

/** Modell nach einem Sprachwechsel: das bisherige, wenn es passt, sonst das erste passende. */
export function modellNachSprachwechsel(
  modellId: string,
  modelle: readonly LlmModelDto[],
  sprache: TargetLanguage,
): { modellId: string; gewechselt: boolean } {
  const passend = modelleFuerSprache(modelle, sprache)
  if (passend.some((m) => m.modelId === modellId)) return { modellId, gewechselt: false }
  if (passend.length === 0) return { modellId, gewechselt: false }
  return { modellId: passend[0].modelId, gewechselt: modellId !== '' }
}

/** Sprachen fuer die Auswahl: global, dann die Oberflaechensprache, dann nach Name. */
export function sprachenSortiert(uiSprache: string, labels: Record<TargetLanguage, string>): TargetLanguage[] {
  const andere = TARGET_LANGUAGE_VALUES.filter((l) => l !== 'global' && l !== uiSprache).sort((a, b) =>
    (labels[a] ?? a).localeCompare(labels[b] ?? b, uiSprache, { sensitivity: 'base' }),
  )
  const aktuell = TARGET_LANGUAGE_VALUES.filter((l) => l !== 'global' && l === uiSprache)
  return ['global', ...aktuell, ...andere]
}

/** Gespeichert wird ohne „nicht festgelegt", sobald daneben etwas gewaehlt ist. */
export function zumSpeichern(wahl: PerspektivWahl): PerspektivWahl {
  const interessen = gewaehlt(wahl.character)
  const zugaenge = gewaehlt(wahl.accessPerspective)
  return {
    ...wahl,
    character: interessen.length > 0 ? interessen : wahl.character,
    accessPerspective: zugaenge.length > 0 ? zugaenge : wahl.accessPerspective,
  }
}

/** Speichern geht, wenn jede Liste etwas enthaelt und ein Modell feststeht. */
export function kannSpeichern(wahl: PerspektivWahl): boolean {
  return wahl.character.length > 0 && wahl.accessPerspective.length > 0 && !!wahl.socialContext && wahl.llmModel !== ''
}
