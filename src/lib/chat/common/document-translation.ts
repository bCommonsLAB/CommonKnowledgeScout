/**
 * @fileoverview Document Translation - LLM-based Translation with Structured Output
 * 
 * @description
 * Provides translation functionality for BookDetailData and SessionDetailData using OpenAI LLM
 * with structured output. Uses Zod schemas for validation and follows DRY principles by
 * reusing callOpenAI from llm.ts (same pattern as Story Mode).
 * 
 * @module chat
 * 
 * @exports
 * - translateBookData: Translates BookDetailData
 * - translateSessionData: Translates SessionDetailData
 * 
 * @usedIn
 * - src/app/api/chat/[libraryId]/translate-document/route.ts: Translation API endpoint
 * 
 * @dependencies
 * - @/lib/chat/common/llm: LLM calling utilities
 * - @/components/library/book-detail: BookDetailData type
 * - @/components/library/session-detail: SessionDetailData type
 * - zod: Schema validation
 */

import { z } from 'zod'
import { parseOpenAIResponseWithUsage } from '@/lib/chat/common/llm'
import type { BookDetailData } from '@/components/library/book-detail'
import type { SessionDetailData } from '@/components/library/session-detail'
import type { TargetLanguage } from '@/lib/chat/constants'

/**
 * Zod-Schema für Chapter-Übersetzung
 */
const chapterTranslationSchema = z.object({
  order: z.number(),
  level: z.number(),
  title: z.string(),
  startPage: z.number().optional(),
  endPage: z.number().optional(),
  summary: z.string().optional(),
  keywords: z.array(z.string()).optional(),
})

/**
 * Zod-Schema für BookDetailData-Übersetzung
 * Übersetzt nur Textfelder, behält alle anderen Felder unverändert
 */
const bookTranslationSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  summary: z.string().optional(),
  topics: z.array(z.string()).optional(),
  chapters: z.array(chapterTranslationSchema).optional(),
  // Nicht-textuelle Felder bleiben unverändert (werden nicht übersetzt)
  year: z.union([z.number(), z.string()]).optional(),
  pages: z.number().optional(),
  region: z.string().optional(),
  source: z.string().optional(),
  issue: z.union([z.string(), z.number()]).optional(),
  language: z.string().optional(),
  docType: z.string().optional(),
  commercialStatus: z.string().optional(),
  chunkCount: z.number().optional(),
  chaptersCount: z.number().optional(),
  fileId: z.string().optional(),
  fileName: z.string().optional(),
  upsertedAt: z.string().optional(),
})

/**
 * Zod-Schema für Slide-Übersetzung
 */
const slideTranslationSchema = z.object({
  page_num: z.number(),
  title: z.string(),
  summary: z.string().optional(),
  image_url: z.string().optional(),
})

/**
 * Zod-Schema für SessionDetailData-Übersetzung
 * Übersetzt nur Textfelder, behält alle anderen Felder unverändert
 */
const sessionTranslationSchema = z.object({
  title: z.string(),
  shortTitle: z.string().optional(),
  teaser: z.string().optional(),
  summary: z.string().optional(),
  markdown: z.string().optional(),
  speakers: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  // Nicht-textuelle Felder bleiben unverändert (werden nicht übersetzt)
  year: z.union([z.number(), z.string()]).optional(),
  date: z.string().optional(),
  starttime: z.string().optional(),
  endtime: z.string().optional(),
  duration: z.union([z.string(), z.number()]).optional(),
  location: z.string().optional(),
  event: z.string().optional(),
  track: z.string().optional(),
  session: z.string().optional(),
  language: z.string().optional(),
  slides: z.array(slideTranslationSchema).optional(),
  video_url: z.string().optional(),
  attachments_url: z.string().optional(),
  url: z.string().optional(),
  speakers_url: z.array(z.string()).optional(),
  speakers_image_url: z.array(z.string()).optional(),
  affiliations: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  fileId: z.string().optional(),
  fileName: z.string().optional(),
  upsertedAt: z.string().optional(),
  chunkCount: z.number().optional(),
})

/**
 * Übersetzt BookDetailData in die Zielsprache
 * 
 * @param data Die zu übersetzenden Buchdaten
 * @param targetLanguage Die Zielsprache
 * @param sourceLanguage Die Originalsprache (optional, für bessere Übersetzung)
 * @param apiKey Der OpenAI API-Key
 * @returns Die übersetzten Buchdaten
 */
