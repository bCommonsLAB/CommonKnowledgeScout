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
import { seedStandardCaptureFlowForLibrary } from '@/lib/creation/flow-seed';

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

  // W-A Stufe 1: Den generischen Standard-Erfassungs-Ablauf idempotent in der DB
  // anlegen, sobald jemand mit Erfass-Recht den Capture-Kontext oeffnet (deckt
  // neue UND bestehende Libraries ab). Der Seed prueft selbst auf Existenz
  // (idempotent). Ein Fehler darf die Berechtigungs-Antwort NICHT blockieren,
  // wird aber geloggt (kein stiller Fallback).
  if (role !== null) {
    try {
      await seedStandardCaptureFlowForLibrary(libraryId, email);
    } catch (err) {
      console.warn(
        `[me/capture] Auto-Seed des Standard-Ablaufs fehlgeschlagen (libraryId=${libraryId}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return NextResponse.json({ canCapture: role !== null, role }, { status: 200 });
}
