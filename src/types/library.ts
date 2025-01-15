import { ReactNode } from 'react';

/**
 * Supported storage provider types.
 * Each type represents a different storage backend implementation.
 */
export type StorageProviderType = 'local' | 'onedrive' | 'gdrive';

/**
 * Configuration options for storage providers.
 * Contains authentication and connection settings.
 */
export interface StorageConfig {
  clientId?: string;      // OAuth client ID
  clientSecret?: string;  // OAuth client secret
  tenantId?: string;     // OneDrive Business tenant ID
  redirectUri?: string;   // OAuth redirect URI
  scope?: string[];      // OAuth permission scopes
}

/**
 * Server-side library configuration.
 * Contains complete library settings including sensitive data.
 * @property {string} id - Unique identifier for the library
 * @property {string} label - Display name of the library
 * @property {string} path - Base path for the library
 * @property {ReactNode} [icon] - Optional icon component
 * @property {StorageProviderType} type - Type of storage provider
 * @property {StorageConfig} [config] - Provider-specific configuration
 * @property {boolean} isEnabled - Whether the library is active
 * @property {string} transcription - Transcription 'shadowTwin' (stored in same directory as original file) or 'db' (stored in database) 
 */
export interface Library {
  id: string;
  label: string;
  path: string;
  icon?: ReactNode;
  type: StorageProviderType;
  config?: StorageConfig;
  isEnabled: boolean;
  transcription: string;
}

/**
 * Client-side library representation.
 * Excludes sensitive configuration data.
 * @property {string} id - Unique identifier for the library
 * @property {string} label - Display name of the library
 * @property {StorageProviderType} type - Type of storage provider
 * @property {string} path - Base path for the library
 * @property {boolean} isEnabled - Whether the library is active
 * @property {Record<string, unknown>} config - Safe configuration data
 */
export interface ClientLibrary {
  id: string;
  label: string;
  type: StorageProviderType;
  path: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
}

/**
 * Represents an item in the file list view.
 * Contains display-relevant metadata for files and folders.
 */
export interface FileListItem {
  id: string;           // Unique identifier
  name: string;         // Display name
  type: 'file' | 'folder';
  size?: number;        // File size (optional for folders)
  modified: Date;       // Last modification date
  path: string;         // Full path in the library
  mimeType?: string;    // MIME type (optional for folders)
}

/**
 * File preview information.
 * Contains data needed for rendering file previews.
 */
export interface FilePreview {
  id: string;           // Unique identifier
  name: string;         // File name
  content: string | Blob; // File content
  mimeType: string;     // MIME type for rendering
  size: number;         // File size in bytes
  modified: Date;       // Last modification date
  metadata?: Record<string, unknown>; // Additional metadata
} 