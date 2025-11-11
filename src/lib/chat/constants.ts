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

export type Retriever = 'chunk' | 'doc' | 'summary' | 'auto'

export const RETRIEVER_VALUES: readonly Retriever[] = ['auto', 'chunk', 'doc', 'summary'] as const

export const RETRIEVER_DEFAULT: Retriever = 'auto'

export const RETRIEVER_LABELS: Record<Retriever, string> = {
  auto: 'Auto',
  chunk: 'Spezifisch',
  doc: 'Übersichtlich',
  summary: 'Übersichtlich',
}

/**
 * Retriever-Werte für Zod-Validierung (ohne 'auto')
 */
export const RETRIEVER_VALUES_FOR_API: readonly ('chunk' | 'doc' | 'summary')[] = ['chunk', 'doc', 'summary'] as const

export const RETRIEVER_ZOD_ENUM = z.enum(['chunk', 'doc', 'summary'])

// ============================================================================
// ZIELSPRACHE (TargetLanguage)
// ============================================================================

export type TargetLanguage = 'de' | 'en' | 'it' | 'fr' | 'es' | 'ar'

export const TARGET_LANGUAGE_VALUES: readonly TargetLanguage[] = ['de', 'en', 'it', 'fr', 'es', 'ar'] as const

export const TARGET_LANGUAGE_DEFAULT: TargetLanguage = 'de'

export const TARGET_LANGUAGE_LABELS: Record<TargetLanguage, string> = {
  de: 'Deutsch',
  en: 'Englisch',
  it: 'Italienisch',
  fr: 'Französisch',
  es: 'Spanisch',
  ar: 'Arabisch',
}

export const TARGET_LANGUAGE_ZOD_ENUM = z.enum(['de', 'en', 'it', 'fr', 'es', 'ar'])

// ============================================================================
// CHARAKTER/PERSPEKTIVE (Character)
// ============================================================================

/**
 * Character-Typ für Chat-Perspektiven.
 * Definiert verschiedene Rollen/Perspektiven, aus denen der Chatbot antworten kann.
 */
export type Character =
  | 'developer'
  | 'technical'
  | 'open-source'
  | 'scientific'
  | 'eco-social'
  | 'social'
  | 'civic'
  | 'policy'
  | 'cultural'
  | 'business'
  | 'entrepreneurial'
  | 'legal'
  | 'educational'
  | 'creative'

export const CHARACTER_VALUES: readonly Character[] = [
  'developer',
  'technical',
  'open-source',
  'scientific',
  'eco-social',
  'social',
  'civic',
  'policy',
  'cultural',
  'business',
  'entrepreneurial',
  'legal',
  'educational',
  'creative',
] as const

export const CHARACTER_DEFAULT: Character = 'business'

export const CHARACTER_LABELS: Record<Character, string> = {
  developer: 'Developer-orientiert',
  technical: 'Technisch-orientiert',
  'open-source': 'Open-Source-spezifisch',
  scientific: 'Naturwissenschaftlich',
  'eco-social': 'Ökosozial-orientiert',
  social: 'Sozial-orientiert',
  civic: 'Bürgerschaftlich-orientiert',
  policy: 'Politikwissenschaftlich-orientiert',
  cultural: 'Kulturell-orientiert',
  business: 'Business-orientiert',
  entrepreneurial: 'Unternehmerisch-orientiert',
  legal: 'Rechtskundespezifisch',
  educational: 'Bildungswissenschaftlich-orientiert',
  creative: 'Kreativ-orientiert',
}

/**
 * Character instructions for LLM prompts
 * These are used in lib/chat/common/prompt.ts
 */
export const CHARACTER_INSTRUCTIONS: Record<Character, string> = {
  // Knowledge & Innovation
  developer: 'You respond from a developer perspective. Focus on code quality, best practices, technology stacks, performance, scalability, and practical implementation.',
  technical: 'You respond from a technical perspective. Focus on technical details, architecture, system design, engineering principles, and practical solution approaches.',
  'open-source': 'You respond from an open-source perspective. Focus on community, transparency, collaboration, license models, and open standards.',
  scientific: 'You respond from a natural science perspective. Focus on evidence, methodology, reproducibility, and scientific accuracy.',
  
  // Society & Impact
  'eco-social': 'You respond from an eco-social perspective. Focus on sustainability, social justice, environmental protection, and long-term societal impacts.',
  social: 'You respond from a social perspective. Focus on community, cooperation, inclusion, and societal aspects.',
  civic: 'You respond from a civic perspective. Focus on citizen participation, democracy, common good, and civil society engagement.',
  policy: 'You respond from a political science perspective. Focus on policy analysis, regulations, governance structures, and socio-political impacts.',
  cultural: 'You respond from a cultural perspective. Focus on cultural values, traditions, societal norms, and cultural diversity.',
  
  // Economy & Practice
  business: 'You respond from a business, entrepreneurial perspective. Focus on efficiency, ROI, market opportunities, competitive advantages, and practical feasibility.',
  entrepreneurial: 'You respond from an entrepreneurial perspective. Focus on innovation, risk-taking, business models, growth strategies, and market success.',
  legal: 'You respond from a legal perspective. Focus on legal aspects, compliance, licenses, data protection, and legal risks.',
  educational: 'You respond from an educational science perspective. Focus on learning processes, pedagogy, knowledge transfer, and didactic approaches.',
  creative: 'You respond from a creative perspective. Focus on innovation, design thinking, artistic approaches, and creative problem-solving.',
}

