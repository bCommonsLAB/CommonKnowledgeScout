/**
 * @fileoverview Source-Favorites API-Route
 *
 * @description
 * Serverseitige Route fuer geteilte Quell-Favoriten in der Explorer-Tabelle.
 * Sehen + Toggeln sind ausschliesslich Owner und aktiven Co-Creators
 * vorbehalten - Gaeste erhalten 403, anonyme Aufrufer 401.
 *
 * @module api/library
 *
 * @exports
 * - GET:  Liste der favorisierten fileIds einer Library
 * - POST: Toggle (add/remove) fuer (libraryId, fileId)
 *
 * @dependencies
 * - @clerk/nextjs/server: Authentifizierung
 * - @/lib/repositories/source-favorites-repo: Persistenz
 * - @/lib/repositories/library-members-repo: Berechtigungs-Check
 * - @/lib/auth/user-email: E-Mail-Normalisierung
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import {
  listFavoriteFileIds,
  toggleFavorite,
} from '@/lib/repositories/source-favorites-repo';
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import { getPreferredUserEmail } from '@/lib/auth/user-email';
import type {
  SourceFavoriteListResponse,
  SourceFavoriteToggleResponse,
} from '@/types/source-favorite';

type RouteParams = { params: Promise<{ libraryId: string }> };

/** Liefert die Member-E-Mail oder null wenn nicht eingeloggt */
async function getAuthEmail(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = getPreferredUserEmail(user);
  return email || null;
}

/**
 * GET /api/library/[libraryId]/source-favorites
 * -> 200 { libraryId, favorites: string[] } fuer Member
 * -> 401 fuer Anonyme
 * -> 403 fuer Gaeste (eingeloggt, aber kein Mitglied)
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const email = await getAuthEmail();
  if (!email) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }
  const { libraryId } = await params;
  if (!libraryId) {
    return NextResponse.json({ error: 'libraryId fehlt' }, { status: 400 });
  }

  const isMember = await isCoCreatorOrOwner(libraryId, email);
  if (!isMember) {
    return NextResponse.json(
      { error: 'Favoriten sind nur fuer Owner und Co-Kreatoren sichtbar' },
      { status: 403 },
    );
  }

  const favorites = await listFavoriteFileIds(libraryId);
  const body: SourceFavoriteListResponse = { libraryId, favorites };
  return NextResponse.json(body);
}

/**
 * POST /api/library/[libraryId]/source-favorites
 * Body: { fileId: string }
 * -> 200 { libraryId, fileId, added: boolean } (Toggle)
 * -> 401 / 403 / 400 wie GET
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

  const isMember = await isCoCreatorOrOwner(libraryId, email);
  if (!isMember) {
    return NextResponse.json(
      { error: 'Favoriten sind nur fuer Owner und Co-Kreatoren aenderbar' },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { fileId?: string };
  const fileId = typeof body.fileId === 'string' ? body.fileId.trim() : '';
  if (!fileId) {
    return NextResponse.json({ error: 'fileId ist erforderlich' }, { status: 400 });
  }

  const result = await toggleFavorite(libraryId, fileId, email);
  const response: SourceFavoriteToggleResponse = {
    libraryId,
    fileId,
    added: result.added,
  };
  return NextResponse.json(response);
}
