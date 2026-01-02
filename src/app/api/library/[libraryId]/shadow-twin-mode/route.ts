/**
 * @fileoverview API-Route für Shadow-Twin-Modus-Umschaltung
 * 
 * @description
 * Serverseitige Route zum Umschalten des Shadow-Twin-Modus einer Library (legacy ↔ v2).
 * 
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import { LibraryService } from '@/lib/services/library-service';
import { convertLibrary } from '@/lib/shadow-twin/conversion-job';

/**
 * POST /api/library/[libraryId]/shadow-twin-mode
 * 
 * Setzt den Shadow-Twin-Modus einer Library.
 * 
 * Body:
 * - mode: 'legacy' | 'v2'
 * - startConversion?: boolean (optional: Startet Konvertierungs-Job wenn true)
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
    const body = await request.json() as { mode?: 'legacy' | 'v2'; startConversion?: boolean };

    if (!body.mode || (body.mode !== 'legacy' && body.mode !== 'v2')) {
      return NextResponse.json(
        { error: 'mode muss "legacy" oder "v2" sein' },
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
        mode: body.mode,
      },
    };

    await LibraryService.getInstance().updateLibrary(userEmail, libraryId, {
      config: updatedConfig,
    });

    FileLogger.info('shadow-twin-mode', 'Shadow-Twin-Modus aktualisiert', {
      libraryId,
      userEmail,
      mode: body.mode,
    });

    // Optional: Starte Konvertierungs-Job
    let conversionResult: { converted: number; errors: number } | undefined;
    if (body.startConversion && body.mode === 'v2') {
      try {
        conversionResult = await convertLibrary(userEmail, libraryId);
        FileLogger.info('shadow-twin-mode', 'Konvertierungs-Job abgeschlossen', {
          libraryId,
          converted: conversionResult.converted,
          errors: conversionResult.errors,
        });
      } catch (error) {
        FileLogger.error('shadow-twin-mode', 'Fehler bei Konvertierungs-Job', {
          libraryId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Fehler nicht weiterwerfen - Modus wurde bereits gesetzt
      }
    }

    return NextResponse.json(
      {
        success: true,
        mode: body.mode,
        conversion: conversionResult,
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