export const CHARACTER_ZOD_ENUM = z.enum([
  'developer',
  'technical',
  'open-source',
  'scientific',
  'eco-social',
  'social',
  'civic',
  'policy',
  'cultural',
  'business',
  'entrepreneurial',
  'legal',
  'educational',
  'creative',
])

/**
 * Farbzuordnung für Characters (Hintergrund und Border).
 * Knowledge & Innovation → kühle Blau-/Indigo-/Cyan-Töne
 * Society & Impact → grüne/teal/lime Töne (leicht erdig)
 * Economy & Practice → warme Amber/Orange/Rose/Stone Töne
 */
export const characterColors: Record<Character, string> = {
  // Knowledge & Innovation (cool)
  developer: 'bg-blue-50 border-blue-200',
  technical: 'bg-cyan-50 border-cyan-200',
  'open-source': 'bg-sky-50 border-sky-200',
  scientific: 'bg-indigo-50 border-indigo-200',
  // Society & Impact (greens)
  'eco-social': 'bg-green-50 border-green-200',
  social: 'bg-teal-50 border-teal-200',
  civic: 'bg-lime-50 border-lime-200',
  policy: 'bg-emerald-50 border-emerald-200',
  cultural: 'bg-green-50 border-green-200/70', // leicht variiert – bleibt im grünen Spektrum
  // Economy & Practice (warm)
  business: 'bg-amber-50 border-amber-200',
  entrepreneurial: 'bg-orange-50 border-orange-200',
  legal: 'bg-stone-50 border-stone-200', // seriös/warm-neutral
  educational: 'bg-yellow-50 border-yellow-200',
  creative: 'bg-rose-50 border-rose-200',
}

/**
 * Icon-Farbzuordnung für Characters (Hintergrund und Text).
 * Folgt demselben Farbschema wie characterColors, jedoch mit stärkerer Intensität.
 */
export const characterIconColors: Record<Character, string> = {
  // Knowledge & Innovation (cool)
  developer: 'bg-blue-100 text-blue-600',
  technical: 'bg-cyan-100 text-cyan-600',
  'open-source': 'bg-sky-100 text-sky-600',
  scientific: 'bg-indigo-100 text-indigo-600',
  // Society & Impact (greens)
  'eco-social': 'bg-green-100 text-green-600',
  social: 'bg-teal-100 text-teal-600',
  civic: 'bg-lime-100 text-lime-600',
  policy: 'bg-emerald-100 text-emerald-600',
  cultural: 'bg-green-100 text-green-600',
  // Economy & Practice (warm)
  business: 'bg-amber-100 text-amber-600',
  entrepreneurial: 'bg-orange-100 text-orange-600',
  legal: 'bg-stone-100 text-stone-600',
  educational: 'bg-yellow-100 text-yellow-600',
  creative: 'bg-rose-100 text-rose-600',
}

// ============================================================================
// SOZIALER KONTEXT (SocialContext)
// ============================================================================

export type SocialContext = 'scientific' | 'general' | 'youth' | 'senior' | 'professional' | 'children' | 'easy_language' 

export const SOCIAL_CONTEXT_VALUES: readonly SocialContext[] = ['scientific', 'general', 'youth', 'senior', 'professional', 'children', 'easy_language'] as const

export const SOCIAL_CONTEXT_DEFAULT: SocialContext = 'general'

export const SOCIAL_CONTEXT_LABELS: Record<SocialContext, string> = {
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
  scientific: 'Use scientific language with technical terms. Explain complex concepts precisely and technically correct.',
  general: 'Clear, accessible language without jargon. Use metaphors and short examples. Maximum medium sentence length.',
  youth: 'Use youth-friendly language. Explain complex concepts vividly and understandably, avoid overly formal formulations.',
  senior: 'Use senior-friendly language. Explain complex concepts clearly and thoroughly, with appropriate pace and without too many abbreviations.',
  professional: 'Use professional, business language. Formulate respectfully, precisely, and results-oriented. Use appropriate polite forms and avoid colloquial expressions.',
  children: 'Use child-friendly language for elementary school age (6-10 years). Use short sentences, simple words, and many examples. Explain step by step and avoid technical terms or use them only with simple explanations.',
  easy_language: 'Use simple language suitable for people with low education levels. Use short sentences, simple words, and many examples. Explain step by step and avoid technical terms or use them only with simple explanations.',
}

export const SOCIAL_CONTEXT_ZOD_ENUM = z.enum(['scientific', 'general', 'youth', 'senior', 'professional', 'children', 'easy_language'])

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

