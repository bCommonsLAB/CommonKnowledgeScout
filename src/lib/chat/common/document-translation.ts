/**
 * @fileoverview Document Translation - Secretary Service Transformer Integration
 * 
 * @description
 * Provides translation functionality for BookDetailData and SessionDetailData using
 * Secretary Service Transformer API with template-based structured output.
 * Uses Zod schemas for validation.
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
 * - @/lib/secretary/adapter: Secretary Service adapter
 * - @/lib/env: Secretary Service configuration
 * - @/components/library/book-detail: BookDetailData type
 * - @/components/library/session-detail: SessionDetailData type
 * - zod: Schema validation
 */

import { z } from 'zod'
import { callTemplateTransform } from '@/lib/secretary/adapter'
import { getSecretaryConfig } from '@/lib/env'
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
 * Template für BookDetailData-Übersetzung (strukturierte JSON-Ausgabe)
 */
const bookTranslationTemplate = `---
structured_data:
  title: {{title|Übersetze den Titel}}
  authors: {{authors|Übersetze die Autorenliste (Array von Strings)}}
  summary: {{summary|Übersetze die Zusammenfassung (optional)}}
  topics: {{topics|Übersetze die Themenliste (Array von Strings, optional)}}
  chapters: {{chapters|Übersetze die Kapitel-Liste (Array von Objekten mit order, level, title, startPage, endPage, summary, keywords, optional)}}
---

Übersetze die folgenden Buchdaten von der Originalsprache in die Zielsprache. Behalte die exakte Struktur bei, ändere nur die Sprache.`

/**
 * Übersetzt BookDetailData in die Zielsprache über Secretary Service Transformer
 * 
 * @param data Die zu übersetzenden Buchdaten
 * @param targetLanguage Die Zielsprache
 * @param sourceLanguage Die Originalsprache (optional, für bessere Übersetzung)
 * @param apiKey Der Secretary Service API-Key (optional, verwendet Config wenn nicht gesetzt)
 * @returns Die übersetzten Buchdaten
 */
export async function translateBookData(
  data: BookDetailData,
  targetLanguage: TargetLanguage,
  sourceLanguage: string | undefined,
  apiKey?: string
): Promise<BookDetailData> {
  const { baseUrl, apiKey: configApiKey } = getSecretaryConfig()
  const effectiveApiKey = apiKey || configApiKey
  
  if (!baseUrl) {
    throw new Error('SECRETARY_SERVICE_URL nicht konfiguriert')
  }
  
  if (!effectiveApiKey) {
    throw new Error('Secretary Service API-Key fehlt')
  }

  // Daten für Übersetzung vorbereiten
  const dataToTranslate = JSON.stringify({
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
  }, null, 2)

  // Secretary Service Transformer aufrufen
  const transformerUrl = `${baseUrl}/transformer/template`
  const response = await callTemplateTransform({
    url: transformerUrl,
    text: dataToTranslate,
    targetLanguage,
    templateContent: bookTranslationTemplate,
    sourceLanguage,
    useCache: true,
    apiKey: effectiveApiKey,
    timeoutMs: 60000, // 60 Sekunden Timeout
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Secretary Service Translation Fehler: ${response.status} ${errorText.slice(0, 200)}`)
  }

  // Parse Response vom Secretary Service
  const responseData: unknown = await response.json().catch(() => {
    throw new Error('Fehler beim Parsen der Secretary Service Antwort')
  })
  
  // Secretary Service Format: { status: "success", data: { structured_data: {...} } }
  let structuredData: unknown
  if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
    const data = (responseData as { data?: { structured_data?: unknown } }).data
    structuredData = data?.structured_data
  }
  
  if (!structuredData) {
    throw new Error('Secretary Service lieferte kein structured_data')
  }

  // Validiere gegen Zod-Schema
  const validated = bookTranslationSchema.parse(structuredData)

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
 * Template für SessionDetailData-Übersetzung (strukturierte JSON-Ausgabe)
 */
const sessionTranslationTemplate = `---
structured_data:
  title: {{title|Übersetze den Titel}}
  shortTitle: {{shortTitle|Übersetze den Kurztitel (optional)}}
  teaser: {{teaser|Übersetze den Teaser (optional)}}
  summary: {{summary|Übersetze die Zusammenfassung (optional)}}
  markdown: {{markdown|Übersetze den Markdown-Text (optional)}}
  speakers: {{speakers|Übersetze die Sprecherliste (Array von Strings, optional)}}
  topics: {{topics|Übersetze die Themenliste (Array von Strings, optional)}}
---

Übersetze die folgenden Session-Daten von der Originalsprache in die Zielsprache. Behalte die exakte Struktur bei, ändere nur die Sprache.`

/**
 * Übersetzt SessionDetailData in die Zielsprache über Secretary Service Transformer
 * 
 * @param data Die zu übersetzenden Session-Daten
 * @param targetLanguage Die Zielsprache
 * @param sourceLanguage Die Originalsprache (optional, für bessere Übersetzung)
 * @param apiKey Der Secretary Service API-Key (optional, verwendet Config wenn nicht gesetzt)
 * @returns Die übersetzten Session-Daten
 */
export async function translateSessionData(
  data: SessionDetailData,
  targetLanguage: TargetLanguage,
  sourceLanguage: string | undefined,
  apiKey?: string
): Promise<SessionDetailData> {
  const { baseUrl, apiKey: configApiKey } = getSecretaryConfig()
  const effectiveApiKey = apiKey || configApiKey
  
  if (!baseUrl) {
    throw new Error('SECRETARY_SERVICE_URL nicht konfiguriert')
  }
  
  if (!effectiveApiKey) {
    throw new Error('Secretary Service API-Key fehlt')
  }

  // Daten für Übersetzung vorbereiten
  const dataToTranslate = JSON.stringify({
    title: data.title,
    shortTitle: data.shortTitle,
    teaser: data.teaser,
    summary: data.summary,
    markdown: data.markdown,
    speakers: data.speakers,
    topics: data.topics,
  }, null, 2)

  // Secretary Service Transformer aufrufen
  const transformerUrl = `${baseUrl}/transformer/template`
  const response = await callTemplateTransform({
    url: transformerUrl,
    text: dataToTranslate,
    targetLanguage,
    templateContent: sessionTranslationTemplate,
    sourceLanguage,
    useCache: true,
    apiKey: effectiveApiKey,
    timeoutMs: 60000, // 60 Sekunden Timeout
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Secretary Service Translation Fehler: ${response.status} ${errorText.slice(0, 200)}`)
  }

  // Parse Response vom Secretary Service
  const responseData: unknown = await response.json().catch(() => {
    throw new Error('Fehler beim Parsen der Secretary Service Antwort')
  })
  
  // Secretary Service Format: { status: "success", data: { structured_data: {...} } }
  let structuredData: unknown
  if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
    const data = (responseData as { data?: { structured_data?: unknown } }).data
    structuredData = data?.structured_data
  }
  
  if (!structuredData) {
    throw new Error('Secretary Service lieferte kein structured_data')
  }

  // Validiere gegen Zod-Schema
  const validated = sessionTranslationSchema.parse(structuredData)

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

