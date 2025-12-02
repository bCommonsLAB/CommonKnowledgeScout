import { NextRequest, NextResponse } from 'next/server';
import { LibraryService } from '@/lib/services/library-service';

/**
 * Next.js Route Segment Config für Caching
 * Cache die Antwort für 60 Sekunden (revalidate)
 * Dies reduziert die Datenbanklast erheblich für öffentliche Libraries
 */
export const revalidate = 60; // Cache für 60 Sekunden

/**
 * GET /api/public/libraries/[slug]
 * Liefert Library-Details nach Slug (ohne Authentifizierung)
 * 
 * PERFORMANCE: Diese Route wird gecacht (60 Sekunden), um häufige Requests zu vermeiden
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug-Name fehlt' },
        { status: 400 }
      );
    }

    const libraryService = LibraryService.getInstance();
    const library = await libraryService.getPublicLibraryBySlug(slug);

    if (!library) {
      return NextResponse.json(
        { error: 'Library nicht gefunden' },
        { status: 404 }
      );
    }

    // Prüfe ob Library wirklich öffentlich ist
    if (library.config?.publicPublishing?.isPublic !== true) {
      return NextResponse.json(
        { error: 'Library nicht öffentlich verfügbar' },
        { status: 403 }
      );
    }

    // Nur sichere Daten zurückgeben
    const safeLibrary = {
      id: library.id,
      label: library.config?.publicPublishing?.publicName || library.label,
      slugName: library.config?.publicPublishing?.slugName,
      description: library.config?.publicPublishing?.description,
      icon: library.config?.publicPublishing?.icon,
      requiresAuth: library.config?.publicPublishing?.requiresAuth === true,
      // Chat-Config ist bereits öffentlich sicher (keine Secrets)
      chat: library.config?.chat,
    };

    return NextResponse.json({ library: safeLibrary });
  } catch (error) {
    console.error('[API] Fehler beim Abrufen der öffentlichen Library:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Library' },
      { status: 500 }
    );
  }
}

