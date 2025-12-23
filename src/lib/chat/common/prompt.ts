/**
 * @fileoverview Prompt Building Utilities - Chat Prompt Construction
 * 
 * @description
 * Provides utilities for building chat prompts including context formatting,
 * source descriptions, and prompt templates. Handles character instructions,
 * social context, target language, and gender-inclusive formulations.
 * 
 * @module chat
 * 
 * @exports
 * - buildPrompt: Builds regular chat prompt (legacy)
 * - buildTOCPrompt: Builds TOC (Table of Contents) prompt for story mode (legacy)
 * - buildChatMessages: Builds messages array for chat prompts (new)
 * - buildTOCMessages: Builds messages array for TOC prompts (new)
 * - buildChatHistoryMessages: Converts chat history to messages array
 * - getSourceDescription: Creates user-friendly source descriptions
 * - buildContext: Formats sources into context string
 * 
 * @usedIn
 * - src/lib/chat/orchestrator.ts: Orchestrator uses prompt builders
 * - src/app/api/chat: API routes may use prompt utilities
 * 
 * @dependencies
 * - @/types/retriever: RetrievedSource type
 * - @/lib/chat/constants: Chat constants for instructions
 */

import type { RetrievedSource } from '@/types/retriever'
import type { Character, TargetLanguage, AccessPerspective } from '../constants'
import {
  CHARACTER_INSTRUCTIONS,
  CHARACTER_DEFAULT,
  SOCIAL_CONTEXT_INSTRUCTIONS,
  SOCIAL_CONTEXT_DEFAULT,
  ACCESS_PERSPECTIVE_INSTRUCTIONS,
  ACCESS_PERSPECTIVE_DEFAULT,
  TARGET_LANGUAGE_LABELS,
  getGenderInclusiveInstruction,
  combineCharacterInstructions,
  combineAccessPerspectiveInstructions,
  AnswerLength,
  SocialContext,
} from '../constants'

/**
 * Erstellt eine benutzerfreundliche Beschreibung für eine Quelle
 * Statt "Chunk 18" → "Slide-Seite 2" oder "Videotranskript Textchunk 5" etc.
 * 
 * @export für serverseitige Referenzen-Generierung
 */
export function getSourceDescription(source: RetrievedSource): string {
  // Check sourceType (if available)
  if (source.sourceType === 'slides' && source.slidePageNum !== undefined) {
    return `Slide page ${source.slidePageNum}${source.slideTitle ? `: ${source.slideTitle}` : ''}`
  }
  if (source.sourceType === 'video_transcript') {
    // Video transcripts are chunked sequentially
    // Use chunkIndex + 1 as text chunk number (better than nothing)
    // TODO: Could be replaced by a real text chunk number later
    const sectionNum = source.chunkIndex !== undefined ? source.chunkIndex + 1 : undefined
    return sectionNum ? `Video transcript chunk ${sectionNum}` : 'Video transcript'
  }
  if (source.sourceType === 'body') {
    // Body chunks are sequential but cannot be precisely located
    const sectionNum = source.chunkIndex !== undefined ? source.chunkIndex + 1 : undefined
    return sectionNum ? `Markdown body chunk ${sectionNum}` : 'Markdown body'
  }
  if (source.sourceType === 'chapter' && source.chapterTitle) {
    return `Chapter "${source.chapterTitle}"${source.chapterOrder !== undefined ? ` (${source.chapterOrder})` : ''}`
  }
  
  // Fallback: Check metadata even without sourceType (for older documents)
  if (source.chapterTitle) {
    return `Chapter "${source.chapterTitle}"${source.chapterOrder !== undefined ? ` (${source.chapterOrder})` : ''}`
  }
  if (source.slidePageNum !== undefined) {
    return `Slide page ${source.slidePageNum}${source.slideTitle ? `: ${source.slideTitle}` : ''}`
  }
  
  // Last fallback: Use chunkIndex if available
  if (source.chunkIndex !== undefined) {
    return `Text chunk ${source.chunkIndex + 1}`
  }
  return 'Unknown source'
}

export function buildContext(sources: RetrievedSource[], perSnippetLimit = 800): string {
  return sources
    .map((s, i) => {
      const description = getSourceDescription(s)
      
      // Formatierte Metadaten für den Prompt (basierend auf Facetten-Definitionen)
      const metadataParts: string[] = []
      if (s.metadata && typeof s.metadata === 'object') {
        for (const [key, value] of Object.entries(s.metadata)) {
          if (value === undefined || value === null) continue
          
          // Formatierung basierend auf Werttyp
          if (Array.isArray(value)) {
            if (value.length > 0) {
              // Array-Werte: Komma-separiert
              const arrayStr = value.map(v => String(v)).join(', ')
              metadataParts.push(`${key}: ${arrayStr}`)
            }
          } else if (typeof value === 'string' || typeof value === 'number') {
            metadataParts.push(`${key}: ${String(value)}`)
          } else if (typeof value === 'boolean') {
            metadataParts.push(`${key}: ${value ? 'true' : 'false'}`)
          }
        }
      }
      
      const metadataLine = metadataParts.length > 0 ? ` | ${metadataParts.join(' | ')}` : ''
      
      return `Source [${i + 1}] ${s.fileName ?? s.id} (${description}, Score ${typeof s.score === 'number' ? s.score.toFixed(3) : 'n/a'}${metadataLine}):\n${(s.text ?? '').slice(0, perSnippetLimit)}`
    })
    .join('\n\n')
}

