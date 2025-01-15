/**
 * Represents a file in the storage system.
 * Contains all necessary metadata for file operations.
 */
export interface StorageFile {
  id: string;          // Unique identifier
  name: string;        // File name with extension
  size: number;        // File size in bytes
  mimeType: string;    // MIME type for content handling
  modifiedAt: Date;    // Last modification timestamp
  path: string;        // Full path in the storage
}

/**
 * Represents a folder in the storage system.
 * Contains basic metadata needed for folder operations.
 */
export interface StorageFolder {
  id: string;          // Unique identifier
  name: string;        // Folder name
  path: string;        // Full path in the storage
  modifiedAt: Date;    // Last modification timestamp
}

/**
 * Unified type for both files and folders in the storage system.
 * Used as the primary type for item operations.
 */
export interface StorageItem {
  id: string;          // Unique identifier
  parentId: string;    // ID of the parent folder
  type: 'file' | 'folder';
  metadata: {
    name: string;      // Item name
    path?: string;     // Optional path (internal use)
    size?: number;     // Size in bytes (files only)
    mimeType?: string; // MIME type (files only)
    modifiedAt: Date;  // Last modification date
  }
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
  
  // ID-based operations
  listItemsById(folderId: string): Promise<StorageItem[]>;
  getItemById(itemId: string): Promise<StorageItem>;
  createFolder(parentId: string, name: string): Promise<StorageItem>;
  deleteItem(itemId: string): Promise<void>;
  moveItem(itemId: string, newParentId: string): Promise<void>;
  
  // File operations
  uploadFile(parentId: string, file: File): Promise<StorageItem>;
  downloadFile(itemId: string): Promise<Blob>;
  getBinary(itemId: string): Promise<{ blob: Blob; mimeType: string; }>;
}

/**
 * Custom error type for storage operations.
 * Provides additional context for storage-related errors.
 */
export interface StorageError extends Error {
  code: string;        // Error code for identification
  provider: string;    // Provider where the error occurred
  path?: string;       // Optional path where the error occurred
} 