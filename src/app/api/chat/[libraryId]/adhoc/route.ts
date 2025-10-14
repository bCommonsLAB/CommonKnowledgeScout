import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'

const bodySchema = z.object({
  systemPrompt: z.string().optional(),
  instructions: z.string().min(1),
  contextText: z.string().min(1),
  answerLength: z.enum(['kurz','mittel','ausführlich']).default('mittel')
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params

    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    const emailForLoad = userEmail || request.headers.get('X-User-Email') || ''
    const ctx = await loadLibraryChatContext(emailForLoad, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    if (!ctx.chat.public && !userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const json = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: 'Ungültige Eingabe', details: parsed.error.flatten() }, { status: 400 })

    const { systemPrompt, instructions, contextText, answerLength } = parsed.data

    const chatApiKey = process.env.OPENAI_API_KEY
    if (!chatApiKey) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt' }, { status: 500 })
    const model = process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4o-mini'
    const temperature = Number(process.env.OPENAI_CHAT_TEMPERATURE ?? 0.2)

    const styleInstruction = answerLength === 'ausführlich'
      ? 'Schreibe eine strukturierte, ausführliche Antwort (ca. 250–600 Wörter).'
      : answerLength === 'mittel'
      ? 'Schreibe eine mittellange Antwort (ca. 120–250 Wörter).'
      : 'Schreibe eine knappe Antwort (1–3 Sätze, max. 120 Wörter).'

    const system = systemPrompt || 'Du bist ein hilfreicher, faktenbasierter Assistent. Nutze ausschließlich den bereitgestellten Kontext.'
    const userPrompt = `Kontext:\n${contextText}\n\nInstruktionen:\n${instructions}\n\nAnforderungen:\n- ${styleInstruction}\n- Antworte auf Deutsch.`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${chatApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt }
        ]
      })
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `OpenAI Chat Fehler: ${res.status} ${text.slice(0, 400)}` }, { status: 500 })
    }
    const raw = await res.text()
    let answer = ''
    try {
      const parsedRes: unknown = JSON.parse(raw)
      const p = (parsedRes && typeof parsedRes === 'object') ? parsedRes as { choices?: Array<{ message?: { content?: unknown } }> } : {}
      const c = p.choices?.[0]?.message?.content
      if (typeof c === 'string') answer = c
    } catch {
      return NextResponse.json({ error: 'OpenAI Chat Parse Fehler', details: raw.slice(0, 400) }, { status: 502 })
    }

    return NextResponse.json({ status: 'ok', answer })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api/chat/adhoc] Unhandled error', error)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}






























