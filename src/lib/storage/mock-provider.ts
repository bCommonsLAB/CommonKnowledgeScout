import { StorageProvider, StorageItem, StorageFile, StorageFolder, StorageError, StorageValidationResult } from './types';

// Deklariere mockData als let, damit wir es später aktualisieren können
let mockData: StorageItem[] = [
  {
    type: 'folder',
    item: {
      id: 'docs',
      name: 'Dokumente',
      path: '/Dokumente',
      modifiedAt: new Date('2024-01-01')
    },
    provider: null as any // wird im Konstruktor gesetzt
  },
  {
    type: 'file',
    item: {
      id: 'presentation',
      name: 'Präsentation.pptx',
      size: 2048576,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      path: '/Dokumente/Präsentation.pptx',
      modifiedAt: new Date('2024-01-02')
    } as StorageFile,
    provider: null as any // wird im Konstruktor gesetzt
  }
];

export class MockStorageProvider implements StorageProvider {
  name = 'Mock Storage';
  id = 'mock';

  constructor() {
    // Initialisiere mockData mit provider-Referenz
    mockData.forEach(item => {
      item.provider = this;
    });
  }

  async validateConfiguration(): Promise<StorageValidationResult> {
    // Mock-Provider benötigt keine spezielle Konfiguration
    return { isValid: true };
  }

  async listItems(path: string): Promise<StorageItem[]> {
    // Simuliere Netzwerklatenz
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockData.filter(item => {
      const itemPath = item.type === 'file' 
        ? (item.item as StorageFile).path 
        : (item.item as StorageFolder).path;
      return itemPath.startsWith(path);
    });
  }

  async getItem(path: string): Promise<StorageItem> {
    const item = mockData.find(item => {
      const itemPath = item.type === 'file' 
        ? (item.item as StorageFile).path 
        : (item.item as StorageFolder).path;
      return itemPath === path;
    });

    if (!item) {
      throw new Error('Item not found') as StorageError;
    }

    return item;
  }

  async createFolder(path: string, name: string): Promise<StorageFolder> {
    const newFolder: StorageFolder = {
      id: Math.random().toString(36).substring(7),
      name,
      path: `${path}/${name}`,
      modifiedAt: new Date()
    };

    const item: StorageItem = {
      type: 'folder',
      item: newFolder,
      provider: this
    };
    mockData.push(item);

    return newFolder;
  }

  async deleteItem(path: string): Promise<void> {
    const index = mockData.findIndex(item => {
      const itemPath = item.type === 'file' 
        ? (item.item as StorageFile).path 
        : (item.item as StorageFolder).path;
      return itemPath === path;
    });

    if (index > -1) {
      mockData.splice(index, 1);
    }
  }

  async moveItem(fromPath: string, toPath: string): Promise<void> {
    const item = await this.getItem(fromPath);
    if (item.type === 'file') {
      (item.item as StorageFile).path = toPath;
    } else {
      (item.item as StorageFolder).path = toPath;
    }
  }

  async uploadFile(path: string, file: File): Promise<StorageFile> {
    const newFile: StorageFile = {
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      mimeType: file.type,
      path: `${path}/${file.name}`,
      modifiedAt: new Date()
    };

    const item: StorageItem = {
      type: 'file',
      item: newFile,
      provider: this
    };
    mockData.push(item);

    return newFile;
  }

  async downloadFile(path: string): Promise<Blob> {
    const file = await this.getItem(path);
    if (file.type !== 'file') {
      throw new Error('Not a file') as StorageError;
    }
    
    // Simuliere einen Download mit einem leeren Blob
    return new Blob(['Mock file content'], { type: (file.item as StorageFile).mimeType });
  }

  async getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string; }> {
    // Simuliere eine Binärdatei mit einem Mock-Inhalt
    const mimeType = 'application/octet-stream';
    const blob = new Blob(['Mock binary content'], { type: mimeType });
    return { blob, mimeType };
  }
} 