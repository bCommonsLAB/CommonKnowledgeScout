import { NextResponse } from 'next/server';
import { LibraryService } from '@/lib/services/library-service';

/**
 * Next.js Route Segment Config für Caching
 * Cache die Antwort für 60 Sekunden (revalidate)
 * Dies reduziert die Datenbanklast erheblich für öffentliche Libraries
 */
export const revalidate = 60; // Cache für 60 Sekunden

/**
 * GET /api/public/libraries
 * Liefert alle öffentlichen Libraries (ohne Authentifizierung)
 * 
 * PERFORMANCE-OPTIMIERUNGEN:
 * - MongoDB-Indizes für publicPublishing-Felder (automatisch erstellt)
 * - Next.js Route Segment Caching (60 Sekunden)
 * - Optimierte Aggregation-Pipeline statt alle Einträge zu laden
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

