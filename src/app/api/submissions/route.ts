/**
 * @fileoverview API-Route Wizard-Submissions: anlegen + Inbox-Liste (ADR-0004, W2 + Welle II-A).
 *
 * @description
 * - `POST /api/submissions` — Erfassung -> Inbox (Submission `pending`, statt
 *   direkt in den Ziel-Provider zu schreiben; ADR-0004-Invariante). Zwei Eingaben:
 *   - `multipart/form-data` (Stufe A „Inhalte erfassen"): Binaerquelle wird ueber
 *     den **Inbox-Provider** in `{libraryId}/inbox/{username}/...` hochgeladen.
 *   - `application/json` (Wizard-/Analyse-Ergebnis): `binaryRefs` liegen im Body.
 *   Rechte: `owner`/`co-creator`/`contributor` (ADR-0004 E2; Write-Key/QR spaeter).
 * - `GET /api/submissions?libraryId=…&status=…` — Inbox-Liste, rechte-gated
 *   (Reviewer: `co-creator`/`owner`).
 * - `GET /api/submissions?libraryId=…&mine=true` — eigene Beitraege des
 *   Erfassers (Contributor-Pruef-Sicht, Welle III-4b); kein Reviewer-Recht noetig.
 *
 * @see docs/architecture/api-route-conventions.md
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPreferredUserEmail } from '@/lib/auth/user-email';
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import { createSubmission, listSubmissions } from '@/lib/repositories/wizard-submissions-repo';
import {
  buildCaptureSubmissionInput,
  parseCaptureBody,
  type CaptureBody,
} from '@/lib/submissions/submission-capture';
import { parseMultipartCapture } from '@/lib/submissions/capture-multipart';
import { resolveCaptureRole } from '@/lib/submissions/capture-access';
import {
  resolveCaptureSizeLimits,
  checkDeclaredTotalSize,
  checkParsedFileSizes,
} from '@/lib/submissions/capture-size-guard';
import { getInboxProvider, inboxUsernameFromEmail } from '@/lib/storage/inbox/inbox-provider-entry';
import { uploadInboxBinary } from '@/lib/submissions/inbox-upload';
import { isSubmissionStatus } from '@/lib/submissions/submission-status';
import { FileLogger } from '@/lib/debug/logger';
import { registerProcessErrorLogging } from '@/lib/debug/process-error-logging';
import type { SubmissionBinaryRef } from '@/types/wizard-submission';

// Diagnose-Netz (Variante C): unbehandelte Fehler protokollieren, statt den
// Prozess kommentarlos sterben zu lassen. Idempotent — laeuft pro Worker einmal.
registerProcessErrorLogging();

/** Legt die `pending`-Submission an, nachdem die Rechte geprueft wurden (403 wenn ohne Recht). */
async function createPendingSubmission(body: CaptureBody, email: string): Promise<NextResponse> {
  const createdByRole = await resolveCaptureRole(email, body.libraryId);
  if (!createdByRole) {
    return NextResponse.json({ error: 'Keine Berechtigung zum Erfassen' }, { status: 403 });
  }
  const submission = await createSubmission(
    buildCaptureSubmissionInput(body, { createdBy: email, createdByRole }),
  );
  return NextResponse.json({ submission }, { status: 201 });
}

/**
 * Stufe A: Binaerquelle(n) ueber den Inbox-Provider in `{libraryId}/inbox/{username}/...`
 * hochladen (NIE in den Ziel-Provider — ADR-0004-Invariante), dann EINE Submission
 * mit allen Refs anlegen. Mehrere Dateien = Ordner-Erfassung (U5e); jede Quelle
 * wird zu einem `binaryRef` derselben Submission.
 */
async function captureWithBinary(request: NextRequest, email: string): Promise<NextResponse> {
  const limits = resolveCaptureSizeLimits();

  // Pre-Parse-Guard: deklarierte Gesamtgroesse pruefen, BEVOR `formData()` den
  // kompletten Upload in den RAM puffert (sonst Dev-OOM -> ERR_EMPTY_RESPONSE).
  const declared = checkDeclaredTotalSize(request.headers.get('content-length'), limits);
  if (declared) return NextResponse.json({ error: declared.message }, { status: 413 });

  let parsed: { body: CaptureBody; files: File[] };
  try {
    parsed = parseMultipartCapture(await request.formData());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ungueltige Eingabe' },
      { status: 400 },
    );
  }

  // Post-Parse-Guard (autoritativ): tatsaechliche Datei-Groessen pro Datei + Summe
  // pruefen, BEVOR `uploadInboxBinary` jede Datei erneut komplett in den RAM laedt.
  const violation = checkParsedFileSizes(parsed.files, limits);
  if (violation) return NextResponse.json({ error: violation.message }, { status: 413 });

  // Rechte VOR dem Upload pruefen — kein verwaister Blob ohne Berechtigung.
  const createdByRole = await resolveCaptureRole(email, parsed.body.libraryId);
  if (!createdByRole) {
    return NextResponse.json({ error: 'Keine Berechtigung zum Erfassen' }, { status: 403 });
  }

  const provider = await getInboxProvider(email, parsed.body.libraryId);
  const username = inboxUsernameFromEmail(email);
  const refs: SubmissionBinaryRef[] = [];
  for (const file of parsed.files) {
    refs.push(await uploadInboxBinary(provider, username, file));
  }
  const body: CaptureBody = { ...parsed.body, binaryRefs: [...(parsed.body.binaryRefs ?? []), ...refs] };

  const submission = await createSubmission(
    buildCaptureSubmissionInput(body, { createdBy: email, createdByRole }),
  );
  return NextResponse.json({ submission }, { status: 201 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const email = getPreferredUserEmail(await currentUser());
    if (!email) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 });

    // Multipart = Erfassung mit Binaerquelle (Stufe A); JSON = Refs liegen im Body.
    if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      return await captureWithBinary(request, email);
    }

    let body: CaptureBody;
    try {
      body = parseCaptureBody(await request.json());
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Ungueltige Eingabe' },
        { status: 400 },
      );
    }
    return await createPendingSubmission(body, email);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interner Fehler';
    FileLogger.error('api/submissions POST', 'Submission anlegen fehlgeschlagen', message);
    return NextResponse.json({ error: message }, { status: 500 });
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

    // `mine=true`: eigene Beitraege des Erfassers (kein Reviewer-Recht noetig).
    // Sonst: Inbox-Liste, nur fuer Reviewer (co-creator/owner).
    const mine = request.nextUrl.searchParams.get('mine') === 'true';
    if (!mine && !(await isCoCreatorOrOwner(libraryId, email))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    const statusParam = request.nextUrl.searchParams.get('status');
    if (statusParam !== null && !isSubmissionStatus(statusParam)) {
      return NextResponse.json({ error: `Ungueltiger status: "${statusParam}"` }, { status: 400 });
    }

    const submissions = await listSubmissions(libraryId, {
      ...(statusParam !== null ? { status: statusParam } : {}),
      ...(mine ? { createdBy: email } : {}),
    });
    return NextResponse.json({ submissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interner Fehler';
    FileLogger.error('api/submissions GET', 'Inbox-Liste fehlgeschlagen', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
