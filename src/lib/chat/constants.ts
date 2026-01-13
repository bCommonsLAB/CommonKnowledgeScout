/**
 * @fileoverview Chat Constants - Central Chat Configuration Definitions
 * 
 * @description
 * Central definition of all chat configuration parameters. This file is the single
 * source of truth for answer length, retriever methods, target language, character
 * perspective, and social context. All other files should import and use these definitions.
 * 
 * @module chat
 * 
 * @exports
 * - AnswerLength: Answer length type and values
 * - Retriever: Retriever method type and values
 * - TargetLanguage: Target language type and values
 * - Character: Character type and values
 * - SocialContext: Social context type and values
 * - Zod enums for validation
 * - Labels and defaults for UI
 * 
 * @usedIn
 * - src/lib/chat/orchestrator.ts: Uses constants for configuration
 * - src/lib/chat/config.ts: Uses constants for configuration normalization
 * - src/components/library/chat: Chat components use constants
 * - src/app/api/chat: Chat API routes use constants
 * 
 * @dependencies
 * - zod: Schema validation library
 */

/**
 * Zentrale Definition aller Chat-Konfigurationsparameter
 * 
 * Diese Datei enthält die einzige Quelle der Wahrheit für:
 * - Antwortlänge (AnswerLength)
 * - Retriever-Methode (Retriever)
 * - Zielsprache (TargetLanguage)
 * - Charakter/Perspektive (Character)
 * - Sozialer Kontext (SocialContext)
 * 
 * Alle anderen Dateien sollten diese Definitionen importieren und verwenden.
 */

import * as z from 'zod'

// ============================================================================
// ANTWORTLÄNGE (AnswerLength)
// ============================================================================

export type AnswerLength = 'kurz' | 'mittel' | 'ausführlich' | 'unbegrenzt'

export const ANSWER_LENGTH_VALUES: readonly AnswerLength[] = ['kurz', 'mittel', 'ausführlich', 'unbegrenzt'] as const

export const ANSWER_LENGTH_DEFAULT: AnswerLength = 'ausführlich'

export const ANSWER_LENGTH_LABELS: Record<AnswerLength, string> = {
  kurz: 'Kurz',
  mittel: 'Mittel',
  ausführlich: 'Ausführlich',
  unbegrenzt: 'Unbegrenzt',
}

export const ANSWER_LENGTH_ZOD_ENUM = z.enum(['kurz', 'mittel', 'ausführlich', 'unbegrenzt'])

// ============================================================================
// RETRIEVER-METHODE (Retriever)
// ============================================================================

export type Retriever = 'chunk' | 'chunkSummary' | 'doc' | 'summary' | 'auto'

export const RETRIEVER_VALUES: readonly Retriever[] = ['auto', 'chunk', 'chunkSummary', 'doc', 'summary'] as const

export const RETRIEVER_DEFAULT: Retriever = 'auto'

export const RETRIEVER_LABELS: Record<Retriever, string> = {
  auto: 'Auto',
  chunk: 'Spezifisch',
  chunkSummary: 'Alle Chunks', // Interne Option, wird im UI als 'chunk' angezeigt
  doc: 'Übersichtlich',
  summary: 'Übersichtlich',
}

/**
 * Retriever-Werte für Zod-Validierung (ohne 'auto' und 'chunkSummary')
 * chunkSummary ist eine interne Option und wird nicht über API gesetzt
 */
export const RETRIEVER_VALUES_FOR_API: readonly ('chunk' | 'doc' | 'summary')[] = ['chunk', 'doc', 'summary'] as const

export const RETRIEVER_ZOD_ENUM = z.enum(['chunk', 'doc', 'summary'])

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

/**
 * Sprachkategorien für Warnhinweise
 * 
 * Definiert, welche Sprachen zu welcher Unterstützungskategorie gehören
 */
