/**
 * @fileoverview Plan einer Uebersetzung fuer `dokument_uebersetzen` (reine Funktion).
 *
 * @description
 * Uebersetzungen eines Galerie-Eintrags entstehen als Jobs `phase-translations`, einer je
 * Zielsprache. Bisher loeste sie nur der Knopf „Publizieren" in der Galerie-Tabelle aus
 * (`/docs/publish`) — fuer Seiten der Website gibt es dort keinen Knopf, und
 * `dokument_publizieren` uebersetzt nicht (Befund 25.11.2026). Hier steht, WELCHE Sprachen
 * ein Auftrag bekommt; ausgeloest wird er in `tools-dokument-uebersetzen.ts`.
 *
 * Anders als die Route raet der Plan nichts: Ein Dokument ohne Sprache oder ein Auftrag ohne
 * Zielsprache ist ein Fehler mit Klartext, kein stiller Rueckfall auf Deutsch oder „nichts tun".
 *
 * @module mcp
 */

import { SUPPORTED_LOCALES, type Locale } from '@ks/i18n'

export interface UebersetzungsPlan {
  quellsprache: string
  /** Zielsprachen ohne die Quellsprache, ohne Dubletten, in der genannten Reihenfolge. */
  zielsprachen: Locale[]
  /** Woher die Zielsprachen stammen. */
  herkunft: 'auftrag' | 'library'
}

function istLocale(wert: string): wert is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(wert)
}

/**
 * @param docMetaJson Metadaten des Galerie-Eintrags (`language` bzw. `sourceLanguage`).
 * @param konfiguriert `config.translations.targetLocales` der Library; `undefined`, wenn nicht gesetzt.
 * @param gewuenscht Zielsprachen aus dem Auftrag; haben Vorrang vor der Library.
 */
export function planeUebersetzung(
  docMetaJson: Record<string, unknown> | undefined,
  konfiguriert: readonly string[] | undefined,
  gewuenscht: readonly string[] | undefined,
): UebersetzungsPlan {
  const roh = docMetaJson?.language ?? docMetaJson?.sourceLanguage
  const quellsprache = typeof roh === 'string' ? roh.trim() : ''
  if (quellsprache === '') {
    throw new Error('Das Dokument nennt keine Sprache (Feld language) — ohne Quellsprache keine Uebersetzung')
  }
  const ausAuftrag = gewuenscht !== undefined && gewuenscht.length > 0
  const wunsch = ausAuftrag ? gewuenscht : konfiguriert ?? []
  const unbekannt = wunsch.filter((s) => !istLocale(s))
  if (unbekannt.length > 0) {
    throw new Error(`Unbekannte Zielsprache: ${unbekannt.join(', ')} — erlaubt sind ${SUPPORTED_LOCALES.join(', ')}`)
  }
  const zielsprachen = Array.from(new Set(wunsch.filter(istLocale))).filter((s) => s !== quellsprache)
  if (zielsprachen.length === 0) {
    throw new Error(
      wunsch.length === 0
        ? 'Keine Zielsprache: Die Library hat keine eingestellt (Einstellungen → Uebersetzungen) — zielsprachen im Auftrag nennen'
        : `Keine Zielsprache ausser der Quellsprache „${quellsprache}" genannt`,
    )
  }
  return { quellsprache, zielsprachen, herkunft: ausAuftrag ? 'auftrag' : 'library' }
}
