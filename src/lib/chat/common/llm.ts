/**
 * @fileoverview LLM Calling Utilities - Secretary Service Integration
 * 
 * @description
 * Zentrale LLM-Client-Bibliothek für alle LLM-Aufrufe über den Secretary Service.
 * Bietet verschiedene Abstraktionsebenen für einfache Text-Ausgaben und strukturierte JSON-Ausgaben mit Zod-Validierung.
 * 
 * ## Verwendungsmuster
 * 
 * ### 1. Einfacher Text-Output (callLlmText)
 * Für einfache Chat-Antworten ohne strukturierte Ausgabe:
 * 
 * ```typescript
 * const result = await callLlmText({
 *   apiKey: secretaryApiKey, // Optional: Wenn nicht gesetzt, wird SECRETARY_SERVICE_API_KEY verwendet
 *   model: 'gpt-4.1-mini', // Erforderlich: Muss explizit gesetzt sein
 *   temperature: 0.3, // Erforderlich: Muss explizit gesetzt sein
 *   messages: [
 *     { role: 'system', content: 'Du bist ein hilfreicher Assistent.' },
 *     { role: 'user', content: 'Erkläre mir TypeScript.' }
 *   ]
 * })
 * 
 * console.log(result.text) // Text-Antwort
 * console.log(result.usage?.totalTokens) // Token-Usage (optional)
 * ```
 * 
 * ### 2. Strukturierte JSON-Ausgabe (callLlmJson)
 * Für strukturierte Daten mit Zod-Validierung:
 * 
 * ```typescript
 * import * as z from 'zod'
 * 
 * const schema = z.object({
 *   recommendation: z.enum(['chunk', 'summary']),
 *   confidence: z.enum(['high', 'medium', 'low']),
 *   reasoning: z.string()
 * })
 * 
 * const result = await callLlmJson(
 *   {
 *     apiKey: secretaryApiKey, // Optional
 *     model: 'gpt-4.1-mini', // Erforderlich: Muss explizit gesetzt sein
 *     temperature: 0.3, // Erforderlich: Muss explizit gesetzt sein
 *     responseFormat: { type: 'json_object' }, // WICHTIG: Muss gesetzt sein!
 *     messages: [
 *       { role: 'system', content: 'Analysiere Fragen und gib JSON zurück.' },
 *       { role: 'user', content: 'Welcher Retriever-Modus passt zu: "Wie funktioniert X?"' }
 *     ]
 *   },
 *   schema // Zod-Schema für Validierung
 * )
 * 
 * // result.data ist jetzt typisiert und validiert
 * console.log(result.data.recommendation) // 'chunk' | 'summary'
 * ```
 * 
 * ### 3. Social Context und andere Kontext-Informationen
 * Social Context (z.B. 'scientific', 'youth', 'professional') wird NICHT direkt
 * an die LLM-Funktionen übergeben, sondern über den Prompt-String integriert.
 * 
 * Der Prompt wird typischerweise über `buildPrompt()` aus `prompt.ts` erstellt,
 * welcher socialContext, character, accessPerspective etc. in den System-Prompt
 * einbaut:
 * 
 * ```typescript
 * import { buildPrompt } from '@/lib/chat/common/prompt'
 * 
 * // Prompt mit socialContext bauen
 * const prompt = buildPrompt(question, sources, answerLength, {
 *   socialContext: 'scientific', // Wird in System-Prompt eingebaut
 *   character: ['expert'],
 *   accessPerspective: ['technical'],
 *   targetLanguage: 'de'
 * })
 * 
 * // Prompt dann an LLM übergeben
 * const result = await callLlmText({
 *   messages: [
 *     { role: 'system', content: prompt }, // Prompt enthält bereits socialContext-Instructions
 *     { role: 'user', content: question }
 *   ]
 * })
 * ```
 * 
 * **Wichtig**: Die LLM-Funktionen erwarten bereits fertig formatierte Messages.
 * Alle Kontext-Informationen (socialContext, character, etc.) müssen vorher
 * in den Prompt-String integriert werden.
 * 
 * @module chat
 * 
 * @exports
 * - callLlmText: LLM Text-Ausgabe über Secretary Service
 * - callLlmJson: LLM Structured Output mit Zod-Validierung über Secretary Service
 * - getLlmProviderForLogging: Gibt Provider-Typ für QueryLog zurück (immer 'secretary')
 * - parseStructuredLLMResponse: Parst strukturierte LLM-Response (legacy)
 * - LlmProviderError: Custom Error für LLM-Provider-Fehler
 * - LlmChatArgs: Arguments interface für LLM-Chat-Aufrufe
 * - LlmUsage: Usage-Informationen aus LLM-Response
 * - LlmTextResult: Result für Text-Output
 * - LlmJsonResult: Result für Structured Output
 * - ParsedLLMResponse: Parsed response interface (legacy)
 * 
 * @usedIn
 * - src/lib/chat/orchestrator.ts: Orchestrator uses LLM utilities
 * - src/lib/chat/common/question-analyzer.ts: Question analysis uses structured output
 * - src/app/api/chat/[libraryId]/adhoc/route.ts: Ad-hoc chat uses text output
 * 
 * @dependencies
 * - zod: Schema validation for structured output
 * 
 * @see {@link ../prompt.ts buildPrompt} Für Prompt-Building mit socialContext, character, etc.
 */