export const LANGUAGE_CATEGORIES = {
  /** ✅ Vollständig unterstützt: Alle europäischen Hauptsprachen + große asiatische Sprachen */
  FULLY_SUPPORTED: ['en', 'de', 'it', 'fr', 'es', 'pt', 'nl', 'no', 'da', 'sv', 'fi', 'pl', 'cs', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'zh', 'ko', 'ja'] as const,
  /** 🌐 Gut unterstützt: Funktionieren gut, aber mit etwas geringerer Präzision */
  WELL_SUPPORTED: ['hr', 'sr', 'bs', 'sl', 'sk', 'lt', 'lv', 'et', 'id', 'ms', 'hi'] as const,
  /** 🌱 Grundkenntnisse: Einfache Texte möglich, komplexere Grammatik kann schwierig sein */
  BASIC_SUPPORT: ['sw', 'yo', 'zu'] as const,
} as const

/**
 * Prüft, zu welcher Kategorie eine Sprache gehört
 */
export function getLanguageCategory(language: TargetLanguage): 'full' | 'well' | 'basic' | null {
  // 'global' verwendet die UI-Sprache, daher keine spezifische Kategorie
  if (language === 'global') {
    return null
  }
  // Type Guard: Prüfe ob language in FULLY_SUPPORTED enthalten ist
  // Verwende explizite Typkonvertierung zu readonly TargetLanguage[] für Type-Safety
  const fullySupported = LANGUAGE_CATEGORIES.FULLY_SUPPORTED as readonly TargetLanguage[]
  if (fullySupported.includes(language)) {
    return 'full'
  }
  // Type Guard: Prüfe ob language in WELL_SUPPORTED enthalten ist
  const wellSupported = LANGUAGE_CATEGORIES.WELL_SUPPORTED as readonly TargetLanguage[]
  if (wellSupported.includes(language)) {
    return 'well'
  }
  // Type Guard: Prüfe ob language in BASIC_SUPPORT enthalten ist
  const basicSupport = LANGUAGE_CATEGORIES.BASIC_SUPPORT as readonly TargetLanguage[]
  if (basicSupport.includes(language)) {
    return 'basic'
  }
  return null
}

/**
 * Liste aller verfügbaren Zielsprachen
 * 
 * Reihenfolge: Globale Sprache → Vollständig unterstützt → Gut unterstützt → Grundkenntnisse
 */
export const TARGET_LANGUAGE_VALUES: readonly TargetLanguage[] = [
  // Globale Sprache (verwendet UI-Sprache)
  'global',
  // ✅ Vollständig unterstützt
  ...LANGUAGE_CATEGORIES.FULLY_SUPPORTED,
  // 🌐 Gut unterstützt (Alltagsniveau, gelegentlich Einschränkungen)
  ...LANGUAGE_CATEGORIES.WELL_SUPPORTED,
  // 🌱 Grundkenntnisse / einfache Texte
  ...LANGUAGE_CATEGORIES.BASIC_SUPPORT,
] as const

export const TARGET_LANGUAGE_DEFAULT: TargetLanguage = 'en'

/**
 * Fallback-Labels für Sprachen (falls Übersetzungen fehlen)
 * Die tatsächlichen Labels werden aus den i18n-Übersetzungsdateien geladen.
 */
export const TARGET_LANGUAGE_LABELS: Record<TargetLanguage, string> = {
  // Globale Sprache (verwendet UI-Sprache)
  global: 'Globale Sprache',
  // ✅ Vollständig unterstützt
  de: 'Deutsch',
  en: 'Englisch',
  it: 'Italienisch',
  fr: 'Französisch',
  es: 'Spanisch',
  pt: 'Portugiesisch',
  nl: 'Niederländisch',
  no: 'Norwegisch',
  da: 'Dänisch',
  sv: 'Schwedisch',
  fi: 'Finnisch',
  pl: 'Polnisch',
  cs: 'Tschechisch',
  hu: 'Ungarisch',
  ro: 'Rumänisch',
  bg: 'Bulgarisch',
  el: 'Griechisch',
  tr: 'Türkisch',
  ru: 'Russisch',
  uk: 'Ukrainisch',
  zh: 'Chinesisch',
  ko: 'Koreanisch',
  ja: 'Japanisch',
  // 🌐 Gut unterstützt
  hr: 'Kroatisch',
  sr: 'Serbisch',
  bs: 'Bosnisch',
  sl: 'Slowenisch',
  sk: 'Slowakisch',
  lt: 'Litauisch',
  lv: 'Lettisch',
  et: 'Estnisch',
  id: 'Indonesisch',
  ms: 'Malaysisch',
  hi: 'Hindi',
  // 🌱 Grundkenntnisse
  sw: 'Swahili',
  yo: 'Yoruba',
  zu: 'Zulu',
}

