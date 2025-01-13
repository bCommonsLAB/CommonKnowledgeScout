import { ReactNode } from 'react';

export type StorageProviderType = 'local' | 'onedrive' | 'gdrive' | 'mock';

export interface StorageConfig {
  clientId?: string;      // Für OAuth Provider (OneDrive, GDrive)
  clientSecret?: string;  // Für OAuth Provider
  tenantId?: string;     // Für OneDrive Business
  redirectUri?: string;   // Für OAuth Flow
  scope?: string[];      // Für OAuth Berechtigungen
}

// Server-seitige vollständige Library mit Konfiguration
export interface Library {
  id: string;        
  label: string;     
  path: string;      
  icon?: ReactNode;   
  type: StorageProviderType;
  config?: StorageConfig;  // Provider-spezifische Konfiguration
  isEnabled: boolean;      
}

// Client-seitige Library-Ansicht ohne sensible Daten
export interface ClientLibrary {
  id: string;
  label: string;
  icon?: ReactNode;
  type: StorageProviderType;
  isEnabled: boolean;
}

export interface FileListItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;     // Optional für Ordner
  modified: Date;
  path: string;
  mimeType?: string; // Optional für Ordner
}

export interface FilePreview {
  id: string;
  name: string;
  content: string | Blob;
  mimeType: string;
  size: number;
  modified: Date;
  metadata?: Record<string, unknown>; // Zusätzliche Metadaten
} 