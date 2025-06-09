import { StorageProvider, StorageItem, StorageValidationResult, StorageError } from './types';
import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as path from 'path';
import mime from 'mime-types';
import * as crypto from 'crypto';

/**
 * FileSystemProvider implementiert das StorageProvider Interface für lokale Dateisysteme.
 * Die Implementierung nutzt ein intelligentes ID-System und Caching für optimale Performance.
 * 
 * ID-Generierung:
 * - Dateien und Ordner haben stabile, eindeutige IDs
 * - IDs bleiben beim Verschieben erhalten
 * - IDs ändern sich bei Umbenennung oder Inhaltänderung
 * 
 * Caching-Strategie:
 * - Bidirektionales Caching (Pfad -> ID und ID -> Pfad)
 * - Cache wird bei Änderungen (move, delete) automatisch aktualisiert
 * - Verhindert wiederholte Hash-Berechnungen
 */
export class FileSystemProvider implements StorageProvider {
  name = 'Local FileSystem';
  id = 'filesystem';
  private basePath: string;
  private idCache: Map<string, string> = new Map(); // Cache für Path -> ID Mapping
  private pathCache: Map<string, string> = new Map(); // Cache für ID -> Path Mapping

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Generiert eine eindeutige, stabile ID für eine Datei oder einen Ordner.
   * 
   * Für Ordner:
   * - Hash aus Name, Größe und Zeitstempeln
   * - Bleibt stabil solange der Name gleich bleibt
   * 
   * Für Dateien:
   * - Hash aus Name, Größe, Zeitstempeln, Inode und Datei-Fingerprint
   * - Fingerprint: Erste 4KB der Datei (Performance-Optimierung)
   * - Inode: Zusätzliche Eindeutigkeit bei gleichen Dateinamen
   * 
   * Besonderheiten:
   * - IDs sind pfadunabhängig (bleiben beim Verschieben gleich)
   * - IDs sind 22 Zeichen lang (base64url-kodiert)
   * - Ergebnisse werden gecached
   * 
   * @param absolutePath Absoluter Pfad zur Datei/Ordner
   * @param stats File Stats vom Filesystem
   * @returns Eindeutige ID als String
   */
  private async generateFileId(absolutePath: string, stats: Stats): Promise<string> {
    // Prüfe ob ID bereits im Cache
    const cachedId = this.idCache.get(absolutePath);
    if (cachedId) return cachedId;

    // Für Ordner: Verwende einen Hash aus Name, Größe und Modifikationsdatum
    if (stats.isDirectory()) {
      const hash = crypto.createHash('sha256');
      hash.update(path.basename(absolutePath)); // Nur der Ordnername
      hash.update(stats.size.toString());
      hash.update(stats.mtime.getTime().toString());
      hash.update(stats.ctime.getTime().toString());
      const id = hash.digest('base64url').slice(0, 22);
      this.idCache.set(absolutePath, id);
      this.pathCache.set(id, absolutePath);
      return id;
    }

    // Für Dateien: Verwende einen Hash aus Dateiname, Größe, Datum und Fingerprint
    try {
      const hash = crypto.createHash('sha256');
      
      // Metadaten für Eindeutigkeit, aber pfadunabhängig
      hash.update(path.basename(absolutePath)); // Nur der Dateiname
      hash.update(stats.size.toString());
      hash.update(stats.mtime.getTime().toString());
      hash.update(stats.ctime.getTime().toString());
      hash.update(stats.ino.toString()); // Inode-Nummer für zusätzliche Eindeutigkeit
      
      // Performance-Optimierung: Lies nur die ersten 4KB der Datei
      // Dies ist ein Kompromiss zwischen Eindeutigkeit und Performance
      if (stats.size > 0) {
        const fd = await fs.open(absolutePath, 'r');
        try {
          const buffer = Buffer.alloc(Math.min(4096, stats.size));
          await fd.read(buffer, 0, buffer.length, 0);
          hash.update(buffer);
        } finally {
          await fd.close();
        }
      }

      const id = hash.digest('base64url').slice(0, 22);
      this.idCache.set(absolutePath, id);
      this.pathCache.set(id, absolutePath);
      return id;
    } catch (error) {
      console.error('Fehler beim Generieren der File-ID:', error);
      throw new StorageError('Fehler beim Generieren der File-ID', 'ID_GENERATION_ERROR', this.id);
    }
  }

