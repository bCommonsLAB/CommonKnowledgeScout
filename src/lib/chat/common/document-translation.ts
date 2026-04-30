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
 * - translateRefurbedDeviceData: Translates RefurbedDeviceDetailData
 * - translateGenericData: Generic translator that uses the translatable spec
 *   from the DetailViewType registry to build a dynamic template at runtime.
 *   Used as fallback for ViewTypes without a specialized translator
 *   (testimonial, blog, climateAction, divaDocument, divaTexture).
 * 
 * @usedIn
 * - src/lib/external-jobs/phase-translations.ts: Worker-Phase, die pro
 *   Ziel-Locale die LLM-Translation ausloest und das Ergebnis in
 *   `docMetaJson.translations` schreibt (neuer Doc-Translations Refactor).
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
import type { RefurbedDeviceDetailData } from '@/components/library/refurbed-device-detail'
import type { TargetLanguage } from '@/lib/chat/constants'
import { getTranslatableFields } from '@/lib/detail-view-types/registry'

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
  markdown: z.string().optional(),
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
  markdown: {{markdown|Übersetze den Markdown-Text (optional, behalte Markdown-Formatierung bei)}}
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

  // Daten für Übersetzung vorbereiten (inkl. markdown-Body)
  const dataToTranslate = JSON.stringify({
    title: data.title,
    authors: data.authors,
    summary: data.summary,
    markdown: data.markdown,
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

// ─────────────────────────────────────────────────────────────────────────────
// RefurbedDevice (gebrauchte PCs/Notebooks fuer Schule, Lehrer, Familien)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zod-Schema fuer RefurbedDeviceDetailData-Uebersetzung.
 *
 * Uebersetzt werden NUR textuelle Felder mit Lese-Charakter:
 * - title, shortTitle, summary, markdown, wofuerGeeignet, tags
 *
 * NICHT uebersetzt werden:
 * - modell (Marken-/Modellname ist universell, "Lenovo ThinkPad T480" bleibt gleich)
 * - geraetetyp (Enum-Wert, intern)
 * - prozessor, arbeitsspeicher, festplatte, grafik, gewicht (Hardware-Specs sind universal)
 * - betriebssystem (Versionen wie "Windows 10" / "Linux Mint 21" sind universal)
 * - coverImageUrl, galleryImageUrls (technische URLs)
 * - year (Zahl)
 */
const refurbedDeviceTranslationSchema = z.object({
  title: z.string(),
  shortTitle: z.string().optional(),
  summary: z.string().optional(),
  markdown: z.string().optional(),
  wofuerGeeignet: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // Nicht-textuelle Felder bleiben unveraendert
  modell: z.string().optional(),
  geraetetyp: z.string().optional(),
  prozessor: z.string().optional(),
  arbeitsspeicher: z.string().optional(),
  festplatte: z.string().optional(),
  grafik: z.string().optional(),
  gewicht: z.string().optional(),
  betriebssystem: z.string().optional(),
  coverImageUrl: z.string().optional(),
  galleryImageUrls: z.array(z.string()).optional(),
  year: z.union([z.number(), z.string()]).optional(),
  fileId: z.string().optional(),
  fileName: z.string().optional(),
  upsertedAt: z.string().optional(),
  chunkCount: z.number().optional(),
})

/**
 * Template fuer RefurbedDeviceDetailData-Uebersetzung (strukturierte JSON-Ausgabe).
 *
 * Zielgruppe sind Laien (Schueler, Lehrer, Familien), daher die explizite
 * Anweisung an das LLM, einfache Sprache zu verwenden.
 */
const refurbedDeviceTranslationTemplate = `---
structured_data:
  title: {{title|Übersetze den Titel}}
  shortTitle: {{shortTitle|Übersetze den Kurztitel (optional)}}
  summary: {{summary|Übersetze die Zusammenfassung (optional, 2-3 Sätze in Alltagssprache)}}
  markdown: {{markdown|Übersetze den Markdown-Text (optional, behalte Markdown-Formatierung bei)}}
  wofuerGeeignet: {{wofuerGeeignet|Übersetze den Eignungs-Text. WICHTIG: Zielgruppe sind Laien (Schüler, Lehrer, Familien) - nutze einfache Alltagssprache, keine Marketing-Phrasen, keine technischen Fachbegriffe ohne Erklärung.}}
  tags: {{tags|Übersetze die Tag-Liste (Array von Strings, optional)}}
---

Übersetze die folgenden Daten eines gebrauchten PCs/Notebooks von der Originalsprache in die Zielsprache. Behalte die exakte Struktur bei, ändere nur die Sprache. Hardware-Specs (Modell, Prozessor, RAM, etc.) und Versions-Bezeichnungen werden separat behandelt und bleiben unverändert.`

/**
 * Uebersetzt RefurbedDeviceDetailData in die Zielsprache ueber Secretary Service Transformer.
 *
 * Strukturell analog zu translateBookData / translateSessionData.
 *
 * @param data Die zu uebersetzenden Geraete-Daten
 * @param targetLanguage Die Zielsprache
 * @param sourceLanguage Die Originalsprache (optional, fuer bessere Uebersetzung)
 * @param apiKey Der Secretary Service API-Key (optional, verwendet Config wenn nicht gesetzt)
 * @returns Die uebersetzten Geraete-Daten
 */
export async function translateRefurbedDeviceData(
  data: RefurbedDeviceDetailData,
  targetLanguage: TargetLanguage,
  sourceLanguage: string | undefined,
  apiKey?: string
): Promise<RefurbedDeviceDetailData> {
  const { baseUrl, apiKey: configApiKey } = getSecretaryConfig()
  const effectiveApiKey = apiKey || configApiKey

  if (!baseUrl) {
    throw new Error('SECRETARY_SERVICE_URL nicht konfiguriert')
  }

  if (!effectiveApiKey) {
    throw new Error('Secretary Service API-Key fehlt')
  }

  // Daten fuer Uebersetzung vorbereiten - nur textuelle Felder ans LLM schicken
  const dataToTranslate = JSON.stringify({
    title: data.title,
    shortTitle: undefined,
    summary: data.summary,
    markdown: data.markdown,
    wofuerGeeignet: data.wofuerGeeignet,
    tags: data.tags,
  }, null, 2)

  // Secretary Service Transformer aufrufen
  const transformerUrl = `${baseUrl}/transformer/template`
  const response = await callTemplateTransform({
    url: transformerUrl,
    text: dataToTranslate,
    targetLanguage,
    templateContent: refurbedDeviceTranslationTemplate,
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
  const validated = refurbedDeviceTranslationSchema.parse(structuredData)

  // Kombiniere uebersetzte Felder mit originalen nicht-textuellen Feldern
  // Uebersetzte Felder ueberschreiben Original-Felder
  return {
    ...data,
    ...validated,
    // Stelle sicher, dass nicht-textuelle Felder erhalten bleiben (nicht uebersetzt)
    modell: data.modell,
    geraetetyp: data.geraetetyp,
    prozessor: data.prozessor,
    arbeitsspeicher: data.arbeitsspeicher,
    festplatte: data.festplatte,
    grafik: data.grafik,
    gewicht: data.gewicht,
    betriebssystem: data.betriebssystem,
    coverImageUrl: data.coverImageUrl,
    galleryImageUrls: data.galleryImageUrls,
    year: data.year,
    fileId: data.fileId,
    fileName: data.fileName,
    upsertedAt: data.upsertedAt,
    chunkCount: data.chunkCount,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generischer Translator (Fallback fuer ViewTypes ohne spezialisierte Logik)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Erlaubte Feldwerte im generischen Translator-Output.
 *
 * Pro Feld kann der Wert sein:
 * - String (text-Feld, z.B. title)
 * - String[] (arrayOfText/topicLike-Feld, z.B. tags)
 * - undefined (Feld war im Original nicht gesetzt)
 */
type GenericTranslatedFieldValue = string | string[] | undefined

/**
 * Baut zur Laufzeit ein LLM-Template aus der `translatable`-Spec eines ViewTypes.
 *
 * Format folgt dem Pattern der spezialisierten Translator-Templates
 * (book / session / refurbedDevice). Pro Feld wird eine `key: {{key|Anweisung}}`-Zeile
 * generiert.
 *
 * Hinweis: `nested`-Strukturen (z.B. book.chapters, session.slides) werden hier
 * NICHT abgedeckt - dafuer sind die spezialisierten Translator zustaendig.
 */
function buildGenericTranslationTemplate(
  textKeys: string[],
  arrayKeys: string[],
  topicLikeKeys: string[],
): string {
  const lines: string[] = []
  for (const key of textKeys) {
    lines.push(`  ${key}: {{${key}|Übersetze das Feld "${key}" (Text, optional).}}`)
  }
  for (const key of arrayKeys) {
    lines.push(`  ${key}: {{${key}|Übersetze das Feld "${key}" (Array von Strings, optional).}}`)
  }
  for (const key of topicLikeKeys) {
    lines.push(`  ${key}: {{${key}|Übersetze das Feld "${key}" (Array von Strings, optional). Behalte semantisch gleiche Begriffe, uebersetze nur die Anzeige.}}`)
  }
  return [
    '---',
    'structured_data:',
    ...lines,
    '---',
    '',
    'Übersetze die folgenden Felder von der Originalsprache in die Zielsprache. Behalte die exakte Struktur bei, ändere nur die Sprache. Felder mit null/undefined als Wert bleiben unverändert.',
  ].join('\n')
}

/**
 * Baut ein Zod-Schema dynamisch aus den `translatable`-Feldern.
 *
 * Alle Felder sind optional - das Secretary darf einzelne Felder weglassen,
 * wenn sie im Original nicht vorhanden waren.
 */
function buildGenericTranslationSchema(
  textKeys: string[],
  arrayKeys: string[],
  topicLikeKeys: string[],
): z.ZodType<Record<string, GenericTranslatedFieldValue>> {
  const shape: Record<string, z.ZodType<GenericTranslatedFieldValue>> = {}
  for (const key of textKeys) {
    shape[key] = z.string().optional()
  }
  for (const key of [...arrayKeys, ...topicLikeKeys]) {
    shape[key] = z.array(z.string()).optional()
  }
  return z.object(shape).passthrough() as z.ZodType<Record<string, GenericTranslatedFieldValue>>
}

/**
 * Generischer Translator fuer ViewTypes ohne spezialisierte Logik.
 *
 * Funktionsweise:
 * 1. Liest `translatable`-Spec aus `getTranslatableFields(viewType)`.
 * 2. Wenn die Spec leer ist (z.B. `divaTexture`): no-op, gib Original zurueck.
 * 3. Sammelt nur die im Original vorhandenen Felder (sparsam).
 * 4. Baut dynamisches Template + Zod-Schema und ruft Secretary-Transformer auf.
 * 5. Mergt uebersetzte Felder ueber das Original (alle nicht-textuellen
 *    Felder bleiben erhalten - das ist der Zweck des `translatable`-Filters).
 *
 * Verwendet von `phase-translations.ts` als Fallback fuer alle ViewTypes,
 * die keinen spezialisierten Translator haben (testimonial, blog,
 * climateAction, divaDocument, divaTexture).
 *
 * Limitierung: `nested`-Strukturen (z.B. book.chapters, session.slides) werden
 * NICHT uebersetzt - das bleibt den spezialisierten Translatoren vorbehalten.
 *
 * @param data Beliebige docMetaJson-Struktur des ViewTypes
 * @param viewType DetailViewType-Name aus der Registry
 * @param targetLanguage Zielsprache
 * @param sourceLanguage Originalsprache (optional)
 * @param apiKey Secretary-API-Key (optional, verwendet Config-Default)
 * @returns Original-Daten mit ueberschriebenen uebersetzten Feldern
 */
export async function translateGenericData<T extends Record<string, unknown>>(
  data: T,
  viewType: string,
  targetLanguage: TargetLanguage,
  sourceLanguage: string | undefined,
  apiKey?: string,
): Promise<T> {
  const spec = getTranslatableFields(viewType)
  const textKeys = spec.text.map((f) => f.key)
  const arrayKeys = spec.arrayOfText.map((f) => f.key)
  const topicLikeKeys = spec.topicLike.map((f) => f.key)
  const allKeys = [...textKeys, ...arrayKeys, ...topicLikeKeys]

  // 1) No-op wenn keine uebersetzbaren Felder definiert sind
  if (allKeys.length === 0) {
    return data
  }

  // 2) Sammle nur die im Original vorhandenen Felder (spart Tokens)
  const dataToTranslate: Record<string, GenericTranslatedFieldValue> = {}
  for (const key of textKeys) {
    const v = data[key]
    if (typeof v === 'string' && v.trim().length > 0) {
      dataToTranslate[key] = v
    }
  }
  for (const key of [...arrayKeys, ...topicLikeKeys]) {
    const v = data[key]
    if (Array.isArray(v) && v.length > 0) {
      dataToTranslate[key] = (v as unknown[]).map((x) => String(x))
    }
  }

  // Wenn keine Felder vorhanden sind: no-op
  if (Object.keys(dataToTranslate).length === 0) {
    return data
  }

  // 3) Secretary-Konfiguration
  const { baseUrl, apiKey: configApiKey } = getSecretaryConfig()
  const effectiveApiKey = apiKey || configApiKey
  if (!baseUrl) throw new Error('SECRETARY_SERVICE_URL nicht konfiguriert')
  if (!effectiveApiKey) throw new Error('Secretary Service API-Key fehlt')

  // 4) Template + Zod-Schema dynamisch bauen
  const template = buildGenericTranslationTemplate(textKeys, arrayKeys, topicLikeKeys)
  const schema = buildGenericTranslationSchema(textKeys, arrayKeys, topicLikeKeys)

  // 5) Secretary-Transformer aufrufen
  const transformerUrl = `${baseUrl}/transformer/template`
  const response = await callTemplateTransform({
    url: transformerUrl,
    text: JSON.stringify(dataToTranslate, null, 2),
    targetLanguage,
    templateContent: template,
    sourceLanguage,
    useCache: true,
    apiKey: effectiveApiKey,
    timeoutMs: 60000,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Secretary Service Translation Fehler: ${response.status} ${errorText.slice(0, 200)}`)
  }

  const responseData: unknown = await response.json().catch(() => {
    throw new Error('Fehler beim Parsen der Secretary Service Antwort')
  })

  let structuredData: unknown
  if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
    const inner = (responseData as { data?: { structured_data?: unknown } }).data
    structuredData = inner?.structured_data
  }
  if (!structuredData) {
    throw new Error('Secretary Service lieferte kein structured_data')
  }

  const validated = schema.parse(structuredData)

  // 6) Merge: uebersetzte Felder ueberschreiben Original, alles andere bleibt
  // Nur Felder einbauen, die wirklich einen Wert zurueckbekommen haben
  // (verhindert dass das LLM ein leeres Feld einfuegt, das im Original nicht da war).
  const merged: Record<string, unknown> = { ...data }
  for (const key of allKeys) {
    const v = validated[key]
    if (v !== undefined) {
      merged[key] = v
    }
  }
  return merged as T
}
