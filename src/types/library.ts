/**
 * Core library type definitions.
 * Contains all types related to library configuration and management.
 */

import { ReactNode } from 'react';

/**
 * Supported storage provider types.
 * Each type represents a different storage backend implementation.
 */
export type StorageProviderType = 'local' | 'onedrive' | 'gdrive';

/**
 * Configuration options for storage providers.
 * Contains provider-specific settings and authentication details.
 */
export interface StorageConfig {
  /** OAuth client ID for authentication */
  clientId?: string;
  
  /** OAuth client secret (server-side only) */
  clientSecret?: string;
  
  /** Tenant ID for enterprise providers (e.g., OneDrive Business) */
  tenantId?: string;
  
  /** OAuth redirect URI for authentication flow */
  redirectUri?: string;
  
  /** Required OAuth permission scopes */
  scope?: string[];
}

/**
 * Server-side library configuration.
 * Complete library settings including sensitive data.
 */
export interface Library {
  /** Unique identifier for the library */
  id: string;
  
  /** Display name shown in the UI */
  label: string;
  
  /** Base path for local filesystem providers */
  path: string;
  
  /** Optional icon component for UI representation */
  icon?: ReactNode;
  
  /** Type of storage provider used */
  type: StorageProviderType;
  
  /** Provider-specific configuration */
  config?: StorageConfig;
  
  /** Whether the library is currently active */
  isEnabled: boolean;
  
  /** Transcription storage strategy:
   * - 'shadowTwin': stored alongside original file
   * - 'db': stored in database
   */
  transcription: 'shadowTwin' | 'db';
}

/**
 * Client-side library representation.
 * Excludes sensitive configuration data for security.
 */
export interface ClientLibrary {
  /** Unique identifier matching server-side library */
  id: string;
  
  /** Display name shown in the UI */
  label: string;
  
  /** Type of storage provider used */
  type: StorageProviderType;
  
  /** Base path for local filesystem providers */
  path: string;
  
  /** Whether the library is currently active */
  isEnabled: boolean;
  
  /** Safe configuration data (excludes sensitive information) */
  config: Record<string, unknown>;
}

/**
 * UI representation of a file or folder.
 * Used in list views and file browsers.
 */
export interface FileListItem {
  /** Unique identifier */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Item type */
  type: 'file' | 'folder';
  
  /** File size in bytes (undefined for folders) */
  size?: number;
  
  /** Last modification timestamp */
  modified: Date;
  
  /** Full path within the library */
  path: string;
  
  /** MIME type for files (undefined for folders) */
  mimeType?: string;

  /** Indicates if this file has a markdown transcription twin */
  hasTranscript?: boolean;
}

/**
 * File preview information.
 * Contains data needed for rendering file previews.
 */
export interface FilePreview {
  /** Unique identifier */
  id: string;
  
  /** File name */
  name: string;
  
  /** File content as string or binary blob */
  content: string | Blob;
  
  /** MIME type for rendering */
  mimeType: string;
  
  /** File size in bytes */
  size: number;
  
  /** Last modification timestamp */
  modified: Date;
  
  /** Additional metadata for preview rendering */
  metadata?: Record<string, unknown>;
} 