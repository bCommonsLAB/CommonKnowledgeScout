---
title: FileSystem Storage Provider
---

# FileSystem Storage Provider

> Status: ✅ Implementiert

Der FileSystem Storage Provider ermöglicht direkten Zugriff auf das lokale Dateisystem des Servers und stellt Dateien/Ordner über eine einheitliche API bereit.

## Architektur (Auszug)
- Server: FileSystemProvider, Storage Factory (Server)
- Client: FileSystemClient, Storage Factory (Client)
- Gemeinsam: StorageProvider Interface, StorageItem

## Interface (Auszug)
```typescript
interface StorageProvider {
  listItemsById(folderId: string): Promise<StorageItem[]>;
  getItemById(itemId: string): Promise<StorageItem>;
  createFolder(parentId: string, name: string): Promise<StorageItem>;
  deleteItem(itemId: string): Promise<void>;
  moveItem(itemId: string, newParentId: string): Promise<void>;
  uploadFile(parentId: string, file: File): Promise<StorageItem>;
  getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string }>;
}
```


