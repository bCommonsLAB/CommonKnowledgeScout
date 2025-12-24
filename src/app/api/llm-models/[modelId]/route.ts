/**
 * @fileoverview LLM Model Detail API Route
 * 
 * @description
 * API Route für einzelne LLM-Modell-Konfigurationen.
 * 
 * @route GET /api/llm-models/[modelId]
 * 
 * @returns Einzelnes LLM-Modell oder 404 wenn nicht gefunden
 */

import { NextResponse } from 'next/server'
import { getLlmModelById } from '@/lib/db/llm-models-repo'

/**
 * GET /api/llm-models/[modelId]
 * 
 * Gibt ein einzelnes LLM-Modell zurück.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const { modelId } = await params
    const model = await getLlmModelById(modelId)
    
    if (!model) {
      return NextResponse.json(
        { error: 'Modell nicht gefunden' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(model)
  } catch (error) {
    console.error(`[api/llm-models/${(await params).modelId}] Fehler beim Laden des Modells:`, error)
    return NextResponse.json(
      { error: 'Fehler beim Laden des LLM-Modells' },
      { status: 500 }
    )
  }
}



