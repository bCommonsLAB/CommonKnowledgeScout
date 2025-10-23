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


