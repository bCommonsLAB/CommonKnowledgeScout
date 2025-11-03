import * as z from 'zod'

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
}

/**
 * Zod-Schema für Validierung der LLM-Antwort
 */
const questionAnalysisSchema = z.object({
  recommendation: z.enum(['chunk', 'summary', 'unclear']),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string().min(10),
  suggestedQuestionChunk: z.string().optional(),
  suggestedQuestionSummary: z.string().optional(),
  explanation: z.string().min(20),
})

/**
 * System-Prompt für die Frage-Analyse
 */
const SYSTEM_PROMPT = `Du bist ein Experte für Informations-Retrieval-Systeme. Deine Aufgabe ist es, Benutzerfragen zu analysieren und den optimalen Retrieval-Modus zu bestimmen.

Es gibt zwei Retrieval-Modi:

1. **Chunk-Modus** (semantische Vektorsuche auf Text-Chunks):
   - Ideal für präzise, spezifische Fragen nach Details
   - Technische Fragen, die exakte Textstellen benötigen
   - Fragen nach konkreten Begriffen, Formeln, Zahlen, Code-Beispielen
   - Fragen nach "Wie funktioniert X?" oder "Was ist die Definition von Y?"
   - Beispiel: "Wie funktioniert die Funktion calculateScore()?" oder "Was ist die Formel für die Berechnung?"

2. **Summary-Modus** (Dokument/Kapitel-Übersichten):
   - Ideal für breite, überblickende Fragen über mehrere Dokumente
   - Fragen nach Themen, Konzepten, Trends
   - Vergleichende Fragen zwischen Dokumenten
   - Fragen nach "Was sind die Hauptthemen?" oder "Welche Dokumente behandeln X?"
   - Beispiel: "Was sind die Hauptthemen der Dokumente?" oder "Welche Konzepte werden in den Sessions behandelt?"

**Kriterien für "unclear":**
- Frage ist zu vage oder allgemein (z.B. "Was gibt es?" oder "Erzähl mir etwas")
- Frage könnte sowohl spezifisch als auch breit beantwortet werden
- Frage enthält mehrere verschiedene Intentionen gleichzeitig

**Antworte IMMER als JSON-Objekt mit genau diesen Feldern:**
- recommendation: 'chunk' | 'summary' | 'unclear'
- confidence: 'high' | 'medium' | 'low' (Wie sicher bist du dir?)
- reasoning: Begründung für die Empfehlung (mindestens 10 Zeichen)
- suggestedQuestionChunk: Nur wenn recommendation='unclear', eine präzisierte Frage für Chunk-Modus
- suggestedQuestionSummary: Nur wenn recommendation='unclear', eine präzisierte Frage für Summary-Modus
- explanation: Benutzerfreundliche Erklärung (mindestens 20 Zeichen), warum dieser Modus empfohlen wird oder was unklar ist

**Wichtig:**
- Wenn recommendation='unclear', MUSS mindestens eine der suggestedQuestion-Felder ausgefüllt sein
- Die explanation sollte für den Benutzer verständlich sein, nicht technisch
- Bei 'unclear' sollten beide Frage-Vorschläge helfen, die ursprüngliche Intention zu klären`

/**
 * Analysiert eine Benutzerfrage und bestimmt den optimalen Retriever-Modus
 * 
 * @param question Die Benutzerfrage, die analysiert werden soll
 * @param context Optional: Library-Kontext (z.B. Event-Modus aktiv?)
 * @returns Analyse-Ergebnis mit Empfehlung und optionalen Frage-Vorschlägen
 */
export async function analyzeQuestionForRetriever(
  question: string,
  context?: {
    isEventMode?: boolean
    libraryType?: string
  }
): Promise<QuestionAnalysisResult> {
  const model = process.env.QUESTION_ANALYZER_MODEL || process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4o-mini'
  const temperature = Number(process.env.QUESTION_ANALYZER_TEMPERATURE ?? 0.3)
  const apiKey = process.env.OPENAI_API_KEY || ''
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY fehlt für Frage-Analyse')
  }

  // User-Prompt zusammenstellen
  let userPrompt = `Analysiere folgende Frage:\n\n"${question}"`
  
  if (context?.isEventMode) {
    userPrompt += '\n\nHinweis: Diese Bibliothek ist im Event-Modus (Sessions/Präsentationen). Dokumente haben typischerweise keine detaillierten Kapitel, sondern Session-Übersichten.'
  }
  
  if (context?.libraryType) {
    userPrompt += `\n\nBibliothekstyp: ${context.libraryType}`
  }

  // LLM-Aufruf mit structured output
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
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI Frage-Analyse Fehler: ${response.status} ${errorText.slice(0, 200)}`)
  }

  const raw = await response.json()
  const content = raw?.choices?.[0]?.message?.content
  
  if (!content || typeof content !== 'string') {
    throw new Error('Ungültige Antwort von OpenAI: Kein Content')
  }

  // JSON parsen und validieren
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('OpenAI Antwort konnte nicht als JSON geparst werden')
  }

  // Zod-Validierung
  const validated = questionAnalysisSchema.parse(parsed)

  // Zusätzliche Validierung: Wenn unclear, müssen suggestedQuestions vorhanden sein
  if (validated.recommendation === 'unclear') {
    if (!validated.suggestedQuestionChunk && !validated.suggestedQuestionSummary) {
      // Fallback: Erstelle generische Vorschläge
      validated.suggestedQuestionChunk = `Gib mir Details zu: ${question}`
      validated.suggestedQuestionSummary = `Gib mir einen Überblick über: ${question}`
    }
  }

  return validated
}



