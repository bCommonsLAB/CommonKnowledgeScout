import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as pathLib from 'path';
import mime from 'mime-types';
import { StorageProvider, StorageItem } from '@/lib/storage/types';
import { Library as LibraryType } from '@/types/library';
import { LibraryService } from '@/lib/services/library-service';
import { auth, currentUser } from '@clerk/nextjs/server';

/**
 * Hilfsfunktion zum Abrufen der Benutzer-E-Mail-Adresse
 * Verwendet den Test-E-Mail-Parameter, falls vorhanden, sonst die authentifizierte E-Mail
 */
async function getUserEmail(request: NextRequest): Promise<string | undefined> {
  const searchParams = request.nextUrl.searchParams;
  const emailParam = searchParams.get('email');
  
  // Wenn ein Email-Parameter übergeben wurde, diesen verwenden (für Tests)
  if (emailParam) {
    console.log(`[API] Verwende Test-E-Mail: ${emailParam}`);
    return emailParam;
  }
  
  // Versuche, authentifizierten Benutzer zu erhalten
  try {
    const { userId } = await auth();
    if (userId) {
      const user = await currentUser();
      if (user && user.emailAddresses && user.emailAddresses.length > 0) {
        const email = user.emailAddresses[0].emailAddress;
        console.log(`[API] Verwende authentifizierte E-Mail: ${email}`);
        return email;
      }
    }
  } catch (error) {
    console.warn('[API] Authentifizierungsdaten konnten nicht abgerufen werden:', error);
  }
  
  console.log('[API] Keine E-Mail-Adresse gefunden');
  return undefined;
}

async function getLibrary(libraryId: string, email: string): Promise<LibraryType | undefined> {
  console.log(`[API] Suche nach Bibliothek mit ID: ${libraryId}`);
  
  // Bibliothek aus MongoDB abrufen
  const libraryService = LibraryService.getInstance();
  const libraries = await libraryService.getUserLibraries(email);
  if (libraries.length === 0) {
    console.log(`[API] Keine Bibliotheken gefunden für ${email}`);
    return undefined;
  }
  const match = libraries.find(lib => lib.id === libraryId && lib.isEnabled);
  if (match) {
    console.log(`[API] Bibliothek gefunden für ${email}, Pfad: "${match.path}", Typ: ${match.type}`);
    return match;
  }
  
  console.log(`[API] Bibliothek mit ID: ${libraryId} nicht gefunden.`);
  return undefined;
}

/**
 * Gibt verfügbare Bibliotheken als Fehlertext zurück, wenn eine Bibliothek nicht gefunden wurde
 */
async function getAvailableLibrariesInfo(email?: string): Promise<string> {
  const libraryService = LibraryService.getInstance();
  const emailsToCheck = email ? [email] : [
    'peter.aichner@crystal-design.com',
    'default@example.com'
  ];
  
  let availableLibraries = '';
  for (const currentEmail of emailsToCheck) {
    const libraries = await libraryService.getUserLibraries(currentEmail);
    const libraryIds = libraries.filter(lib => lib.isEnabled).map(lib => lib.id).join(', ');
    if (libraryIds) {
      availableLibraries += `${currentEmail}: ${libraryIds}; `;
    }
  }
  
  return availableLibraries || 'keine';
}

// Konvertiert eine ID zurück in einen Pfad
function getPathFromId(library: LibraryType, fileId: string): string {
  console.log('[getPathFromId] Input:', { fileId, libraryPath: library.path });
  
  if (fileId === 'root') return library.path;
  
  try {
    const decodedPath = Buffer.from(fileId, 'base64').toString();
    console.log('[getPathFromId] Decoded path:', decodedPath);
    
    // Always treat decoded path as relative path and normalize it
    const normalizedPath = decodedPath.replace(/\\/g, '/');
    
    // Check for path traversal attempts
    if (normalizedPath.includes('..')) {
      console.log('[getPathFromId] Path traversal detected, returning root');
      return library.path;
    }
    
    // Join with base path using pathLib.join to handle separators correctly
    const result = pathLib.join(library.path, normalizedPath);
    
    // Double check the result is within the library path
    const normalizedResult = pathLib.normalize(result).replace(/\\/g, '/');
    const normalizedLibPath = pathLib.normalize(library.path).replace(/\\/g, '/');
    if (!normalizedResult.startsWith(normalizedLibPath)) {
      console.log('[getPathFromId] Path escape detected, returning root');
      return library.path;
    }
    
    console.log('[getPathFromId] Result:', result);
    return result;
  } catch (error) {
    console.error('Error decoding path:', error);
    return library.path;
  }
}

