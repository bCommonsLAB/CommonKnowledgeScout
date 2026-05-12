/**
 * @fileoverview Source-User-States API-Route
 *
 * @description
 * Eigene Sterne und privater "nicht wichtig"-Marker pro User.
 * Loest die alte `source-favorites/route.ts` ab, bei der ein einziger
 * Stern Library-weit geteilt wurde.
 *
 * Berechtigung:
 * - Lesen + Setzen ausschliesslich Owner und aktive Co-Creators
 *   (`isCoCreatorOrOwner`).
 * - Gaeste/Anonyme: 401 / 403; UI rendert keine Sterne.
 *
 * @module api/library
 *
 * @exports
 * - GET:  Eigene States (favorites + notImportant) als String-Listen
 * - POST: State setzen oder loeschen (Body `{ fileId, state }`)
 *
 * @dependencies
 * - @clerk/nextjs/server: Authentifizierung
 * - @/lib/repositories/source-user-states-repo: Persistenz
 * - @/lib/repositories/library-members-repo: Berechtigungs-Check
 * - @/lib/auth/user-email: E-Mail-Normalisierung
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import {
  getOwnStates,
  setState,
} from '@/lib/repositories/source-user-states-repo';
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import { getPreferredUserEmail } from '@/lib/auth/user-email';
import type {
  OwnUserStatesResponse,
  SetUserStateInput,
  SetUserStateResponse,
  SourceUserStateValue,
} from '@/types/source-user-state';

type RouteParams = { params: Promise<{ libraryId: string }> };

/** Liefert die Member-E-Mail oder null wenn nicht eingeloggt. */
async function getAuthEmail(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = getPreferredUserEmail(user);
  return email || null;
}

/**
 * GET /api/library/[libraryId]/source-user-states
 * -> 200 { libraryId, favorites: string[], notImportant: string[] } fuer Member
 * -> 401 fuer Anonyme
 * -> 403 fuer Gaeste
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
      { error: 'Sterne sind nur fuer Owner und Co-Kreatoren sichtbar' },
      { status: 403 },
    );
  }

  const { favorites, notImportant } = await getOwnStates(libraryId, email);
  const body: OwnUserStatesResponse = { libraryId, favorites, notImportant };
  return NextResponse.json(body);
}

/** Validiert den State-Wert aus dem Body explizit (kein silent fallback). */
function parseStateValue(raw: unknown): SourceUserStateValue | null | 'invalid' {
  if (raw === null) return null;
  if (raw === 'favorite' || raw === 'not_important') return raw;
  return 'invalid';
}

/**
 * POST /api/library/[libraryId]/source-user-states
 * Body: { fileId: string, state: 'favorite' | 'not_important' | null }
 * -> 200 { libraryId, fileId, state } (final state nach Operation)
 * -> 400 / 401 / 403 wie GET
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
      { error: 'Sterne sind nur fuer Owner und Co-Kreatoren aenderbar' },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Partial<SetUserStateInput>;
  const fileId = typeof body.fileId === 'string' ? body.fileId.trim() : '';
  if (!fileId) {
    return NextResponse.json({ error: 'fileId ist erforderlich' }, { status: 400 });
  }
  const parsed = parseStateValue(body.state);
  if (parsed === 'invalid') {
    return NextResponse.json(
      { error: "state muss 'favorite', 'not_important' oder null sein" },
      { status: 400 },
    );
  }

  const result = await setState(libraryId, fileId, email, parsed);
  const response: SetUserStateResponse = {
    libraryId,
    fileId,
    state: result.state,
  };
  return NextResponse.json(response);
}
