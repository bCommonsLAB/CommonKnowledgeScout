/**
 * @fileoverview `POST /api/submissions/[id]/approve` — Freigabe (ADR-0004, W4).
 * pending -> ready. Nur Reviewer (`co-creator`/`owner`). Optionaler `note`-Body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { performReviewTransition } from '@/lib/submissions/review-actions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return performReviewTransition(request, id, 'ready');
}
