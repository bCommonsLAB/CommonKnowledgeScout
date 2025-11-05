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
 * Character-Instructions für LLM-Prompts
 * Diese werden in lib/chat/common/prompt.ts verwendet
 */
export const CHARACTER_INSTRUCTIONS: Record<Character, string> = {
  // Knowledge & Innovation
  developer: 'Du antwortest aus einer Entwickler-Perspektive. Fokus auf Code-Qualität, Best Practices, Technologie-Stacks, Performance, Skalierbarkeit und praktische Implementierung.',
  technical: 'Du antwortest aus einer technischen Perspektive. Fokus auf technische Details, Architektur, Systemdesign, Engineering-Prinzipien und praktische Lösungsansätze.',
  'open-source': 'Du antwortest aus einer Open-Source-Perspektive. Fokus auf Community, Transparenz, Kollaboration, Lizenzmodelle und offene Standards.',
  scientific: 'Du antwortest aus einer naturwissenschaftlichen Perspektive. Fokus auf Evidenz, Methodik, Reproduzierbarkeit und wissenschaftliche Genauigkeit.',
  
  // Society & Impact
  'eco-social': 'Du antwortest aus einer ökosozialen Perspektive. Fokus auf Nachhaltigkeit, soziale Gerechtigkeit, Umweltschutz und langfristige gesellschaftliche Auswirkungen.',
  social: 'Du antwortest aus einer sozialen Perspektive. Fokus auf Gemeinschaft, Kooperation, Inklusion und gesellschaftliche Aspekte.',
  civic: 'Du antwortest aus einer bürgerschaftlichen Perspektive. Fokus auf Bürgerbeteiligung, Demokratie, Gemeinwohl und zivilgesellschaftliches Engagement.',
  policy: 'Du antwortest aus einer politikwissenschaftlichen Perspektive. Fokus auf Policy-Analyse, Regulierungen, Governance-Strukturen und gesellschaftspolitische Auswirkungen.',
  cultural: 'Du antwortest aus einer kulturellen Perspektive. Fokus auf kulturelle Werte, Traditionen, gesellschaftliche Normen und kulturelle Vielfalt.',
  
  // Economy & Practice
  business: 'Du antwortest aus einer geschäftlichen, unternehmerischen Perspektive. Fokus auf Effizienz, ROI, Marktchancen, Wettbewerbsvorteile und praktische Umsetzbarkeit.',
  entrepreneurial: 'Du antwortest aus einer unternehmerischen Perspektive. Fokus auf Innovation, Risikobereitschaft, Geschäftsmodelle, Wachstumsstrategien und Markterfolg.',
  legal: 'Du antwortest aus einer rechtskundlichen Perspektive. Fokus auf rechtliche Aspekte, Compliance, Lizenzen, Datenschutz und rechtliche Risiken.',
  educational: 'Du antwortest aus einer bildungswissenschaftlichen Perspektive. Fokus auf Lernprozesse, Pädagogik, Wissensvermittlung und didaktische Ansätze.',
  creative: 'Du antwortest aus einer kreativen Perspektive. Fokus auf Innovation, Design-Thinking, künstlerische Ansätze und kreative Problemlösung.',
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
 * SocialContext-Instructions für LLM-Prompts
 * Diese werden in lib/chat/common/prompt.ts verwendet
 */
export const SOCIAL_CONTEXT_INSTRUCTIONS: Record<SocialContext, string> = {
  scientific: 'Verwende eine wissenschaftliche Sprache mit Fachbegriffen. Erkläre komplexe Konzepte präzise und technisch korrekt.',
  general: 'Klare, zugängliche Sprache ohne Fachjargon. Metaphern und kurze Beispiele nutzen. Max. mittlere Satzlänge.',
  youth: 'Verwende eine jugendgerechte Sprache. Erkläre komplexe Konzepte lebendig und verständlich, vermeide zu formelle Formulierungen.',
  senior: 'Verwende eine seniorengerechte Sprache. Erkläre komplexe Konzepte klar und ausführlich, mit angemessenem Tempo und ohne zu viele Abkürzungen.',
  professional: 'Verwende eine professionelle, geschäftliche Sprache. Formuliere respektvoll, präzise und ergebnisorientiert. Verwende angemessene Höflichkeitsformen und vermeide umgangssprachliche Ausdrücke.',
  children: 'Verwende eine kindgerechte Sprache für Volksschulalter (6-10 Jahre). Verwende kurze Sätze, einfache Wörter und viele Beispiele. Erkläre Schritt für Schritt und vermeide Fachbegriffe oder verwende sie nur mit einfachen Erklärungen.',
  easy_language: 'Verwende eine einfache Sprache, die für Menschen mit geringem Bildungsniveau geeignet ist. Verwende kurze Sätze, einfache Wörter und viele Beispiele. Erkläre Schritt für Schritt und vermeide Fachbegriffe oder verwende sie nur mit einfachen Erklärungen.',
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
 * Anweisung für gendergerechte Formulierung in LLM-Prompts
 */
export function getGenderInclusiveInstruction(genderInclusive: boolean): string {
  if (!genderInclusive) return ''
  return 'Verwende gendergerechte Formulierungen: Nutze geschlechtsneutrale Begriffe (z.B. "Personen", "Mitarbeitende", "Studierende"), verwende Binnen-I (z.B. "MitarbeiterInnen"), Gendersternchen (z.B. "Mitarbeiter*innen") oder Doppelformen (z.B. "Mitarbeiter und Mitarbeiterinnen") wo angemessen. Vermeide ausschließlich männliche oder weibliche Formulierungen, wenn es um gemischte Gruppen geht.'
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