  /**
   * Findet den absoluten Pfad zu einer Datei anhand ihrer ID.
   * 
   * Suchstrategie:
   * 1. Prüft zuerst den Cache
   * 2. Falls nicht im Cache: Rekursive Suche im Filesystem
   * 3. Generiert IDs für gefundene Dateien und vergleicht
   * 
   * Performance-Optimierung:
   * - Bidirektionales Caching verhindert wiederholte Suchen
   * - Cache wird bei Änderungen (move, delete) aktualisiert
   * 
   * @param fileId Die zu suchende File-ID
   * @returns Absoluter Pfad zur Datei
   * @throws StorageError wenn die Datei nicht gefunden wird
   */
  private async findPathById(fileId: string): Promise<string> {
    if (fileId === 'root') {
      console.log(`[FileSystemProvider] findPathById: fileId=root, basePath=${this.basePath}`);
      return this.basePath;
    }
    
    // Prüfe zuerst den Cache
    const cachedPath = this.pathCache.get(fileId);
    if (cachedPath) return cachedPath;

    // Wenn nicht im Cache, durchsuche das Verzeichnis rekursiv
    const findInDir = async (dir: string): Promise<string | null> => {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stats = await fs.stat(itemPath);
        
        // Generiere ID und vergleiche
        const itemId = await this.generateFileId(itemPath, stats);
        if (itemId === fileId) return itemPath;
        
        // Wenn es ein Verzeichnis ist, durchsuche es rekursiv
        if (stats.isDirectory()) {
          const found = await findInDir(itemPath);
          if (found) return found;
        }
      }
      
      return null;
    };

    const foundPath = await findInDir(this.basePath);
    if (!foundPath) {
      console.error(`[FileSystemProvider] findPathById: Datei nicht gefunden für fileId=${fileId}`);
      throw new StorageError('Datei nicht gefunden', 'FILE_NOT_FOUND', this.id);
    }