export function styleInstruction(answerLength: AnswerLength): string {
  if (answerLength === 'unbegrenzt') {
    return 'Write a comprehensive, in-depth answer (approx. 2000–4000 words or more) in Markdown format. Since many sources are provided, create a thorough analysis with multiple sections, detailed explanations, and comprehensive coverage of the topic. Use headings (##, ###), lists (-), **bold** for important terms, and well-structured paragraphs. Include: 1) Executive summary (2–3 paragraphs), 2) Detailed analysis organized by themes/topics, 3) Examples and case studies from the sources, 4) Connections and relationships between different aspects, 5) Implications and broader context. Ensure all relevant information from the sources is synthesized and presented in depth. The answer should be extensive and detailed, reflecting the breadth of information available.'
  }
  if (answerLength === 'ausführlich') {
    return 'Write a structured, comprehensive answer (approx. 250–600 words) in Markdown format: Use headings (##), lists (-), **bold** for important terms, and paragraphs for better readability. Start with 1–2 sentences summary, then details in paragraphs or bullet points. Avoid filler words.'
  }
  if (answerLength === 'mittel') {
    return 'Write a medium-length answer (approx. 120–250 words) in Markdown format: Use lists (-), **bold** for important terms, and paragraphs. 3–6 sentences or a short list of the most important points. Direct and precise.'
  }
  return 'Write a concise answer (1–3 sentences, max. 120 words) in Markdown format: Use **bold** for important terms if necessary. No introduction, directly the core statement.'
}

/**
 * Erstellt Charakter/Perspektive-Anweisung basierend auf Konfiguration.
 * Verwendet die zentrale Character-Instructions aus lib/chat/constants.ts.
 * Unterstützt mehrere Character-Werte (Array) für kombinierte Perspektiven.
 */
function getCharacterInstruction(character: Character | Character[]): string {
  if (Array.isArray(character)) {
    return combineCharacterInstructions(character)
  }
  return CHARACTER_INSTRUCTIONS[character] || combineCharacterInstructions(CHARACTER_DEFAULT)
}

/**
 * Erstellt Sprachkontext-Anweisung basierend auf Konfiguration
 * Verwendet die zentrale SocialContext-Instructions aus lib/chat/constants.ts.
 */
function getSocialContextInstruction(socialContext: SocialContext): string {
  return SOCIAL_CONTEXT_INSTRUCTIONS[socialContext] || SOCIAL_CONTEXT_INSTRUCTIONS[SOCIAL_CONTEXT_DEFAULT]
}

/**
 * Erstellt Zugangsperspektive-Anweisung basierend auf Konfiguration.
 * Verwendet die zentrale AccessPerspective-Instructions aus lib/chat/constants.ts.
 * Unterstützt mehrere AccessPerspective-Werte (Array) für kombinierte Perspektiven.
 * 'undefined' wird herausgefiltert und führt zu einer leeren Instruction.
 */
function getAccessPerspectiveInstruction(accessPerspective: AccessPerspective | AccessPerspective[]): string {
  if (Array.isArray(accessPerspective)) {
    return combineAccessPerspectiveInstructions(accessPerspective)
  }
  // Wenn 'undefined', gib leeren String zurück
  if (accessPerspective === 'undefined') {
    return ''
  }
  return ACCESS_PERSPECTIVE_INSTRUCTIONS[accessPerspective] || combineAccessPerspectiveInstructions(ACCESS_PERSPECTIVE_DEFAULT)
}

/**
 * Creates language instruction based on configuration
 * Uses the central TargetLanguage labels from lib/chat/constants.ts.
 * 
 * @param targetLanguage Die Zielsprache (kann 'global' sein)
 * @param uiLocale Die UI-Locale für 'global' Fallback (optional)
 */
function getLanguageInstruction(targetLanguage: TargetLanguage, uiLocale?: string): string {
  // Wenn 'global', verwende UI-Locale oder Fallback
  if (targetLanguage === 'global') {
    if (uiLocale) {
      const localeToTargetMap: Record<string, string> = {
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
        sw: 'Swahili',
        yo: 'Yoruba',
        zu: 'Zulu',
      }
      const languageName = localeToTargetMap[uiLocale] || 'German'
      return `Respond in ${languageName}.`
    }
    return 'Respond in German.' // Fallback
  }
  const languageName = TARGET_LANGUAGE_LABELS[targetLanguage] || 'German'
  return `Respond in ${languageName}.`
}

