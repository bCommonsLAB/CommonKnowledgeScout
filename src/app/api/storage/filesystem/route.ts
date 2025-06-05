import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as pathLib from 'path';
import mime from 'mime-types';
import { StorageItem } from '@/lib/storage/types';
import { Library as LibraryType } from '@/types/library';
import { LibraryService } from '@/lib/services/library-service';
import { auth, currentUser } from '@clerk/nextjs/server';

// Force dynamic rendering - verhindert Caching
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Debug-Zeitstempel für jeden Request
const REQUEST_ID = () => `REQ_${Date.now()}_${Math.random().toString(36).substring(7)}`;

/**
 * Hilfsfunktion zum Abrufen der Benutzer-E-Mail-Adresse
 * Verwendet den Test-E-Mail-Parameter, falls vorhanden, sonst die authentifizierte E-Mail
 */
async function getUserEmail(request: NextRequest): Promise<string | undefined> {
  const searchParams = request.nextUrl.searchParams;
  const emailParam = searchParams.get('email');
  
  console.log('[API][getUserEmail] Suche nach E-Mail:', {
    hasEmailParam: !!emailParam,
    emailParam,
    url: request.url
  });
  
  // Wenn ein Email-Parameter übergeben wurde, diesen verwenden (für Tests)
  if (emailParam) {
    console.log(`[API][getUserEmail] Verwende Test-E-Mail: ${emailParam}`);
    return emailParam;
  }
  
  // Versuche, authentifizierten Benutzer zu erhalten
  try {
    const { userId } = await auth();
    console.log('[API][getUserEmail] Auth Ergebnis:', { userId });
    
    if (userId) {
      const user = await currentUser();
      const emailAddresses = user?.emailAddresses || [];
      console.log('[API][getUserEmail] User gefunden:', {
        hasUser: !!user,
        hasEmailAddresses: emailAddresses.length > 0,
        emailCount: emailAddresses.length
      });
      
      if (user && emailAddresses.length > 0) {
        const email = emailAddresses[0].emailAddress;
        console.log(`[API][getUserEmail] Verwende authentifizierte E-Mail: ${email}`);
        return email;
      }
    }
  } catch (error) {
    console.warn('[API][getUserEmail] Authentifizierungsdaten konnten nicht abgerufen werden:', error);
  }
  
  console.log('[API][getUserEmail] Keine E-Mail-Adresse gefunden');
  return undefined;
}