import * as z from 'zod'
import { getSecretaryConfig } from '@/lib/env'
import { callTransformerChat } from '@/lib/secretary/adapter'

/**
 * Arguments für LLM Chat API-Aufrufe mit Messages-Array
 * 
 * @example
 * ```typescript
 * // Einfacher Chat
 * await callLlmText({
 *   apiKey: secretaryApiKey, // Optional
 *   model: 'gpt-4.1-mini', // Erforderlich
 *   temperature: 0.3, // Erforderlich
 *   messages: [
 *     { role: 'system', content: 'Du bist ein Assistent.' },
 *     { role: 'user', content: 'Hallo!' }
 *   ]
 * })
 * 
 * // Mit strukturierter Ausgabe
 * await callLlmJson({
 *   apiKey: secretaryApiKey, // Optional
 *   model: 'gpt-4.1-mini', // Erforderlich
 *   temperature: 0.3, // Erforderlich
 *   responseFormat: { type: 'json_object' },
 *   messages: [
 *     { role: 'system', content: 'Antworte nur mit JSON.' },
 *     { role: 'user', content: 'Gib mir ein JSON-Objekt zurück.' }
 *   ]
 * }, schema)
 * ```
 */
export interface LlmChatArgs {
  /** Secretary Service API-Key (optional, verwendet SECRETARY_SERVICE_API_KEY wenn nicht gesetzt) */
  apiKey?: string
  /** Model-Name (erforderlich, muss explizit gesetzt sein - kein Fallback) */
  model: string
  /** Temperature (erforderlich, muss explizit gesetzt sein - kein Fallback) */
  temperature: number
  /** Messages-Array mit system/user/assistant Messages */
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  /** Strukturierte JSON-Ausgabe aktivieren (optional, nur für callLlmJson erforderlich) */
  responseFormat?: { type: 'json_object' }
  /** Max Tokens für Completion (optional) */
  maxTokens?: number
}

/**
 * Usage-Informationen aus LLM-Response
 */
export interface LlmUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

/**
 * Result für Text-Output
 */
export interface LlmTextResult {
  text: string
  usage?: LlmUsage
}

/**
 * Result für Structured Output
 */
export interface LlmJsonResult<T> {
  data: T
  usage?: LlmUsage
}

/**
 * Provider-Typ für QueryLog (wird immer 'secretary' sein)
 */