/**
 * Konvertiert Chat-Historie zu Messages-Array für LLM
 * 
 * @param history Chat-Historie mit question/answer Paaren
 * @returns Array von user/assistant Messages
 */
export function buildChatHistoryMessages(
  history: Array<{ question: string; answer: string }>
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!history || history.length === 0) return []
  
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const item of history) {
    messages.push({ role: 'user', content: item.question })
    messages.push({ role: 'assistant', content: item.answer })
  }
  return messages
}

/**
 * Formats chat history for LLM prompt (legacy - wird nicht mehr verwendet)
 * @deprecated Verwende buildChatHistoryMessages() für echtes Messages-Array
 */
function formatChatHistory(history: Array<{ question: string; answer: string }>): string {
  if (!history || history.length === 0) return ''
  
  return history.map((item, index) => {
    return `Previous question ${index + 1}:
${item.question}

Answer:
${item.answer}`
  }).join('\n\n---\n\n')
}

/**
 * Erstellt alle System-Prompt-Komponenten basierend auf Konfiguration.
 * Wiederverwendbar für buildPrompt und buildTOCPrompt.
 */
function buildSystemPromptComponents(options?: {
  targetLanguage?: TargetLanguage
  character?: Character | Character[]
  accessPerspective?: AccessPerspective | AccessPerspective[]
  socialContext?: SocialContext
  genderInclusive?: boolean
  uiLocale?: string
}): {
  characterInstruction: string
  accessPerspectiveInstruction: string
  socialContextInstruction: string
  genderInclusiveInstruction: string
  languageInstruction: string
} {
  return {
    characterInstruction: options?.character ? getCharacterInstruction(options.character) : '',
    accessPerspectiveInstruction: options?.accessPerspective ? getAccessPerspectiveInstruction(options.accessPerspective) : '',
    socialContextInstruction: options?.socialContext ? getSocialContextInstruction(options.socialContext) : '',
    genderInclusiveInstruction: options?.genderInclusive !== undefined ? getGenderInclusiveInstruction(options.genderInclusive) : '',
    languageInstruction: options?.targetLanguage ? getLanguageInstruction(options.targetLanguage, options.uiLocale) : 'Respond in German.',
  }
}

/**
 * Erstellt Filter-Text für den Prompt basierend auf Facetten-Definitionen.
 * Wiederverwendbar für buildPrompt und buildTOCPrompt.
 */
function buildFacetFilterText(
  filters: Record<string, unknown> | undefined,
  facetDefs: Array<{ metaKey: string; label?: string; type: string }> | undefined
): string[] {
  const filterParts: string[] = []
  if (!filters || !facetDefs || Object.keys(filters).length === 0) {
    return filterParts
  }
  
  for (const def of facetDefs) {
    const filterValue = filters[def.metaKey]
    if (filterValue === undefined || filterValue === null) continue
    
    const label = def.label || def.metaKey
    let valueText = ''
    if (Array.isArray(filterValue)) {
      valueText = filterValue.map(v => String(v)).join(', ')
    } else if (typeof filterValue === 'object' && '$in' in filterValue && Array.isArray(filterValue.$in)) {
      valueText = (filterValue.$in as unknown[]).map(v => String(v)).join(', ')
    } else {
      valueText = String(filterValue)
    }
    if (valueText) {
      filterParts.push(`${label}: ${valueText}`)
    }
  }
  
  return filterParts
}

/**
 * Message-Typ für LLM Messages-Array
 */
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/**
 * Erstellt System-Message für Chat-Prompts
 * 
 * @param options Konfiguration für Sprache, Character, Perspektive, etc.
 * @returns System-Message mit allen Anweisungen
 */
export function buildSystemMessage(options?: {
  targetLanguage?: TargetLanguage
  character?: Character | Character[]
  accessPerspective?: AccessPerspective | AccessPerspective[]
  socialContext?: SocialContext
  genderInclusive?: boolean
  uiLocale?: string
}): ChatMessage {
  const promptComponents = buildSystemPromptComponents(options)
  const { characterInstruction, accessPerspectiveInstruction, socialContextInstruction, genderInclusiveInstruction, languageInstruction } = promptComponents
  
  const systemParts: string[] = ['You are a precise assistant. Answer the question exclusively based on the provided sources.']
  
  if (languageInstruction) {
    systemParts.push(`\nLanguage Instructions:\n${languageInstruction}`)
  }
  if (characterInstruction) {
    systemParts.push(`\nUser Character Instructions:\n${characterInstruction}`)
  }
  if (accessPerspectiveInstruction) {
    systemParts.push(`\nUser Perspective Instructions:\n${accessPerspectiveInstruction}`)
  }
  if (socialContextInstruction) {
    systemParts.push(`\nSocial Context Instructions:\n${socialContextInstruction}`)
  }
  if (genderInclusiveInstruction) {
    systemParts.push(`\nGender Inclusive Instructions:\n${genderInclusiveInstruction}`)
  }
  
  return {
    role: 'system',
    content: systemParts.join('')
  }
}

