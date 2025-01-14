export interface StorageFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  modifiedAt: Date;
  path: string;
}

export interface StorageFolder {
  id: string;
  name: string;
  path: string;
  modifiedAt: Date;
}

export interface StorageItem {
  type: 'file' | 'folder';
  item: {
    id: string;
    name: string;
    path: string;
    modifiedAt: Date;
  };
  provider: StorageProvider;
}

export interface StorageValidationResult {
  isValid: boolean;
  error?: string;
}

export interface StorageProvider {
  name: string;
  id: string;
  
  // Validierung
  validateConfiguration(): Promise<StorageValidationResult>;
  
  // Basis Operationen
  listItems(path: string): Promise<StorageItem[]>;
  getItem(path: string): Promise<StorageItem>;
  createFolder(path: string, name: string): Promise<StorageFolder>;
  deleteItem(path: string): Promise<void>;
  moveItem(fromPath: string, toPath: string): Promise<void>;
  
  // Datei-spezifische Operationen
  uploadFile(path: string, file: File): Promise<StorageFile>;
  downloadFile(path: string): Promise<Blob>;
  getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string; }>;
}

export interface StorageError extends Error {
  code: string;
  provider: string;
  path?: string;
} 