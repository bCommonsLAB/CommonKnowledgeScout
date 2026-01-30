import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { StorageFactory } from '@/lib/storage/storage-factory';
import { LibraryService } from '@/lib/services/library-service';
import { getSelfBaseUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Generische Storage API Route
 * Leitet Anfragen basierend auf dem Bibliothekstyp an den richtigen Provider weiter
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const fileId = searchParams.get('fileId');
  const libraryId = searchParams.get('libraryId');

  // Validiere erforderliche Parameter
  if (!libraryId) {
    return NextResponse.json({ error: 'libraryId is required' }, { status: 400 });
  }

  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
  }

  try {
    // Benutzerauthentifizierung
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    // Benutzer-E-Mail abrufen
    const user = await currentUser();
    if (!user?.emailAddresses?.length) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 });
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    // Bibliotheken des Benutzers laden
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(userEmail);
    const clientLibraries = libraryService.toClientLibraries(libraries);
    
    // Storage Factory initialisieren
    const storageFactory = StorageFactory.getInstance();
    storageFactory.setLibraries(clientLibraries);
    
    // Im Server-Kontext: Setze die Basis-URL für API-Aufrufe
    // Verwende getSelfBaseUrl() für korrekte URL in Docker/Reverse-Proxy-Umgebungen
    const baseUrl = getSelfBaseUrl();
    storageFactory.setApiBaseUrl(baseUrl);
    storageFactory.setUserEmail(userEmail);
    
    // Provider für die Bibliothek abrufen
    const provider = await storageFactory.getProvider(libraryId);

    switch (action) {
      case 'list': {
        const items = await provider.listItemsById(fileId);
        return NextResponse.json(items);
      }

      case 'get': {
        try {
          const item = await provider.getItemById(fileId);
          return NextResponse.json(item);
        } catch (error) {
          console.error('[Storage API] Fehler beim Laden des Items', {
            fileId,
            libraryId,
            error: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : undefined,
            errorStack: error instanceof Error ? error.stack : undefined
          });
          return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Fehler beim Laden des Items',
            fileId,
            libraryId
          }, { status: 500 });
        }
      }

      case 'binary': {
        const { blob, mimeType } = await provider.getBinary(fileId);
        const buffer = await blob.arrayBuffer();
        
        // Headers für die Response
        const headers: HeadersInit = {
          'Content-Type': mimeType,
          'Content-Length': blob.size.toString(),
          'Cache-Control': 'no-store'
        };
        
        // Für PDFs: Content-Disposition auf inline setzen, damit sie im Browser
        // angezeigt werden statt heruntergeladen zu werden
        // WICHTIG: Dies behebt das Problem bei OneDrive, wo die direkte Microsoft-URL
        // standardmäßig einen Download auslöst
        if (mimeType === 'application/pdf') {
          // Versuche den Dateinamen zu ermitteln für einen sauberen Dateinamen-Header
          try {
            const item = await provider.getItemById(fileId);
            const filename = item?.metadata?.name || 'document.pdf';
            // RFC 5987-konforme Kodierung für Dateinamen mit Sonderzeichen
            const encodedFilename = encodeURIComponent(filename).replace(/'/g, "%27");
            headers['Content-Disposition'] = `inline; filename="${filename}"; filename*=UTF-8''${encodedFilename}`;
          } catch {
            // Fallback: Einfacher inline-Header ohne Dateiname
            headers['Content-Disposition'] = 'inline';
          }
        }
        
        return new NextResponse(buffer, { headers });
      }

      case 'path': {
        const path = await provider.getPathById(fileId);
        return new NextResponse(path);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Storage API] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const fileId = searchParams.get('fileId') || 'root';
  const libraryId = searchParams.get('libraryId');

  if (!libraryId) {
    return NextResponse.json({ error: 'libraryId is required' }, { status: 400 });
  }

  try {
    // Benutzerauthentifizierung
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    // Benutzer-E-Mail abrufen
    const user = await currentUser();
    if (!user?.emailAddresses?.length) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 });
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    // Bibliotheken des Benutzers laden
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(userEmail);
    const clientLibraries = libraryService.toClientLibraries(libraries);
    
    // Storage Factory initialisieren
    const storageFactory = StorageFactory.getInstance();
    storageFactory.setLibraries(clientLibraries);
    
    // Im Server-Kontext: Setze die Basis-URL für API-Aufrufe
    // Verwende getSelfBaseUrl() für korrekte URL in Docker/Reverse-Proxy-Umgebungen
    const baseUrl = getSelfBaseUrl();
    storageFactory.setApiBaseUrl(baseUrl);
    storageFactory.setUserEmail(userEmail);
    
    // Provider für die Bibliothek abrufen
    const provider = await storageFactory.getProvider(libraryId);

    switch (action) {
      case 'createFolder': {
        const { name } = await request.json();
        const item = await provider.createFolder(fileId, name);
        return NextResponse.json(item);
      }

      case 'upload': {
        const formData = await request.formData();
        const file = formData.get('file');
        
        if (!file || !(file instanceof File)) {
          return NextResponse.json({ error: 'No valid file provided' }, { status: 400 });
        }

        const item = await provider.uploadFile(fileId, file);
        return NextResponse.json(item);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Storage API] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fileId = searchParams.get('fileId');
  const libraryId = searchParams.get('libraryId');

  if (!libraryId || !fileId) {
    return NextResponse.json({ error: 'libraryId and fileId are required' }, { status: 400 });
  }

  try {
    // Benutzerauthentifizierung
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    // Benutzer-E-Mail abrufen
    const user = await currentUser();
    if (!user?.emailAddresses?.length) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 });
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    // Bibliotheken des Benutzers laden
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(userEmail);
    const clientLibraries = libraryService.toClientLibraries(libraries);
    
    // Storage Factory initialisieren
    const storageFactory = StorageFactory.getInstance();
    storageFactory.setLibraries(clientLibraries);
    
    // Im Server-Kontext: Setze die Basis-URL für API-Aufrufe
    // Verwende getSelfBaseUrl() für korrekte URL in Docker/Reverse-Proxy-Umgebungen
    const baseUrl = getSelfBaseUrl();
    storageFactory.setApiBaseUrl(baseUrl);
    storageFactory.setUserEmail(userEmail);
    
    // Provider für die Bibliothek abrufen
    const provider = await storageFactory.getProvider(libraryId);

    // Prüfe ob es sich um ein Buch handelt (PDF-Datei) und lösche Azure-Bilder
    try {
      const item = await provider.getItemById(fileId)
      if (item && item.type === 'file' && item.metadata.mimeType === 'application/pdf') {
        // Prüfe ob Azure Storage konfiguriert ist
        const { getAzureStorageConfig } = await import('@/lib/config/azure-storage')
        const azureConfig = getAzureStorageConfig()
        if (azureConfig) {
          const { AzureStorageService } = await import('@/lib/services/azure-storage-service')
          const azureStorage = new AzureStorageService()
          if (azureStorage.isConfigured()) {
            try {
              await azureStorage.deleteImagesForOwner(
                azureConfig.containerName,
                libraryId,
                'books',
                fileId
              )
              console.log('[Storage API] Azure-Bilder für Buch gelöscht', { fileId, libraryId })
            } catch (azureError) {
              // Fehler beim Löschen der Azure-Bilder: Loggen, aber nicht abbrechen
              console.warn('[Storage API] Fehler beim Löschen der Azure-Bilder', {
                fileId,
                libraryId,
                error: azureError instanceof Error ? azureError.message : String(azureError),
              })
            }
          }
        }
      }
    } catch (checkError) {
      // Fehler beim Prüfen: Loggen, aber nicht abbrechen (Item könnte bereits gelöscht sein)
      console.warn('[Storage API] Fehler beim Prüfen des Items für Azure-Bild-Löschung', {
        fileId,
        libraryId,
        error: checkError instanceof Error ? checkError.message : String(checkError),
      })
    }

    await provider.deleteItem(fileId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Storage API] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fileId = searchParams.get('fileId');
  const newParentId = searchParams.get('newParentId');
  const libraryId = searchParams.get('libraryId');

  if (!libraryId || !fileId || !newParentId) {
    return NextResponse.json({ error: 'libraryId, fileId and newParentId are required' }, { status: 400 });
  }

  try {
    // Benutzerauthentifizierung
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    // Benutzer-E-Mail abrufen
    const user = await currentUser();
    if (!user?.emailAddresses?.length) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 });
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    // Bibliotheken des Benutzers laden
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(userEmail);
    const clientLibraries = libraryService.toClientLibraries(libraries);
    
    // Storage Factory initialisieren
    const storageFactory = StorageFactory.getInstance();
    storageFactory.setLibraries(clientLibraries);
    
    // Im Server-Kontext: Setze die Basis-URL für API-Aufrufe
    // Verwende getSelfBaseUrl() für korrekte URL in Docker/Reverse-Proxy-Umgebungen
    const baseUrl = getSelfBaseUrl();
    storageFactory.setApiBaseUrl(baseUrl);
    storageFactory.setUserEmail(userEmail);
    
    // Provider für die Bibliothek abrufen
    const provider = await storageFactory.getProvider(libraryId);

    await provider.moveItem(fileId, newParentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Storage API] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 