// Konvertiert einen Pfad in eine ID
function getIdFromPath(library: LibraryType, absolutePath: string): string {
  
  if (absolutePath === library.path) return 'root';
  
  // Normalize both paths to use forward slashes
  const normalizedBasePath = pathLib.normalize(library.path).replace(/\\/g, '/');
  const normalizedPath = pathLib.normalize(absolutePath).replace(/\\/g, '/');
  
  // Get relative path by removing base path
  let relativePath = pathLib.relative(normalizedBasePath, normalizedPath)
    .replace(/\\/g, '/') // Normalize to forward slashes
    .replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
  
  // If path tries to go up, return root
  if (relativePath.includes('..')) {
    return 'root';
  }
    
  
  const result = relativePath ? Buffer.from(relativePath).toString('base64') : 'root';
  return result;
}

// Konvertiert Stats in ein StorageItem
async function statsToStorageItem(library: LibraryType, absolutePath: string, stats: Stats): Promise<StorageItem> {
  const id = getIdFromPath(library, absolutePath);
  const parentPath = pathLib.dirname(absolutePath);
  const parentId = parentPath === library.path ? 'root' : getIdFromPath(library, parentPath);

  return {
    id,
    parentId,
    type: stats.isDirectory() ? 'folder' : 'file',
    metadata: {
      name: pathLib.basename(absolutePath),
      size: stats.size,
      mimeType: stats.isFile() ? mime.lookup(absolutePath) || 'application/octet-stream' : 'folder',
      modifiedAt: stats.mtime
    }
  };
}

// Listet Items in einem Verzeichnis
async function listItems(library: LibraryType, fileId: string): Promise<StorageItem[]> {
  console.log(`[API] GET listItems fileId=${fileId}, Bibliothek=${library.id}, Pfad="${library.path}"`);
  
  const absolutePath = getPathFromId(library, fileId);
  console.log(`[API] Absoluter Pfad für Verzeichnisauflistung: "${absolutePath}"`);
  
  try {
    const items = await fs.readdir(absolutePath);
    console.log(`[API] Verzeichnis erfolgreich gelesen, ${items.length} Elemente gefunden`);
    
    const itemPromises = items.map(async (item) => {
      const itemPath = pathLib.join(absolutePath, item);
      try {
        const stats = await fs.stat(itemPath);
        return statsToStorageItem(library, itemPath, stats);
      } catch {
        return null;
      }
    });

    const results = await Promise.all(itemPromises);
    const validResults = results.filter((item): item is StorageItem => item !== null);
    
    console.log(`[API] Response: ${validResults.length} gültige Items zurückgegeben`);
    return validResults;
  } catch (error) {
    console.error(`[API] Fehler beim Lesen des Verzeichnisses "${absolutePath}":`, error);
    throw error;
  }
}

/**
 * Verarbeitet Anfragen, wenn eine Bibliothek nicht gefunden wurde
 */
