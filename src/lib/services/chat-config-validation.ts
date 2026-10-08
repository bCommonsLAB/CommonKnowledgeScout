/**
 * @fileoverview Chat-Konfiguration: ein Merge, eine Validierung (Welle D).
 *
 * @description
 * Bis 08.10.2026 pruefte nur das Settings-Formular im Browser
 * (`use-chat-form.ts`, Zod mit Platzhalter-Querpruefung); die PATCH-Route
 * `/api/libraries/[id]` mergte `config.chat` ungeprueft, und die Stream-Route
 * normalisierte erst beim Lesen — ein Platzhalter auf eine unbekannte
 * Facette haette dort den Chat der Library angehalten. Hier liegen Merge und
 * Pruefung als reine Funktionen, die Route UND Bruecke (`konfiguration_setzen`)
 * rufen — Muster `public-publishing-validation.ts` (2.34.0).
 *
 * @module services
 */

import { ZodError } from 'zod'
import { normalizeChatConfig, type NormalizedChatConfig } from '@/lib/chat/config'

export type ChatKonfigurationPruefung =
  | { ok: true; config: NormalizedChatConfig }
  | { ok: false; fehler: string[] }

/**
 * Flacher Merge wie in der PATCH-Route: genannte Schluessel ersetzen die alten,
 * ungenannte bleiben. `gallery` wird als Ganzes ersetzt, wenn es genannt ist —
 * genau wie bisher (das Formular schickt immer das komplette Objekt).
 */
export function mergeChatKonfiguration(
  alt: Record<string, unknown> | undefined,
  neu: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(alt ?? {}), ...neu }
}

/**
 * Prueft einen WIRKSAMEN Zustand (nach dem Merge) mit demselben Schema wie das
 * Formular: Typen, Facetten-Woerterbuch zum Typ, Platzhalter der
 * Antwortregeln gegen die Facetten. Liefert lesbare Fehler je Pfad.
 */
export function validiereChatKonfiguration(config: unknown): ChatKonfigurationPruefung {
  try {
    return { ok: true, config: normalizeChatConfig(config) }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        fehler: error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '(Wurzel)'}: ${issue.message}`),
      }
    }
    return { ok: false, fehler: [error instanceof Error ? error.message : String(error)] }
  }
}

/** Fehlerliste als ein Text, fuer HTTP-Antwort und Werkzeug-Fehler. */
export function formatiereChatKonfigurationFehler(fehler: readonly string[]): string {
  return `Chat-Konfiguration ungueltig:\n${fehler.map((f) => `- ${f}`).join('\n')}`
}
