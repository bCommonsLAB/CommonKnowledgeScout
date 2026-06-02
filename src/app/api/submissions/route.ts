/**
 * @fileoverview API-Route Wizard-Submissions: anlegen + Inbox-Liste (ADR-0004, W2).
 *
 * @description
 * - `POST /api/submissions` — Erfassung -> Inbox: legt eine Submission (`pending`)
 *   an, statt direkt in den Ziel-Provider zu schreiben (ADR-0004-Invariante).
 *   Rechte: `co-creator` oder `owner` (kontoloser Write-Key/QR = spaetere Scheibe;
 *   `contributor` kommt mit W3).
 * - `GET /api/submissions?libraryId=…&status=…` — Inbox-Liste, rechte-gated
 *   (Reviewer: `co-creator`/`owner`).
 *
 * @see docs/architecture/api-route-conventions.md
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPreferredUserEmail } from '@/lib/auth/user-email';
import { LibraryService } from '@/lib/services/library-service';
import { getActiveMemberRole, isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import { createSubmission, listSubmissions } from '@/lib/repositories/wizard-submissions-repo';
import {
  buildCaptureSubmissionInput,
  parseCaptureBody,
  resolveCreatorRole,
} from '@/lib/submissions/submission-capture';
import { isSubmissionStatus } from '@/lib/submissions/submission-status';
import { FileLogger } from '@/lib/debug/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const email = getPreferredUserEmail(await currentUser());
    if (!email) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 });

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Ungueltiger JSON-Body' }, { status: 400 });
    }

    const body = parseCaptureBody(raw);

    // Rechte + Rolle ableiten: Owner ueber Library-Besitz, sonst aktive Mitglieds-Rolle.
    // Erfassen duerfen Owner, Co-Creator und Contributor (ADR-0004 E2); sonst 403.
    const isOwner = (await LibraryService.getInstance().getLibrary(email, body.libraryId)) !== null;
    const memberRole = isOwner ? null : await getActiveMemberRole(body.libraryId, email);
    const createdByRole = resolveCreatorRole(isOwner, memberRole);
    if (!createdByRole) {
      return NextResponse.json({ error: 'Keine Berechtigung zum Erfassen' }, { status: 403 });
    }

    const submission = await createSubmission(
      buildCaptureSubmissionInput(body, { createdBy: email, createdByRole }),
    );
    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interner Fehler';
    // Eingabe-/Validierungsfehler aus parseCaptureBody -> 400, sonst 500.
    const isValidation = message.startsWith('parseCaptureBody:');
    FileLogger.error('api/submissions POST', 'Submission anlegen fehlgeschlagen', message);
    return NextResponse.json({ error: message }, { status: isValidation ? 400 : 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const email = getPreferredUserEmail(await currentUser());
    if (!email) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 });

    const libraryId = request.nextUrl.searchParams.get('libraryId') ?? '';
    if (!libraryId) return NextResponse.json({ error: 'libraryId fehlt' }, { status: 400 });

    if (!(await isCoCreatorOrOwner(libraryId, email))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    const statusParam = request.nextUrl.searchParams.get('status');
    if (statusParam !== null && !isSubmissionStatus(statusParam)) {
      return NextResponse.json({ error: `Ungueltiger status: "${statusParam}"` }, { status: 400 });
    }

    const submissions = await listSubmissions(libraryId, {
      ...(statusParam !== null ? { status: statusParam } : {}),
    });
    return NextResponse.json({ submissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interner Fehler';
    FileLogger.error('api/submissions GET', 'Inbox-Liste fehlgeschlagen', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
