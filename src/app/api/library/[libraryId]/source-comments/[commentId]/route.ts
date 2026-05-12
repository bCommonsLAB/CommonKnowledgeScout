/**
 * @fileoverview Source-Comments API-Route (Item-Endpoint)
 *
 * @description
 * PATCH und DELETE fuer einzelne Kommentare.
 * - Edit: nur der Author seines eigenen Kommentars (Server prueft).
 * - Delete: Author seines eigenen oder Owner/Co-Creator (Moderation).
 *
 * Loeschen ist Soft-Delete - das Dokument bleibt erhalten, damit der UI
 * "Kommentar geloescht von X" anzeigen kann.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import {
  SourceCommentForbiddenError,
  SourceCommentNotFoundError,
  softDeleteComment,
  updateComment,
} from '@/lib/repositories/source-comments-repo';
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import { getPreferredUserEmail } from '@/lib/auth/user-email';

type RouteParams = { params: Promise<{ libraryId: string; commentId: string }> };

async function getAuthEmail(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = getPreferredUserEmail(user);
  return email || null;
}

/** Mappt Domain-Fehler aus dem Repo auf konsistente HTTP-Statuscodes */
function errorResponse(err: unknown): NextResponse {
  if (err instanceof SourceCommentNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  if (err instanceof SourceCommentForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * PATCH /api/library/[libraryId]/source-comments/[commentId]
 * Body: { body: string }
 * Nur der Author darf editieren - die Pruefung erfolgt im Repo.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const email = await getAuthEmail();
  if (!email) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  const { commentId } = await params;
  if (!commentId) {
    return NextResponse.json({ error: 'commentId fehlt' }, { status: 400 });
  }

  const payload = (await request.json().catch(() => ({}))) as { body?: string };
  const body = typeof payload.body === 'string' ? payload.body : '';
  if (!body.trim()) {
    return NextResponse.json({ error: 'body darf nicht leer sein' }, { status: 400 });
  }

  try {
    const updated = await updateComment(commentId, email, body);
    return NextResponse.json({ comment: updated });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * DELETE /api/library/[libraryId]/source-comments/[commentId]
 * Author seines eigenen Kommentars OR Owner/Co-Creator (Moderation).
 * Soft-Delete: setzt `deletedAt` + `deletedBy`.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const email = await getAuthEmail();
  if (!email) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  const { libraryId, commentId } = await params;
  if (!libraryId || !commentId) {
    return NextResponse.json({ error: 'libraryId/commentId fehlen' }, { status: 400 });
  }

  const isModerator = await isCoCreatorOrOwner(libraryId, email);

  try {
    const deleted = await softDeleteComment(commentId, email, isModerator);
    return NextResponse.json({ comment: deleted });
  } catch (err) {
    return errorResponse(err);
  }
}
