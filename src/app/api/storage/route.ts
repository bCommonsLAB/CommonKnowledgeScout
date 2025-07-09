import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth/server';
import { StorageFactory } from '@/lib/storage/storage-factory';
import { LibraryService } from '@/lib/services/library-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Hilfsfunktion zum Abrufen von Auth-Informationen und Bibliotheken
 */
async function getAuthAndLibraries(request: NextRequest) {
  // Authentifizierung prüfen mit neuer Abstraktionsschicht
  const authResult = await getServerAuth(request);
  
  if (!authResult.userId || !authResult.user) {
    throw new Error('Nicht authentifiziert');
  }

  const userEmail = authResult.user.email;
  
  // Bibliotheken des Benutzers laden
  const libraryService = LibraryService.getInstance();
  const libraries = await libraryService.getUserLibraries(userEmail);
  const clientLibraries = libraryService.toClientLibraries(libraries);
  
  return {
    userEmail,
    libraries: clientLibraries,
    authResult
  };
}

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
    // Auth und Bibliotheken abrufen
    const { libraries } = await getAuthAndLibraries(request);
    
    // Storage Factory initialisieren
    const storageFactory = StorageFactory.getInstance();
    storageFactory.setLibraries(libraries);
    
    // Provider für die Bibliothek abrufen
    const provider = await storageFactory.getProvider(libraryId);

    switch (action) {
      case 'list': {
        const items = await provider.listItemsById(fileId);
        return NextResponse.json(items);
      }

      case 'get': {
        const item = await provider.getItemById(fileId);
        return NextResponse.json(item);
      }

      case 'binary': {
        const { blob, mimeType } = await provider.getBinary(fileId);
        const buffer = await blob.arrayBuffer();
        
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': mimeType,
            'Content-Length': blob.size.toString(),
            'Cache-Control': 'no-store'
          }
        });
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
    
    // Spezielle Behandlung für Auth-Fehler
    if (error instanceof Error && error.message === 'Nicht authentifiziert') {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }
    
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
    // Auth und Bibliotheken abrufen
    const { libraries } = await getAuthAndLibraries(request);
    
    // Storage Factory initialisieren
    const storageFactory = StorageFactory.getInstance();
    storageFactory.setLibraries(libraries);
    
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
    
    // Spezielle Behandlung für Auth-Fehler
    if (error instanceof Error && error.message === 'Nicht authentifiziert') {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }
    
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
    // Auth und Bibliotheken abrufen
    const { libraries } = await getAuthAndLibraries(request);
    
    // Storage Factory initialisieren
    const storageFactory = StorageFactory.getInstance();
    storageFactory.setLibraries(libraries);
    
    // Provider für die Bibliothek abrufen
    const provider = await storageFactory.getProvider(libraryId);

    await provider.deleteItem(fileId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Storage API] Error:', error);
    
    // Spezielle Behandlung für Auth-Fehler
    if (error instanceof Error && error.message === 'Nicht authentifiziert') {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }
    
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
    // Auth und Bibliotheken abrufen
    const { libraries } = await getAuthAndLibraries(request);
    
    // Storage Factory initialisieren
    const storageFactory = StorageFactory.getInstance();
    storageFactory.setLibraries(libraries);
    
    // Provider für die Bibliothek abrufen
    const provider = await storageFactory.getProvider(libraryId);

    await provider.moveItem(fileId, newParentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Storage API] Error:', error);
    
    // Spezielle Behandlung für Auth-Fehler
    if (error instanceof Error && error.message === 'Nicht authentifiziert') {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 