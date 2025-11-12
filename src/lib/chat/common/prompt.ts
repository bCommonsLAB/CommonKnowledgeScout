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
 * - buildPrompt: Builds regular chat prompt
 * - buildTOCPrompt: Builds TOC (Table of Contents) prompt for story mode
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
import type { Character, TargetLanguage } from '../constants'
import {
  CHARACTER_INSTRUCTIONS,
  CHARACTER_DEFAULT,
  SOCIAL_CONTEXT_INSTRUCTIONS,
  SOCIAL_CONTEXT_DEFAULT,
  TARGET_LANGUAGE_LABELS,
  getGenderInclusiveInstruction,
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
  return answerLength === 'ausführlich' || answerLength === 'unbegrenzt'
    ? 'Write a structured, comprehensive answer (approx. 250–600 words) in Markdown format: Use headings (##), lists (-), **bold** for important terms, and paragraphs for better readability. Start with 1–2 sentences summary, then details in paragraphs or bullet points. Avoid filler words.'
    : answerLength === 'mittel'
    ? 'Write a medium-length answer (approx. 120–250 words) in Markdown format: Use lists (-), **bold** for important terms, and paragraphs. 3–6 sentences or a short list of the most important points. Direct and precise.'
    : 'Write a concise answer (1–3 sentences, max. 120 words) in Markdown format: Use **bold** for important terms if necessary. No introduction, directly the core statement.'
}

/**
 * Erstellt Charakter/Perspektive-Anweisung basierend auf Konfiguration.
 * Verwendet die zentrale Character-Instructions aus lib/chat/constants.ts.
 */
function getCharacterInstruction(character: Character): string {
  return CHARACTER_INSTRUCTIONS[character] || CHARACTER_INSTRUCTIONS[CHARACTER_DEFAULT]
}

/**
 * Erstellt Sprachkontext-Anweisung basierend auf Konfiguration
 * Verwendet die zentrale SocialContext-Instructions aus lib/chat/constants.ts.
 */
function getSocialContextInstruction(socialContext: SocialContext): string {
  return SOCIAL_CONTEXT_INSTRUCTIONS[socialContext] || SOCIAL_CONTEXT_INSTRUCTIONS[SOCIAL_CONTEXT_DEFAULT]
}

/**
 * Creates language instruction based on configuration
 * Uses the central TargetLanguage labels from lib/chat/constants.ts.
 */
function getLanguageInstruction(targetLanguage: TargetLanguage): string {
  const languageName = TARGET_LANGUAGE_LABELS[targetLanguage] || 'German'
  return `Respond in ${languageName}.`
}

/**
 * Formats chat history for LLM prompt
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

export function buildPrompt(
  question: string, 
  sources: RetrievedSource[], 
  answerLength: AnswerLength,
  options?: {
    targetLanguage?: TargetLanguage
    character?: Character
    socialContext?: SocialContext
    genderInclusive?: boolean
    chatHistory?: Array<{ question: string; answer: string }>
    filters?: Record<string, unknown>
    facetDefs?: Array<{ metaKey: string; label?: string; type: string }>
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
  const characterInstruction = options?.character ? getCharacterInstruction(options.character) : ''
  const socialContextInstruction = options?.socialContext ? getSocialContextInstruction(options.socialContext) : ''
  const genderInclusiveInstruction = options?.genderInclusive !== undefined ? getGenderInclusiveInstruction(options.genderInclusive) : ''
  const languageInstruction = options?.targetLanguage ? getLanguageInstruction(options.targetLanguage) : 'Respond in German.'
  
  // Format chat history if available
  const chatHistoryText = options?.chatHistory && options.chatHistory.length > 0
    ? formatChatHistory(options.chatHistory)
    : ''
  
  // Create filter text for the prompt
  let filterText = ''
  if (options?.filters && options?.facetDefs && Object.keys(options.filters).length > 0) {
    const filterParts: string[] = []
    for (const def of options.facetDefs) {
      const filterValue = options.filters[def.metaKey]
      if (filterValue !== undefined && filterValue !== null) {
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
    }
    if (filterParts.length > 0) {
      filterText = `\n\nIMPORTANT: The answer refers only to documents that match the following filter criteria:\n${filterParts.map(p => `- ${p}`).join('\n')}\nPlease mention in your answer, if relevant, that this is a summary or analysis of the filtered documents (e.g., "Summary of documents from 2024" or "Analysis of talks on Open Source").`
    }
  }
  
  // Build system prompt
  const systemParts: string[] = ['You are a precise assistant. Answer the question exclusively based on the provided sources.']
  if (characterInstruction) {
    systemParts.push(`\n${characterInstruction}`)
  }
  if (socialContextInstruction) {
    systemParts.push(`\n${socialContextInstruction}`)
  }
  if (genderInclusiveInstruction) {
    systemParts.push(`\n${genderInclusiveInstruction}`)
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
  "answer": "## Introduction\\n\\nThe topics are covered...\\n\\n[1] [2]",
  "suggestedQuestions": [
    "How does X work?",
    "What are the prerequisites for Y?",
    ...
  ],
  "usedReferences": [1, 2]
}

IMPORTANT: 
- References are added server-side, do not generate them in JSON.
- The "usedReferences" field must contain all numbers you cite as [n] in your answer.

${languageInstruction}`
}

/**
 * Erstellt einen speziellen Prompt für die TOC-Generierung (Table of Contents).
 * Dieser Prompt fordert eine strukturierte StoryTopicsData-Struktur zurück.
 * 
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
    character?: Character
    socialContext?: SocialContext
    genderInclusive?: boolean
    filters?: Record<string, unknown>
    facetDefs?: Array<{ metaKey: string; label?: string; type: string }>
  }
): string {
  const context = buildContext(sources)
  
  // Create system prompt components based on configuration
  const characterInstruction = options?.character ? getCharacterInstruction(options.character) : ''
  const socialContextInstruction = options?.socialContext ? getSocialContextInstruction(options.socialContext) : ''
  const genderInclusiveInstruction = options?.genderInclusive !== undefined ? getGenderInclusiveInstruction(options.genderInclusive) : ''
  const languageInstruction = options?.targetLanguage ? getLanguageInstruction(options.targetLanguage) : 'Respond in German.'
  
  // Create filter text for the prompt
  let filterText = ''
  if (options?.filters && Object.keys(options.filters).length > 0) {
    const filterParts: string[] = []
    
    // Normale Facetten-Filter
    if (options.facetDefs) {
      for (const def of options.facetDefs) {
        const filterValue = options.filters[def.metaKey]
        if (filterValue !== undefined && filterValue !== null) {
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
      }
    }
    
    // fileId-Filter (spezielle Behandlung)
    const fileIdFilter = options.filters.fileId
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
    
    if (filterParts.length > 0) {
      filterText = `\n\nIMPORTANT: The topic overview refers only to documents that match the following filter criteria:\n${filterParts.map(p => `- ${p}`).join('\n')}\nPlease consider this when selecting and formulating topics.`
    }
  }
  
  // Build system prompt
  const systemParts: string[] = ['You create a structured topic overview based on the provided sources. Analyze the content and identify the central topic areas.']
  if (characterInstruction) {
    systemParts.push(`\n${characterInstruction}`)
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
  "title": "Topic Overview",
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
- Each topic should contain 3-7 relevant questions (questions)
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
- IDs must be unique and follow the pattern

${languageInstruction}`
}


