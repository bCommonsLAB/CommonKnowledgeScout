/**
 * @fileoverview API-Route für Shadow-Twin-Modus-Umschaltung
 * 
 * @description
 * Serverseitige Route zum Setzen des Shadow-Twin-Modus einer Library.
 *
 * WICHTIG (v2-only Runtime):
 * - Die Anwendung läuft ausschließlich im v2-Modus.
 * - 'legacy' wird nicht mehr als Betriebsmodus akzeptiert (nur noch als historisches Config-Flag in bestehenden Libraries).
 * - Migration/Repair bestehender Artefakte ist bewusst später geplant und wird hier NICHT gestartet.
 * 
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import { LibraryService } from '@/lib/services/library-service';
import { ShadowTwinLegacyNotAllowedError } from '@/lib/shadow-twin/errors';

/**
 * POST /api/library/[libraryId]/shadow-twin-mode
 * 
 * Setzt den Shadow-Twin-Modus einer Library.
 * 
 * Body:
 * - mode: 'v2'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) {
      return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 });
    }

    const { libraryId } = await params;
    const body = await request.json() as { mode?: unknown };

    const mode = body.mode
    if (mode !== 'v2') {
      return NextResponse.json(
        { error: new ShadowTwinLegacyNotAllowedError('Shadow‑Twin legacy/v1 ist nicht erlaubt. Bitte nur v2 verwenden.').message },
        { status: 400 }
      );
    }

    // Lade Library
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId);
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 });
    }

    // Aktualisiere Config
    const updatedConfig = {
      ...library.config,
      shadowTwin: {
        ...library.config?.shadowTwin,
        mode: 'v2' as const,
      },
    };

    // WICHTIG: LibraryService.updateLibrary erwartet die komplette Library (kein Patch).
    // Wir laden oben die Library und schreiben sie hier mit aktualisierter Config zurück.
    // Dadurch ist die Umschaltung atomar auf Library-Ebene und konsistent zum Rest der API.
    const updatedLibrary = { ...library, config: updatedConfig };
    await LibraryService.getInstance().updateLibrary(userEmail, updatedLibrary);

    FileLogger.info('shadow-twin-mode', 'Shadow-Twin-Modus aktualisiert', {
      libraryId,
      userEmail,
      mode: 'v2',
    });

    return NextResponse.json(
      {
        success: true,
        mode: 'v2',
      },
      { status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    FileLogger.error('shadow-twin-mode', 'Fehler bei Modus-Umschaltung', { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/library/[libraryId]/shadow-twin-mode
 * 
 * Liest den aktuellen Shadow-Twin-Modus einer Library.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) {
      return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 });
    }

    const { libraryId } = await params;

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId);
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 });
    }

    const mode = library.config?.shadowTwin?.mode || 'legacy';

    return NextResponse.json({ mode }, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    FileLogger.error('shadow-twin-mode', 'Fehler beim Lesen des Modus', { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

