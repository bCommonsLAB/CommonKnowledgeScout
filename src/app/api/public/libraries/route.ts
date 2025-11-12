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

    // Nur sichere Daten zurückgeben (ohne API-Keys, Secrets, etc.)
    const safeLibraries = publicLibraries.map(lib => ({
      id: lib.id,
      label: lib.config?.publicPublishing?.publicName || lib.label,
      slugName: lib.config?.publicPublishing?.slugName,
      description: lib.config?.publicPublishing?.description,
      icon: lib.config?.publicPublishing?.icon,
      backgroundImageUrl: lib.config?.publicPublishing?.backgroundImageUrl,
      // Vollständige Chat-Config zurückgeben (inkl. detailViewType und alle anderen Settings)
      chat: lib.config?.chat,
    }));

    return NextResponse.json({ libraries: safeLibraries });
  } catch (error) {
    console.error('[API] Fehler beim Abrufen der öffentlichen Libraries:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der öffentlichen Libraries' },
      { status: 500 }
    );
  }
}