export async function translateBookData(
  data: BookDetailData,
  targetLanguage: TargetLanguage,
  sourceLanguage: string | undefined,
  apiKey: string
): Promise<BookDetailData> {
  const model = process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4.1-mini'
  const temperature = 0.3

  // System-Prompt für präzise Übersetzung ohne Interpretation
  const systemPrompt = `Du bist ein präziser Übersetzer. Übersetze den folgenden Text ohne Interpretation, Umformulierung oder Perspektivwechsel in die Zielsprache. Behalte die exakte Struktur und den Inhalt bei, ändere nur die Sprache.`

  // User-Prompt mit zu übersetzenden Daten
  const userPrompt = `Übersetze die folgenden Buchdaten von ${sourceLanguage || 'der Originalsprache'} nach ${targetLanguage}:

${JSON.stringify({
    title: data.title,
    authors: data.authors,
    summary: data.summary,
    topics: data.topics,
    chapters: data.chapters?.map(ch => ({
      order: ch.order,
      level: ch.level,
      title: ch.title,
      startPage: ch.startPage,
      endPage: ch.endPage,
      summary: ch.summary,
      keywords: ch.keywords,
    })),
  }, null, 2)}

Antworte NUR mit einem JSON-Objekt, das die übersetzten Felder enthält. Die Struktur muss identisch sein wie das Input-Objekt.`

  // LLM-Aufruf mit structured output (response_format: json_object)
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI Translation Fehler: ${response.status} ${errorText.slice(0, 200)}`)
  }

  const result = await parseOpenAIResponseWithUsage(response)
  
  // Parse JSON aus Response (structured output gibt direkt JSON zurück)
  let parsed: unknown
  try {
    const responseJson = JSON.parse(result.raw)
    const content = (responseJson as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content
    if (typeof content === 'string') {
      // Structured output gibt JSON-String zurück
      parsed = JSON.parse(content)
    } else if (content && typeof content === 'object') {
      // Falls bereits Objekt
      parsed = content
    } else {
      throw new Error('Ungültiges Response-Format')
    }
  } catch (error) {
    console.error('[DocumentTranslation] Parse-Fehler:', error)
    console.error('[DocumentTranslation] Raw response:', result.raw.substring(0, 500))
    throw new Error('Fehler beim Parsen der Übersetzungsantwort')
  }

  // Validiere gegen Zod-Schema
  const validated = bookTranslationSchema.parse(parsed)

  // Kombiniere übersetzte Felder mit originalen nicht-textuellen Feldern
  // Übersetzte Felder überschreiben Original-Felder
  return {
    ...data,
    ...validated,
    // Stelle sicher, dass nicht-textuelle Felder erhalten bleiben
    year: data.year,
    pages: data.pages,
    region: data.region,
    source: data.source,
    issue: data.issue,
    language: data.language,
    docType: data.docType,
    commercialStatus: data.commercialStatus,
    chunkCount: data.chunkCount,
    chaptersCount: data.chaptersCount,
    fileId: data.fileId,
    fileName: data.fileName,
    upsertedAt: data.upsertedAt,
  }
}

/**
 * Übersetzt SessionDetailData in die Zielsprache
 * 
 * @param data Die zu übersetzenden Session-Daten
 * @param targetLanguage Die Zielsprache
 * @param sourceLanguage Die Originalsprache (optional, für bessere Übersetzung)
 * @param apiKey Der OpenAI API-Key
 * @returns Die übersetzten Session-Daten
 */
export async function translateSessionData(
  data: SessionDetailData,
  targetLanguage: TargetLanguage,
  sourceLanguage: string | undefined,
  apiKey: string
): Promise<SessionDetailData> {
  const model = process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4.1-mini'
  const temperature = 0.3

  console.log('[DocumentTranslation] translateSessionData gestartet:', {
    model,
    temperature,
    sourceLanguage: sourceLanguage || 'unknown',
    targetLanguage,
    hasTitle: !!data.title,
    hasSummary: !!data.summary,
    hasMarkdown: !!data.markdown,
    speakersCount: data.speakers?.length || 0,
    topicsCount: data.topics?.length || 0,
  })

  // System-Prompt für präzise Übersetzung ohne Interpretation
  const systemPrompt = `Du bist ein präziser Übersetzer. Übersetze den folgenden Text ohne Interpretation, Umformulierung oder Perspektivwechsel in die Zielsprache. Behalte die exakte Struktur und den Inhalt bei, ändere nur die Sprache.`

  // User-Prompt mit zu übersetzenden Daten
  const dataToTranslate = {
    title: data.title,
    shortTitle: data.shortTitle,
    teaser: data.teaser,
    summary: data.summary,
    markdown: data.markdown,
    speakers: data.speakers,
    topics: data.topics,
  }
  
  console.log('[DocumentTranslation] Zu übersetzende Daten:', {
    titleLength: data.title?.length || 0,
    summaryLength: data.summary?.length || 0,
    markdownLength: data.markdown?.length || 0,
  })
  
  const userPrompt = `Übersetze die folgenden Session-Daten von ${sourceLanguage || 'der Originalsprache'} nach ${targetLanguage}:

${JSON.stringify(dataToTranslate, null, 2)}

Antworte NUR mit einem JSON-Objekt, das die übersetzten Felder enthält. Die Struktur muss identisch sein wie das Input-Objekt.`

  // LLM-Aufruf mit structured output (response_format: json_object)
  console.log('[DocumentTranslation] Sende Request an OpenAI...')
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  
  console.log('[DocumentTranslation] OpenAI Response Status:', {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('[DocumentTranslation] OpenAI Fehler:', {
      status: response.status,
      errorText: errorText.substring(0, 500),
    })
    throw new Error(`OpenAI Translation Fehler: ${response.status} ${errorText.slice(0, 200)}`)
  }

  const result = await parseOpenAIResponseWithUsage(response)
  console.log('[DocumentTranslation] Response geparst:', {
    hasRaw: !!result.raw,
    rawLength: result.raw?.length || 0,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    totalTokens: result.totalTokens,
  })
  
  // Parse JSON aus Response (structured output gibt direkt JSON zurück)
  let parsed: unknown
  try {
    const responseJson = JSON.parse(result.raw)
    const content = (responseJson as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content
    console.log('[DocumentTranslation] Content extrahiert:', {
      hasContent: !!content,
      contentType: typeof content,
      isString: typeof content === 'string',
    })
    
    if (typeof content === 'string') {
      // Structured output gibt JSON-String zurück
      console.log('[DocumentTranslation] Parse JSON-String...')
      parsed = JSON.parse(content)
    } else if (content && typeof content === 'object') {
      // Falls bereits Objekt
      console.log('[DocumentTranslation] Content ist bereits Objekt')
      parsed = content
    } else {
      throw new Error('Ungültiges Response-Format')
    }
    
    console.log('[DocumentTranslation] Parsed erfolgreich:', {
      hasParsed: !!parsed,
      parsedKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : [],
    })
  } catch (error) {
    console.error('[DocumentTranslation] Parse-Fehler:', error)
    console.error('[DocumentTranslation] Raw response (erste 1000 Zeichen):', result.raw.substring(0, 1000))
    throw new Error('Fehler beim Parsen der Übersetzungsantwort')
  }

  // Validiere gegen Zod-Schema
  console.log('[DocumentTranslation] Validiere gegen Zod-Schema...')
  const validated = sessionTranslationSchema.parse(parsed)
  console.log('[DocumentTranslation] ✅ Validierung erfolgreich:', {
    hasTitle: !!validated.title,
    hasSummary: !!validated.summary,
    speakersCount: validated.speakers?.length || 0,
    topicsCount: validated.topics?.length || 0,
  })

  // Kombiniere übersetzte Felder mit originalen nicht-textuellen Feldern
  // Übersetzte Felder überschreiben Original-Felder
  return {
    ...data,
    ...validated,
    // Stelle sicher, dass nicht-textuelle Felder erhalten bleiben
    year: data.year,
    date: data.date,
    starttime: data.starttime,
    endtime: data.endtime,
    duration: data.duration,
    location: data.location,
    event: data.event,
    track: data.track,
    session: data.session,
    language: data.language,
    slides: data.slides,
    video_url: data.video_url,
    attachments_url: data.attachments_url,
    url: data.url,
    speakers_url: data.speakers_url,
    speakers_image_url: data.speakers_image_url,
    affiliations: data.affiliations,
    tags: data.tags,
    fileId: data.fileId,
    fileName: data.fileName,
    upsertedAt: data.upsertedAt,
    chunkCount: data.chunkCount,
  }
}

