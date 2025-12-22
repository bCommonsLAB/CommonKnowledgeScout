/**
 * @fileoverview LLM Calling Utilities - OpenAI API Integration
 * 
 * @description
 * Zentrale LLM-Client-Bibliothek für alle OpenAI Chat Completion API-Aufrufe.
 * Bietet verschiedene Abstraktionsebenen für einfache Prompts, flexible Messages-Arrays
 * und strukturierte JSON-Ausgaben mit Zod-Validierung.
 * 
 * ## Verwendungsmuster
 * 
 * ### 1. Einfacher Text-Output (callOpenAIChatText)
 * Für einfache Chat-Antworten ohne strukturierte Ausgabe:
 * 
 * ```typescript
 * const answer = await callOpenAIChatText({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   messages: [
 *     { role: 'system', content: 'Du bist ein hilfreicher Assistent.' },
 *     { role: 'user', content: 'Erkläre mir TypeScript.' }
 *   ]
 * })
 * ```
 * 
 * ### 2. Strukturierte JSON-Ausgabe (callOpenAIChatJson)
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
 * const result = await callOpenAIChatJson(
 *   {
 *     apiKey: process.env.OPENAI_API_KEY!,
 *     responseFormat: { type: 'json_object' }, // WICHTIG: Muss gesetzt sein!
 *     messages: [
 *       { role: 'system', content: 'Analysiere Fragen und gib JSON zurück.' },
 *       { role: 'user', content: 'Welcher Retriever-Modus passt zu: "Wie funktioniert X?"' }
 *     ]
 *   },
 *   schema // Zod-Schema für Validierung
 * )
 * // result ist jetzt typisiert und validiert
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
 * const answer = await callOpenAIChatText({
 *   apiKey: process.env.OPENAI_API_KEY!,
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
 * ### 4. Flexible Messages-Arrays (callOpenAIChat)
 * Für vollständige Kontrolle über die Messages-Struktur:
 * 
 * ```typescript
 * const response = await callOpenAIChat({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   model: 'gpt-4.1-mini', // Optional, verwendet ENV-Variable wenn nicht gesetzt
 *   temperature: 0.3, // Optional, verwendet ENV-Variable wenn nicht gesetzt
 *   messages: [
 *     { role: 'system', content: 'System-Prompt' },
 *     { role: 'user', content: 'User-Frage' },
 *     { role: 'assistant', content: 'Vorherige Antwort' }, // Für Chat-History
 *     { role: 'user', content: 'Folgefrage' }
 *   ],
 *   maxTokens: 2000 // Optional
 * })
 * 
 * const text = await readOpenAIChatText(response)
 * ```
 * 
 * @module chat
 * 
 * @exports
 * - callLlmText: Provider-agnostische Text-Ausgabe (empfohlen für neue Features)
 * - callLlmJson: Provider-agnostische Structured Output mit Zod-Validierung (empfohlen für neue Features)
 * - getLlmProvider: Bestimmt den zu verwendenden LLM-Provider (openai|secretary)
 * - getLlmProviderForLogging: Konvertiert Provider-Typ für QueryLog-kompatiblen Typ
 * - callOpenAI: Calls OpenAI API with prompt (backward compatible, deprecated)
 * - callOpenAIChat: Calls OpenAI API with messages array (flexible, low-level)
 * - callOpenAIChatText: Calls OpenAI API and returns text content (convenience, deprecated - use callLlmText)
 * - callOpenAIChatJson: Calls OpenAI API with structured output and Zod validation (deprecated - use callLlmJson)
 * - readOpenAIChatText: Extracts text content from response
 * - parseOpenAIResponseWithUsage: Parses response with token usage
 * - parseStructuredLLMResponse: Parses structured JSON response (legacy)
 * - LlmProviderError: Custom Error für LLM-Provider-Fehler
 * - LlmCallArgs: Arguments interface for LLM calls (deprecated)
 * - OpenAIChatArgs: Arguments interface for flexible chat calls
 * - LlmCallResult: Result interface for LLM calls
 * - LlmUsage: Usage-Informationen aus LLM-Response
 * - LlmTextResult: Result für Text-Output
 * - LlmJsonResult: Result für Structured Output
 * - ParsedLLMResponse: Parsed response interface (legacy)
 * 
 * @usedIn
 * - src/lib/chat/orchestrator.ts: Orchestrator uses provider-agnostische LLM utilities
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

export interface LlmCallArgs {
  model: string
  temperature: number
  prompt: string
  apiKey: string
  maxTokens?: number // Optional: Max tokens for completion (for unlimited mode)
}

/**
 * Arguments for flexible OpenAI Chat API calls with messages array
 * 
 * @example
 * ```typescript
 * // Einfacher Chat
 * await callOpenAIChat({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   messages: [
 *     { role: 'system', content: 'Du bist ein Assistent.' },
 *     { role: 'user', content: 'Hallo!' }
 *   ]
 * })
 * 
 * // Mit strukturierter Ausgabe
 * await callOpenAIChat({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   responseFormat: { type: 'json_object' },
 *   messages: [
 *     { role: 'system', content: 'Antworte nur mit JSON.' },
 *     { role: 'user', content: 'Gib mir ein JSON-Objekt zurück.' }
 *   ]
 * })
 * ```
 */
