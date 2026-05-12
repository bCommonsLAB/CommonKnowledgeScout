/**
 * @fileoverview Source-Comments API-Route (Collection-Endpoint)
 *
 * @description
 * Lese- und Schreibzugriffe fuer Multi-User-Feedback-Kommentare pro Quelle.
 *
 * Sichtbarkeits-Logik (Server-seitig durchsetzen):
 * - Owner + aktive Co-Creator: alle Kommentare zur Quelle.
 * - Gast (eingeloggt, kein Member): nur eigene Kommentare (Repo-Filter
 *   `onlyAuthorEmail = email`).
 *
 * Schreiben (POST) ist fuer jeden eingeloggten User erlaubt.
 *
 * @module api/library
 *
 * @exports
 * - GET:  Thread fuer eine Quelle (?fileId=...) oder Bulk-Counts
 *         (?fileIds=a,b,c) fuer Tabellen-Render.
 * - POST: Neuer Kommentar { fileId, body }.
 *
 * @dependencies
 * - @clerk/nextjs/server
 * - @/lib/repositories/source-comments-repo
 * - @/lib/repositories/library-members-repo
 * - @/lib/auth/user-email
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import {
  createComment,
  getCommentCountsForLibrary,
  listCommentsByFileId,
} from '@/lib/repositories/source-comments-repo';
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import { getPreferredUserEmail } from '@/lib/auth/user-email';
import type {
  SourceCommentCountsResponse,
  SourceCommentThreadResponse,
} from '@/types/source-comment';

type RouteParams = { params: Promise<{ libraryId: string }> };

async function getAuthEmail(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = getPreferredUserEmail(user);
  return email || null;
}

/**
 * Splittet einen `fileIds`-Query-Param (kommaseparierte Liste) und
 * begrenzt auf eine sinnvolle Obergrenze, damit die Tabellen-Bulk-Abfrage
 * keine unbegrenzte Aggregation triggert.
 */
function parseFileIds(raw: string | null): string[] {
  if (!raw) return [];
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const MAX = 500;
  return ids.length > MAX ? ids.slice(0, MAX) : ids;
}

/**
 * GET /api/library/[libraryId]/source-comments
 * - ?fileId=...        -> Thread (rolelhaengig gefiltert)
 * - ?fileIds=a,b,c     -> Bulk-Counts pro fileId (rolelhaengig)
 *
 * Antworten enthalten `filteredToOwn`, damit das UI den Gast-Hinweis
 * korrekt anzeigen kann.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const email = await getAuthEmail();
  if (!email) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  const { libraryId } = await params;
  if (!libraryId) {
    return NextResponse.json({ error: 'libraryId fehlt' }, { status: 400 });
  }

  const isMember = await isCoCreatorOrOwner(libraryId, email);
  const onlyAuthorEmail = isMember ? undefined : email;

  const url = new URL(request.url);
  const fileId = url.searchParams.get('fileId');
  const fileIdsRaw = url.searchParams.get('fileIds');

  if (fileIdsRaw !== null) {
    const fileIds = parseFileIds(fileIdsRaw);
    const counts = await getCommentCountsForLibrary(libraryId, fileIds, { onlyAuthorEmail });
    const body: SourceCommentCountsResponse = {
      libraryId,
      counts,
      filteredToOwn: !isMember,
    };
    return NextResponse.json(body);
  }

  if (!fileId) {
    return NextResponse.json(
      { error: 'fileId oder fileIds ist erforderlich' },
      { status: 400 },
    );
  }

  const comments = await listCommentsByFileId(libraryId, fileId, { onlyAuthorEmail });
  const body: SourceCommentThreadResponse = {
    libraryId,
    fileId,
    comments,
    filteredToOwn: !isMember,
  };
  return NextResponse.json(body);
}

/**
 * POST /api/library/[libraryId]/source-comments
 * Body: { fileId, body }
 * Jeder eingeloggte User darf schreiben (Owner, Co-Creator oder Gast).
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

  const payload = (await request.json().catch(() => ({}))) as {
    fileId?: string;
    body?: string;
  };
  const fileId = typeof payload.fileId === 'string' ? payload.fileId.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body : '';

  if (!fileId) {
    return NextResponse.json({ error: 'fileId ist erforderlich' }, { status: 400 });
  }
  if (!body.trim()) {
    return NextResponse.json({ error: 'body darf nicht leer sein' }, { status: 400 });
  }

  const created = await createComment(libraryId, fileId, email, body);
  return NextResponse.json({ comment: created }, { status: 201 });
}
