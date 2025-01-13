import { StorageProvider, StorageItem, StorageFile, StorageFolder, StorageError, StorageValidationResult } from './types';
import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as path from 'path';
import mime from 'mime-types';

export class FileSystemProvider implements StorageProvider {
  name = 'Local FileSystem';
  id = 'filesystem';
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  public async validateConfiguration(): Promise<StorageValidationResult> {
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

  private getAbsolutePath(relativePath: string): string {
    // Sicherheitscheck: Verhindere directory traversal
    const normalizedPath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    return path.join(this.basePath, normalizedPath);
  }

  private async getStats(absolutePath: string) {
    try {
      return await fs.stat(absolutePath);
    } catch (error) {
      throw new Error('Item not found') as StorageError;
    }
  }

  private async itemToStorageItem(itemPath: string, stats: Stats): Promise<StorageItem> {
    const name = path.basename(itemPath);
    const relativePath = itemPath.replace(this.basePath, '').replace(/\\/g, '/');

    if (stats.isDirectory()) {
      const folder: StorageFolder = {
        id: Buffer.from(relativePath).toString('base64'),
        name,
        path: relativePath || '/',
        modifiedAt: stats.mtime
      };
      return { type: 'folder', item: folder, provider: this };
    } else {
      const file: StorageFile = {
        id: Buffer.from(relativePath).toString('base64'),
        name,
        size: stats.size,
        mimeType: mime.lookup(name) || 'application/octet-stream',
        path: relativePath,
        modifiedAt: stats.mtime
      };
      return { type: 'file', item: file, provider: this };
    }
  }

  async listItems(relativePath: string): Promise<StorageItem[]> {
    const absolutePath = this.getAbsolutePath(relativePath);
    const items = await fs.readdir(absolutePath);
    
    const itemPromises = items.map(async (item) => {
      const itemPath = path.join(absolutePath, item);
      const stats = await fs.stat(itemPath);
      return this.itemToStorageItem(itemPath, stats);
    });

    return Promise.all(itemPromises);
  }

  async getItem(relativePath: string): Promise<StorageItem> {
    const absolutePath = this.getAbsolutePath(relativePath);
    const stats = await this.getStats(absolutePath);
    return this.itemToStorageItem(absolutePath, stats);
  }

  async createFolder(parentPath: string, name: string): Promise<StorageFolder> {
    const absolutePath = this.getAbsolutePath(path.join(parentPath, name));
    await fs.mkdir(absolutePath, { recursive: true });
    const stats = await this.getStats(absolutePath);
    const item = await this.itemToStorageItem(absolutePath, stats);
    return item.item as StorageFolder;
  }

  async deleteItem(relativePath: string): Promise<void> {
    const absolutePath = this.getAbsolutePath(relativePath);
    const stats = await this.getStats(absolutePath);
    
    if (stats.isDirectory()) {
      await fs.rm(absolutePath, { recursive: true });
    } else {
      await fs.unlink(absolutePath);
    }
  }

  async moveItem(fromPath: string, toPath: string): Promise<void> {
    const absoluteFromPath = this.getAbsolutePath(fromPath);
    const absoluteToPath = this.getAbsolutePath(toPath);
    await fs.rename(absoluteFromPath, absoluteToPath);
  }

  async uploadFile(parentPath: string, file: File): Promise<StorageFile> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const absolutePath = this.getAbsolutePath(path.join(parentPath, file.name));
    await fs.writeFile(absolutePath, buffer);
    
    const stats = await this.getStats(absolutePath);
    const item = await this.itemToStorageItem(absolutePath, stats);
    return item.item as StorageFile;
  }

  async downloadFile(relativePath: string): Promise<Blob> {
    const absolutePath = this.getAbsolutePath(relativePath);
    const stats = await this.getStats(absolutePath);
    
    if (!stats.isFile()) {
      throw new Error('Not a file') as StorageError;
    }

    const buffer = await fs.readFile(absolutePath);
    const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
    return new Blob([buffer], { type: mimeType });
  }
} 