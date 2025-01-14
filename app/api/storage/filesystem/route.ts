import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as pathLib from 'path';
import mime from 'mime-types';
import { StorageProvider, StorageItem, StorageFile, StorageFolder, StorageError } from '@/lib/storage/types';
import { Library as LibraryType } from '@/types/library';

// Library-Konfiguration
const defaultLibraries: LibraryType[] = [
  {
    id: 'local',
    label: "Lokale Bibliothek",
    path: process.env.STORAGE_BASE_PATH || '',
    type: 'local',
    isEnabled: process.env.STORAGE_BASE_PATH ? true : false,
    config: {}
  }
];

// Helfer-Funktion um die Library zu finden
function getLibrary(libraryId: string): LibraryType | undefined {
  return defaultLibraries.find(lib => lib.id === libraryId && lib.isEnabled);
}

// Helfer-Funktion für die Pfad-Normalisierung
function getAbsolutePath(library: LibraryType, relativePath: string): string {
  // Entferne führende Slashes und Backslashes
  const cleanPath = relativePath.replace(/^[/\\]+/, '');
  
  // Verhindere Directory Traversal
  const normalizedPath = pathLib.normalize(cleanPath).replace(/^(\.\.(\/|\\|$))+/, '');
  
  // Wenn der Pfad bereits absolut ist, gib ihn zurück
  if (pathLib.isAbsolute(normalizedPath)) {
    return normalizedPath;
  }

  // Behandle OneDrive-Pfade speziell
  const basePath = library.path.replace(/\\/g, '/');
  
  // Behandle Sonderzeichen im Pfad
  const decodedPath = decodeURIComponent(normalizedPath);
  const fullPath = pathLib.join(basePath, decodedPath);
  
  // Normalisiere den finalen Pfad und stelle sicher, dass Sonderzeichen korrekt kodiert sind
  const finalPath = pathLib.normalize(fullPath);
  
  console.log('Pfad-Verarbeitung:', {
    original: relativePath,
    decoded: decodedPath,
    final: finalPath
  });
  
  return finalPath;
}

// Helfer-Funktion für die Verzeichnis-Prüfung
async function ensureDirectoryAccess(path: string): Promise<{ isAccessible: boolean; details: string }> {
  try {
    console.log('Prüfe Verzeichniszugriff:', {
      path,
      exists: await fs.access(path).then(() => true).catch(() => false)
    });
    
    const stats = await fs.stat(path);
    const files = await fs.readdir(path);
    
    console.log('Verzeichnis gefunden:', {
      path,
      isDirectory: stats.isDirectory(),
      entries: files.length,
      mode: stats.mode
    });
    
    return { 
      isAccessible: true, 
      details: `Verzeichnis gefunden mit ${files.length} Einträgen` 
    };
  } catch (error: any) {
    console.error('Verzeichniszugriff fehlgeschlagen:', {
      path,
      error: error.message,
      code: error.code,
      syscall: error.syscall,
      stackTrace: error.stack
    });
    return { 
      isAccessible: false, 
      details: `Zugriffsfehler: ${error.code} (${error.syscall}) - ${error.message}` 
    };
  }
}

// Helfer-Funktion für die Konvertierung in StorageItem
async function itemToStorageItem(basePath: string, path: string, stats: Stats): Promise<StorageItem> {
  const relativePath = path.replace(basePath, '').replace(/^[/\\]+/, '');
  
  if (stats.isDirectory()) {
    const folder = statsToStorageFolder(relativePath, stats);
    return { 
      type: 'folder', 
      item: folder, 
      provider 
    };
  } else {
    const file = statsToStorageFile(relativePath, stats);
    return { 
      type: 'file', 
      item: file, 
      provider 
    };
  }
}

// Helfer-Funktion für die Konvertierung von Stats zu StorageFile
function statsToStorageFile(path: string, stats: Stats): StorageFile {
  return {
    id: Buffer.from(path).toString('base64'),
    name: pathLib.basename(path),
    size: stats.size,
    mimeType: mime.lookup(path) || 'application/octet-stream',
    path,
    modifiedAt: stats.mtime
  };
}

// Helfer-Funktion für die Konvertierung von Stats zu StorageFolder
function statsToStorageFolder(path: string, stats: Stats): StorageFolder {
  return {
    id: Buffer.from(path).toString('base64'),
    name: pathLib.basename(path),
    path,
    modifiedAt: stats.mtime
  };
}

