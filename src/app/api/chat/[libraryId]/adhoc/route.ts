import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { ANSWER_LENGTH_ZOD_ENUM, ANSWER_LENGTH_DEFAULT } from '@/lib/chat/constants'
import { callLlmText } from '@/lib/chat/common/llm'
import { getSecretaryConfig } from '@/lib/env'

const bodySchema = z.object({
  systemPrompt: z.string().optional(),
  instructions: z.string().min(1),
  contextText: z.string().min(1),
  answerLength: ANSWER_LENGTH_ZOD_ENUM.default(ANSWER_LENGTH_DEFAULT)
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
    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    if (!ctx.library.config?.publicPublishing?.isPublic && !userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const json = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: 'Ungültige Eingabe', details: parsed.error.flatten() }, { status: 400 })

    const { systemPrompt, instructions, contextText, answerLength } = parsed.data

    const { apiKey: chatApiKey } = getSecretaryConfig()
    if (!chatApiKey) return NextResponse.json({ error: 'Secretary Service API-Key fehlt' }, { status: 500 })

    // LLM-Modell und Temperature: Aus Library-Config oder Default
    let llmModel: string | undefined = ctx.library.config?.chat?.models?.chat
    let llmTemperature: number | undefined = ctx.library.config?.chat?.models?.temperature
    
    // Wenn kein Modell gesetzt, lade Default-Modell
    if (!llmModel) {
      const { getDefaultLlmModel } = await import('@/lib/db/llm-models-repo')
      const defaultModel = await getDefaultLlmModel()
      if (defaultModel) {
        llmModel = defaultModel._id
      }
    }
    
    // Wenn keine Temperature gesetzt, verwende Default (0.3)
    if (llmTemperature === undefined || llmTemperature === null || isNaN(llmTemperature)) {
      llmTemperature = 0.3
    }
    
    if (!llmModel) {
      return NextResponse.json({ error: 'LLM-Modell ist erforderlich' }, { status: 400 })
    }

    const styleInstruction = answerLength === 'ausführlich'
      ? 'Schreibe eine strukturierte, ausführliche Antwort (ca. 250–600 Wörter).'
      : answerLength === 'mittel'
      ? 'Schreibe eine mittellange Antwort (ca. 120–250 Wörter).'
      : 'Schreibe eine knappe Antwort (1–3 Sätze, max. 120 Wörter).'

    const system = systemPrompt || 'Du bist ein hilfreicher, faktenbasierter Assistent. Nutze ausschließlich den bereitgestellten Kontext.'
    const userPrompt = `Kontext:\n${contextText}\n\nInstruktionen:\n${instructions}\n\nAnforderungen:\n- ${styleInstruction}\n- Antworte auf Deutsch.`

    try {
      const result = await callLlmText({
        apiKey: chatApiKey,
        model: llmModel,
        temperature: llmTemperature,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt }
        ]
      })

      return NextResponse.json({ status: 'ok', answer: result.text })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'LLM Chat Fehler'
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api/chat/adhoc] Unhandled error', error)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}


































