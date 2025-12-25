/**
 * @fileoverview LLM Models API Route
 * 
 * @description
 * API Route für LLM-Modell-Konfigurationen. Gibt alle aktiven Modelle zurück,
 * sortiert nach order-Feld.
 * 
 * @route GET /api/llm-models
 * 
 * @returns Array von aktiven LLM-Modellen
 */

import { NextResponse } from 'next/server'
import { getAllLlmModels } from '@/lib/db/llm-models-repo'

/**
 * GET /api/llm-models
 * 
 * Gibt alle aktiven LLM-Modelle zurück, sortiert nach order-Feld.
 */
export async function GET() {
  try {
    const models = await getAllLlmModels()
    return NextResponse.json(models)
  } catch (error) {
    console.error('[api/llm-models] Fehler beim Laden der Modelle:', error)
    return NextResponse.json(
      { error: 'Fehler beim Laden der LLM-Modelle' },
      { status: 500 }
    )
  }
}