async function handleLibraryNotFound(libraryId: string, userEmail?: string): Promise<NextResponse> {
  const availableLibraries = await getAvailableLibrariesInfo(userEmail);
  console.error(`[API] Bibliothek mit ID: ${libraryId} nicht gefunden. Verfügbare Bibliotheken: ${availableLibraries}`);
  
  return NextResponse.json({ 
    error: `Bibliothek mit ID: ${libraryId} nicht gefunden`,
    errorCode: 'LIBRARY_NOT_FOUND',
    libraryId: libraryId
  }, { status: 404 });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const fileId = searchParams.get('fileId') || 'root';
  const libraryId = searchParams.get('libraryId') || '';

  console.log(`[API] GET ${action} fileId=${fileId}, libraryId=${libraryId}`);

  // E-Mail aus Authentifizierung oder Parameter ermitteln
  const userEmail = await getUserEmail(request);

  if (!userEmail) {
    return NextResponse.json({ error: 'No user email found' }, { status: 400 });
  }

  const library = await getLibrary(libraryId, userEmail);
  if (!library) {
    return handleLibraryNotFound(libraryId, userEmail);
  }

  try {
    switch (action) {
      case 'list': {
        const items = await listItems(library, fileId);
        return NextResponse.json(items);
      }

      case 'get': {
        const absolutePath = getPathFromId(library, fileId);
        const stats = await fs.stat(absolutePath);
        const item = await statsToStorageItem(library, absolutePath, stats);
        return NextResponse.json(item);
      }

      case 'binary': {
        if (!fileId || fileId === 'root') {
          return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
        }

        const absolutePath = getPathFromId(library, fileId);
        const stats = await fs.stat(absolutePath);
        
        if (!stats.isFile()) {
          return NextResponse.json({ error: 'Not a file' }, { status: 400 });
        }

        const content = await fs.readFile(absolutePath);
        const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
        
        return new NextResponse(content, {
          headers: {
            'Content-Type': mimeType,
            'Content-Length': stats.size.toString(),
            'Cache-Control': 'no-store'
          }
        });
      }

      case 'path': {
        return handleGetPath(library, fileId);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const fileId = searchParams.get('fileId') || 'root';
  const libraryId = searchParams.get('libraryId') || '';

  console.log(`[API] POST ${action} fileId=${fileId}, libraryId=${libraryId}`);

  // E-Mail aus Authentifizierung oder Parameter ermitteln
  const userEmail = await getUserEmail(request);

  if (!userEmail) {
    return NextResponse.json({ error: 'No user email found' }, { status: 400 });
  }

  const library = await getLibrary(libraryId, userEmail);
  if (!library) {
    return handleLibraryNotFound(libraryId, userEmail);
  }

  try {
    switch (action) {
      case 'createFolder': {
        const { name } = await request.json();
        const parentPath = getPathFromId(library, fileId);
        const newFolderPath = pathLib.join(parentPath, name);
        
        await fs.mkdir(newFolderPath, { recursive: true });
        const stats = await fs.stat(newFolderPath);
        const item = await statsToStorageItem(library, newFolderPath, stats);
        
        return NextResponse.json(item);
      }

      case 'upload': {
        console.log('[API] Upload started');
        const formData = await request.formData();
        console.log('[API] FormData received');
        
        const file = formData.get('file');
        console.log('[API] File from FormData:', {
          exists: !!file,
          type: file ? typeof file : 'undefined',
          isFile: file instanceof File,
          name: file instanceof File ? file.name : 'unknown'
        });

        if (!file || !(file instanceof File)) {
          console.error('[API] Invalid file object received');
          return NextResponse.json({ error: 'No valid file provided' }, { status: 400 });
        }

        try {
          const parentPath = getPathFromId(library, fileId);
          console.log('[API] Parent path resolved:', parentPath);
          
          const filePath = pathLib.join(parentPath, file.name);
          console.log('[API] Target file path:', filePath);

          const arrayBuffer = await file.arrayBuffer();
          console.log('[API] File buffer created, size:', arrayBuffer.byteLength);
          
          const buffer = Buffer.from(arrayBuffer);
          await fs.writeFile(filePath, buffer);
          console.log('[API] File written to disk');

          const stats = await fs.stat(filePath);
          console.log('[API] File stats retrieved');
          
          const item = await statsToStorageItem(library, filePath, stats);
          console.log('[API] StorageItem created');
          
          return NextResponse.json(item);
        } catch (error) {
          console.error('[API] Upload processing error:', error);
          throw error; // Re-throw to be caught by the outer try-catch
        }
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fileId = searchParams.get('fileId');
  const libraryId = searchParams.get('libraryId') || '';

  console.log(`[API] DELETE fileId=${fileId}, libraryId=${libraryId}`);

  if (!fileId || fileId === 'root') {
    return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
  }

  // E-Mail aus Authentifizierung oder Parameter ermitteln
  const userEmail = await getUserEmail(request);

  if (!userEmail) {
    return NextResponse.json({ error: 'No user email found' }, { status: 400 });
  }

  const library = await getLibrary(libraryId, userEmail);
  if (!library) {
    return handleLibraryNotFound(libraryId, userEmail);
  }

  try {
    const absolutePath = getPathFromId(library, fileId);
    const stats = await fs.stat(absolutePath);
    
    if (stats.isDirectory()) {
      await fs.rm(absolutePath, { recursive: true });
    } else {
      await fs.unlink(absolutePath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fileId = searchParams.get('fileId');
  const newParentId = searchParams.get('newParentId');
  const libraryId = searchParams.get('libraryId') || '';

  console.log(`[API] PATCH fileId=${fileId}, newParentId=${newParentId}, libraryId=${libraryId}`);

  if (!fileId || !newParentId || fileId === 'root') {
    return NextResponse.json({ error: 'Invalid file or parent ID' }, { status: 400 });
  }

  // E-Mail aus Authentifizierung oder Parameter ermitteln
  const userEmail = await getUserEmail(request);

  if (!userEmail) {
    return NextResponse.json({ error: 'No user email found' }, { status: 400 });
  }

  const library = await getLibrary(libraryId, userEmail);
  if (!library) {
    return handleLibraryNotFound(libraryId, userEmail);
  }

  try {
    const sourcePath = getPathFromId(library, fileId);
    const targetParentPath = getPathFromId(library, newParentId);
    const fileName = pathLib.basename(sourcePath);
    const targetPath = pathLib.join(targetParentPath, fileName);

    await fs.rename(sourcePath, targetPath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

async function handleGetPath(library: LibraryType, fileId: string): Promise<Response> {
  try {
    console.log('[API] GET path fileId=', fileId);
    const absolutePath = getPathFromId(library, fileId);
    
    // Konvertiere absoluten Pfad zu relativem Pfad
    const relativePath = pathLib.relative(library.path, absolutePath)
      .replace(/\\/g, '/') // Normalisiere zu Forward Slashes
      .replace(/^\/+|\/+$/g, ''); // Entferne führende/nachfolgende Slashes
    
    const displayPath = relativePath || '/';
    console.log('[API] Path resolved:', displayPath);
    
    return new Response(displayPath);
  } catch (error) {
    console.error('[API] Error getting path:', error);
    return new Response('Failed to get path', { status: 500 });
  }
} 