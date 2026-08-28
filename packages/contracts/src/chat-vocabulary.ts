/**
 * @fileoverview Chat-Vokabular — die vier Aufzaehlungen, die eine Library beschreiben
 *
 * @description
 * Zielsprache, Interessenprofil (Character), sozialer Kontext und
 * Zugangsperspektive sind Teil des Library-Steckbriefs und damit ein Contract,
 * kein Chat-Implementierungsdetail. Reine String-Unions ohne Laufzeitcode —
 * einzige Ausnahme ist SOCIAL_CONTEXT_VALUES, das direkt neben seiner Union
 * steht: Zwei Orte fuer dieselbe Aufzaehlung laufen frueher oder spaeter
 * auseinander (Welle M4d, Entscheidung 3).
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
