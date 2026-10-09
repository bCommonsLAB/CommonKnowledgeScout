/**
 * @fileoverview Chat-Vokabular — die vier Aufzaehlungen, die eine Library beschreiben
 *
 * @description
 * Zielsprache, Interessenprofil (Character), sozialer Kontext und
 * Zugangsperspektive sind Teil des Library-Steckbriefs und damit ein Contract,
 * kein Chat-Implementierungsdetail. Neben jeder Union steht ihre Werteliste:
 * Zwei Orte fuer dieselbe Aufzaehlung laufen frueher oder spaeter auseinander
 * (Welle M4d, Entscheidung 3). Seit dem Perspektiv-Dialog (09.10.2026) liegen
 * auch die Listen fuer Sprachen, Interessen und Zugaenge hier — der Dialog im
 * Paket `@ks/module-story` darf `src/lib/chat` nicht kennen.
 *
 * Die uebrigen Konstanten-Bloecke (Labels, Defaults, Zod-Enums, Prompts)
 * bleiben in src/lib/chat/constants.ts — das Paket beschreibt, es rechnet nicht.
 *
 * @module contracts/chat-vocabulary
 */

// ============================================================================
// ZIELSPRACHE (TargetLanguage)
// ============================================================================

/**
 * Verfügbare Zielsprachen für Chat-Antworten
 * 
 * Kategorien:
 * ✅ Vollständig unterstützt: Alle europäischen Hauptsprachen + große asiatische Sprachen
 * 🌐 Gut unterstützt: Funktionieren gut, aber mit etwas geringerer Präzision
 * 🌱 Grundkenntnisse: Einfache Texte möglich, komplexere Grammatik kann schwierig sein
 */

export type TargetLanguage = 
  // Globale Sprache (verwendet UI-Sprache)
  | 'global'
  // ✅ Vollständig unterstützt
  | 'de' // Deutsch
  | 'en' // Englisch
  | 'it' // Italienisch
  | 'fr' // Französisch
  | 'es' // Spanisch
  | 'pt' // Portugiesisch
  | 'nl' // Niederländisch
  | 'no' // Norwegisch
  | 'da' // Dänisch
  | 'sv' // Schwedisch
  | 'fi' // Finnisch
  | 'pl' // Polnisch
  | 'cs' // Tschechisch
  | 'hu' // Ungarisch
  | 'ro' // Rumänisch
  | 'bg' // Bulgarisch
  | 'el' // Griechisch
  | 'tr' // Türkisch
  | 'ru' // Russisch
  | 'uk' // Ukrainisch
  | 'zh' // Chinesisch (Mandarin, traditionell & vereinfacht)
  | 'ko' // Koreanisch
  | 'ja' // Japanisch
  // 🌐 Gut unterstützt (Alltagsniveau, gelegentlich Einschränkungen)
  | 'hr' // Kroatisch
  | 'sr' // Serbisch
  | 'bs' // Bosnisch
  | 'sl' // Slowenisch
  | 'sk' // Slowakisch
  | 'lt' // Litauisch
  | 'lv' // Lettisch
  | 'et' // Estnisch
  | 'id' // Indonesisch
  | 'ms' // Malaysisch
  | 'hi' // Hindi
  // 🌱 Grundkenntnisse / einfache Texte
  | 'sw' // Swahili
  | 'yo' // Yoruba
  | 'zu' // Zulu
  | 'am' // Amharisch
  | 'om' // Oromo (Afaan Oromoo)

// ============================================================================
// INTERESSENPROFIL (Character)
// ============================================================================

/**
 * Character-Typ für Chat-Perspektiven (Interessenprofile).
 * Definiert verschiedene Interessenprofile, aus denen der Chatbot antworten kann.
 * Unterstützt mehrere Werte (max. 3) für kombinierte Perspektiven.
 * 'undefined' ist der Standard-Wert, wenn nichts ausgewählt wurde.
 */
export type Character =
  | 'undefined'
  | 'technical'
  | 'social-cultural'
  | 'ecology'
  | 'business'
  | 'educational'
  | 'practical'
  | 'research'
  | 'creative'

// ============================================================================
// SOZIALER KONTEXT (SocialContext)
// ============================================================================

export type SocialContext = 'undefined' | 'scientific' | 'general' | 'youth' | 'senior' | 'professional' | 'children' | 'easy_language' 

export const SOCIAL_CONTEXT_VALUES: readonly SocialContext[] = ['undefined', 'scientific', 'general', 'youth', 'senior', 'professional', 'children', 'easy_language'] as const

// ============================================================================
// ZUGANGSPERSPEKTIVE (AccessPerspective)
// ============================================================================

/**
 * AccessPerspective-Typ für Zugangsperspektiven.
 * Definiert verschiedene Arten des Zugangs zu Inhalten (WIE schaust du auf Inhalte?).
 * Unterstützt mehrere Werte (max. 3) für kombinierte Perspektiven.
 * 'undefined' ist der Standard-Wert, wenn nichts ausgewählt wurde.
 */
export type AccessPerspective =
  | 'undefined'
  | 'insight'
  | 'community'
  | 'sustainability'
  | 'learning'
  | 'practical_view'
  | 'future_view'

export const ACCESS_PERSPECTIVE_VALUES: readonly AccessPerspective[] = [
  'undefined',
  'insight',
  'community',
  'sustainability',
  'learning',
  'practical_view',
  'future_view',
] as const

export const CHARACTER_VALUES: readonly Character[] = [
  'undefined',
  'technical',
  'social-cultural',
  'ecology',
  'business',
  'educational',
  'practical',
  'research',
  'creative',
] as const

/** Sprachkategorien fuer Warnhinweise: wie gut die Modelle eine Sprache koennen. */
export const LANGUAGE_CATEGORIES = {
  /** Vollstaendig unterstuetzt: alle europaeischen Hauptsprachen und grosse asiatische Sprachen */
  FULLY_SUPPORTED: ['en', 'de', 'it', 'fr', 'es', 'pt', 'nl', 'no', 'da', 'sv', 'fi', 'pl', 'cs', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'zh', 'ko', 'ja'] as const,
  /** Gut unterstuetzt, mit etwas geringerer Praezision */
  WELL_SUPPORTED: ['hr', 'sr', 'bs', 'sl', 'sk', 'lt', 'lv', 'et', 'id', 'ms', 'hi'] as const,
  /** Grundkenntnisse: einfache Texte moeglich */
  BASIC_SUPPORT: ['sw', 'yo', 'zu', 'am', 'om'] as const,
} as const

/** Kategorie einer Sprache; `global` folgt der Oberflaechensprache und hat keine. */
export function getLanguageCategory(language: TargetLanguage): 'full' | 'well' | 'basic' | null {
  if (language === 'global') return null
  if ((LANGUAGE_CATEGORIES.FULLY_SUPPORTED as readonly TargetLanguage[]).includes(language)) return 'full'
  if ((LANGUAGE_CATEGORIES.WELL_SUPPORTED as readonly TargetLanguage[]).includes(language)) return 'well'
  if ((LANGUAGE_CATEGORIES.BASIC_SUPPORT as readonly TargetLanguage[]).includes(language)) return 'basic'
  return null
}

/** Alle Zielsprachen: global, dann vollstaendig, gut und grundlegend unterstuetzt. */
export const TARGET_LANGUAGE_VALUES: readonly TargetLanguage[] = [
  'global',
  ...LANGUAGE_CATEGORIES.FULLY_SUPPORTED,
  ...LANGUAGE_CATEGORIES.WELL_SUPPORTED,
  ...LANGUAGE_CATEGORIES.BASIC_SUPPORT,
] as const