/**
 * Erstellt User-Message für Chat-Prompts mit Frage, Sources und Requirements
 * 
 * @param question Die aktuelle Frage
 * @param sources Gefundene Quellen
 * @param answerLength Antwortlänge
 * @param options Optionale Konfiguration (Filter, etc.)
 * @returns User-Message mit Frage + Sources + Requirements
 */
export function buildChatUserMessage(
  question: string,
  sources: RetrievedSource[],
  answerLength: AnswerLength,
  options?: {
    filters?: Record<string, unknown>
    facetDefs?: Array<{ metaKey: string; label?: string; type: string }>
    candidatesCount?: number
    usedInPrompt?: number
  }
): ChatMessage {
  const context = buildContext(sources)
  const style = styleInstruction(answerLength)
  
  // Create mapping from source number to description for better clarity
  const sourceDescriptions = sources.map((s, i) => {
    const desc = getSourceDescription(s)
    return `[${i + 1}] = ${desc}`
  }).join(', ')
  
  // Create filter text for the prompt
  const filterParts = buildFacetFilterText(options?.filters, options?.facetDefs)
  const filterText = filterParts.length > 0
    ? `\n\nIMPORTANT: The answer refers only to documents that match the following filter criteria:\n${filterParts.map(p => `- ${p}`).join('\n')}\nPlease mention in your answer, if relevant, that this is a summary or analysis of the filtered documents (e.g., "Summary of documents from 2024" or "Analysis of talks on Open Source").`
    : ''
  
  // Note about space constraints (only for chunk mode)
  const spaceConstraintNote = options?.candidatesCount && options?.usedInPrompt && options.usedInPrompt < options.candidatesCount
    ? `\n\nNote: Due to space constraints, only ${options.usedInPrompt} of ${options.candidatesCount} matching documents could be considered.`
    : ''
  
  const content = `Question:
${question}

Sources:
${context}

Requirements:
- ${style}
- Factually correct, without speculation.
- Always respond in **Markdown format** with clear formatting (headings, lists, bold).
- Cite reference numbers of used sources as [n] at the end.
- IMPORTANT: Use only the numbers, NOT "Chunk X".
- Example: "[1] [2] [5]".
- Available descriptions: ${sourceDescriptions}${filterText}${spaceConstraintNote}

Output Format:
Always respond as a JSON object with exactly these three fields:
- "answer": Markdown-formatted text with reference numbers [1], [2], etc.
- "suggestedQuestions": Array with exactly 7 meaningful follow-up questions based on the context covered
- "usedReferences": Array of numbers containing the reference numbers of all sources you actually used in your answer (e.g., [2, 4, 6, 7, 9, 17])

Example:
{
  "answer": "## Titel take question into account \\n\\nThe topics are covered...\\n\\n[1] [2]",
  "suggestedQuestions": [
    "How does X work?",
    "What are the prerequisites for Y?",
    ...
  ],
  "usedReferences": [1, 2]
}

IMPORTANT: 
- References are added server-side, do not generate them in JSON.
- The "usedReferences" field must contain all numbers you cite as [n] in your answer.`
  
  return {
    role: 'user',
    content
  }
}

/**
 * Erstellt vollständiges Messages-Array für Chat-Prompts
 * 
 * @param question Die aktuelle Frage
 * @param sources Gefundene Quellen
 * @param answerLength Antwortlänge
 * @param options Optionale Konfiguration (System-Prompt, History, Filter, etc.)
 * @returns Messages-Array mit system + history + user Messages
 */
export function buildChatMessages(
  question: string,
  sources: RetrievedSource[],
  answerLength: AnswerLength,
  options?: {
    targetLanguage?: TargetLanguage
    character?: Character | Character[]
    accessPerspective?: AccessPerspective | AccessPerspective[]
    socialContext?: SocialContext
    genderInclusive?: boolean
    chatHistory?: Array<{ question: string; answer: string }>
    filters?: Record<string, unknown>
    facetDefs?: Array<{ metaKey: string; label?: string; type: string }>
    uiLocale?: string
    candidatesCount?: number
    usedInPrompt?: number
  }
): ChatMessage[] {
  const messages: ChatMessage[] = []
  
  // System-Message zuerst
  messages.push(buildSystemMessage({
    targetLanguage: options?.targetLanguage,
    character: options?.character,
    accessPerspective: options?.accessPerspective,
    socialContext: options?.socialContext,
    genderInclusive: options?.genderInclusive,
    uiLocale: options?.uiLocale,
  }))
  
  // Chat-Historie als echte Messages
  if (options?.chatHistory && options.chatHistory.length > 0) {
    const historyMessages = buildChatHistoryMessages(options.chatHistory)
    messages.push(...historyMessages)
  }
  
  // Aktuelle User-Message mit Frage + Sources + Requirements
  messages.push(buildChatUserMessage(question, sources, answerLength, {
    filters: options?.filters,
    facetDefs: options?.facetDefs,
    candidatesCount: options?.candidatesCount,
    usedInPrompt: options?.usedInPrompt,
  }))
  
  return messages
}