export const TARGET_LANGUAGE_ZOD_ENUM = z.enum([
  'global',
  'en', 'de', 'it', 'fr', 'es', 'pt', 'nl', 'no', 'da', 'sv', 'fi', 'pl', 'cs', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'zh', 'ko', 'ja',
  'hr', 'sr', 'bs', 'sl', 'sk', 'lt', 'lv', 'et', 'id', 'ms', 'hi',
  'sw', 'yo', 'zu',
])

// ============================================================================
// CHARAKTER/PERSPEKTIVE (Character)
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

export const CHARACTER_DEFAULT: Character[] = ['undefined']

/**
 * Filtert 'undefined' aus einem Character-Array heraus
 * Wird verwendet, um zu prüfen, ob tatsächlich eine Auswahl getroffen wurde
 */
export function filterUndefinedCharacters(characters: Character[]): Character[] {
  return characters.filter(char => char !== 'undefined')
}

export const CHARACTER_LABELS: Record<Character, string> = {
  undefined: 'Keine spezifische Perspektive',
  technical: 'Technikorientiert',
  'social-cultural': 'Gesellschaft & Kultur',
  ecology: 'Ökologie & Nachhaltigkeit',
  business: 'Wirtschaft & Organisation',
  educational: 'Bildung & Lernen',
  practical: 'Alltag & Praxis',
  research: 'Forschung & Analyse',
  creative: 'Kreativ & Visionär',
}

/**
 * Character instructions for LLM prompts
 * These are used in lib/chat/common/prompt.ts
 * 
 * Unterstützt kombinierte Perspektiven: Wenn mehrere Character-Werte gewählt werden,
 * werden die Instructions mit "AND" kombiniert.
 */
export const CHARACTER_INSTRUCTIONS: Record<Character, string> = {
  undefined: '', // Keine spezifische Perspektive - keine Instruction
  technical: 'You respond from a technology-oriented perspective. Focus on technical backgrounds, processes, systems, and methodologies. Emphasize technical aspects, tools, architecture, and functionality.',
  'social-cultural': 'You respond from a social and cultural perspective. Focus on social impacts, cultural dynamics, and community questions. Emphasize societal significance, people, relationships, and processes.',
  ecology: 'You respond from an ecological and sustainability perspective. Focus on ecological consequences, climate, future, and resources. Emphasize sustainability aspects, environmental impacts, risks, and opportunities.',
  business: 'You respond from an economic and organizational perspective. Focus on economic frameworks, business models, value creation, and strategic questions. Emphasize utility, efficiency, organization, and scalability.',
  educational: 'You respond from an educational and learning perspective. Focus on clear, structured content with a learning focus. Emphasize fundamentals, illustrative examples, and explanatory models.',
  practical: 'You respond from a practical and everyday perspective. Focus on what this means for daily life. Emphasize practical relevance, concrete examples, and action-oriented approaches.',
  research: 'You respond from a research and analysis perspective. Focus on methodology, evidence, source criticism, and argumentation lines. Emphasize scientific rigor and analytical depth.',
  creative: 'You respond from a creative and visionary perspective. Focus on future scenarios, visions, idea sketches, and new possibilities. Emphasize horizons, opportunities, and creative applications.',
}

/**
 * Kombiniert mehrere Character-Instructions zu einer kombinierten Anweisung
 * @param characters Array von Character-Werten (max. 3)
 * @returns Kombinierte Instruction-String
 */
export function combineCharacterInstructions(characters: Character[]): string {
  // Filtere 'undefined' heraus, da es keine Instruction hat
  const filtered = characters.filter(char => char !== 'undefined')
  
  if (filtered.length === 0) {
    return '' // Keine Instructions wenn nur 'undefined' vorhanden
  }
  
  if (filtered.length === 1) {
    return CHARACTER_INSTRUCTIONS[filtered[0]]
  }
  
  // Kombiniere mehrere Instructions mit "AND"
  const instructions = filtered.map(char => CHARACTER_INSTRUCTIONS[char]).filter(inst => inst.length > 0)
  if (instructions.length === 0) {
    return ''
  }
  return `You respond from a combined perspective that integrates: ${instructions.join(' AND ')}`
}