export interface OpenAIChatArgs {
  /** OpenAI API-Key (erforderlich) */
  apiKey: string
  /** Model-Name (optional, verwendet OPENAI_CHAT_MODEL_NAME oder 'gpt-4.1-mini' als Fallback) */
  model?: string
  /** Temperature (optional, verwendet OPENAI_CHAT_TEMPERATURE oder 0.3 als Fallback) */
  temperature?: number
  /** Messages-Array mit system/user/assistant Messages */
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  /** Strukturierte JSON-Ausgabe aktivieren (optional, nur für callOpenAIChatJson erforderlich) */
  responseFormat?: { type: 'json_object' }
  /** Max Tokens für Completion (optional) */
  maxTokens?: number
}

export interface LlmCallResult {
  raw: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
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
 * Provider-Typ für LLM-Aufrufe
 */
export type LlmProvider = 'openai' | 'secretary'

/**
 * Bestimmt den zu verwendenden LLM-Provider basierend auf ENV-Variablen
 * 
 * Reihenfolge:
 * 1. Explizites `LLM_PROVIDER` ENV-Variable (wenn gesetzt)
 * 2. Inference: Wenn `OPENAI_API_KEY` gesetzt → 'openai', sonst → 'secretary'
 * 
 * @returns Provider-Typ
 */
export function getLlmProvider(): LlmProvider {
  const explicitProvider = process.env.LLM_PROVIDER
  if (explicitProvider === 'openai' || explicitProvider === 'secretary') {
    return explicitProvider
  }
  
  // Inference: Wenn OpenAI API Key vorhanden, verwende OpenAI, sonst Secretary
  if (process.env.OPENAI_API_KEY) {
    return 'openai'
  }
  
  return 'secretary'
}

/**
 * Konvertiert internen Provider-Typ zu QueryLog-kompatiblem Typ.
 * 
 * @param provider Interner Provider-Typ ('openai' | 'secretary')
 * @returns QueryLog-kompatibler Provider-Typ
 */
export function getLlmProviderForLogging(provider: LlmProvider): 'openai' | 'anthropic' | 'azureOpenAI' | 'secretary' | 'other' {
  if (provider === 'openai') return 'openai'
  if (provider === 'secretary') return 'secretary'
  return 'other'
}

/**
 * Calls OpenAI API with prompt (backward compatible wrapper)
 * 
 * @deprecated Use callOpenAIChat for new code. This function is kept for backward compatibility.
 */
export async function callOpenAI({ model, temperature, prompt, apiKey, maxTokens }: LlmCallArgs): Promise<Response> {
  return callOpenAIChat({
    apiKey,
    model,
    temperature,
    messages: [
      { role: 'system', content: 'Du bist ein hilfreicher, faktenbasierter Assistent.' },
      { role: 'user', content: prompt }
    ],
    maxTokens
  })
}

/**
 * Calls OpenAI Chat Completions API with flexible messages array
 * 
 * Low-level Funktion für vollständige Kontrolle über die API-Anfrage.
 * Für einfachere Use Cases siehe `callOpenAIChatText` oder `callOpenAIChatJson`.
 * 
 * @param args Chat completion arguments
 * @returns Response from OpenAI API (muss selbst geparst werden)
 * 
 * @example
 * ```typescript
 * const response = await callOpenAIChat({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   messages: [
 *     { role: 'system', content: 'Du bist ein Assistent.' },
 *     { role: 'user', content: 'Hallo!' }
 *   ]
 * })
 * 
 * if (response.ok) {
 *   const text = await readOpenAIChatText(response)
 *   console.log(text)
 * }
 * ```
 */
export async function callOpenAIChat(args: OpenAIChatArgs): Promise<Response> {
  const model = args.model || process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4.1-mini'
  const temperature = args.temperature ?? Number(process.env.OPENAI_CHAT_TEMPERATURE ?? 0.3)
  
  const body: Record<string, unknown> = {
    model,
    temperature,
    messages: args.messages
  }
  
  if (args.responseFormat) {
    body.response_format = args.responseFormat
  }
  
  if (args.maxTokens !== undefined) {
    body.max_tokens = args.maxTokens
  }
  
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${args.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

/**
 * Extracts text content from OpenAI Chat Completion response
 * 
 * @param response Response from OpenAI API
 * @returns Text content from first choice
 */
export async function readOpenAIChatText(response: Response): Promise<string> {
  const raw = await response.text()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const p = parsed as { choices?: Array<{ message?: { content?: unknown } }> }
      const content = p.choices?.[0]?.message?.content
      if (typeof content === 'string') {
        return content
      }
    }
  } catch {
    // Bei Parse-Fehler leeren String zurückgeben
  }
  return ''
}

/**
 * Calls OpenAI Chat API and returns text content directly
 * 
 * Convenience-Funktion für einfache Text-Antworten. Parst die Response automatisch
 * und gibt nur den Text-Inhalt zurück.
 * 
 * **Hinweis zu socialContext**: Social Context wird NICHT direkt hier übergeben,
 * sondern muss bereits im `messages` Array integriert sein (z.B. über `buildPrompt()`).
 * 
 * @param args Chat completion arguments
 * @returns Text content from first choice
 * @throws Error if API call fails or response is invalid
 * 
 * @example
 * ```typescript
 * // Einfacher Chat ohne strukturierte Ausgabe
 * const answer = await callOpenAIChatText({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   messages: [
 *     { role: 'system', content: 'Du bist ein hilfreicher Assistent.' },
 *     { role: 'user', content: 'Erkläre mir TypeScript.' }
 *   ]
 * })
 * 
 * // Mit socialContext (bereits im Prompt integriert)
 * import { buildPrompt } from '@/lib/chat/common/prompt'
 * const prompt = buildPrompt(question, sources, 'mittel', {
 *   socialContext: 'scientific', // Wird in System-Prompt eingebaut
 *   targetLanguage: 'de'
 * })
 * const answer = await callOpenAIChatText({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   messages: [
 *     { role: 'system', content: prompt }, // Prompt enthält socialContext
 *     { role: 'user', content: question }
 *   ]
 * })
 * ```
 */
export async function callOpenAIChatText(args: OpenAIChatArgs): Promise<string> {
  const response = await callOpenAIChat(args)
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI Chat Fehler: ${response.status} ${errorText.slice(0, 400)}`)
  }
  
  return readOpenAIChatText(response)
}

/**
 * Calls OpenAI Chat API with structured JSON output and validates with Zod schema
 * 
 * Verwendet OpenAI's `response_format: { type: 'json_object' }` für garantierte JSON-Ausgabe
 * und validiert das Ergebnis mit einem Zod-Schema. Wirft einen Fehler, wenn die Validierung fehlschlägt.
 * 
 * **Structured Output definieren**:
 * 1. Definiere ein Zod-Schema für die erwartete JSON-Struktur
 * 2. Setze `responseFormat: { type: 'json_object' }` im args
 * 3. Stelle sicher, dass der System-Prompt das LLM anweist, JSON zurückzugeben
 * 
 * @param args Chat completion arguments (MUSS responseFormat: { type: 'json_object' } enthalten)
 * @param schema Zod schema für Validierung der JSON-Antwort
 * @returns Validated and parsed result (typisiert nach Schema)
 * @throws Error if API call fails, response is invalid, or validation fails
 * 
 * @example
 * ```typescript
 * import * as z from 'zod'
 * 
 * // 1. Zod-Schema definieren
 * const questionAnalysisSchema = z.object({
 *   recommendation: z.enum(['chunk', 'summary', 'unclear']),
 *   confidence: z.enum(['high', 'medium', 'low']),
 *   reasoning: z.string().min(10),
 *   explanation: z.string().min(20),
 *   chatTitle: z.string().max(60).optional()
 * })
 * 
 * // 2. LLM mit structured output aufrufen
 * const result = await callOpenAIChatJson(
 *   {
 *     apiKey: process.env.OPENAI_API_KEY!,
 *     model: 'gpt-4.1-mini',
 *     temperature: 0.3,
 *     responseFormat: { type: 'json_object' }, // WICHTIG: Muss gesetzt sein!
 *     messages: [
 *       {
 *         role: 'system',
 *         content: 'Du analysierst Fragen. Antworte NUR mit einem JSON-Objekt.'
 *       },
 *       {
 *         role: 'user',
 *         content: 'Analysiere: "Wie funktioniert TypeScript?"'
 *       }
 *     ]
 *   },
 *   questionAnalysisSchema // Zod-Schema für Validierung
 * )
 * 
 * // result ist jetzt typisiert und validiert
 * console.log(result.recommendation) // 'chunk' | 'summary' | 'unclear'
 * console.log(result.confidence) // 'high' | 'medium' | 'low'
 * ```
 * 
 * @see {@link ../question-analyzer.ts} Für ein vollständiges Beispiel
 */
export async function callOpenAIChatJson<T>(
  args: OpenAIChatArgs & { responseFormat: { type: 'json_object' } },
  schema: z.ZodSchema<T>
): Promise<T> {
  const response = await callOpenAIChat(args)
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI Chat Fehler: ${response.status} ${errorText.slice(0, 400)}`)
  }
  
  const raw = await response.text()
  let content: string | undefined
  
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const p = parsed as { choices?: Array<{ message?: { content?: unknown } }> }
      const msgContent = p.choices?.[0]?.message?.content
      if (typeof msgContent === 'string') {
        content = msgContent
      }
    }
  } catch {
    throw new Error('OpenAI response could not be parsed as JSON')
  }
  
  if (!content) {
    throw new Error('Invalid response from OpenAI: No content')
  }
  
  // Parse JSON content (structured output returns JSON string)
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('OpenAI response content could not be parsed as JSON')
  }
  
  // Validate with Zod schema
  return schema.parse(parsed)
}

