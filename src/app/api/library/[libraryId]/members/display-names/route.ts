/**
 * @fileoverview Member-Display-Names API-Route
 *
 * @description
 * Loest E-Mail-Adressen zu Display-Names auf (Vorname + Nachname falls
 * vorhanden, sonst Username, sonst E-Mail).
 *
 * Wird vom Tooltip-UI on-demand aufgerufen, wenn der User ueber einen
 * Sterne-Counter hovert.
 *
 * Berechtigung: Member-only (Owner + aktive Co-Creators) der jeweiligen
 * Library. Nicht-Member erhalten 401/403, sodass keine User-Daten an
 * Aussenstehende leaken. Alle uebergebenen E-Mails werden aufgeloest;
 * E-Mails, die Clerk nicht kennt, werden als E-Mail-String
 * zurueckgegeben.
 *
 * @module api/library
 *
 * @exports
 * - GET ?emails=a@b.com,c@d.com -> { libraryId, names }
 *
 * @dependencies
 * - @clerk/nextjs/server: Auth + Backend-SDK fuer User-Lookup
 * - @/lib/repositories/library-members-repo: Berechtigungs-Check
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';
import { isCoCreatorOrOwner } from '@/lib/repositories/library-members-repo';
import { getPreferredUserEmail, normalizeEmail } from '@/lib/auth/user-email';
import type { MemberDisplayNamesResponse } from '@/types/source-user-state';

type RouteParams = { params: Promise<{ libraryId: string }> };

const MAX_EMAILS = 200;

async function getAuthEmail(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = getPreferredUserEmail(user);
  return email || null;
}

/** Holt einen Display-Namen aus einem Clerk-User; Fallback E-Mail. */
function pickDisplayName(
  user: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  } | null,
  fallbackEmail: string,
): string {
  if (!user) return fallbackEmail;
  const first = (user.firstName ?? '').trim();
  const last = (user.lastName ?? '').trim();
  const composed = `${first} ${last}`.trim();
  if (composed) return composed;
  const username = (user.username ?? '').trim();
  if (username) return username;
  return fallbackEmail;
}

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
      { error: 'Member-Display-Names sind nur fuer Owner und Co-Kreatoren sichtbar' },
      { status: 403 },
    );
  }

  const raw = request.nextUrl.searchParams.get('emails') ?? '';
  const requested = Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => normalizeEmail(s))
        .filter(Boolean),
    ),
  );

  if (requested.length === 0) {
    return NextResponse.json({ error: 'emails ist erforderlich' }, { status: 400 });
  }
  if (requested.length > MAX_EMAILS) {
    return NextResponse.json(
      { error: `Zu viele E-Mails (max ${MAX_EMAILS})` },
      { status: 400 },
    );
  }

  const names: Record<string, string> = {};
  try {
    const client = await clerkClient();
    const list = await client.users.getUserList({ emailAddress: requested });
    const data = Array.isArray(list?.data) ? list.data : [];
    for (const user of data) {
      const allEmails = (user.emailAddresses ?? [])
        .map((e) => normalizeEmail(e?.emailAddress ?? ''))
        .filter(Boolean);
      const match = allEmails.find((e) => requested.includes(e));
      if (!match) continue;
      names[match] = pickDisplayName(user, match);
    }
  } catch (err) {
    console.warn('[members/display-names] Clerk-Resolve fehlgeschlagen:', {
      libraryId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  // E-Mails, die Clerk nicht kannte: Fallback auf E-Mail-String.
  for (const e of requested) {
    if (!(e in names)) names[e] = e;
  }

  const body: MemberDisplayNamesResponse = { libraryId, names };
  return NextResponse.json(body);
}