export const CHARACTER_ZOD_ENUM = z.enum([
  'undefined',
  'technical',
  'social-cultural',
  'ecology',
  'business',
  'educational',
  'practical',
  'research',
  'creative',
])

/**
 * Zod-Schema für Character-Array (max. 3 Werte)
 */
export const CHARACTER_ARRAY_ZOD_SCHEMA = z.array(CHARACTER_ZOD_ENUM).max(3).min(1)

/**
 * Farbzuordnung für Characters (Hintergrund und Border).
 * Sachlicher Zugang → kühle Blau-/Indigo-/Cyan-Töne
 * Menschlicher Zugang → grüne/teal/lime Töne
 * Zukunftsorientierter Zugang → warme Amber/Orange/Rose Töne
 */
export const characterColors: Record<Character, string> = {
  undefined: 'bg-gray-50 border-gray-200',
  // Sachlicher Zugang (cool)
  technical: 'bg-cyan-50 border-cyan-200',
  business: 'bg-blue-50 border-blue-200',
  research: 'bg-indigo-50 border-indigo-200',
  // Menschlicher Zugang (greens)
  'social-cultural': 'bg-teal-50 border-teal-200',
  practical: 'bg-lime-50 border-lime-200',
  educational: 'bg-green-50 border-green-200',
  // Zukunftsorientierter Zugang (warm)
  ecology: 'bg-emerald-50 border-emerald-200',
  creative: 'bg-rose-50 border-rose-200',
}

/**
 * Icon-Farbzuordnung für Characters (Hintergrund und Text).
 * Folgt demselben Farbschema wie characterColors, jedoch mit stärkerer Intensität.
 */
export const characterIconColors: Record<Character, string> = {
  undefined: 'bg-gray-100 text-gray-600',
  // Sachlicher Zugang (cool)
  technical: 'bg-cyan-100 text-cyan-600',
  business: 'bg-blue-100 text-blue-600',
  research: 'bg-indigo-100 text-indigo-600',
  // Menschlicher Zugang (greens)
  'social-cultural': 'bg-teal-100 text-teal-600',
  practical: 'bg-lime-100 text-lime-600',
  educational: 'bg-green-100 text-green-600',
  // Zukunftsorientierter Zugang (warm)
  ecology: 'bg-emerald-100 text-emerald-600',
  creative: 'bg-rose-100 text-rose-600',
}

// ============================================================================
// SOZIALER KONTEXT (SocialContext)
// ============================================================================

export type SocialContext = 'undefined' | 'scientific' | 'general' | 'youth' | 'senior' | 'professional' | 'children' | 'easy_language' 

export const SOCIAL_CONTEXT_VALUES: readonly SocialContext[] = ['undefined', 'scientific', 'general', 'youth', 'senior', 'professional', 'children', 'easy_language'] as const

export const SOCIAL_CONTEXT_DEFAULT: SocialContext = 'undefined'

export const SOCIAL_CONTEXT_LABELS: Record<SocialContext, string> = {
  undefined: 'Kein spezifischer Sprachstil',
  scientific: 'Wissenschaftlich',
  general: 'Allgemeinverständlich',
  youth: 'Jugendlich',
  senior: 'Ältere Erwachsene',
  professional: 'Professionell',
  children: 'Kindgerecht',
  easy_language: 'Einfache Sprache',
}

/**
 * SocialContext instructions for LLM prompts
 * These are used in lib/chat/common/prompt.ts
 */
