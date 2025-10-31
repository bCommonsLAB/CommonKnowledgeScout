export interface LlmCallArgs {
  model: string
  temperature: number
  prompt: string
  apiKey: string
}

export async function callOpenAI({ model, temperature, prompt, apiKey }: LlmCallArgs): Promise<Response> {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: 'system', content: 'Du bist ein hilfreicher, faktenbasierter Assistent.' },
        { role: 'user', content: prompt }
      ]
    })
  })
}

export async function parseOpenAIResponse(raw: string): Promise<string> {
  const parsed: unknown = JSON.parse(raw)
  if (parsed && typeof parsed === 'object') {
    const p = parsed as { choices?: Array<{ message?: { content?: unknown } }> }
    const c = p.choices?.[0]?.message?.content
    if (typeof c === 'string') return c
  }
  throw new Error('OpenAI Chat Parse Fehler')
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
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const p = parsed as { choices?: Array<{ message?: { content?: unknown } }> }
      const content = p.choices?.[0]?.message?.content
      if (typeof content === 'string') {
        // Versuche als strukturiertes JSON zu parsen
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
            }
          }
        } catch {
          // Fallback: Plain Text Antwort (für Rückwärtskompatibilität)
          answer = content
          suggestedQuestions = []
          usedReferences = []
        }
      }
    }
  } catch {
    throw new Error('OpenAI Chat Parse Fehler')
  }
  
  return { answer, suggestedQuestions, usedReferences }
}


