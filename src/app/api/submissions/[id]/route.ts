/**
 * @fileoverview API-Route einzelne Wizard-Submission: Detail (ADR-0004, W2).
 *
 * @description
 * - `GET /api/submissions/[id]` — Detail inkl. Markdown + Metadaten fuer die
 *   Preview aus dem Staging (ADR-0004 §E4). Sichtbar fuer Reviewer
 *   (`co-creator`/`owner`) oder den Erfasser selbst.
 * - `PATCH /api/submissions/[id]` — redaktionelle Korrektur der Abnahme (W4),
 *   nur Reviewer; nur im editierbaren Status (sonst 409).
 *
 * Freigabe/Ablehnung liegen in den Unterrouten `approve`/`reject`.
 *
 * @see docs/architecture/api-route-conventions.md
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPreferredUserEmail, normalizeEmail } from '@/lib/auth/user-email';
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import {
  getSubmissionById,
  updateSubmissionMetadata,
} from '@/lib/repositories/wizard-submissions-repo';
import { parseReviewEdit } from '@/lib/submissions/submission-capture';
import { FileLogger } from '@/lib/debug/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const email = getPreferredUserEmail(await currentUser());
    if (!email) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 });

    const { id } = await params;
    const submission = await getSubmissionById(id);
    if (!submission) return NextResponse.json({ error: 'Submission nicht gefunden' }, { status: 404 });

    const isAuthor = submission.createdBy === normalizeEmail(email);
    const isReviewer = await isCoCreatorOrOwner(submission.libraryId, email);
    if (!isAuthor && !isReviewer) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    return NextResponse.json({ submission });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interner Fehler';
    FileLogger.error('api/submissions/[id] GET', 'Detail fehlgeschlagen', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const email = getPreferredUserEmail(await currentUser());
    if (!email) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 });

    const { id } = await params;
    const existing = await getSubmissionById(id);
    if (!existing) return NextResponse.json({ error: 'Submission nicht gefunden' }, { status: 404 });
    // Korrektur ist Reviewer-Sache (co-creator/owner); contributor editiert nicht.
    if (!(await isCoCreatorOrOwner(existing.libraryId, email))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    let input;
    try {
      input = parseReviewEdit(await request.json());
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Ungueltige Eingabe' },
        { status: 400 },
      );
    }

    const submission = await updateSubmissionMetadata(id, input);
    return NextResponse.json({ submission });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interner Fehler';
    // SubmissionNotEditableError -> 409, NotFound -> 404, sonst 500.
    const name = error instanceof Error ? error.name : '';
    const status = name === 'SubmissionNotEditableError' ? 409 : name === 'SubmissionNotFoundError' ? 404 : 500;
    FileLogger.error('api/submissions/[id] PATCH', 'Korrektur fehlgeschlagen', message);
    return NextResponse.json({ error: message }, { status });
  }
}