export const SOCIAL_CONTEXT_INSTRUCTIONS: Record<SocialContext, string> = {
  undefined: '', // Kein spezifischer Sprachstil - keine Instruction
  scientific: 'Use scientific language with technical terms. Explain complex concepts precisely and technically correct.',
  general: 'Clear, accessible language without jargon. Use metaphors and short examples. Maximum medium sentence length.',
  youth: 'Use youth-friendly language. Explain complex concepts vividly and understandably, avoid overly formal formulations.',
  senior: 'Use senior-friendly language. Explain complex concepts clearly and thoroughly, with appropriate pace and without too many abbreviations.',
  professional: 'Use professional, business language. Formulate respectfully, precisely, and results-oriented. Use appropriate polite forms and avoid colloquial expressions.',
  children: 'Use child-friendly language for elementary school age (6-10 years). Use short sentences, simple words, and many examples. Explain step by step and avoid technical terms or use them only with simple explanations.',
  easy_language: 'Use simple language suitable for people with low education levels. Use short sentences, simple words, and many examples. Explain step by step and avoid technical terms or use them only with simple explanations.',
}

export const SOCIAL_CONTEXT_ZOD_ENUM = z.enum(['undefined', 'scientific', 'general', 'youth', 'senior', 'professional', 'children', 'easy_language'])

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

export const ACCESS_PERSPECTIVE_DEFAULT: AccessPerspective[] = ['undefined']

/**
 * Filtert 'undefined' aus einem AccessPerspective-Array heraus
 * Wird verwendet, um zu prüfen, ob tatsächlich eine Auswahl getroffen wurde
 */
export function filterUndefinedAccessPerspectives(accessPerspectives: AccessPerspective[]): AccessPerspective[] {
  return accessPerspectives.filter(ap => ap !== 'undefined')
}

export const ACCESS_PERSPECTIVE_LABELS: Record<AccessPerspective, string> = {
  undefined: 'Keine spezifische Zugangsperspektive',
  insight: 'Erkenntnisorientiert',
  community: 'Gemeinschaftsorientiert',
  sustainability: 'Nachhaltigkeitsorientiert',
  learning: 'Lernorientiert',
  practical_view: 'Praxisorientiert',
  future_view: 'Zukunftsorientiert',
}

/**
 * AccessPerspective instructions for LLM prompts
 * These are used in lib/chat/common/prompt.ts
 * 
 * Unterstützt kombinierte Perspektiven: Wenn mehrere AccessPerspective-Werte gewählt werden,
 * werden die Instructions mit "AND" kombiniert.
 */
export const ACCESS_PERSPECTIVE_INSTRUCTIONS: Record<AccessPerspective, string> = {
  undefined: '', // Keine spezifische Zugangsperspektive - keine Instruction
  insight: 'Emphasize understanding, connections, reflection, and deeper insights. Focus on comprehension, relationships between concepts, and thoughtful analysis.',
  community: 'Emphasize collaboration, participation, social impact, and togetherness. Focus on collective action, shared values, and community benefits.',
  sustainability: 'Emphasize ecological, social, and long-term responsibility. Focus on sustainable practices, environmental considerations, and future generations.',
  learning: 'Emphasize clear, illustrative communication and learning-oriented approach. Focus on educational value, step-by-step explanations, and knowledge transfer.',
  practical_view: 'Emphasize implementability, practical relevance, and concrete application. Focus on actionable steps, real-world examples, and usability.',
  future_view: 'Emphasize potential, innovation, possibilities, and future visions. Focus on forward-looking perspectives, opportunities, and transformative ideas.',
}

/**
 * Kombiniert mehrere AccessPerspective-Instructions zu einer kombinierten Anweisung
 * @param accessPerspectives Array von AccessPerspective-Werten (max. 3)
 * @returns Kombinierte Instruction-String
 */
export function combineAccessPerspectiveInstructions(accessPerspectives: AccessPerspective[]): string {
  // Filtere 'undefined' heraus, da es keine Instruction hat
  const filtered = accessPerspectives.filter(ap => ap !== 'undefined')
  
  if (filtered.length === 0) {
    return '' // Keine Instructions wenn nur 'undefined' vorhanden
  }
  
  if (filtered.length === 1) {
    return ACCESS_PERSPECTIVE_INSTRUCTIONS[filtered[0]]
  }
  
  // Kombiniere mehrere Instructions mit "AND"
  const instructions = filtered.map(ap => ACCESS_PERSPECTIVE_INSTRUCTIONS[ap]).filter(inst => inst.length > 0)
  if (instructions.length === 0) {
    return ''
  }
  return `You approach the content from a combined perspective that integrates: ${instructions.join(' AND ')}`
}

