/**
 * @fileoverview Aggregierte Sterne (Counts + Voter-E-Mails)
 *
 * @description
 * Liefert pro fileId die Anzahl der Sterne und die Liste der Voter-
 * E-Mails - fuer Tooltip ("wer hat gesternt") und Sortierung
 * "nach Sternen". Beruecksichtigt nur `state = 'favorite'`,
 * `not_important` ist privat.
 *
 * Berechtigung: Member-only (Owner + aktive Co-Creators).
 *
 * @module api/library
 *
 * @exports
 * - GET ?fileIds=a,b,c -> { counts, voters }
 *
 * @dependencies
 * - @clerk/nextjs/server: Authentifizierung
 * - @/lib/repositories/source-user-states-repo: Aggregation
 * - @/lib/repositories/library-members-repo: Berechtigungs-Check
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getAggregatedFavorites } from '@/lib/repositories/source-user-states-repo';
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import { getPreferredUserEmail } from '@/lib/auth/user-email';
import type { AggregatedFavoritesResponse } from '@/types/source-user-state';

type RouteParams = { params: Promise<{ libraryId: string }> };

const MAX_FILE_IDS = 500;

async function getAuthEmail(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = getPreferredUserEmail(user);
  return email || null;
}

/**
 * GET /api/library/[libraryId]/source-favorites/aggregated?fileIds=a,b,c
 * -> 200 { libraryId, counts, voters } fuer Member
 * -> 400 wenn fileIds fehlt oder zu viele
 * -> 401 / 403 wie ueblich
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
  if (!isMember) {
    return NextResponse.json(
      { error: 'Aggregierte Sterne sind nur fuer Owner und Co-Kreatoren sichtbar' },
      { status: 403 },
    );
  }

  const raw = request.nextUrl.searchParams.get('fileIds') ?? '';
  const fileIds = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (fileIds.length === 0) {
    return NextResponse.json({ error: 'fileIds ist erforderlich' }, { status: 400 });
  }
  if (fileIds.length > MAX_FILE_IDS) {
    return NextResponse.json(
      { error: `Zu viele fileIds (max ${MAX_FILE_IDS})` },
      { status: 400 },
    );
  }

  const { counts, voters } = await getAggregatedFavorites(libraryId, fileIds);
  const body: AggregatedFavoritesResponse = { libraryId, counts, voters };
  return NextResponse.json(body);
}
