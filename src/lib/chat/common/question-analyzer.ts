import { callLlmJson } from './llm'
import { getSecretaryConfig } from '@/lib/env'
import { questionAnalysisSchemaJson, questionAnalysisZodSchema } from './structured-schemas'

/**
 * Ergebnis der Frage-Analyse für Retriever-Modus-Auswahl
 */
export interface QuestionAnalysisResult {
  /** Empfohlener Retriever-Modus oder 'unclear' wenn Frage unklar ist */
  recommendation: 'chunk' | 'summary' | 'unclear'
  /** Konfidenz der Empfehlung */
  confidence: 'high' | 'medium' | 'low'
  /** Begründung für die Empfehlung (für interne Analyse) */
  reasoning: string
  /** Vorgeschlagene präzisierte Frage für Chunk-Modus (nur wenn unclear) */
  suggestedQuestionChunk?: string
  /** Vorgeschlagene präzisierte Frage für Summary-Modus (nur wenn unclear) */
  suggestedQuestionSummary?: string
  /** Erklärung für den Benutzer (benutzerfreundlich formuliert) */
  explanation: string
  /** Chat-Titel basierend auf der Frage (max. ~60 Zeichen, prägnant und beschreibend) */
  chatTitle?: string
}

/**
 * System prompt for question analysis
 */
const SYSTEM_PROMPT = `You are an expert in information retrieval systems. Your task is to analyze user questions and determine the optimal retrieval mode.

There are two retrieval modes:

1. **Chunk mode** (semantic vector search on text chunks):
   - Ideal for precise, specific questions about details
   - Technical questions that need exact text passages
   - Questions about concrete terms, formulas, numbers, code examples
   - Questions like "How does X work?" or "What is the definition of Y?"
   - Example: "How does the calculateScore() function work?" or "What is the formula for the calculation?"

2. **Summary mode** (document/chapter overviews):
   - Ideal for broad, overview questions across multiple documents
   - Questions about topics, concepts, trends
   - Comparative questions between documents
   - Questions like "What are the main topics?" or "Which documents cover X?"
   - Example: "What are the main topics of the documents?" or "Which concepts are covered in the sessions?"

**Criteria for "unclear":**
- Question is too vague or general (e.g., "What is there?" or "Tell me something")
- Question could be answered both specifically and broadly
- Question contains multiple different intentions simultaneously

**Always respond as a JSON object with exactly these fields:**
- recommendation: 'chunk' | 'summary' | 'unclear'
- confidence: 'high' | 'medium' | 'low' (How sure are you?)
- reasoning: Justification for the recommendation (at least 10 characters)
- suggestedQuestionChunk: Only if recommendation='unclear', a refined question for Chunk mode
- suggestedQuestionSummary: Only if recommendation='unclear', a refined question for Summary mode
- explanation: User-friendly explanation (at least 20 characters) why this mode is recommended or what is unclear
- chatTitle: A concise chat title based on the question (max. 60 characters). Should reflect the main topic or intention of the question. Example: "How does X work?" → "How X works" or "What are the main topics?" → "Main Topics Overview"

**Important:**
- If recommendation='unclear', at least one of the suggestedQuestion fields must be filled
- The explanation should be understandable for the user, not technical
- For 'unclear', both question suggestions should help clarify the original intention
- chatTitle should always be present and maximum 60 characters long. Use concise, descriptive titles without quotation marks.`

/**
 * Analysiert eine Benutzerfrage und bestimmt den optimalen Retriever-Modus
 * 
 * @param question Die Benutzerfrage, die analysiert werden soll
 * @param context Optional: Library-Kontext (z.B. Event-Modus aktiv?)
 * @param apiKey Optional: Library-spezifischer Secretary Service API-Key. Wenn nicht gesetzt, wird SECRETARY_SERVICE_API_KEY verwendet.
 * @returns Analyse-Ergebnis mit Empfehlung und optionalen Frage-Vorschlägen
 */
export async function analyzeQuestionForRetriever(
  question: string,
  context?: {
    isEventMode?: boolean
    libraryType?: string
  },
  apiKey?: string
): Promise<QuestionAnalysisResult> {
  // Model und Temperature müssen explizit gesetzt sein (deterministisch, kein Fallback)
  if (!process.env.QUESTION_ANALYZER_MODEL) {
    throw new Error('QUESTION_ANALYZER_MODEL Umgebungsvariable ist erforderlich')
  }
  const model = process.env.QUESTION_ANALYZER_MODEL
  const temperatureStr = process.env.QUESTION_ANALYZER_TEMPERATURE
  if (!temperatureStr) {
    throw new Error('QUESTION_ANALYZER_TEMPERATURE Umgebungsvariable ist erforderlich')
  }
  const temperature = Number(temperatureStr)
  const { apiKey: configApiKey } = getSecretaryConfig()
  const effectiveApiKey = apiKey || configApiKey
  
  if (!effectiveApiKey) {
    throw new Error('Secretary Service API-Key fehlt für Frage-Analyse')
  }

  // Build user prompt
  let userPrompt = `Analyze the following question:\n\n"${question}"`
  
  if (context?.isEventMode) {
    userPrompt += '\n\nNote: This library is in event mode (sessions/presentations). Documents typically do not have detailed chapters, but session overviews.'
  }
  
  if (context?.libraryType) {
    userPrompt += `\n\nLibrary type: ${context.libraryType}`
  }

  // LLM-Aufruf mit structured output über Secretary Service
  const resultData = await callLlmJson(
    {
      apiKey: effectiveApiKey,
      model,
      temperature,
      responseFormat: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    },
    questionAnalysisZodSchema,
    questionAnalysisSchemaJson
  )
  
  // Konvertiere null zu undefined für optionale Felder und erstelle typisiertes Ergebnis
  const result: QuestionAnalysisResult = {
    recommendation: resultData.data.recommendation,
    confidence: resultData.data.confidence,
    reasoning: resultData.data.reasoning,
    explanation: resultData.data.explanation,
    suggestedQuestionChunk: resultData.data.suggestedQuestionChunk ?? undefined,
    suggestedQuestionSummary: resultData.data.suggestedQuestionSummary ?? undefined,
    chatTitle: resultData.data.chatTitle,
  }

  // Additional validation: If unclear, suggestedQuestions must be present
  if (result.recommendation === 'unclear') {
    if (!result.suggestedQuestionChunk && !result.suggestedQuestionSummary) {
      // Fallback: Create generic suggestions
      result.suggestedQuestionChunk = `Give me details about: ${question}`
      result.suggestedQuestionSummary = `Give me an overview of: ${question}`
    }
  }

  // Fallback for chat title: If not generated, create one based on the question
  if (!result.chatTitle || result.chatTitle.trim().length === 0) {
    // Create a concise title from the question (max. 60 characters)
    const trimmedQuestion = question.trim()
    if (trimmedQuestion.length <= 60) {
      result.chatTitle = trimmedQuestion
    } else {
      // Truncate the question to max. 57 characters and add "..."
      result.chatTitle = trimmedQuestion.slice(0, 57) + '...'
    }
  }

  return result
}



