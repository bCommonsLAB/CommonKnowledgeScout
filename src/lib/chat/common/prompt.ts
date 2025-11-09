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
  // Prüfe sourceType (falls vorhanden)
  if (source.sourceType === 'slides' && source.slidePageNum !== undefined) {
    return `Slide-Seite ${source.slidePageNum}${source.slideTitle ? `: ${source.slideTitle}` : ''}`
  }
  if (source.sourceType === 'video_transcript') {
    // Video-Transkripte werden sequenziell gechunkt
    // Verwende chunkIndex + 1 als Textchunk-Nummer (besser als nichts)
    // TODO: Könnte später durch eine echte Textchunk-Nummer ersetzt werden
    const sectionNum = source.chunkIndex !== undefined ? source.chunkIndex + 1 : undefined
    return sectionNum ? `Videotranskript Textchunk ${sectionNum}` : 'Videotranskript'
  }
  if (source.sourceType === 'body') {
    // Body-Chunks sind sequenziell, können aber nicht genau lokalisiert werden
    const sectionNum = source.chunkIndex !== undefined ? source.chunkIndex + 1 : undefined
    return sectionNum ? `Markdown-Body Textchunk ${sectionNum}` : 'Markdown-Body'
  }
  if (source.sourceType === 'chapter' && source.chapterTitle) {
    return `Kapitel "${source.chapterTitle}"${source.chapterOrder !== undefined ? ` (${source.chapterOrder})` : ''}`
  }
  
  // Fallback: Prüfe Metadaten auch ohne sourceType (für ältere Dokumente)
  if (source.chapterTitle) {
    return `Kapitel "${source.chapterTitle}"${source.chapterOrder !== undefined ? ` (${source.chapterOrder})` : ''}`
  }
  if (source.slidePageNum !== undefined) {
    return `Slide-Seite ${source.slidePageNum}${source.slideTitle ? `: ${source.slideTitle}` : ''}`
  }
  
  // Letzter Fallback: Verwende chunkIndex wenn vorhanden
  if (source.chunkIndex !== undefined) {
    return `Textchunk ${source.chunkIndex + 1}`
  }
  return 'Unbekannte Quelle'
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
      
      return `Quelle [${i + 1}] ${s.fileName ?? s.id} (${description}, Score ${typeof s.score === 'number' ? s.score.toFixed(3) : 'n/a'}${metadataLine}):\n${(s.text ?? '').slice(0, perSnippetLimit)}`
    })
    .join('\n\n')
}