async function getLibrary(libraryId: string, email: string): Promise<LibraryType | undefined> {
  console.log(`[API][getLibrary] Suche nach Bibliothek:`, {
    libraryId,
    email,
    timestamp: new Date().toISOString()
  });
  
  // Bibliothek aus MongoDB abrufen
  const libraryService = LibraryService.getInstance();
  const libraries = await libraryService.getUserLibraries(email);
  
  console.log(`[API][getLibrary] Gefundene Bibliotheken:`, {
    count: libraries.length,
    libraries: libraries.map(lib => ({
      id: lib.id,
      label: lib.label,
      isEnabled: lib.isEnabled
    }))
  });
  
  if (libraries.length === 0) {
    console.log(`[API][getLibrary] Keine Bibliotheken gefunden für ${email}`);
    return undefined;
  }
  
  const match = libraries.find(lib => lib.id === libraryId && lib.isEnabled);
  if (match) {
    console.log(`[API][getLibrary] Bibliothek gefunden:`, {
      id: match.id,
      label: match.label,
      path: match.path,
      type: match.type,
      isEnabled: match.isEnabled
    });
    return match;
  }
  
  console.log(`[API][getLibrary] Bibliothek nicht gefunden:`, {
    libraryId,
    email,
    availableIds: libraries.map(lib => lib.id)
  });
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
  const relativePath = pathLib.relative(normalizedBasePath, normalizedPath)
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
  // TEST: Sofortige Response um zu sehen ob die Route überhaupt erreicht wird
  const testParam = request.nextUrl.searchParams.get('test');
  if (testParam === 'ping') {
    return new NextResponse('PONG - Route is reachable!', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'X-Test-Response': 'true',
        'X-Timestamp': new Date().toISOString()
      }
    });
  }
  
  // GANZ WICHTIG: Als allererstes loggen - MUSS angezeigt werden!
  process.stdout.write(`\n💥💥💥 FILESYSTEM ROUTE CALLED 💥💥💥\n`);
  
  const requestId = REQUEST_ID();
  
  // Sofort loggen, um zu sehen ob die Route überhaupt aufgerufen wird
  console.error(`[FILESYSTEM-API] ${requestId} - Route wurde aufgerufen!`);
  console.warn(`[FILESYSTEM-API] ${requestId} - Route wurde aufgerufen!`);
  console.log(`[FILESYSTEM-API] ${requestId} - Route wurde aufgerufen!`);
  
  // Auch in die Response schreiben
  const debugHeaders = new Headers();
  debugHeaders.set('X-Debug-Request-Id', requestId);
  debugHeaders.set('X-Debug-Timestamp', new Date().toISOString());
  
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const fileId = url.searchParams.get('fileId');
  const libraryId = url.searchParams.get('libraryId');
  
  // WARN: Wichtig für Debugging - wird garantiert angezeigt
  console.warn(`[API][filesystem] ⚠️ NEUE ANFRAGE ${requestId}:`, {
    url: request.url,
    method: request.method,
    action,
    fileId,
    libraryId,
    headers: Object.fromEntries(request.headers.entries())
  });

  // Validiere erforderliche Parameter
  if (!libraryId) {
    console.warn(`[API][filesystem] ❌ Fehlender libraryId Parameter`);
    return NextResponse.json({ error: 'libraryId is required' }, { status: 400 });
  }

  if (!fileId) {
    console.warn(`[API][filesystem] ❌ Fehlender fileId Parameter`);
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
  }

  // E-Mail aus Authentifizierung oder Parameter ermitteln
  const userEmail = await getUserEmail(request);
  console.warn(`[API][filesystem] 👤 Authentifizierung:`, {
    userEmail,
    hasEmail: !!userEmail
  });

  if (!userEmail) {
    console.warn(`[API][filesystem] ❌ Keine E-Mail gefunden`);
    return NextResponse.json({ error: 'No user email found' }, { status: 400 });
  }

  const library = await getLibrary(libraryId, userEmail);
  console.warn(`[API][filesystem] 📚 Bibliothekssuche:`, {
    libraryId,
    userEmail,
    found: !!library,
    library: library ? {
      id: library.id,
      label: library.label,
      path: library.path,
      type: library.type
    } : null
  });

  if (!library) {
    console.warn(`[API][filesystem] ❌ Bibliothek nicht gefunden`);
    return handleLibraryNotFound(libraryId, userEmail);
  }

  try {
    switch (action) {
      case 'list': {
        console.warn(`[API][filesystem] 📋 Liste Items:`, {
          libraryId,
          fileId,
          userEmail
        });
        const items = await listItems(library, fileId);
        return NextResponse.json(items);
      }

      case 'get': {
        console.log('[API][filesystem] Hole Item:', {
          libraryId,
          fileId,
          userEmail
        });
        const absolutePath = getPathFromId(library, fileId);
        const stats = await fs.stat(absolutePath);
        const item = await statsToStorageItem(library, absolutePath, stats);
        return NextResponse.json(item);
      }

      case 'binary': {
        console.log('[API][filesystem] Hole Binärdaten:', {
          libraryId,
          fileId,
          userEmail
        });
        if (!fileId || fileId === 'root') {
          console.error('[API][filesystem] Ungültige Datei-ID für binary:', {
            fileId,
            libraryId,
            userEmail
          });
          return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
        }

        const absolutePath = getPathFromId(library, fileId);
        const stats = await fs.stat(absolutePath);
        
        if (!stats.isFile()) {
          console.error('[API][filesystem] Keine Datei:', {
            path: absolutePath,
            libraryId,
            fileId,
            userEmail
          });
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
        console.log('[API][filesystem] Hole Pfad:', {
          libraryId,
          fileId,
          userEmail
        });
        return handleGetPath(library, fileId);
      }

      default:
        console.error('[API][filesystem] Ungültige Aktion:', {
          action,
          libraryId,
          fileId,
          userEmail
        });
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.warn(`[API][filesystem] 💥 FEHLER:`, {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      action,
      libraryId,
      fileId,
      userEmail
    });
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error) 
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