export const ACCESS_PERSPECTIVE_ZOD_ENUM = z.enum([
  'undefined',
  'insight',
  'community',
  'sustainability',
  'learning',
  'practical_view',
  'future_view',
])

/**
 * Zod-Schema für AccessPerspective-Array (max. 3 Werte)
 */
export const ACCESS_PERSPECTIVE_ARRAY_ZOD_SCHEMA = z.array(ACCESS_PERSPECTIVE_ZOD_ENUM).max(3).min(1)

// ============================================================================
// GENDERGEREchte FORMULIERUNG (GenderInclusive)
// ============================================================================

/**
 * Gendergerechte Formulierung aktivieren/deaktivieren
 * Bei Aktivierung: Verwendung von geschlechtsneutralen Formulierungen (z.B. "Personen" statt "Männer/Frauen", 
 * Binnen-I, Gendersternchen, oder geschlechtsneutrale Alternativen)
 */
export type GenderInclusive = boolean

export const GENDER_INCLUSIVE_DEFAULT: GenderInclusive = true

/**
 * Instruction for gender-inclusive formulation in LLM prompts
 */
export function getGenderInclusiveInstruction(genderInclusive: boolean): string {
  if (!genderInclusive) return ''
  return 'Use gender-inclusive formulations: Use gender-neutral terms (e.g., "people", "employees", "students"), use Binnen-I (e.g., "MitarbeiterInnen"), gender asterisk (e.g., "Mitarbeiter*innen"), or double forms (e.g., "Mitarbeiter und Mitarbeiterinnen") where appropriate. Avoid exclusively male or female formulations when referring to mixed groups.'
}

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/**
 * Validiert, ob ein Wert ein gültiger Character ist
 */
export function isValidCharacter(value: unknown): value is Character {
  return typeof value === 'string' && CHARACTER_VALUES.includes(value as Character)
}

/**
 * Validiert, ob ein Wert ein gültiges Character-Array ist (max. 3 Werte)
 */
export function isValidCharacterArray(value: unknown): value is Character[] {
  if (!Array.isArray(value)) return false
  if (value.length === 0 || value.length > 3) return false
  return value.every(char => isValidCharacter(char))
}

/**
 * Konvertiert einen alten Single-Character-Wert zu einem Array (für Backward-Compatibility)
 */
export function normalizeCharacterToArray(value: unknown): Character[] {
  if (Array.isArray(value)) {
    // Bereits ein Array: Validiere und begrenze auf max. 3
    const valid = value.filter(char => isValidCharacter(char)).slice(0, 3)
    return valid.length > 0 ? valid : CHARACTER_DEFAULT
  }
  
  if (isValidCharacter(value)) {
    // Single-Value: Konvertiere zu Array
    return [value]
  }
  
  // Fallback zu Default
  return CHARACTER_DEFAULT
}

/**
 * Parst einen Character-Parameter aus einer URL (komma-separierter String).
 * Konvertiert den String zu einem Character[] Array.
 * 
 * @param characterParam - URL-Parameter als String (z.B. "business,technical" oder null/undefined)
 * @returns Character[] Array (max. 3 Werte) oder undefined, wenn kein gültiger Wert gefunden wurde
 * 
 * @example
 * parseCharacterFromUrlParam("business,technical") // => ['business', 'technical']
 * parseCharacterFromUrlParam("invalid") // => undefined
 * parseCharacterFromUrlParam(null) // => undefined
 */
export function parseCharacterFromUrlParam(characterParam: string | null | undefined): Character[] | undefined {
  if (!characterParam) {
    return undefined
  }
  
  // Parse komma-separierte Werte
  const parts = characterParam.split(',').map(s => s.trim()).filter(s => s.length > 0)
  
  // Validiere und filtere gültige Character-Werte
  const validChars = parts.filter(char => isValidCharacter(char)) as Character[]
  
  // Gib undefined zurück, wenn keine gültigen Werte gefunden wurden
  if (validChars.length === 0) {
    return undefined
  }
  
  // Begrenze auf max. 3 Werte
  return validChars.slice(0, 3)
}

