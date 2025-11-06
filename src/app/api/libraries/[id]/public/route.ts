import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { LibraryService } from '@/lib/services/library-service';

/**
 * PUT /api/libraries/[id]/public
 * Aktualisiert Public-Settings einer Library (Auth erforderlich)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: libraryId } = await params;

    // Authentifizierung prüfen
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    const user = await currentUser();
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json(
        { error: 'Keine E-Mail-Adresse gefunden' },
        { status: 401 }
      );
    }

    const userEmail = user.emailAddresses[0].emailAddress;

    // Request Body parsen
    const body = await request.json().catch(() => ({}));
    const { slugName, publicName, description, icon, apiKey, isPublic, gallery } = body;

    // Validierung
    if (isPublic === true) {
      if (!slugName || slugName.length < 3) {
        return NextResponse.json(
          { error: 'Slug-Name ist erforderlich und muss mindestens 3 Zeichen lang sein' },
          { status: 400 }
        );
      }

      if (!/^[a-z0-9-]+$/.test(slugName)) {
        return NextResponse.json(
          { error: 'Slug-Name darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten' },
          { status: 400 }
        );
      }

      if (!publicName || publicName.length < 3) {
        return NextResponse.json(
          { error: 'Öffentlicher Name ist erforderlich und muss mindestens 3 Zeichen lang sein' },
          { status: 400 }
        );
      }

      if (!description || description.length < 10) {
        return NextResponse.json(
          { error: 'Beschreibung ist erforderlich und muss mindestens 10 Zeichen lang sein' },
          { status: 400 }
        );
      }
    }

    const libraryService = LibraryService.getInstance();

    // Prüfe Slug-Eindeutigkeit (wenn öffentlich und Slug geändert wurde)
    if (isPublic === true && slugName) {
      const existingLibrary = await libraryService.getPublicLibraryBySlug(slugName);
      if (existingLibrary && existingLibrary.id !== libraryId) {
        return NextResponse.json(
          { error: 'Dieser Slug-Name ist bereits vergeben' },
          { status: 409 }
        );
      }
    }

    // Library laden
    const library = await libraryService.getLibrary(userEmail, libraryId);
    if (!library) {
      return NextResponse.json(
        { error: 'Library nicht gefunden' },
        { status: 404 }
      );
    }

    console.log('[API] Library vor Update:', {
      id: library.id,
      hasConfig: !!library.config,
      configKeys: library.config ? Object.keys(library.config) : [],
      hasPublicPublishing: !!library.config?.publicPublishing
    });

    // Public-Publishing-Config aktualisieren
    // WICHTIG: Mergen der gesamten config-Struktur, nicht überschreiben
    const updatedLibrary = {
      ...library,
      config: {
        ...library.config,
        publicPublishing: {
          slugName: slugName || library.config?.publicPublishing?.slugName || '',
          publicName: publicName || library.config?.publicPublishing?.publicName || library.label,
          description: description || library.config?.publicPublishing?.description || '',
          icon: icon !== undefined ? (icon === 'none' ? undefined : icon) : library.config?.publicPublishing?.icon,
          // API-Key nur aktualisieren wenn gesetzt und nicht maskiert
          // Wenn undefined, behalte den alten Wert
          apiKey: apiKey !== undefined && apiKey !== '' && !apiKey.includes('...') && !apiKey.includes('••••') && (apiKey.match(/\./g)?.length || 0) < 10
            ? apiKey 
            : library.config?.publicPublishing?.apiKey,
          isPublic: isPublic !== undefined ? isPublic : false,
          // Gallery-Texte mergen (nur wenn vorhanden)
          gallery: gallery ? {
            headline: gallery.headline !== undefined ? gallery.headline : library.config?.publicPublishing?.gallery?.headline,
            subtitle: gallery.subtitle !== undefined ? gallery.subtitle : library.config?.publicPublishing?.gallery?.subtitle,
            description: gallery.description !== undefined ? gallery.description : library.config?.publicPublishing?.gallery?.description,
            filterDescription: gallery.filterDescription !== undefined ? gallery.filterDescription : library.config?.publicPublishing?.gallery?.filterDescription,
          } : library.config?.publicPublishing?.gallery,
        },
      },
    };

    console.log('[API] Library nach Update-Vorbereitung:', {
      id: updatedLibrary.id,
      hasConfig: !!updatedLibrary.config,
      configKeys: updatedLibrary.config ? Object.keys(updatedLibrary.config) : [],
      hasPublicPublishing: !!updatedLibrary.config?.publicPublishing,
      publicPublishing: updatedLibrary.config?.publicPublishing
    });

    // Library speichern
    const success = await libraryService.updateLibrary(userEmail, updatedLibrary);

    if (!success) {
      return NextResponse.json(
        { error: 'Fehler beim Aktualisieren der Library' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Public-Settings erfolgreich aktualisiert',
    });
  } catch (error) {
    console.error('[API] Fehler beim Aktualisieren der Public-Settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}
