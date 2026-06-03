/**
 * @fileoverview `POST /api/submissions/[id]/reject` — Ablehnung (ADR-0004, W4).
 * * -> rejected (kein Ziel-Schreiben). Nur Reviewer (`co-creator`/`owner`).
 * Optionaler `note`-Body als Ablehnungsgrund.
 */

import { NextRequest, NextResponse } from 'next/server';
import { performReviewTransition } from '@/lib/submissions/review-actions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return performReviewTransition(request, id, 'rejected');
}