/**
 * Konvertiert Character-Array (oder Single-Value/String) zu einem komma-separierten String.
 * 
 * Diese Funktion ist die Umkehrung von `normalizeCharacterToArray` und wird verwendet,
 * um Character-Werte für URL-Parameter, Query-Logs oder API-Requests zu serialisieren.
 * 
 * @param character - Character[] Array, einzelner Character-Wert, String oder undefined
 * @returns Komma-separierter String (z.B. "business,technical") oder undefined
 * 
 * @example
 * characterArrayToString(['business', 'technical']) // => "business,technical"
 * characterArrayToString('business') // => "business"
 * characterArrayToString(undefined) // => undefined
 * characterArrayToString([]) // => undefined
 */
export function characterArrayToString(character: Character[] | Character | string | undefined): string | undefined {
  if (!character) {
    return undefined
  }
  
  if (Array.isArray(character)) {
    // Array: Verbinde mit Komma, wenn nicht leer
    return character.length > 0 ? character.join(',') : undefined
  }
  
  // String oder Single-Value: Gib direkt zurück
  return character
}

/**
 * Konvertiert 'global' zu einer tatsächlichen Sprache basierend auf UI-Locale
 * Wenn targetLanguage nicht 'global' ist, wird es unverändert zurückgegeben
 * 
 * @param targetLanguage Die Zielsprache (kann 'global' sein)
 * @param uiLocale Die UI-Locale (z.B. 'de', 'en')
 * @returns Die tatsächliche Zielsprache
 */
