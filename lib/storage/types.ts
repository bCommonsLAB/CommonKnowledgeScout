export interface StorageItemMetadata {
  name: string;
  size: number;
  modifiedAt: Date;
  mimeType: string;
}

export interface StorageItem {
  id: string;
  parentId: string;
  type: 'file' | 'folder';
  metadata: {
    name: string;
    size: number;
    modifiedAt: Date;
    mimeType: string;
  };
}

export interface StorageProvider {
  name: string;
  id: string;
  validateConfiguration: () => Promise<{ isValid: boolean; error?: string }>;
  listItems: (path: string) => Promise<StorageItem[]>;
  getItem: (path: string) => Promise<StorageItem>;
  createFolder: (parentId: string, name: string) => Promise<StorageItem>;
  deleteItem: (path: string) => Promise<void>;
  moveItem: (fromPath: string, toPath: string) => Promise<void>;
  uploadFile: (parentId: string, file: File) => Promise<StorageItem>;
  downloadFile: (path: string) => Promise<Blob>;
  getBinary: (fileId: string) => Promise<{ blob: Blob; mimeType: string }>;
} 