/**
 * @fileoverview API-Route einzelne Wizard-Submission: Detail (ADR-0004, W2).
 *
 * @description
 * `GET /api/submissions/[id]` — liefert eine Submission inkl. Markdown + Metadaten
 * fuer die Preview aus dem Staging (ADR-0004 §E4: Preview unabhaengig vom
 * Publish-Status). Sichtbar fuer Reviewer (`co-creator`/`owner`) oder den
 * Erfasser selbst.
 *
 * Korrektur (PATCH) + Freigabe/Ablehnung (approve/reject) folgen mit der
 * Abnahme-UI (W4); sie nutzen die bereits vorhandenen Repo-Funktionen.
 *
 * @see docs/architecture/api-route-conventions.md
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPreferredUserEmail, normalizeEmail } from '@/lib/auth/user-email';
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import { getSubmissionById } from '@/lib/repositories/wizard-submissions-repo';
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
