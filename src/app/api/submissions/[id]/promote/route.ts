/**
 * @fileoverview `POST /api/submissions/[id]/promote` — Publikation (ADR-0004 §E3, W5).
 * ready -> publishing -> published. Schreibt Ziel-Provider + RAG-Index (der
 * einzige Provider-Schreibschritt). Nur Reviewer (`owner`/`co-creator`); bei
 * Token-/Speicher-Fehler Ruecksprung auf `ready` (retry-bar). Idempotent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { performPromotion } from '@/lib/submissions/promote-actions';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return performPromotion(id);
}