// Helfer-Funktion für Fehlermeldungen
function getReadableError(error: any): string {
  if (!error) return 'Unbekannter Fehler';
  
  // Behandle Node.js Filesystem Fehler
  if (error.code) {
    switch (error.code) {
      case 'ENOENT':
        return `Das Verzeichnis ist nicht verfügbar (${error.path}). 
                Bei OneDrive: 
                1. Stellen Sie sicher, dass das Verzeichnis auf "Offline verfügbar" gesetzt ist
                2. Warten Sie, bis OneDrive die Synchronisation abgeschlossen hat
                3. Prüfen Sie, ob Sie Zugriff auf das Verzeichnis haben`;
      case 'EPERM':
      case 'EACCES':
        return `Keine Berechtigung für den Zugriff auf: ${error.path}`;
      case 'ETIMEDOUT':
        return 'Zeitüberschreitung beim Zugriff auf das Verzeichnis. Möglicherweise ist OneDrive noch beim Synchronisieren.';
      case 'EBUSY':
        return 'Das Verzeichnis wird gerade von einem anderen Prozess verwendet (z.B. OneDrive Sync).';
      default:
        return `Dateisystemfehler (${error.code}): ${error.path || 'Unbekannter Pfad'}`;
    }
  }
  
  return error.message || 'Unbekannter Fehler';
}

// Implementiere die Provider-Funktionen
async function listItems(path: string): Promise<StorageItem[]> {
  try {
    // Prüfe zuerst den Verzeichniszugriff
    const access = await ensureDirectoryAccess(path);
    if (!access.isAccessible) {
      throw new Error(`Verzeichniszugriff nicht möglich: ${access.details}`);
    }

    const items = await fs.readdir(path);
    const itemPromises = items.map(async (item) => {
      const itemPath = pathLib.join(path, item);
      try {
        const stats = await fs.stat(itemPath);
        return itemToStorageItem(path, itemPath, stats);
      } catch (itemError: any) {
        console.warn(`Überspringe Element ${item}:`, itemError.message);
        return null;
      }
    });

    // Filtere fehlgeschlagene Items heraus
    const results = await Promise.all(itemPromises);
    return results.filter((item): item is StorageItem => item !== null);
  } catch (error) {
    throw new Error(getReadableError(error));
  }
}

async function getItem(path: string): Promise<StorageItem> {
  const stats = await fs.stat(path);
  return itemToStorageItem(path, path, stats);
}

async function createFolder(path: string, name: string): Promise<StorageFolder> {
  const absolutePath = pathLib.join(path, name);
  await fs.mkdir(absolutePath, { recursive: true });
  const stats = await fs.stat(absolutePath);
  return statsToStorageFolder(absolutePath, stats);
}

async function deleteItem(path: string): Promise<void> {
  const stats = await fs.stat(path);
  if (stats.isDirectory()) {
    await fs.rm(path, { recursive: true });
  } else {
    await fs.unlink(path);
  }
}

async function moveItem(fromPath: string, toPath: string): Promise<void> {
  await fs.rename(fromPath, toPath);
}

async function uploadFile(path: string, file: File): Promise<StorageFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const absolutePath = pathLib.join(path, file.name);
  await fs.writeFile(absolutePath, buffer);
  
  const stats = await fs.stat(absolutePath);
  return statsToStorageFile(absolutePath, stats);
}

async function downloadFile(path: string): Promise<Blob> {
  const buffer = await fs.readFile(path);
  const mimeType = mime.lookup(path) || 'application/octet-stream';
  return new Blob([buffer], { type: mimeType });
}