/**
 * Parst die OpenAI Response und extrahiert Token-Informationen
 */
export async function parseOpenAIResponseWithUsage(response: Response): Promise<LlmCallResult> {
  const raw = await response.text()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const p = parsed as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }
      const usage = p.usage
      return {
        raw,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
      }
    }
  } catch {
    // Bei Parse-Fehler trotzdem raw zurückgeben
  }
  return { raw }
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
    // Versuche zuerst als OpenAI Response-Format zu parsen
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const p = parsed as { choices?: Array<{ message?: { content?: unknown } }> }
      const content = p.choices?.[0]?.message?.content
      if (typeof content === 'string') {
        // OpenAI Format: Content ist ein String, der JSON enthalten kann
        try {
          const llmJson = JSON.parse(content) as unknown
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
          // Fallback: Plain Text Antwort (für Rückwärtskompatibilität)
          answer = content
          suggestedQuestions = []
          usedReferences = []
          return { answer, suggestedQuestions, usedReferences }
        }
      }
    }
    
    // Falls kein OpenAI-Format: Versuche raw direkt als JSON zu parsen (für provider-agnostische Responses)
    // Dies funktioniert, wenn der LLM direkt einen JSON-String zurückgibt
    try {
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
    } catch {
      // Nicht als direktes JSON parsbar
    }
    
    // Fallback: Versuche raw direkt als JSON-String zu parsen (wenn es bereits ein JSON-String ist)
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
 */