export function getLlmProviderForLogging(): 'openai' | 'anthropic' | 'azureOpenAI' | 'secretary' | 'other' {
  return 'secretary'
}

/**
 * Parst eine strukturierte LLM-Response mit answer, suggestedQuestions und usedReferences
 */
export interface ParsedLLMResponse {
  answer: string
  suggestedQuestions: string[]
  usedReferences: number[]
}

export function parseStructuredLLMResponse(raw: string): ParsedLLMResponse {
  let answer = ''
  let suggestedQuestions: string[] = []
  let usedReferences: number[] = []
  
  try {
    // Versuche raw direkt als JSON zu parsen
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const directJson = parsed as Record<string, unknown>
      const ans = typeof directJson.answer === 'string' ? directJson.answer : ''
      const questions = Array.isArray(directJson.suggestedQuestions) 
        ? directJson.suggestedQuestions.filter((q): q is string => typeof q === 'string')
        : []
      const usedRefs = Array.isArray(directJson.usedReferences)
        ? directJson.usedReferences.filter((r): r is number => typeof r === 'number' && r > 0)
        : []
      if (ans) {
        answer = ans
        suggestedQuestions = questions
        usedReferences = usedRefs
        return { answer, suggestedQuestions, usedReferences }
      }
    }
    
    // Fallback: Versuche raw direkt als JSON-String zu parsen
    try {
      const jsonString = typeof raw === 'string' ? raw : JSON.stringify(raw)
      const llmJson = JSON.parse(jsonString) as unknown
      if (llmJson && typeof llmJson === 'object') {
        const llm = llmJson as Record<string, unknown>
        const ans = typeof llm.answer === 'string' ? llm.answer : ''
        const questions = Array.isArray(llm.suggestedQuestions) 
          ? llm.suggestedQuestions.filter((q): q is string => typeof q === 'string')
          : []
        const usedRefs = Array.isArray(llm.usedReferences)
          ? llm.usedReferences.filter((r): r is number => typeof r === 'number' && r > 0)
          : []
        if (ans) {
          answer = ans
          suggestedQuestions = questions
          usedReferences = usedRefs
          return { answer, suggestedQuestions, usedReferences }
        }
      }
    } catch {
      // Nicht parsbar als JSON
    }
  } catch {
    // Raw ist kein JSON - verwende als Plain Text
    answer = raw
    suggestedQuestions = []
    usedReferences = []
  }
  
  return { answer, suggestedQuestions, usedReferences }
}

/**
 * Custom Error für LLM-Provider-Fehler
 */
export class LlmProviderError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number
  ) {
    super(message)
    this.name = 'LlmProviderError'
  }
}

/**
 * Parst Secretary Service TransformerResponse und extrahiert Text + Usage
 */
async function parseSecretaryTextResponse(response: Response): Promise<LlmTextResult> {
  const data: unknown = await response.json()
  
  if (!data || typeof data !== 'object') {
    throw new LlmProviderError('Invalid Secretary Service response format', 'InvalidResponse')
  }
  
  const resp = data as {
    status?: string
    data?: { text?: unknown; structured_data?: unknown }
    process?: { llm_info?: { total_tokens?: number; requests?: Array<{ tokens?: number }> } }
  }
  
  if (resp.status !== 'success') {
    const error = (data as { error?: { code?: unknown; message?: unknown } }).error
    const errorCode = error && typeof error === 'object' && 'code' in error 
      ? String(error.code) 
      : undefined
    const errorMsg = error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : 'Secretary Service error'
    throw new LlmProviderError(`Secretary Service Fehler: ${errorMsg}`, errorCode, response.status)
  }
  
  const text = typeof resp.data?.text === 'string' ? resp.data.text : ''
  
  // Usage aus process.llm_info extrahieren
  let usage: LlmUsage | undefined
  if (resp.process?.llm_info) {
    const llmInfo = resp.process.llm_info
    usage = {
      totalTokens: llmInfo.total_tokens
    }
    // Falls einzelne Requests vorhanden, aggregiere tokens
    if (llmInfo.requests && llmInfo.requests.length > 0) {
      const totalFromRequests = llmInfo.requests.reduce((sum, req) => sum + (req.tokens || 0), 0)
      if (totalFromRequests > 0) {
        usage.totalTokens = totalFromRequests
      }
    }
  }
  
  return { text, usage }
}