export function buildPrompt(
  question: string, 
  sources: RetrievedSource[], 
  answerLength: AnswerLength,
  options?: {
    targetLanguage?: TargetLanguage
    character?: Character | Character[]
    accessPerspective?: AccessPerspective | AccessPerspective[]
    socialContext?: SocialContext
    genderInclusive?: boolean
    chatHistory?: Array<{ question: string; answer: string }>
    filters?: Record<string, unknown>
    facetDefs?: Array<{ metaKey: string; label?: string; type: string }>
    uiLocale?: string
  }
): string {
  const context = buildContext(sources)
  const style = styleInstruction(answerLength)
  
  // Create mapping from source number to description for better clarity
  const sourceDescriptions = sources.map((s, i) => {
    const desc = getSourceDescription(s)
    return `[${i + 1}] = ${desc}`
  }).join(', ')
  
  // Create system prompt components based on configuration
  const promptComponents = buildSystemPromptComponents(options)
  const { characterInstruction, accessPerspectiveInstruction, socialContextInstruction, genderInclusiveInstruction, languageInstruction } = promptComponents
  
  // Format chat history if available
  const chatHistoryText = options?.chatHistory && options.chatHistory.length > 0
    ? formatChatHistory(options.chatHistory)
    : ''
  
  // Create filter text for the prompt
  const filterParts = buildFacetFilterText(options?.filters, options?.facetDefs)
  const filterText = filterParts.length > 0
    ? `\n\nIMPORTANT: The answer refers only to documents that match the following filter criteria:\n${filterParts.map(p => `- ${p}`).join('\n')}\nPlease mention in your answer, if relevant, that this is a summary or analysis of the filtered documents (e.g., "Summary of documents from 2024" or "Analysis of talks on Open Source").`
    : ''
  
  // Build system prompt
  const systemParts: string[] = ['You are a precise assistant. Answer the question exclusively based on the provided sources.']
  // WICHTIG: languageInstruction muss im System-Prompt sein, damit die Sprache korrekt berücksichtigt wird
  if (languageInstruction) {
    systemParts.push(`\nLanguage Instructions:\n${languageInstruction}`)
  }
  if (characterInstruction) {
    systemParts.push(`\nUser Character Instructions:\n${characterInstruction}`)
  }
  if (accessPerspectiveInstruction) {
    systemParts.push(`\nUser Perspective Instructions:\n${accessPerspectiveInstruction}`)
  }
  if (socialContextInstruction) {
    systemParts.push(`\nSocial Context Instructions:\n${socialContextInstruction}`)
  }
  if (genderInclusiveInstruction) {
    systemParts.push(`\nGender Inclusive Instructions:\n${genderInclusiveInstruction}`)
  } 
  
  // Insert chat history before the current question if available
  const chatHistorySection = chatHistoryText 
    ? `\n\nPrevious conversation:\n${chatHistoryText}\n\n---\n\n`
    : ''
  
  return `${systemParts.join('')}

${chatHistorySection}Question:
${question}

Sources:
${context}

Requirements:
- ${style}
- Factually correct, without speculation.
- Always respond in **Markdown format** with clear formatting (headings, lists, bold).
- Cite reference numbers of used sources as [n] at the end.
- IMPORTANT: Use only the numbers, NOT "Chunk X".
- Example: "[1] [2] [5]".
- Available descriptions: ${sourceDescriptions}
${chatHistoryText ? '\n- Consider the previous conversation and build upon it if relevant.' : ''}
${filterText}

Output Format:
Always respond as a JSON object with exactly these three fields:
- "answer": Markdown-formatted text with reference numbers [1], [2], etc.
- "suggestedQuestions": Array with exactly 7 meaningful follow-up questions based on the context covered
- "usedReferences": Array of numbers containing the reference numbers of all sources you actually used in your answer (e.g., [2, 4, 6, 7, 9, 17])

Example:
{
  "answer": "## Titel take question into account \\n\\nThe topics are covered...\\n\\n[1] [2]",
  "suggestedQuestions": [
    "How does X work?",
    "What are the prerequisites for Y?",
    ...
  ],
  "usedReferences": [1, 2]
}

IMPORTANT: 
- References are added server-side, do not generate them in JSON.
- The "usedReferences" field must contain all numbers you cite as [n] in your answer.`
}