function zodToJsonSchema(schema: z.ZodSchema<unknown>): string {
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
 * Provider-agnostische LLM Text-Aufruf-Funktion
 * 
 * Verwendet je nach Konfiguration entweder OpenAI oder Secretary Service.
 * 
 * @param args Chat completion arguments
 * @returns Text content + optional usage
 * @throws Error if API call fails or response is invalid
 */
export async function callLlmText(args: OpenAIChatArgs): Promise<LlmTextResult> {
  const provider = getLlmProvider()
  
  if (provider === 'openai') {
    const response = await callOpenAIChat(args)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new LlmProviderError(
        `OpenAI Chat Fehler: ${response.status} ${errorText.slice(0, 400)}`,
        'OpenAIChatError',
        response.status
      )
    }
    
    const text = await readOpenAIChatText(response)
    const usageResult = await parseOpenAIResponseWithUsage(response.clone())
    
    return {
      text,
      usage: {
        promptTokens: usageResult.promptTokens,
        completionTokens: usageResult.completionTokens,
        totalTokens: usageResult.totalTokens
      }
    }
  } else {
    // Secretary Service
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
        timeoutMs: 60000 // 60 Sekunden Default
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
}

/**
 * Provider-agnostische LLM Structured Output-Aufruf-Funktion
 * 
 * Verwendet je nach Konfiguration entweder OpenAI oder Secretary Service.
 * Validiert das Ergebnis immer mit Zod-Schema (letzte Sicherheitsstufe).
 * 
 * @param args Chat completion arguments (MUSS responseFormat enthalten)
 * @param schema Zod schema für Validierung
 * @returns Validated and parsed result + optional usage
 * @throws Error if API call fails, response is invalid, or validation fails
 */
export async function callLlmJson<T>(
  args: OpenAIChatArgs & { responseFormat: { type: 'json_object' } },
  schema: z.ZodSchema<T>
): Promise<LlmJsonResult<T>> {
  const provider = getLlmProvider()
  
  if (provider === 'openai') {
    try {
      const validated = await callOpenAIChatJson(args, schema)
      // Usage ist bei OpenAI nicht direkt verfügbar ohne Response-Parsing
      // Für jetzt: Usage optional
      return { data: validated }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new LlmProviderError(
          `Schema validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          'SchemaValidationError'
        )
      }
      throw new LlmProviderError(
        error instanceof Error ? error.message : 'OpenAI Chat Fehler',
        'OpenAIChatError'
      )
    }
  } else {
    // Secretary Service
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
    
    // Konvertiere Zod-Schema zu JSON Schema (vereinfacht)
    // Für Produktion: Verwende schema_id wenn möglich
    const schemaJson = zodToJsonSchema(schema)
    
    try {
      const response = await callTransformerChat({
        url: chatUrl,
        messages: args.messages,
        model: args.model,
        temperature: args.temperature,
        maxTokens: args.maxTokens,
        responseFormat: 'json_object',
        schemaJson,
        strict: true, // Strict validation aktivieren
        useCache: true,
        apiKey: effectiveApiKey,
        timeoutMs: 60000
      })
      
      return parseSecretaryJsonResponse(response, schema)
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
}


