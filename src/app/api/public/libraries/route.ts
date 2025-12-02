import { NextResponse } from 'next/server';
import { LibraryService } from '@/lib/services/library-service';

/**
 * Next.js Route Segment Config für Caching
 * Cache die Antwort für 60 Sekunden (revalidate)
 * Dies reduziert die Datenbanklast erheblich für öffentliche Libraries
 * 
 * HINWEIS: Bei Änderungen an requiresAuth kann der Cache verhindern, dass
 * Änderungen sofort sichtbar werden. In diesem Fall Seite neu laden oder
 * Cache manuell invalidieren.
 */
// Temporär auf 0 gesetzt für Debugging - später wieder auf 60 setzen
export const revalidate = 0; // Cache für 0 Sekunden (temporär für Debugging)

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
      requiresAuth: lib.config?.publicPublishing?.requiresAuth === true,
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

