import { NextRequest, NextResponse } from 'next/server';
import { LibraryService } from '@/lib/services/library-service';
import { shouldShowOnHomepage } from '@/lib/public-publishing';
import { explorerGate } from '@ks/module-explorer'

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
export async function GET(request: NextRequest) {
  // Site-Gate (Modul-Landkarte §3): Ist `explorer` fuer diese Site
  // nicht aktiv, antwortet die Route mit 404.
  const gated = explorerGate(request)
  if (gated) return gated

  try {
    // Während des Builds leere Liste zurückgeben (MongoDB ist nicht verfügbar)
    if (process.env.NEXT_RUNTIME === 'build') {
      return NextResponse.json({ libraries: [] });
    }

    const libraryService = LibraryService.getInstance();
    const publicLibraries = await libraryService.getAllPublicLibraries();

    // Backwards-Compatibility: Wenn showOnHomepage fehlt, behandeln wir es als true.
    // So bleiben bestehende Libraries weiterhin auf der Homepage sichtbar, bis das Flag explizit deaktiviert wird.
    const homepageLibraries = publicLibraries.filter(lib =>
      shouldShowOnHomepage(lib.config?.publicPublishing?.showOnHomepage)
    );

    // Nur sichere Daten zurückgeben (ohne API-Keys, Secrets, etc.)
    const safeLibraries = homepageLibraries.map(lib => {
      const pub = lib.config?.publicPublishing
      return {
        id: lib.id,
        label: pub?.publicName || lib.label,
        slugName: pub?.slugName,
        description: pub?.description,
        icon: pub?.icon,
        backgroundImageUrl: pub?.backgroundImageUrl,
        logoUrl: pub?.logoUrl,
        requiresAuth: pub?.requiresAuth === true,
        chat: lib.config?.chat,
      }
    });

    return NextResponse.json({ libraries: safeLibraries });
  } catch (error) {
    console.error('[API] Fehler beim Abrufen der öffentlichen Libraries:', error);
    // Während des Builds keine Fehler werfen, sondern leere Liste zurückgeben
    if (process.env.NEXT_RUNTIME === 'build') {
      return NextResponse.json({ libraries: [] });
    }
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der öffentlichen Libraries' },
      { status: 500 }
    );
  }
}