/**
 * Erstellt System-Message für TOC-Prompts
 * 
 * @param options Konfiguration für Sprache, Character, Perspektive, etc.
 * @returns System-Message für TOC-Generierung
 */
export function buildTOCSystemMessage(options?: {
  targetLanguage?: TargetLanguage
  character?: Character | Character[]
  accessPerspective?: AccessPerspective | AccessPerspective[]
  socialContext?: SocialContext
  genderInclusive?: boolean
  uiLocale?: string
}): ChatMessage {
  const promptComponents = buildSystemPromptComponents(options)
  const { characterInstruction, accessPerspectiveInstruction, socialContextInstruction, genderInclusiveInstruction, languageInstruction } = promptComponents
  
  const systemParts: string[] = ['You create a structured topic overview based on the provided sources. Analyze the content and identify the central topic areas.']
  
  if (languageInstruction) {
    systemParts.push(`\nLanguage Instructions:\n${languageInstruction}`)
  }
  if (characterInstruction) {
    systemParts.push(`\n${characterInstruction}`)
  }
  if (accessPerspectiveInstruction) {
    systemParts.push(`\n${accessPerspectiveInstruction}`)
  }
  if (socialContextInstruction) {
    systemParts.push(`\n${socialContextInstruction}`)
  }
  if (genderInclusiveInstruction) {
    systemParts.push(`\n${genderInclusiveInstruction}`)
  }
  
  return {
    role: 'system',
    content: systemParts.join('')
  }
}

/**
 * Erstellt User-Message für TOC-Prompts mit Task, Sources und Requirements
 * 
 * @param libraryId Eindeutige ID der Library
 * @param sources Gefundene Quellen
 * @param options Optionale Konfiguration (Filter, etc.)
 * @returns User-Message für TOC-Generierung
 */
export function buildTOCUserMessage(
  libraryId: string,
  sources: RetrievedSource[],
  options?: {
    filters?: Record<string, unknown>
    facetDefs?: Array<{ metaKey: string; label?: string; type: string }>
  }
): ChatMessage {
  const context = buildContext(sources)
  
  // Create filter text for the prompt
  const filterParts = buildFacetFilterText(options?.filters, options?.facetDefs)
  
  // fileId-Filter (spezielle Behandlung für TOC)
  const fileIdFilter = options?.filters?.fileId
  if (fileIdFilter !== undefined && fileIdFilter !== null) {
    let fileIdValues: string[] = []
    if (Array.isArray(fileIdFilter)) {
      fileIdValues = fileIdFilter.map(v => String(v))
    } else if (typeof fileIdFilter === 'object' && '$in' in fileIdFilter && Array.isArray(fileIdFilter.$in)) {
      fileIdValues = (fileIdFilter.$in as unknown[]).map(v => String(v))
    } else {
      fileIdValues = [String(fileIdFilter)]
    }
    
    // Versuche Dokumentennamen aus sources zu extrahieren
    const docTitles = new Set<string>()
    for (const source of sources) {
      if (source.fileId && fileIdValues.includes(source.fileId)) {
        const title = source.fileName || source.fileId
        if (title) docTitles.add(title)
      }
    }
    
    if (docTitles.size > 0) {
      filterParts.push(`Document: ${Array.from(docTitles).join(', ')}`)
    } else if (fileIdValues.length > 0) {
      filterParts.push(`Document: ${fileIdValues.length} ${fileIdValues.length === 1 ? 'document' : 'documents'}`)
    }
  }
  
  const filterText = filterParts.length > 0
    ? `\n\nIMPORTANT: The topic overview refers only to documents that match the following filter criteria:\n${filterParts.map(p => `- ${p}`).join('\n')}\nPlease consider this when selecting and formulating topics.`
    : ''
  
  const content = `Task:
Create a structured topic overview (Table of Contents) based on the following sources.
Identify the central topic areas and formulate relevant questions for each topic that users might ask.

Sources:
${context}${filterText}

Output Format:
Respond EXCLUSIVELY as a JSON object with exactly this structure:

{
  "id": "${libraryId}",
  "title": "Short Title for Topic Overview considering filters (max. 100 characters)",
  "tagline": "Short, concise tagline (max. 50 characters)",
  "intro": "Introductory text describing how the topic overview is structured and how it can be used (max. 300 characters)",
  "topics": [
    {
      "id": "topic-1",
      "title": "Title of the first topic",
      "summary": "Brief summary of the topic (optional, max. 200 characters)",
      "questions": [
        {
          "id": "q-1-1",
          "text": "Formulate a concrete question about this topic",
          "intent": "what",
          "retriever": "auto"
        },
        {
          "id": "q-1-2",
          "text": "Another question about this topic",
          "intent": "why",
          "retriever": "summary"
        }
      ]
    },
    {
      "id": "topic-2",
      "title": "Title of the second topic",
      "summary": "Brief summary",
      "questions": [
        {
          "id": "q-2-1",
          "text": "Question about the second topic",
          "intent": "how",
          "retriever": "auto"
        }
      ]
    }
  ]
}

Requirements:
- Create 5-10 central topic areas (topics) that emerge from the sources
- Each topic should contain 4-7 relevant questions (questions)
- Questions should be concrete and answerable 
- Use unique IDs: "topic-1", "topic-2", etc. for topics and "q-1-1", "q-1-2", etc. for questions
- The "intent" can be: "what", "why", "how", "compare" or "recommend" (optional)
- The "retriever" can be: "summary", "chunk" or "auto" (optional, default: "auto")
- The "summary" per topic is optional but recommended for better UX
- The "tagline" should be concise, e.g., "Seven central topic areas" or "Overview of the most important topics"
- The "intro" should explain how the topic overview can be used

Example Structure:
- If the sources deal with Open Source, AI, Sustainability, topics could be:
  - "Open Source & Society" with questions like "Why is Open Source more than technology?"
  - "Artificial Intelligence & Ethics" with questions like "How can AI promote common good?"
  - "Energy & Sustainability" with questions like "What role does software play for the climate?"

IMPORTANT:
- Respond ONLY as a JSON object, no Markdown, no code fences
- All strings must be valid JSON (correct escapes for quotation marks)
- The structure must be exactly followed
- IDs must be unique and follow the pattern`
  
  return {
    role: 'user',
    content
  }
}

