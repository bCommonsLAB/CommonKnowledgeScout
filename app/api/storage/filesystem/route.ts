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
  // Ansonsten füge den Library-Pfad hinzu
  return pathLib.join(library.path, normalizedPath);
}

// Helfer-Funktion für die Konvertierung in StorageItem
async function itemToStorageItem(basePath: string, path: string, stats: Stats): Promise<StorageItem> {
  if (stats.isDirectory()) {
    const folder = statsToStorageFolder(path, stats);
    return { type: 'folder', item: folder, provider };
  } else {
    const file = statsToStorageFile(path, stats);
    return { type: 'file', item: file, provider };
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

// Implementiere die Provider-Funktionen
async function listItems(path: string): Promise<StorageItem[]> {
  const items = await fs.readdir(path);
  const itemPromises = items.map(async (item) => {
    const itemPath = pathLib.join(path, item);
    const stats = await fs.stat(itemPath);
    return itemToStorageItem(path, itemPath, stats);
  });
  return await Promise.all(itemPromises);
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

// Definiere den Provider
const provider: StorageProvider = {
  name: 'Local Filesystem',
  id: 'local',
  validateConfiguration: async () => ({ isValid: true }),
  listItems,
  getItem,
  createFolder,
  deleteItem,
  moveItem,
  uploadFile,
  downloadFile
};

export async function GET(request: NextRequest) {
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
      case 'list': {
        const absolutePath = getAbsolutePath(library, reqPath);
        const items = await fs.readdir(absolutePath);
        const itemPromises = items.map(async (item) => {
          const itemPath = pathLib.join(absolutePath, item);
          const stats = await fs.stat(itemPath);
          return itemToStorageItem(library.path, itemPath, stats);
        });
        const result = await Promise.all(itemPromises);
        return NextResponse.json(result);
      }

      case 'get': {
        const absolutePath = getAbsolutePath(library, reqPath);
        const stats = await fs.stat(absolutePath);
        const item = await itemToStorageItem(library.path, absolutePath, stats);
        return NextResponse.json(item);
      }

      case 'download': {
        const absolutePath = getAbsolutePath(library, reqPath);
        const stats = await fs.stat(absolutePath);
        if (!stats.isFile()) {
          return NextResponse.json({ error: 'Not a file' }, { status: 400 });
        }
        const buffer = await fs.readFile(absolutePath);
        const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${pathLib.basename(absolutePath)}"`,
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Storage API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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