export function styleInstruction(answerLength: AnswerLength): string {
  return answerLength === 'ausführlich' || answerLength === 'unbegrenzt'
    ? 'Schreibe eine strukturierte, ausführliche Antwort (ca. 250–600 Wörter) im Markdown-Format: Verwende Überschriften (##), Listen (-), **Fettdruck** für wichtige Begriffe, und Absätze für bessere Lesbarkeit. Beginne mit 1–2 Sätzen Zusammenfassung, danach Details in Absätzen oder Stichpunkten. Vermeide Füllwörter.'
    : answerLength === 'mittel'
    ? 'Schreibe eine mittellange Antwort (ca. 120–250 Wörter) im Markdown-Format: Verwende Listen (-), **Fettdruck** für wichtige Begriffe, und Absätze. 3–6 Sätze oder eine kurze Liste der wichtigsten Punkte. Direkt und präzise.'
    : 'Schreibe eine knappe Antwort (1–3 Sätze, max. 120 Wörter) im Markdown-Format: Verwende **Fettdruck** für wichtige Begriffe wenn nötig. Keine Einleitung, direkt die Kernaussage.'
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
 * Erstellt Sprach-Anweisung basierend auf Konfiguration
 * Verwendet die zentrale TargetLanguage-Labels aus lib/chat/constants.ts.
 */
function getLanguageInstruction(targetLanguage: TargetLanguage): string {
  return `Antworte auf ${TARGET_LANGUAGE_LABELS[targetLanguage] || 'Deutsch'}.`
}

/**
 * Formatiert Chatverlauf für den LLM-Prompt
 */
function formatChatHistory(history: Array<{ question: string; answer: string }>): string {
  if (!history || history.length === 0) return ''
  
  return history.map((item, index) => {
    return `Vorherige Frage ${index + 1}:
${item.question}

Antwort:
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
  
  // Erstelle Mapping von Quelle-Nummer zu Beschreibung für bessere Klarheit
  const sourceDescriptions = sources.map((s, i) => {
    const desc = getSourceDescription(s)
    return `[${i + 1}] = ${desc}`
  }).join(', ')
  
  // Erstelle System-Prompt-Komponenten basierend auf Konfiguration
  const characterInstruction = options?.character ? getCharacterInstruction(options.character) : ''
  const socialContextInstruction = options?.socialContext ? getSocialContextInstruction(options.socialContext) : ''
  const genderInclusiveInstruction = options?.genderInclusive !== undefined ? getGenderInclusiveInstruction(options.genderInclusive) : ''
  const languageInstruction = options?.targetLanguage ? getLanguageInstruction(options.targetLanguage) : 'Antworte auf Deutsch.'
  
  // Formatiere Chatverlauf, falls vorhanden
  const chatHistoryText = options?.chatHistory && options.chatHistory.length > 0
    ? formatChatHistory(options.chatHistory)
    : ''
  
  // Erstelle Filter-Text für den Prompt
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
      filterText = `\n\nWICHTIG: Die Antwort bezieht sich nur auf Dokumente, die folgenden Filterkriterien entsprechen:\n${filterParts.map(p => `- ${p}`).join('\n')}\nBitte erwähne in deiner Antwort, wenn relevant, dass es sich um eine Zusammenfassung oder Analyse der gefilterten Dokumente handelt (z.B. "Zusammenfassung der Dokumente aus dem Jahrgang 2024" oder "Analyse der Talks zum Thema Open Source").`
    }
  }
  
  // System-Prompt zusammenbauen
  const systemParts: string[] = ['Du bist ein präziser Assistent. Beantworte die Frage ausschließlich auf Basis der bereitgestellten Quellen.']
  if (characterInstruction) {
    systemParts.push(`\n${characterInstruction}`)
  }
  if (socialContextInstruction) {
    systemParts.push(`\n${socialContextInstruction}`)
  }
  if (genderInclusiveInstruction) {
    systemParts.push(`\n${genderInclusiveInstruction}`)
  }
  
  // Chatverlauf vor der aktuellen Frage einfügen, falls vorhanden
  const chatHistorySection = chatHistoryText 
    ? `\n\nBisheriger Gesprächsverlauf:\n${chatHistoryText}\n\n---\n\n`
    : ''
  
  return `${systemParts.join('')}

${chatHistorySection}Frage:
${question}

Quellen:
${context}

Anforderungen:
- ${style}
- Fachlich korrekt, ohne Spekulationen.
- Antworte **immer im Markdown-Format** mit übersichtlicher Formatierung (Überschriften, Listen, Fettdruck).
- Zitiere am Ende die Referenznummern der verwendeten Quellen als [n] .
- WICHTIG: Verwende nur die Nummern, NICHT "Chunk X".
- Beispiel: "[1] [2] [5]".
- Verfügbare Beschreibungen: ${sourceDescriptions}
${chatHistoryText ? '\n- Berücksichtige den bisherigen Gesprächsverlauf und baue darauf auf, wenn relevant.' : ''}
${filterText}

Ausgabe-Format:
Antworte IMMER als JSON-Objekt mit genau diesen drei Feldern:
- "answer": Markdown-formatierter Text mit Referenz-Nummern [1], [2], etc.
- "suggestedQuestions": Array mit genau 7 sinnvollen Folgefragen basierend auf dem behandelten Kontext
- "usedReferences": Array von Zahlen, die die Referenznummern aller Quellen enthält, die du tatsächlich in deiner Antwort verwendet hast (z.B. [2, 4, 6, 7, 9, 17])

Beispiel:
{
  "answer": "## Einleitung\\n\\nDie Themen werden behandelt...\\n\\n[1] [2]",
  "suggestedQuestions": [
    "Wie funktioniert X?",
    "Was sind die Voraussetzungen für Y?",
    ...
  ],
  "usedReferences": [1, 2]
}

WICHTIG: 
- Referenzen werden serverseitig hinzugefügt, generiere sie nicht im JSON.
- Das Feld "usedReferences" muss alle Nummern enthalten, die du in deiner Antwort als [n] zitierst.

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
  
  // Erstelle System-Prompt-Komponenten basierend auf Konfiguration
  const characterInstruction = options?.character ? getCharacterInstruction(options.character) : ''
  const socialContextInstruction = options?.socialContext ? getSocialContextInstruction(options.socialContext) : ''
  const genderInclusiveInstruction = options?.genderInclusive !== undefined ? getGenderInclusiveInstruction(options.genderInclusive) : ''
  const languageInstruction = options?.targetLanguage ? getLanguageInstruction(options.targetLanguage) : 'Antworte auf Deutsch.'
  
  // Erstelle Filter-Text für den Prompt
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
      filterText = `\n\nWICHTIG: Die Themenübersicht bezieht sich nur auf Dokumente, die folgenden Filterkriterien entsprechen:\n${filterParts.map(p => `- ${p}`).join('\n')}\nBitte berücksichtige dies bei der Themenauswahl und Formulierung.`
    }
  }
  
  // System-Prompt zusammenbauen
  const systemParts: string[] = ['Du erstellst eine strukturierte Themenübersicht basierend auf den bereitgestellten Quellen. Analysiere die Inhalte und identifiziere die zentralen Themenfelder.']
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

Aufgabe:
Erstelle eine strukturierte Themenübersicht (Table of Contents) basierend auf den folgenden Quellen. 
Identifiziere die zentralen Themenfelder und formuliere für jedes Thema relevante Fragen, die Nutzer stellen könnten.

Quellen:
${context}
${filterText}

Ausgabe-Format:
Antworte AUSSCHLIESSLICH als JSON-Objekt mit genau dieser Struktur:

{
  "id": "${libraryId}",
  "title": "Themenübersicht",
  "tagline": "Kurze, prägnante Tagline (max. 50 Zeichen)",
  "intro": "Einleitender Text, der beschreibt, wie die Themenübersicht strukturiert ist und wie sie verwendet werden kann (max. 300 Zeichen)",
  "topics": [
    {
      "id": "topic-1",
      "title": "Titel des ersten Themas",
      "summary": "Kurze Zusammenfassung des Themas (optional, max. 200 Zeichen)",
      "questions": [
        {
          "id": "q-1-1",
          "text": "Formuliere eine konkrete Frage zu diesem Thema",
          "intent": "what",
          "retriever": "auto"
        },
        {
          "id": "q-1-2",
          "text": "Weitere Frage zu diesem Thema",
          "intent": "why",
          "retriever": "summary"
        }
      ]
    },
    {
      "id": "topic-2",
      "title": "Titel des zweiten Themas",
      "summary": "Kurze Zusammenfassung",
      "questions": [
        {
          "id": "q-2-1",
          "text": "Frage zum zweiten Thema",
          "intent": "how",
          "retriever": "auto"
        }
      ]
    }
  ]
}

Anforderungen:
- Erstelle 5-10 zentrale Themenfelder (topics), die sich aus den Quellen ergeben
- Jedes Thema sollte 3-7 relevante Fragen (questions) enthalten
- Die Fragen sollten konkret und beantwortbar sein
- Verwende eindeutige IDs: "topic-1", "topic-2", etc. für Themen und "q-1-1", "q-1-2", etc. für Fragen
- Der "intent" kann sein: "what", "why", "how", "compare" oder "recommend" (optional)
- Der "retriever" kann sein: "summary", "chunk" oder "auto" (optional, Standard: "auto")
- Die "summary" pro Thema ist optional, aber empfohlen für bessere UX
- Der "tagline" sollte prägnant sein, z.B. "Sieben zentrale Themenfelder" oder "Überblick über die wichtigsten Themen"
- Der "intro" sollte erklären, wie die Themenübersicht verwendet werden kann

Beispiel-Struktur:
- Wenn die Quellen über Open Source, KI, Nachhaltigkeit handeln, könnten Themen sein:
  - "Open Source & Gesellschaft" mit Fragen wie "Warum Open Source mehr ist als Technologie?"
  - "Künstliche Intelligenz & Ethik" mit Fragen wie "Wie kann KI Gemeinwohl fördern?"
  - "Energie & Nachhaltigkeit" mit Fragen wie "Welche Rolle spielt Software für das Klima?"

WICHTIG:
- Antworte NUR als JSON-Objekt, kein Markdown, keine Code-Fences
- Alle Strings müssen gültiges JSON sein (korrekte Escapes für Anführungszeichen)
- Die Struktur muss exakt eingehalten werden
- IDs müssen eindeutig sein und dem Muster folgen

${languageInstruction}`
}