/**
 * Erstellt vollständiges Messages-Array für TOC-Prompts
 * 
 * @param libraryId Eindeutige ID der Library
 * @param sources Gefundene Quellen
 * @param options Optionale Konfiguration (System-Prompt, Filter, etc.)
 * @returns Messages-Array mit system + user Messages
 */
export function buildTOCMessages(
  libraryId: string,
  sources: RetrievedSource[],
  options?: {
    targetLanguage?: TargetLanguage
    character?: Character | Character[]
    accessPerspective?: AccessPerspective | AccessPerspective[]
    socialContext?: SocialContext
    genderInclusive?: boolean
    filters?: Record<string, unknown>
    facetDefs?: Array<{ metaKey: string; label?: string; type: string }>
    uiLocale?: string
  }
): ChatMessage[] {
  const messages: ChatMessage[] = []
  
  // System-Message zuerst
  messages.push(buildTOCSystemMessage({
    targetLanguage: options?.targetLanguage,
    character: options?.character,
    accessPerspective: options?.accessPerspective,
    socialContext: options?.socialContext,
    genderInclusive: options?.genderInclusive,
    uiLocale: options?.uiLocale,
  }))
  
  // User-Message mit Task + Sources + Requirements
  messages.push(buildTOCUserMessage(libraryId, sources, {
    filters: options?.filters,
    facetDefs: options?.facetDefs,
  }))
  
  return messages
}

/**
 * Erstellt einen speziellen Prompt für die TOC-Generierung (Table of Contents).
 * Dieser Prompt fordert eine strukturierte StoryTopicsData-Struktur zurück.
 * 
 * @deprecated Verwende buildTOCMessages() für echtes Messages-Array
 * @param libraryId Eindeutige ID der Library (wird als id in StoryTopicsData verwendet)
 * @param sources Gefundene Quellen für die Themenübersicht
 * @param options Optionale Konfiguration für Sprache, Charakter, Kontext und Filter
 * @returns Prompt-String für LLM
 */
