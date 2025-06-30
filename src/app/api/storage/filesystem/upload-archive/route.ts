import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/lib/storage/storage-service';
import { LibraryService } from '@/lib/services/library-service';
import { auth } from '@clerk/nextjs/server';

/**
 * POST /api/storage/filesystem/upload-archive
 * Lädt Archive-Dateien in das FileSystem hoch
 */
export async function POST(request: NextRequest) {
  try {
    // Authentifizierung prüfen
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    // FormData auslesen
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const targetPath = formData.get('targetPath') as string;
    const libraryId = formData.get('libraryId') as string;

    if (!file || !targetPath || !libraryId) {
      return NextResponse.json(
        { error: 'Fehlende Parameter: file, targetPath und libraryId sind erforderlich' },
        { status: 400 }
      );
    }

    // Library-Service initialisieren
    const libraryService = LibraryService.getInstance();
    
    // User-Email aus Clerk-User extrahieren
    const userEmail = 'default@example.com'; // TODO: Clerk User-Email implementieren wenn verfügbar
    
    // Library abrufen
    const library = await libraryService.getLibrary(userEmail, libraryId);
    if (!library) {
      return NextResponse.json(
        { error: 'Library nicht gefunden oder nicht berechtigt' },
        { status: 404 }
      );
    }

    // Storage-Provider abrufen
    const storageService = StorageService.getInstance();
    const provider = storageService.getProvider('filesystem');

    // Verzeichnisstruktur aus targetPath erstellen
    const pathParts = targetPath.split('/');
    const filename = pathParts.pop() || file.name;
    
    // Ordner-Hierarchie erstellen
    let currentFolderId = 'root';
    for (const folderName of pathParts) {
      if (folderName.trim()) {
        try {
          // Prüfen ob Ordner bereits existiert
          const items = await provider.listItemsById(currentFolderId);
          const existingFolder = items.find(item => 
            item.type === 'folder' && 
            item.metadata.name === folderName
          );
          
          if (existingFolder) {
            currentFolderId = existingFolder.id;
          } else {
            // Neuen Ordner erstellen
            const newFolder = await provider.createFolder(currentFolderId, folderName);
            currentFolderId = newFolder.id;
          }
        } catch (error) {
          console.error(`Fehler beim Erstellen/Finden des Ordners ${folderName}:`, error);
          return NextResponse.json(
            { error: `Fehler beim Erstellen der Ordnerstruktur: ${folderName}` },
            { status: 500 }
          );
        }
      }
    }

    // Datei hochladen
    const uploadedItem = await provider.uploadFile(currentFolderId, new File([file], filename, {
      type: file.type || 'application/octet-stream'
    }));

    return NextResponse.json({
      status: 'success',
      data: {
        uploadedFile: uploadedItem,
        targetPath,
        libraryId
      }
    });

  } catch (error) {
    console.error('Fehler beim Archive-Upload:', error);
    return NextResponse.json(
      { 
        error: `Fehler beim Hochladen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}` 
      },
      { status: 500 }
    );
  }
} 