// Logging-Funktion für bessere Übersichtlichkeit
function logWithRequestId(requestId: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${requestId}] ${message}`, data || '');
}

// Definiere den Provider mit Logging
const provider: StorageProvider = {
  name: 'Local Filesystem',
  id: 'local',
  validateConfiguration: async () => {
    const library = getLibrary('local');
    if (!library) return { isValid: false, error: 'Library nicht gefunden' };
    
    const access = await ensureDirectoryAccess(library.path);
    return { 
      isValid: access.isAccessible,
      error: access.isAccessible ? undefined : access.details
    };
  },
  listItems,
  getItem,
  createFolder,
  deleteItem,
  moveItem,
  uploadFile,
  downloadFile,
  async getBinary(fileId: string) {
    console.log('[Provider] getBinary aufgerufen', { fileId });
    
    try {
      const decodedPath = Buffer.from(fileId, 'base64').toString();
      console.log('[Provider] Dekodierter Pfad:', decodedPath);
      
      const filePath = pathLib.join(process.env.STORAGE_BASE_PATH || '', decodedPath);
      console.log('[Provider] Vollständiger Dateipfad:', filePath);
      
      const content = await fs.readFile(filePath);
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      
      console.log('[Provider] Datei gelesen', {
        size: content.length,
        mimeType
      });
      
      return { 
        blob: new Blob([content], { type: mimeType }), 
        mimeType 
      };
    } catch (error) {
      console.error('[Provider] Fehler in getBinary:', error);
      throw error;
    }
  }
};

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const libraryId = searchParams.get('libraryId');
  const path = searchParams.get('path') || '/';
  const fileId = searchParams.get('fileId');

  logWithRequestId(requestId, 'Neue GET Anfrage', {
    action,
    libraryId,
    path,
    fileId
  });

  // Validiere die Library
  const library = getLibrary(libraryId || 'local');
  if (!library) {
    logWithRequestId(requestId, 'Library nicht gefunden oder deaktiviert');
    return NextResponse.json({ 
      error: 'Die ausgewählte Bibliothek wurde nicht gefunden oder ist deaktiviert.' 
    }, { status: 404 });
  }

  try {
    switch (action) {
      case 'list':
        const absolutePath = getAbsolutePath(library, path);
        const items = await listItems(absolutePath);
        return NextResponse.json(items);

      case 'get':
        const itemPath = getAbsolutePath(library, path);
        const stats = await fs.stat(itemPath);
        const item = await itemToStorageItem(library.path, itemPath, stats);
        return NextResponse.json(item);

      case 'download':
        const filePath = getAbsolutePath(library, path);
        const fileStats = await fs.stat(filePath);
        if (!fileStats.isFile()) {
          return NextResponse.json({ error: 'Not a file' }, { status: 400 });
        }
        const fileContent = await fs.readFile(filePath);
        const mimeType = mime.lookup(filePath) || 'application/octet-stream';
        return new NextResponse(fileContent, {
          headers: {
            'Content-Type': mimeType,
            'Content-Length': fileStats.size.toString(),
          },
        });

      case 'binary':
        if (!fileId) {
          logWithRequestId(requestId, 'Fehlende File ID');
          return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
        }
        
        try {
          logWithRequestId(requestId, 'Starte Binary-Verarbeitung', { fileId });
          
          // Dekodiere die Base64-ID zurück in den Pfad
          const decodedPath = Buffer.from(fileId, 'base64').toString();
          logWithRequestId(requestId, 'Dekodierter Pfad', { decodedPath });
          
          const binaryPath = getAbsolutePath(library, decodedPath);
          logWithRequestId(requestId, 'Absoluter Pfad', { binaryPath });
          
          const binaryStats = await fs.stat(binaryPath);
          
          if (!binaryStats.isFile()) {
            logWithRequestId(requestId, 'Pfad ist keine Datei');
            return NextResponse.json({ error: 'Not a file' }, { status: 400 });
          }
          
          logWithRequestId(requestId, 'Dateistatistik', {
            size: binaryStats.size,
            modified: binaryStats.mtime
          });
          
          const binaryContent = await fs.readFile(binaryPath);
          const binaryMimeType = mime.lookup(binaryPath) || 'application/octet-stream';
          
          logWithRequestId(requestId, 'Sende Binärdaten', {
            mimeType: binaryMimeType,
            size: binaryContent.length
          });
          
          return new NextResponse(binaryContent, {
            headers: {
              'Content-Type': binaryMimeType,
              'Content-Length': binaryStats.size.toString(),
              'Cache-Control': 'no-store',
              'X-Request-ID': requestId
            },
          });
        } catch (error) {
          logWithRequestId(requestId, 'Fehler beim Dateizugriff', { error });
          return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

      default:
        logWithRequestId(requestId, 'Ungültige Aktion');
        return NextResponse.json({ 
          error: 'Die angeforderte Aktion ist nicht gültig.' 
        }, { status: 400 });
    }
  } catch (error) {
    logWithRequestId(requestId, 'Storage-Operation fehlgeschlagen', { error });
    return NextResponse.json(
      { error: getReadableError(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const reqPath = searchParams.get('path') || '/';
  const libraryId = searchParams.get('libraryId') || 'local';

  const library = getLibrary(libraryId);
  if (!library || !library.isEnabled) {
    return NextResponse.json({ error: 'Library not found or disabled' }, { status: 404 });
  }

  try {
    switch (action) {
      case 'createFolder': {
        const { name } = await request.json();
        const absolutePath = getAbsolutePath(library, pathLib.join(reqPath, name));
        await fs.mkdir(absolutePath, { recursive: true });
        const stats = await fs.stat(absolutePath);
        const folder = await itemToStorageItem(library.path, absolutePath, stats);
        return NextResponse.json(folder);
      }

      case 'upload': {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        if (!file) {
          return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const absolutePath = getAbsolutePath(library, pathLib.join(reqPath, file.name));
        await fs.writeFile(absolutePath, buffer);
        
        const stats = await fs.stat(absolutePath);
        const item = await itemToStorageItem(library.path, absolutePath, stats);
        return NextResponse.json(item);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Storage API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reqPath = searchParams.get('path');
  const libraryId = searchParams.get('libraryId') || 'local';

  const library = getLibrary(libraryId);
  if (!library || !library.isEnabled || !reqPath) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const absolutePath = getAbsolutePath(library, reqPath);
    const stats = await fs.stat(absolutePath);
    
    if (stats.isDirectory()) {
      await fs.rm(absolutePath, { recursive: true });
    } else {
      await fs.unlink(absolutePath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Storage API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const libraryId = searchParams.get('libraryId') || 'local';

  const library = getLibrary(libraryId);
  if (!library || !library.isEnabled) {
    return NextResponse.json({ error: 'Library not found or disabled' }, { status: 404 });
  }

  try {
    const { fromPath, toPath } = await request.json();
    const absoluteFromPath = getAbsolutePath(library, fromPath);
    const absoluteToPath = getAbsolutePath(library, toPath);
    
    await fs.rename(absoluteFromPath, absoluteToPath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Storage API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 