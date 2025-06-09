/**
 * Storage system type definitions.
 * Contains all types related to storage operations and providers.
 */

/**
 * Represents metadata for storage items.
 * Contains common properties for both files and folders.
 */
export interface StorageItemMetadata {
  /** Display name of the item */
  name: string;
  
  /** Size in bytes (0 for folders) */
  size: number;
  
  /** Last modification timestamp */
  modifiedAt: Date;
  
  /** MIME type (application/folder for folders) */
  mimeType: string;

  /** Indicates if this file has a markdown transcription twin */
  hasTranscript?: boolean;

  /** Indicates if this file is a transcription twin */
  isTwin?: boolean;

  /** Reference to the twin file if exists */
  transcriptionTwin?: {
    /** ID of the twin file */
    id: string;
    /** Name of the twin file */
    name: string;
    /** Whether this file is the transcription (true) or the original (false) */
    isTranscription: boolean;
  };
}

/**
 * Unified type for both files and folders in the storage system.
 * Used as the primary type for item operations.
 */
export interface StorageItem {
  /** Unique identifier within the storage provider */
  id: string;
  
  /** ID of the parent folder (empty for root) */
  parentId: string;
  
  /** Item type discriminator */
  type: 'file' | 'folder';
  
  /** Item metadata */
  metadata: StorageItemMetadata;

  /** Optional children for folder caching */
  children?: StorageItem[];
}

/**
 * Result of storage validation operations.
 * Used to verify storage configurations and permissions.
 */
export interface StorageValidationResult {
  /** Whether the validation was successful */
  isValid: boolean;
  
  /** Optional error message if validation failed */
  error?: string;
}

/**
 * Core interface for storage providers.
 * Implements all necessary operations for file/folder management.
 */
export interface StorageProvider {
  /** Display name of the provider */
  name: string;
  
  /** Unique provider identifier */
  id: string;
  
  /**
   * Checks if the provider is authenticated.
   * For OAuth providers, checks if valid tokens exist.
   * @returns Whether the provider is authenticated
   */
  isAuthenticated(): boolean;
  
  /**
   * Validates the provider configuration.
   * Checks if the provider is properly configured and accessible.
   */
  validateConfiguration(): Promise<StorageValidationResult>;
  
  /**
   * Lists items in a folder by its ID.
   * @param folderId - ID of the folder to list (empty for root)
   * @returns Array of storage items in the folder
   */
  listItemsById(folderId: string): Promise<StorageItem[]>;
  
  /**
   * Retrieves a single item by its ID.
   * @param itemId - ID of the item to retrieve
   * @returns The storage item
   */
  getItemById(itemId: string): Promise<StorageItem>;
  
  /**
   * Creates a new folder.
   * @param parentId - ID of the parent folder
   * @param name - Name of the new folder
   * @returns The created folder item
   */
  createFolder(parentId: string, name: string): Promise<StorageItem>;
  
  /**
   * Deletes an item by its ID.
   * @param itemId - ID of the item to delete
   */
  deleteItem(itemId: string): Promise<void>;
  
  /**
   * Moves an item to a new parent folder.
   * @param itemId - ID of the item to move
   * @param newParentId - ID of the new parent folder
   */
  moveItem(itemId: string, newParentId: string): Promise<void>;
  
  /**
   * Renames an item.
   * @param itemId - ID of the item to rename
   * @param newName - New name for the item
   * @returns The updated storage item
   */
  renameItem(itemId: string, newName: string): Promise<StorageItem>;
  
  /**
   * Uploads a file to a folder.
   * @param parentId - ID of the parent folder
   * @param file - File to upload
   * @returns The created file item
   */
  uploadFile(parentId: string, file: File): Promise<StorageItem>;
  
  /**
   * Retrieves the binary content of a file.
   * @param fileId - ID of the file
   * @returns Binary content and MIME type
   */
  getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string; }>;

  /**
   * Retrieves the path of an item by its ID.
   * @param itemId - ID of the item
   * @returns The path of the item
   */
  getPathById(itemId: string): Promise<string>;
}

/**
 * Custom error type for storage operations.
 * Provides additional context for storage-related errors.
 */
export class StorageError extends Error {
  /**
   * Creates a new storage error.
   * @param message - Error message
   * @param code - Error code for categorization
   * @param provider - ID of the provider where the error occurred
   */
  constructor(
    message: string,
    public code: string = 'UNKNOWN',
    public provider: string = 'unknown'
  ) {
    super(message);
    this.name = 'StorageError';
  }
} 