/**
 * Parst Secretary Service TransformerResponse für Structured Output und validiert mit Zod
 */
async function parseSecretaryJsonResponse<T>(
  response: Response,
  schema: z.ZodSchema<T>
): Promise<LlmJsonResult<T>> {
  const data: unknown = await response.json()
  
  if (!data || typeof data !== 'object') {
    throw new LlmProviderError('Invalid Secretary Service response format', 'InvalidResponse')
  }
  
  const resp = data as {
    status?: string
    data?: { structured_data?: unknown }
    process?: { llm_info?: { total_tokens?: number; requests?: Array<{ tokens?: number }> } }
  }
  
  if (resp.status !== 'success') {
    const error = (data as { error?: { code?: unknown; message?: unknown } }).error
    const errorCode = error && typeof error === 'object' && 'code' in error 
      ? String(error.code) 
      : undefined
    const errorMsg = error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : 'Secretary Service error'
    throw new LlmProviderError(`Secretary Service Fehler: ${errorMsg}`, errorCode, response.status)
  }
  
  // Structured data sollte immer vorhanden sein bei json_object
  const structuredData = resp.data?.structured_data
  if (!structuredData || typeof structuredData !== 'object') {
    throw new LlmProviderError('Secretary Service lieferte kein structured_data', 'MissingStructuredData')
  }
  
  // Usage aus process.llm_info extrahieren
  let usage: LlmUsage | undefined
  if (resp.process?.llm_info) {
    const llmInfo = resp.process.llm_info
    usage = {
      totalTokens: llmInfo.total_tokens
    }
    if (llmInfo.requests && llmInfo.requests.length > 0) {
      const totalFromRequests = llmInfo.requests.reduce((sum, req) => sum + (req.tokens || 0), 0)
      if (totalFromRequests > 0) {
        usage.totalTokens = totalFromRequests
      }
    }
  }
  
  // Validieren mit Zod-Schema (letzte Sicherheitsstufe)
  try {
    const validated = schema.parse(structuredData)
    return { data: validated, usage }
  } catch (validationError) {
    if (validationError instanceof z.ZodError) {
      throw new LlmProviderError(
        `Schema validation failed: ${validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'SchemaValidationError'
      )
    }
    throw validationError
  }
}

/**
 * Konvertiert Zod-Schema zu JSON Schema Draft-07 (für Secretary Service)
 * 
 * Vereinfachte Konvertierung - unterstützt nur grundlegende Zod-Typen.
 * Für komplexe Schemas sollte schema_id verwendet werden.
 * 
 * @param _schema Zod-Schema (aktuell nicht verwendet, da nur generisches Schema zurückgegeben wird)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function zodToJsonSchema(_schema: z.ZodSchema<unknown>): string {
  // Vereinfachte Implementierung - für komplexe Schemas sollte schema_id verwendet werden
  // Diese Funktion ist ein Fallback für einfache Schemas
  try {
    // Versuche, Schema zu analysieren (vereinfacht)
    const jsonSchema: Record<string, unknown> = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {},
      required: []
    }
    
    // Für jetzt: Returniere ein generisches Schema
    // In Produktion sollte hier eine vollständige Zod→JSON Schema Konvertierung stehen
    return JSON.stringify(jsonSchema)
  } catch {
    // Fallback: Leeres Schema
    return JSON.stringify({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object'
    })
  }
}

/**
 * LLM Text-Aufruf-Funktion über Secretary Service
 * 
 * @param args Chat completion arguments
 * @returns Text content + optional usage
 * @throws Error if API call fails or response is invalid
 */
export async function callLlmText(args: LlmChatArgs): Promise<LlmTextResult> {
  // Validierung: Model und Temperature müssen explizit gesetzt sein (deterministisch, kein Fallback)
  if (!args.model) {
    throw new LlmProviderError('Model ist erforderlich für LLM-Aufruf', 'MissingModel')
  }
  if (args.temperature === undefined || args.temperature === null) {
    throw new LlmProviderError('Temperature ist erforderlich für LLM-Aufruf', 'MissingTemperature')
  }
  
  const { baseUrl, apiKey: configApiKey } = getSecretaryConfig()
  const effectiveApiKey = args.apiKey || configApiKey
  
  if (!baseUrl) {
    throw new LlmProviderError('SECRETARY_SERVICE_URL nicht konfiguriert', 'SecretaryConfigError')
  }
  
  if (!effectiveApiKey) {
    throw new LlmProviderError('Secretary Service API-Key fehlt', 'SecretaryConfigError')
  }
  
  // URL-Konstruktion: Wenn baseUrl bereits /api enthält, kein zusätzliches /api
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
  const endpoint = normalizedBaseUrl.endsWith('/api') ? '/transformer/chat' : '/api/transformer/chat'
  const chatUrl = `${normalizedBaseUrl}${endpoint}`
  
  // Timeout-Konfiguration: Verwende ENV-Variable oder Default (240 Sekunden für lange LLM-Antworten)
  const timeoutMs = Number(process.env.LLM_CHAT_TIMEOUT_MS || 240000)
  
  try {
    const response = await callTransformerChat({
      url: chatUrl,
      messages: args.messages,
      model: args.model,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      responseFormat: 'text',
      useCache: true,
      apiKey: effectiveApiKey,
      timeoutMs
    })
    
    return parseSecretaryTextResponse(response)
  } catch (error) {
    if (error instanceof LlmProviderError) {
      throw error
    }
    // HttpError von fetch-with-timeout enthält bereits Details
    const { HttpError: HttpErrorType } = await import('@/lib/utils/fetch-with-timeout')
    if (error instanceof HttpErrorType) {
      throw new LlmProviderError(
        `Secretary Service Fehler (${error.status}): ${error.message || error.statusText}`,
        'SecretaryRequestError',
        error.status
      )
    }
    throw new LlmProviderError(
      error instanceof Error ? error.message : 'Secretary Service request failed',
      'SecretaryRequestError'
    )
  }
}

/**
 * LLM Structured Output-Aufruf-Funktion über Secretary Service
 * 
 * Validiert das Ergebnis immer mit Zod-Schema (letzte Sicherheitsstufe).
 * 
 * @param args Chat completion arguments (MUSS responseFormat enthalten)
 * @param schema Zod schema für Validierung
 * @param schemaJson Optional: Manuelles JSON Schema (Draft-07) als String. Wenn nicht gesetzt, wird ein generisches Schema verwendet (nicht empfohlen).
 * @returns Validated and parsed result + optional usage
 * @throws Error if API call fails, response is invalid, or validation fails
 */
export async function callLlmJson<T>(
  args: LlmChatArgs & { responseFormat: { type: 'json_object' } },
  schema: z.ZodSchema<T>,
  schemaJson?: string
): Promise<LlmJsonResult<T>> {
  // Validierung: Model und Temperature müssen explizit gesetzt sein (deterministisch, kein Fallback)
  if (!args.model) {
    throw new LlmProviderError('Model ist erforderlich für LLM-Aufruf', 'MissingModel')
  }
  if (args.temperature === undefined || args.temperature === null) {
    throw new LlmProviderError('Temperature ist erforderlich für LLM-Aufruf', 'MissingTemperature')
  }
  
  const { baseUrl, apiKey: configApiKey } = getSecretaryConfig()
  const effectiveApiKey = args.apiKey || configApiKey
  
  if (!baseUrl) {
    throw new LlmProviderError('SECRETARY_SERVICE_URL nicht konfiguriert', 'SecretaryConfigError')
  }
  
  if (!effectiveApiKey) {
    throw new LlmProviderError('Secretary Service API-Key fehlt', 'SecretaryConfigError')
  }
  
  // URL-Konstruktion: Wenn baseUrl bereits /api enthält, kein zusätzliches /api
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
  const endpoint = normalizedBaseUrl.endsWith('/api') ? '/transformer/chat' : '/api/transformer/chat'
  const chatUrl = `${normalizedBaseUrl}${endpoint}`
  
  // Verwende übergebenes schemaJson oder Fallback (nicht empfohlen für Produktion)
  const effectiveSchemaJson = schemaJson || zodToJsonSchema(schema)
  
  // Timeout-Konfiguration: Verwende ENV-Variable oder Default (240 Sekunden für lange LLM-Antworten)
  const timeoutMs = Number(process.env.LLM_CHAT_TIMEOUT_MS || 240000)

  /**
   * Retry-Strategie für SchemaValidationError
   *
   * Motivation:
   * - Einige Modelle liefern gelegentlich "fast korrektes" JSON, das erst bei Zod scheitert.
   * - Wiederholung derselben Anfrage funktioniert häufig (transient / sampling noise).
   *
   * Regeln:
   * - Nur retry'en bei LlmProviderError mit code === 'SchemaValidationError'
   * - Bei Retry: Cache deaktivieren (sonst riskieren wir denselben invaliden Cache-Hit)
   * - Bei Retry: Temperature auf <= 0.2 senken (stabileres Structured Output)
   */
  const maxSchemaValidationRetries = Number(process.env.LLM_SCHEMA_VALIDATION_RETRY_COUNT || 2)
  const retryBackoffMs = Number(process.env.LLM_SCHEMA_VALIDATION_RETRY_BACKOFF_MS || 150)
  
  for (let attempt = 0; attempt <= maxSchemaValidationRetries; attempt++) {
    const isRetry = attempt > 0

    try {
      const response = await callTransformerChat({
        url: chatUrl,
        messages: args.messages,
        model: args.model,
        temperature: isRetry ? Math.min(args.temperature, 0.2) : args.temperature,
        maxTokens: args.maxTokens,
        responseFormat: 'json_object',
        schemaJson: effectiveSchemaJson,
        strict: false, // Strict validation deaktiviert (erlaubt flexiblere Schema-Validierung)
        useCache: !isRetry,
        apiKey: effectiveApiKey,
        timeoutMs
      })

      return await parseSecretaryJsonResponse(response, schema)
    } catch (error) {
      // Retry nur bei SchemaValidationError (Zod) – alles andere sofort weiterwerfen/wrappen.
      if (error instanceof LlmProviderError) {
        if (error.code === 'SchemaValidationError' && attempt < maxSchemaValidationRetries) {
          const backoff = retryBackoffMs * (attempt + 1)
          if (backoff > 0) {
            await new Promise(resolve => setTimeout(resolve, backoff))
          }
          continue
        }
        throw error
      }

      // HttpError von fetch-with-timeout enthält bereits Details
      const { HttpError: HttpErrorType } = await import('@/lib/utils/fetch-with-timeout')
      if (error instanceof HttpErrorType) {
        throw new LlmProviderError(
          `Secretary Service Fehler (${error.status}): ${error.message || error.statusText}`,
          'SecretaryRequestError',
          error.status
        )
      }

      throw new LlmProviderError(
        error instanceof Error ? error.message : 'Secretary Service request failed',
        'SecretaryRequestError'
      )
    }
  }

  // Sollte nie erreicht werden, aber TypeScript zuliebe:
  throw new LlmProviderError('Schema validation failed after retries', 'SchemaValidationError')
}
