/**
 * @fileoverview Abnahme-Aktionen (Freigabe/Ablehnung) als geteilte Route-Logik
 * (ADR-0004, W4).
 *
 * @description
 * `approve` (pending -> ready) und `reject` (* -> rejected) teilen sich Auth,
 * Reviewer-Gate (`co-creator`/`owner`) und den Status-Uebergang ueber die reine
 * Status-Maschine. Der eigentliche Uebergang wird im Repo validiert; ein
 * unzulaessiger Uebergang (z.B. Freigabe einer bereits publizierten Submission)
 * fuehrt zu HTTP 409.
 *
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 * @module lib/submissions
 */

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPreferredUserEmail } from '@/lib/auth/user-email';
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import {
  changeSubmissionStatus,
  getSubmissionById,
} from '@/lib/repositories/wizard-submissions-repo';
import { FileLogger } from '@/lib/debug/logger';

/** Liest eine optionale `note` aus dem Request-Body (z.B. Ablehnungsgrund). */
async function readOptionalNote(request: Request): Promise<string | undefined> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return undefined;
  }
  if (body && typeof body === 'object' && typeof (body as Record<string, unknown>).note === 'string') {
    return (body as Record<string, unknown>).note as string;
  }
  return undefined;
}

/**
 * Fuehrt einen Reviewer-Status-Uebergang aus (Freigabe/Ablehnung). Nur
 * `co-creator`/`owner` (Reviewer); `contributor` darf nicht abnehmen.
 */
export async function performReviewTransition(
  request: Request,
  id: string,
  to: 'ready' | 'rejected',
): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const email = getPreferredUserEmail(await currentUser());
    if (!email) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 });

    const existing = await getSubmissionById(id);
    if (!existing) return NextResponse.json({ error: 'Submission nicht gefunden' }, { status: 404 });
    if (!(await isCoCreatorOrOwner(existing.libraryId, email))) {
      return NextResponse.json({ error: 'Keine Berechtigung zur Abnahme' }, { status: 403 });
    }

    const note = await readOptionalNote(request);
    const submission = await changeSubmissionStatus(id, {
      to,
      actor: email,
      at: new Date().toISOString(),
      ...(note !== undefined ? { note } : {}),
    });
    return NextResponse.json({ submission });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Interner Fehler';
    const name = error instanceof Error ? error.name : '';
    // Unzulaessiger Uebergang -> 409, verschwundene Submission -> 404, sonst 500.
    const status =
      name === 'InvalidSubmissionTransitionError' ? 409 : name === 'SubmissionNotFoundError' ? 404 : 500;
    FileLogger.error('api/submissions review', `Uebergang nach ${to} fehlgeschlagen`, message);
    return NextResponse.json({ error: message }, { status });
  }
}
