/**
 * Represents metadata for storage items.
 * Contains common properties for both files and folders.
 */
export interface StorageItemMetadata {
  name: string;      // Item name
  size: number;      // Size in bytes (files only)
  modifiedAt: Date;  // Last modification date
  mimeType: string;  // MIME type (files only)
}

/**
 * Unified type for both files and folders in the storage system.
 * Used as the primary type for item operations.
 */
export interface StorageItem {
  id: string;          // Unique identifier
  parentId: string;    // ID of the parent folder
  type: 'file' | 'folder';
  metadata: StorageItemMetadata;
}

/**
 * Result of storage validation operations.
 * Used to verify storage configurations and permissions.
 */
export interface StorageValidationResult {
  isValid: boolean;
  error?: string;      // Error message if validation fails
}

/**
 * Core interface for storage providers.
 * Implements all necessary operations for file/folder management.
 */
export interface StorageProvider {
  name: string;        // Display name of the provider
  id: string;          // Unique provider identifier
  
  validateConfiguration(): Promise<StorageValidationResult>;
  
  // ID-based operations
  listItemsById(folderId: string): Promise<StorageItem[]>;
  getItemById(itemId: string): Promise<StorageItem>;
  createFolder(parentId: string, name: string): Promise<StorageItem>;
  deleteItem(itemId: string): Promise<void>;
  moveItem(itemId: string, newParentId: string): Promise<void>;
  uploadFile(parentId: string, file: File): Promise<StorageItem>;
  getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string; }>;
}

/**
 * Custom error type for storage operations.
 * Provides additional context for storage-related errors.
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN',
    public provider: string = 'unknown'
  ) {
    super(message);
    this.name = 'StorageError';
  }
} 