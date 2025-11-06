import { NextResponse } from 'next/server';
import { LibraryService } from '@/lib/services/library-service';

/**
 * GET /api/public/libraries
 * Liefert alle öffentlichen Libraries (ohne Authentifizierung)
 */
export async function GET() {
  try {
    const libraryService = LibraryService.getInstance();
    const publicLibraries = await libraryService.getAllPublicLibraries();

    console.log('[API] /api/public/libraries - Gefundene öffentliche Libraries:', publicLibraries.length);

    // Nur sichere Daten zurückgeben (ohne API-Keys, Secrets, etc.)
    const safeLibraries = publicLibraries.map(lib => {
      const safeLib = {
        id: lib.id,
        label: lib.config?.publicPublishing?.publicName || lib.label,
        slugName: lib.config?.publicPublishing?.slugName,
        description: lib.config?.publicPublishing?.description,
        icon: lib.config?.publicPublishing?.icon,
      };
      console.log('[API] /api/public/libraries - Safe Library:', safeLib);
      return safeLib;
    });

    return NextResponse.json({ libraries: safeLibraries });
  } catch (error) {
    console.error('[API] Fehler beim Abrufen der öffentlichen Libraries:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der öffentlichen Libraries' },
      { status: 500 }
    );
  }
}

