/**
 * Core library type definitions.
 * Contains all types related to library configuration and management.
 */

import { ReactNode } from 'react';
import type { Character } from './character';

/**
 * Supported storage provider types.
 * Each type represents a different storage backend implementation.
 */
export type StorageProviderType = 'local' | 'onedrive' | 'gdrive';

/**
 * Chat/RAG-spezifische Konfiguration pro Library.
 * UI-Parameter, Feature-Flags und optionale Modell-/Store-Overrides.
 * Der Vektor-Index leitet sich standardmäßig aus dem Library-Namen ab,
 * sofern kein expliziter Override gesetzt ist.
 */
export interface LibraryChatConfig {
  /** Ob der Chat öffentlich zugreifbar ist (ohne Login) */
  public?: boolean;

  /** Avatarbild der Chat-Ansicht */
  titleAvatarSrc?: string;

  /** Begrüßungstext */
  welcomeMessage: string;

  /** Generische Fehlermeldung für Chat-Antworten */
  errorMessage?: string;

  /** Platzhalter im Eingabefeld */
  placeholder?: string;

  /** Maximale Eingabelänge */
  maxChars?: number;

  /** Hinweistext bei Überschreitung der Eingabelänge */
  maxCharsWarningMessage?: string;

  /** Footer-Text unterhalb des Chats */
  footerText?: string;

  /** Link im Footer (z. B. Firmen-/Projektlink) */
  companyLink?: string;

  /** Feature-Flags für die Darstellung/Funktionalität */
  features?: {
    /** Zitate/Quellen anzeigen */
    citations?: boolean;
    /** Streaming von Teilantworten aktivieren */
    streaming?: boolean;
  };

  /** Ratenbegrenzung für öffentliche Nutzung */
  rateLimit?: {
    windowSec: number;
    max: number;
  };

  /** Modell-Overrides; Standardwerte über ENV konfigurierbar */
  models?: {
    chat?: string;
    embeddings?: string;
    temperature?: number;
  };

  /** Vektor-Store-Overrides; Index = Libraryname, außer es wird überschrieben */
  vectorStore?: {
    indexOverride?: string;
  };

  /** Zielsprache für Chat-Antworten */
  targetLanguage?: 'de' | 'en' | 'it' | 'fr' | 'es' | 'ar';

  /** Charakter/Profil für die Antwort-Perspektive */
  character?: Character;

  /** Sozialer Kontext/Sprachebene */
  socialContext?: 'scientific' | 'popular' | 'youth' | 'senior';
}

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

  /** Secretary Service Konfiguration */
  secretaryService?: {
    /** API-URL des Secretary Service */
    apiUrl: string;
    
    /** API-Key für die Authentifizierung */
    apiKey: string;

    /** PDF-Standardwerte pro Library (serverseitig wirksam) */
    pdfDefaults?: {
      /** Standard-Extraktionsmethode für PDF → Markdown */
      extractionMethod?: 'native' | 'ocr' | 'both' | 'preview' | 'preview_and_native' | 'llm' | 'llm_and_ocr' | 'mistral_ocr';
      /** Standard-Template-Name für Phase 2 (ohne .md) */
      template?: string;
    };
  };

  /** Chat-/RAG-Konfiguration pro Library (öffentlich sichere Inhalte) */
  chat?: LibraryChatConfig;
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
  
  /** Safe configuration data */
  config: {
    /** Secretary Service Konfiguration */
    secretaryService?: {
      /** API-URL des Secretary Service */
      apiUrl: string;
      
      /** API-Key für die Authentifizierung */
      apiKey: string;

      /** PDF-Standardwerte pro Library (UI-sicher) */
      pdfDefaults?: {
        extractionMethod?: 'native' | 'ocr' | 'both' | 'preview' | 'preview_and_native' | 'llm' | 'llm_and_ocr' | 'mistral_ocr';
        template?: string;
      };
    };
    /** Chat-/RAG-Konfiguration für die UI */
    chat?: LibraryChatConfig;
    [key: string]: unknown;
  };
  
  /** Optional icon component for UI representation */
  icon?: ReactNode;
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