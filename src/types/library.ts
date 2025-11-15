/**
 * @fileoverview Library Type Definitions
 * 
 * @description
 * Contains all TypeScript types and interfaces related to library configuration and management.
 * Defines library structure, storage configuration, chat configuration, and public publishing
 * settings. Used throughout the application for type-safe library operations.
 * 
 * @module library
 * 
 * @exports
 * - StorageProviderType: Supported storage provider types
 * - LibraryChatConfig: Chat/RAG configuration per library
 * - StorageConfig: Storage provider configuration
 * - Library: Complete library type with all configurations
 * - ClientLibrary: Client-side library type
 * - PublicLibraryConfig: Public publishing configuration
 * 
 * @usedIn
 * - src/lib/services/library-service.ts: Library service uses these types
 * - src/atoms/library-atom.ts: Library state atoms use these types
 * - src/lib/storage/storage-factory.ts: Storage factory uses library types
 * - src/components/library: Library components use these types
 * - src/app/api/libraries: Library API routes use these types
 * 
 * @dependencies
 * - @/lib/chat/constants: Character and SocialContext types
 */

import { ReactNode } from 'react';
import type { Character } from '@/lib/chat/constants';
import type { SocialContext } from '@/lib/chat/constants';

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

  /** Charakter/Profil für die Antwort-Perspektive (Array mit max. 3 Werten, kann leer sein) */
  character?: Character[];

  /** Sozialer Kontext/Sprachebene */
  socialContext?: SocialContext;

  /** Gendergerechte Formulierung aktivieren/deaktivieren */
  genderInclusive?: boolean;

  /** Benutzer-Präferenzen für Chat-Einstellungen (werden beim Start gespeichert) */
  userPreferences?: {
    targetLanguage?: 'de' | 'en' | 'it' | 'fr' | 'es' | 'ar';
    /** Charakter/Profil für die Antwort-Perspektive (Array mit max. 3 Werten, kann leer sein) */
    character?: Character[];
    socialContext?: SocialContext;
    genderInclusive?: boolean;
  };

  /** Gallery-Konfiguration für die Wissensgalerie */
  gallery?: {
    /** Typ der Detailansicht: 'book' für klassische Dokumente, 'session' für Event-Sessions/Präsentationen */
    detailViewType?: 'book' | 'session';
    /** Facetten-Definitionen für Filter */
    facets?: Array<{
      metaKey: string;
      label?: string;
      type?: 'string' | 'number' | 'boolean' | 'string[]' | 'date' | 'integer-range';
      multi?: boolean;
      visible?: boolean;
      buckets?: Array<{ label: string; min: number; max: number }>;
    }>;
  };
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

  /** Öffentliche Veröffentlichungseinstellungen */
  publicPublishing?: {
    /** Eindeutiger Slug für URL (z.B. "sfscon-talks") */
    slugName: string;
    /** Öffentlicher Name für die Anzeige (z.B. "SFSCon Talks") */
    publicName: string;
    /** Beschreibung für öffentliche Teaser */
    description: string;
    /** Icon-Name aus Lucide oder URL für öffentliche Ansicht */
    icon?: string;
    /** OpenAI API-Key für anonyme Anfragen (serverseitig, nie an Client gesendet) */
    apiKey?: string;
    /** Flag für öffentliche Verfügbarkeit */
    isPublic: boolean;
    /** URL für Hintergrundbild auf der Homepage */
    backgroundImageUrl?: string;
    /** Gallery-spezifische Texte für die öffentliche Ansicht */
    gallery?: {
      /** Große Überschrift für die Gallery-Ansicht */
      headline?: string;
      /** Untertitel unter der Überschrift */
      subtitle?: string;
      /** Beschreibungstext unter der Überschrift */
      description?: string;
      /** Beschreibungstext für das Filter-Panel */
      filterDescription?: string;
    };
    /** Story-Modus-spezifische Texte für die öffentliche Ansicht */
    story?: {
      /** Überschrift im Story-Tab */
      headline?: string;
      /** Untertitel unter der Überschrift */
      subtitle?: string;
      /** Absatz unter der Headline */
      intro?: string;
      /** Titel „Themenübersicht" */
      topicsTitle?: string;
      /** Erklärungstext zur Themenübersicht */
      topicsIntro?: string;
    };
  };
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
    /** Public-Publishing-Daten (ohne API-Key) */
    publicPublishing?: {
      slugName: string;
      publicName: string;
      description: string;
      icon?: string;
      isPublic: boolean;
      /** URL für Hintergrundbild auf der Homepage */
      backgroundImageUrl?: string;
      /** Maskierter API-Key (erste 6 und letzte 4 Zeichen sichtbar, z.B. "sk-proj....................abcd") */
      apiKey?: string;
      /** Gallery-spezifische Texte für die öffentliche Ansicht */
      gallery?: {
        /** Große Überschrift für die Gallery-Ansicht */
        headline?: string;
        /** Untertitel unter der Überschrift */
        subtitle?: string;
        /** Beschreibungstext unter der Überschrift */
        description?: string;
        /** Beschreibungstext für das Filter-Panel */
        filterDescription?: string;
      };
      /** Story-Modus-spezifische Texte für die öffentliche Ansicht */
      story?: {
        /** Überschrift im Story-Tab */
        headline?: string;
        /** Absatz unter der Headline */
        intro?: string;
        /** Titel „Themenübersicht" */
        topicsTitle?: string;
        /** Erklärungstext zur Themenübersicht */
        topicsIntro?: string;
      };
    };
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