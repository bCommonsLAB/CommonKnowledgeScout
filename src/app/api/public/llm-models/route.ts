/**
 * @fileoverview Public LLM Models API Route
 *
 * Diese Route ist absichtlich unter `/api/public/*`, damit sie für anonyme Nutzer
 * ohne Clerk-Schutz verfügbar ist (siehe Middleware: `/api/public(.*)` ist public).
 *
 * @route GET /api/public/llm-models
 */

import { NextResponse } from 'next/server'
import { getAllLlmModels } from '@/lib/db/llm-models-repo'

export async function GET() {
  try {
    const models = await getAllLlmModels()
    return NextResponse.json(models)
  } catch (error) {
    console.error('[api/public/llm-models] Fehler beim Laden der Modelle:', error)
    return NextResponse.json(
      { error: 'Fehler beim Laden der LLM-Modelle' },
      { status: 500 }
    )
  }
}