    return foundPath;
  }

  private async getParentId(absolutePath: string): Promise<string> {
    if (absolutePath === this.basePath) return 'root';
    const parentPath = path.dirname(absolutePath);
    if (parentPath === this.basePath) return 'root';
    
    const stats = await fs.stat(parentPath);
    return this.generateFileId(parentPath, stats);
  }

  private async statsToStorageItem(absolutePath: string, stats: Stats): Promise<StorageItem> {
    const id = await this.generateFileId(absolutePath, stats);
    const parentId = await this.getParentId(absolutePath);

    return {
      id,
      parentId,
      type: stats.isDirectory() ? 'folder' : 'file',
      metadata: {
        name: path.basename(absolutePath),
        size: stats.size,
        modifiedAt: stats.mtime,
        mimeType: stats.isFile() ? mime.lookup(absolutePath) || 'application/octet-stream' : 'folder'
      }
    };
  }

  public async validateConfiguration(): Promise<StorageValidationResult> {
    console.log('[StorageProvider] validateConfiguration aufgerufen');
    
    try {
      const stats = await fs.stat(this.basePath);
      if (!stats.isDirectory()) {
        return {
          isValid: false,
          error: `Storage path ${this.basePath} exists but is not a directory`
        };
      }
      return { isValid: true };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          isValid: false,
          error: `Storage path ${this.basePath} does not exist. Please create the directory first.`
        };
      }
      return {
        isValid: false,
        error: `Cannot access storage path ${this.basePath}: ${(error as Error).message}`
      };
    }
  }

  async listItemsById(folderId: string): Promise<StorageItem[]> {
    console.log(`[FileSystemProvider] listItemsById: folderId=${folderId}`);
    const absolutePath = await this.findPathById(folderId);
    console.log(`[FileSystemProvider] Absoluter Pfad für folderId=${folderId}: ${absolutePath}`);
    const items = await fs.readdir(absolutePath);
    
    const itemPromises = items.map(async (item) => {
      const itemPath = path.join(absolutePath, item);
      try {
        const stats = await fs.stat(itemPath);
        return this.statsToStorageItem(itemPath, stats);
      } catch {
        return null;
      }
    });

    const results = await Promise.all(itemPromises);
    return results.filter((item): item is StorageItem => item !== null);
  }

  async getItemById(itemId: string): Promise<StorageItem> {
    const absolutePath = await this.findPathById(itemId);
    const stats = await fs.stat(absolutePath);
    return this.statsToStorageItem(absolutePath, stats);
  }

  async createFolder(parentId: string, name: string): Promise<StorageItem> {
    const parentPath = await this.findPathById(parentId);
    const newFolderPath = path.join(parentPath, name);
    
    await fs.mkdir(newFolderPath, { recursive: true });
    const stats = await fs.stat(newFolderPath);
    return this.statsToStorageItem(newFolderPath, stats);
  }

  async deleteItem(itemId: string): Promise<void> {
    const absolutePath = await this.findPathById(itemId);
    const stats = await fs.stat(absolutePath);
    
    // Entferne aus dem Cache
    this.idCache.delete(absolutePath);
    this.pathCache.delete(itemId);
    
    if (stats.isDirectory()) {
      await fs.rm(absolutePath, { recursive: true });
    } else {
      await fs.unlink(absolutePath);
    }
  }

  async moveItem(itemId: string, newParentId: string): Promise<void> {
    const sourcePath = await this.findPathById(itemId);
    const targetParentPath = await this.findPathById(newParentId);
    const fileName = path.basename(sourcePath);
    const targetPath = path.join(targetParentPath, fileName);
    
    // Entferne alte Einträge aus dem Cache
    this.idCache.delete(sourcePath);
    this.pathCache.delete(itemId);
    
    await fs.rename(sourcePath, targetPath);
  }

  async renameItem(itemId: string, newName: string): Promise<StorageItem> {
    const sourcePath = await this.findPathById(itemId);
    const parentPath = path.dirname(sourcePath);
    const targetPath = path.join(parentPath, newName);
    
    // Prüfe ob Zieldatei bereits existiert
    try {
      await fs.access(targetPath);
      throw new StorageError(
        `Eine Datei mit dem Namen "${newName}" existiert bereits`,
        'FILE_EXISTS',
        this.id
      );
    } catch (error) {
      // Wenn die Datei nicht existiert, ist das gut - wir können fortfahren
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    
    // Entferne alte Einträge aus dem Cache
    this.idCache.delete(sourcePath);
    this.pathCache.delete(itemId);
    
    // Führe die Umbenennung durch
    await fs.rename(sourcePath, targetPath);
    
    // Hole die neuen Stats und generiere das aktualisierte StorageItem
    const stats = await fs.stat(targetPath);
    return this.statsToStorageItem(targetPath, stats);
  }

  async uploadFile(parentId: string, file: File): Promise<StorageItem> {
    const parentPath = await this.findPathById(parentId);
    const filePath = path.join(parentPath, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    
    await fs.writeFile(filePath, buffer);
    const stats = await fs.stat(filePath);
    return this.statsToStorageItem(filePath, stats);
  }

  async getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string; }> {
    const absolutePath = await this.findPathById(fileId);
    const stats = await fs.stat(absolutePath);
    
    if (!stats.isFile()) {
      throw new StorageError('Not a file', 'INVALID_TYPE', this.id);
    }

    const buffer = await fs.readFile(absolutePath);
    const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
    return { 
      blob: new Blob([buffer], { type: mimeType }),
      mimeType
    };
  }

  async getPathById(itemId: string): Promise<string> {
    if (itemId === 'root') return '/';
    
    try {
      const absolutePath = await this.findPathById(itemId);
      // Konvertiere absoluten Pfad zu relativem Pfad vom Basis-Verzeichnis
      const relativePath = path.relative(this.basePath, absolutePath);
      // Ersetze Backslashes durch Forward Slashes für konsistente Pfade
      return relativePath ? `/${relativePath.replace(/\\/g, '/')}` : '/';
    } catch (error) {
      console.error('Fehler beim Auflösen des Pfads:', error);
      throw new StorageError(
        'Fehler beim Auflösen des Pfads',
        'PATH_RESOLUTION_ERROR',
        this.id
      );
    }
  }
} 