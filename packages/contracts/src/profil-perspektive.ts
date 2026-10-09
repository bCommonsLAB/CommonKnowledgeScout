/**
 * @fileoverview Die Story-Perspektive im Benutzerprofil (09.10.2026)
 *
 * @description
 * Angemeldete Personen tragen ihre Perspektive von Browser zu Browser mit:
 * Die App legt sie unter der Benutzer-E-Mail ab (`/api/user/story-perspektive`)
 * und holt sie beim naechsten Besuch zurueck. Eine Perspektive fuer alle
 * Libraries — wie bisher im localStorage. `alsProfilPerspektive` prueft einen
 * fremden Wert gegen die Wertelisten und sagt, was nicht passt.
 *
 * @module contracts/profil-perspektive
 */

import type { AccessPerspective, Character, SocialContext, TargetLanguage } from './chat-vocabulary'
import { ACCESS_PERSPECTIVE_VALUES, CHARACTER_VALUES, SOCIAL_CONTEXT_VALUES, TARGET_LANGUAGE_VALUES } from './chat-vocabulary'

export interface ProfilPerspektiveDto {
  targetLanguage: TargetLanguage
  character: Character[]
  accessPerspective: AccessPerspective[]
  socialContext: SocialContext
  llmModel: string
}

function liste<T extends string>(roh: unknown, erlaubt: readonly T[], name: string): T[] | string {
  if (!Array.isArray(roh) || roh.length === 0 || roh.length > 5) return `${name}: Liste mit 1–5 Werten erwartet`
  const fremd = roh.filter((w) => !(erlaubt as readonly unknown[]).includes(w))
  return fremd.length > 0 ? `${name}: unbekannt ${JSON.stringify(fremd)}` : (roh as T[])
}

/** Prueft einen Wert; liefert die Perspektive oder den Grund, warum er nicht passt. */
export function alsProfilPerspektive(roh: unknown): ProfilPerspektiveDto | { fehler: string } {
  if (typeof roh !== 'object' || roh === null) return { fehler: 'Objekt erwartet' }
  const o = roh as Record<string, unknown>
  if (!(TARGET_LANGUAGE_VALUES as readonly unknown[]).includes(o.targetLanguage)) return { fehler: `targetLanguage unbekannt: ${String(o.targetLanguage)}` }
  if (!(SOCIAL_CONTEXT_VALUES as readonly unknown[]).includes(o.socialContext)) return { fehler: `socialContext unbekannt: ${String(o.socialContext)}` }
  if (typeof o.llmModel !== 'string' || o.llmModel.trim() === '') return { fehler: 'llmModel fehlt' }
  const character = liste(o.character, CHARACTER_VALUES, 'character')
  if (typeof character === 'string') return { fehler: character }
  const accessPerspective = liste(o.accessPerspective, ACCESS_PERSPECTIVE_VALUES, 'accessPerspective')
  if (typeof accessPerspective === 'string') return { fehler: accessPerspective }
  return {
    targetLanguage: o.targetLanguage as TargetLanguage,
    character,
    accessPerspective,
    socialContext: o.socialContext as SocialContext,
    llmModel: o.llmModel.trim(),
  }
}
