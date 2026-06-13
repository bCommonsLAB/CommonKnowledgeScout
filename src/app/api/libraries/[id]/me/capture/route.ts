/**
 * @fileoverview GET /api/libraries/[id]/me/capture — Erfass-Berechtigung (ADR-0004 E2).
 *
 * @description
 * Liefert, ob der eingeloggte User in dieser Library erfassen darf
 * (owner/co-creator/contributor). Server-Wahrheit fuer das Conditional-Rendering
 * des „Inhalte erfassen"-Buttons in Galerie/Erkunden — der Client-Atom kennt die
 * `contributor`-Rolle nicht zuverlaessig, daher hier serverseitig pruefen.
 *
 * @see src/lib/submissions/capture-access.ts (resolveCaptureRole)
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 */

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPreferredUserEmail } from '@/lib/auth/user-email';
import { resolveCaptureRole } from '@/lib/submissions/capture-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: libraryId } = await params;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  const email = getPreferredUserEmail(await currentUser());
  if (!email) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 });

  const role = await resolveCaptureRole(email, libraryId);
  return NextResponse.json({ canCapture: role !== null, role }, { status: 200 });
}
