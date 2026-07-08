/**
 * @fileoverview Source-Comments Bulk-Counts-Route (POST mit fileIds im Body)
 *
 * @description
 * Bulk-Variante von `GET source-comments?fileIds=...` fuer grosse
 * Libraries: Ab ~150-200 geladenen Quellen sprengt die kommaseparierte
 * fileIds-Liste (base64-kodierte IDs) das URL-/Header-Limit des Servers
 * (HTTP 431). Analog zum Graph-Fix (doc-neighbors/doc-relations) nimmt
 * dieser Endpoint die IDs deshalb als JSON-Body entgegen.
 *
 * Sichtbarkeit wie beim GET: Member sehen alle Counts, Gaeste nur die
 * eigenen (`filteredToOwn`).
 *
 * @module api/library
 *
 * @exports
 * - POST: Body `{ fileIds: string[] }` ->
 *         `{ libraryId, counts, filteredToOwn }`
 *
 * @dependencies
 * - @clerk/nextjs/server: Authentifizierung
 * - @/lib/repositories/source-comments-repo: Aggregation
 * - @/lib/repositories/library-members-repo: Rollen-Check
 * - @/lib/auth/user-email: E-Mail-Normalisierung
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getCommentCountsForLibrary } from '@/lib/repositories/source-comments-repo';
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import { getPreferredUserEmail } from '@/lib/auth/user-email';
import type { SourceCommentCountsResponse } from '@/types/source-comment';

type RouteParams = { params: Promise<{ libraryId: string }> };

/** Obergrenze pro Anfrage — passt zum Client-Cap des Graph-Loaders (2000). */
const MAX_FILE_IDS = 2000;

async function getAuthEmail(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = getPreferredUserEmail(user);
  return email || null;
}

/** Validiert den Body explizit (kein silent fallback bei kaputten Payloads). */
function parseFileIdsBody(raw: unknown): string[] | 'invalid' {
  if (typeof raw !== 'object' || raw === null) return 'invalid';
  const value = (raw as { fileIds?: unknown }).fileIds;
  if (!Array.isArray(value)) return 'invalid';
  const ids = value
    .filter((v): v is string => typeof v === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return ids;
}

/**
 * POST /api/library/[libraryId]/source-comments/counts
 * Body: { fileIds: string[] }
 * -> 200 { libraryId, counts, filteredToOwn }
 * -> 400 bei fehlendem/ungueltigem Body oder mehr als MAX_FILE_IDS
 * -> 401 fuer Anonyme
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const email = await getAuthEmail();
  if (!email) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  const { libraryId } = await params;
  if (!libraryId) {
    return NextResponse.json({ error: 'libraryId fehlt' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const fileIds = parseFileIdsBody(body);
  if (fileIds === 'invalid') {
    return NextResponse.json(
      { error: 'fileIds (string[]) ist erforderlich' },
      { status: 400 },
    );
  }
  if (fileIds.length > MAX_FILE_IDS) {
    return NextResponse.json(
      { error: `Maximal ${MAX_FILE_IDS} fileIds pro Anfrage` },
      { status: 400 },
    );
  }

  const isMember = await isCoCreatorOrOwner(libraryId, email);
  const onlyAuthorEmail = isMember ? undefined : email;

  const counts = await getCommentCountsForLibrary(libraryId, fileIds, { onlyAuthorEmail });
  const response: SourceCommentCountsResponse = {
    libraryId,
    counts,
    filteredToOwn: !isMember,
  };
  return NextResponse.json(response);
}