export function buildTOCPrompt(
  libraryId: string,
  sources: RetrievedSource[],
  options?: {
    targetLanguage?: TargetLanguage
    character?: Character | Character[]
    accessPerspective?: AccessPerspective | AccessPerspective[]
    socialContext?: SocialContext
    genderInclusive?: boolean
    filters?: Record<string, unknown>
    facetDefs?: Array<{ metaKey: string; label?: string; type: string }>
    uiLocale?: string
  }
): string {
  const context = buildContext(sources)
  
  // Create system prompt components based on configuration
  const promptComponents = buildSystemPromptComponents(options)
  const { characterInstruction, accessPerspectiveInstruction, socialContextInstruction, genderInclusiveInstruction, languageInstruction } = promptComponents
  
  // Create filter text for the prompt
  const filterParts = buildFacetFilterText(options?.filters, options?.facetDefs)
  
  // fileId-Filter (spezielle Behandlung für TOC)
  const fileIdFilter = options?.filters?.fileId
  if (fileIdFilter !== undefined && fileIdFilter !== null) {
    let fileIdValues: string[] = []
    if (Array.isArray(fileIdFilter)) {
      fileIdValues = fileIdFilter.map(v => String(v))
    } else if (typeof fileIdFilter === 'object' && '$in' in fileIdFilter && Array.isArray(fileIdFilter.$in)) {
      fileIdValues = (fileIdFilter.$in as unknown[]).map(v => String(v))
    } else {
      fileIdValues = [String(fileIdFilter)]
    }
    
    // Versuche Dokumentennamen aus sources zu extrahieren
    const docTitles = new Set<string>()
    for (const source of sources) {
      if (source.fileId && fileIdValues.includes(source.fileId)) {
        // Verwende fileName oder fileId als Fallback
        const title = source.fileName || source.fileId
        if (title) docTitles.add(title)
      }
    }
    
    if (docTitles.size > 0) {
      filterParts.push(`Document: ${Array.from(docTitles).join(', ')}`)
    } else if (fileIdValues.length > 0) {
      // Fallback: Zeige Anzahl der Dokumente
      filterParts.push(`Document: ${fileIdValues.length} ${fileIdValues.length === 1 ? 'document' : 'documents'}`)
    }
  }
  
  const filterText = filterParts.length > 0
    ? `\n\nIMPORTANT: The topic overview refers only to documents that match the following filter criteria:\n${filterParts.map(p => `- ${p}`).join('\n')}\nPlease consider this when selecting and formulating topics.`
    : ''
  
  // Build system prompt
  const systemParts: string[] = ['You create a structured topic overview based on the provided sources. Analyze the content and identify the central topic areas.']
  // WICHTIG: languageInstruction muss im System-Prompt sein, damit die Sprache korrekt berücksichtigt wird
  if (languageInstruction) {
    systemParts.push(`\nLanguage Instructions:\n${languageInstruction}`)
  }
  if (characterInstruction) {
    systemParts.push(`\n${characterInstruction}`)
  }
  if (accessPerspectiveInstruction) {
    systemParts.push(`\n${accessPerspectiveInstruction}`)
  }
  if (socialContextInstruction) {
    systemParts.push(`\n${socialContextInstruction}`)
  }
  if (genderInclusiveInstruction) {
    systemParts.push(`\n${genderInclusiveInstruction}`)
  }
  
  return `${systemParts.join('')}

Task:
Create a structured topic overview (Table of Contents) based on the following sources.
Identify the central topic areas and formulate relevant questions for each topic that users might ask.

Sources:
${context}
${filterText}

Output Format:
Respond EXCLUSIVELY as a JSON object with exactly this structure:

{
  "id": "${libraryId}",
  "title": "Short Title for Topic Overview considering filters (max. 100 characters)",
  "tagline": "Short, concise tagline (max. 50 characters)",
  "intro": "Introductory text describing how the topic overview is structured and how it can be used (max. 300 characters)",
  "topics": [
    {
      "id": "topic-1",
      "title": "Title of the first topic",
      "summary": "Brief summary of the topic (optional, max. 200 characters)",
      "questions": [
        {
          "id": "q-1-1",
          "text": "Formulate a concrete question about this topic",
          "intent": "what",
          "retriever": "auto"
        },
        {
          "id": "q-1-2",
          "text": "Another question about this topic",
          "intent": "why",
          "retriever": "summary"
        }
      ]
    },
    {
      "id": "topic-2",
      "title": "Title of the second topic",
      "summary": "Brief summary",
      "questions": [
        {
          "id": "q-2-1",
          "text": "Question about the second topic",
          "intent": "how",
          "retriever": "auto"
        }
      ]
    }
  ]
}

Requirements:
- Create 5-10 central topic areas (topics) that emerge from the sources
- Each topic should contain 4-7 relevant questions (questions)
- Questions should be concrete and answerable 
- Use unique IDs: "topic-1", "topic-2", etc. for topics and "q-1-1", "q-1-2", etc. for questions
- The "intent" can be: "what", "why", "how", "compare" or "recommend" (optional)
- The "retriever" can be: "summary", "chunk" or "auto" (optional, default: "auto")
- The "summary" per topic is optional but recommended for better UX
- The "tagline" should be concise, e.g., "Seven central topic areas" or "Overview of the most important topics"
- The "intro" should explain how the topic overview can be used

Example Structure:
- If the sources deal with Open Source, AI, Sustainability, topics could be:
  - "Open Source & Society" with questions like "Why is Open Source more than technology?"
  - "Artificial Intelligence & Ethics" with questions like "How can AI promote common good?"
  - "Energy & Sustainability" with questions like "What role does software play for the climate?"

IMPORTANT:
- Respond ONLY as a JSON object, no Markdown, no code fences
- All strings must be valid JSON (correct escapes for quotation marks)
- The structure must be exactly followed
- IDs must be unique and follow the pattern`
}