export function resolveTargetLanguage(targetLanguage: TargetLanguage | undefined, uiLocale: string): Exclude<TargetLanguage, 'global'> {
  if (targetLanguage === 'global' || !targetLanguage) {
    // Konvertiere UI-Locale zu TargetLanguage
    const localeToTargetMap: Record<string, Exclude<TargetLanguage, 'global'>> = {
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
    return localeToTargetMap[uiLocale] || TARGET_LANGUAGE_DEFAULT
  }
  return targetLanguage
}

/**
 * Validiert, ob ein Wert ein gültiger TargetLanguage ist
 */
export function isValidTargetLanguage(value: unknown): value is TargetLanguage {
  return typeof value === 'string' && TARGET_LANGUAGE_VALUES.includes(value as TargetLanguage)
}

/**
 * Validiert, ob ein Wert ein gültiger SocialContext ist
 */
export function isValidSocialContext(value: unknown): value is SocialContext {
  return typeof value === 'string' && SOCIAL_CONTEXT_VALUES.includes(value as SocialContext)
}

/**
 * Validiert, ob ein Wert ein gültiger AccessPerspective ist
 */
export function isValidAccessPerspective(value: unknown): value is AccessPerspective {
  return typeof value === 'string' && ACCESS_PERSPECTIVE_VALUES.includes(value as AccessPerspective)
}

/**
 * Validiert, ob ein Wert ein gültiges AccessPerspective-Array ist (max. 3 Werte)
 */
export function isValidAccessPerspectiveArray(value: unknown): value is AccessPerspective[] {
  if (!Array.isArray(value)) return false
  if (value.length === 0 || value.length > 3) return false
  return value.every(ap => isValidAccessPerspective(ap))
}

/**
 * Konvertiert einen alten Single-AccessPerspective-Wert zu einem Array (für Backward-Compatibility)
 */
export function normalizeAccessPerspectiveToArray(value: unknown): AccessPerspective[] {
  if (Array.isArray(value)) {
    // Bereits ein Array: Validiere und begrenze auf max. 3
    const valid = value.filter(ap => isValidAccessPerspective(ap)).slice(0, 3)
    return valid.length > 0 ? valid : ACCESS_PERSPECTIVE_DEFAULT
  }
  
  if (isValidAccessPerspective(value)) {
    // Single-Value: Konvertiere zu Array
    return [value]
  }
  
  // Fallback zu Default
  return ACCESS_PERSPECTIVE_DEFAULT
}

/**
 * Parst einen AccessPerspective-Parameter aus einer URL (komma-separierter String).
 * Konvertiert den String zu einem AccessPerspective[] Array.
 * 
 * @param accessPerspectiveParam - URL-Parameter als String (z.B. "insight,community" oder null/undefined)
 * @returns AccessPerspective[] Array (max. 3 Werte) oder undefined, wenn kein gültiger Wert gefunden wurde
 * 
 * @example
 * parseAccessPerspectiveFromUrlParam("insight,community") // => ['insight', 'community']
 * parseAccessPerspectiveFromUrlParam("invalid") // => undefined
 * parseAccessPerspectiveFromUrlParam(null) // => undefined
 */
export function parseAccessPerspectiveFromUrlParam(accessPerspectiveParam: string | null | undefined): AccessPerspective[] | undefined {
  if (!accessPerspectiveParam) {
    return undefined
  }
  
  // Parse komma-separierte Werte
  const parts = accessPerspectiveParam.split(',').map(s => s.trim()).filter(s => s.length > 0)
  
  // Validiere und filtere gültige AccessPerspective-Werte
  const validAPs = parts.filter(ap => isValidAccessPerspective(ap)) as AccessPerspective[]
  
  // Gib undefined zurück, wenn keine gültigen Werte gefunden wurden
  if (validAPs.length === 0) {
    return undefined
  }
  
  // Begrenze auf max. 3 Werte
  return validAPs.slice(0, 3)
}

/**
 * Konvertiert AccessPerspective-Array (oder Single-Value/String) zu einem komma-separierten String.
 * 
 * Diese Funktion ist die Umkehrung von `normalizeAccessPerspectiveToArray` und wird verwendet,
 * um AccessPerspective-Werte für URL-Parameter, Query-Logs oder API-Requests zu serialisieren.
 * 
 * @param accessPerspective - AccessPerspective[] Array, einzelner AccessPerspective-Wert, String oder undefined
 * @returns Komma-separierter String (z.B. "insight,community") oder undefined
 * 
 * @example
 * accessPerspectiveArrayToString(['insight', 'community']) // => "insight,community"
 * accessPerspectiveArrayToString('insight') // => "insight"
 * accessPerspectiveArrayToString(undefined) // => undefined
 * accessPerspectiveArrayToString([]) // => undefined
 */
export function accessPerspectiveArrayToString(accessPerspective: AccessPerspective[] | AccessPerspective | string | undefined): string | undefined {
  if (!accessPerspective) {
    return undefined
  }
  
  if (Array.isArray(accessPerspective)) {
    // Array: Verbinde mit Komma, wenn nicht leer
    return accessPerspective.length > 0 ? accessPerspective.join(',') : undefined
  }
  
  // String oder Single-Value: Gib direkt zurück
  return accessPerspective
}

/**
 * Validiert, ob ein Wert ein gültiger AnswerLength ist
 */
export function isValidAnswerLength(value: unknown): value is AnswerLength {
  return typeof value === 'string' && ANSWER_LENGTH_VALUES.includes(value as AnswerLength)
}

/**
 * Validiert, ob ein Wert ein gültiger Retriever ist
 */
export function isValidRetriever(value: unknown): value is Retriever {
  return typeof value === 'string' && RETRIEVER_VALUES.includes(value as Retriever)
}

// ============================================================================
// TOC QUESTION (Table of Contents)
// ============================================================================

/**
 * Standard question used to generate Table of Contents (TOC) / Topic Overview
 * This question is sent to the LLM to generate a structured topic overview
 */
export const TOC_QUESTION = 'What topics are covered here? Can we output them as a table of contents.'

// ============================================================================
// LLM MODELL (LlmModelId)
// ============================================================================
/**
 * LLM Modell-ID Type
 * 
 * Repräsentiert die Modell-ID für LLM-Aufrufe (z.B. 'google/gemini-2.5-flash')
 */
export type LlmModelId = string

/**
 * Standard LLM Modell-ID
 * 
 * Wird verwendet, wenn kein Modell explizit gewählt wurde.
 * Das tatsächliche Standard-Modell wird aus MongoDB geladen (erstes Modell nach order-Sortierung).
 */
export const LLM_MODEL_DEFAULT: LlmModelId = ''
