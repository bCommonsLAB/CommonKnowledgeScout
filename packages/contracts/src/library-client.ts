/**
 * @fileoverview Voller Library-Steckbrief (Client-Sicht)
 *
 * @description
 * `ClientLibrary` ist die Sicht des angemeldeten Nutzers auf eine Library:
 * alles, was die App zum Arbeiten braucht, ohne die serverseitigen Secrets.
 * `library-service.ts` maskiert vor der Auslieferung (u.a.
 * `secretaryService.apiKey`).
 *
 * Fuer oeffentliche, nicht angemeldete Ansichten gibt es den kurzen
 * Steckbrief `LibraryProfile` (`library-profile.ts`) — er beschreibt die
 * flache Projektion, die `GET /api/public/libraries` liefert.
 *
 * @module contracts/library-client
 */

import type { StorageProviderType, TranslationsConfig, CaptureWizardsConfig } from './library-config'
import type { LibraryChatConfig } from './library-chat'

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
      /** Benutzerdefinierte Verbindung aktiv (Standard: false → ENV-Defaults) */
      useCustomConfig?: boolean;

      /** API-URL des Secretary Service */
      apiUrl: string;
      
      /** API-Key für die Authentifizierung */
      apiKey: string;

      // === Phase 1: Transkription ===
      /** Standard-Extraktionsmethode für PDF → Text (Default: mistral_ocr) */
      pdfExtractionMethod?: 'mistral_ocr' | 'native' | 'ocr' | 'both' | 'preview' | 'preview_and_native' | 'llm' | 'llm_and_ocr';

      // === Phase 2: Transformation ===
      /** Standard-Template für strukturierte Ausgabe (ohne .md) */
      template?: string;
      /** Standard-LLM-Modell für Template-Transformation */
      llmModel?: string;
      /** Standard-Zielsprache für Transformation */
      targetLanguage?: 'de' | 'en';
      /** Automatisch Cover-Bild bei Transformation generieren */
      generateCoverImage?: boolean;
      /** Standard-Prompt für Cover-Bild-Generierung */
      coverImagePrompt?: string;

      // === Verbindungsmodus ===
      /** Desktop-Modus: Ergebnisse aktiv abholen statt per Webhook. Nur relevant bei useCustomConfig=true. */
      useDirectConnection?: boolean;
    };
    /** Azure Ingestion Storage — Pflege unter Story → Binary Storage */
    ingestionStorage?: {
      useCustomConfig?: boolean;
      connectionString?: string;
      containerName?: string;
    };
    /** Chat-/RAG-Konfiguration für die UI */
    chat?: LibraryChatConfig;
    /** Transformation: DIVA-Liefersystem-Daten auswerten (DIVA-Info-Tab). Default false. */
    analyzeDivaTextureInfo?: boolean;
    /** Ausschluss-Muster fuer Storage-Scans (Welle 0b). */
    scanExcludeGlobs?: string[];
    /** E1: Bekannte Namen fuer die Extraktion (kein Secret). */
    extractionKnownNames?: string[];
    /** Agentensicht-Konventionen (Welle 1/3) — kein Secret, siehe StorageConfig.agentView. */
    agentView?: {
      enabled?: boolean;
      vorhabenFolderPattern?: string;
      indexRequiredMaxDepth?: number;
      berichtFreshness?: boolean;
      localRootPath?: string;
      /** A6: kuratiertes Themen-Vokabular (Dropdown des Themen-Editors). */
      themen?: string[];
    };
    /** Plan 2 · W-C: Kuratierung der „Inhalte erfassen"-Wizards (kein Secret). */
    captureWizards?: CaptureWizardsConfig;
    /**
     * Schwellwert fuer Auto-Uebernahme bei Stoffgruppen-Klassifikation (Stufe 4).
     * Bereich [0, 1], Default 0.9.
     */
    autoApplyConfidenceThreshold?: number;

    /** Defaults fuer das DIVA-Toolbar-Popover in der Archiv-Dateiliste. */
    divaArchiveDefaults?: {
      filterMode?: 'all' | 'with' | 'without';
      groupByAttribute?: string | null;
      extraColumns?: string[];
    };
    /** Doc-Translations-Konfiguration (clientseitig sichtbar, weil reine Sprach-Praeferenzen) */
    translations?: TranslationsConfig;
    /** Creation-Flow-Konfiguration für die UI */
    creation?: {
      types?: Array<{
        id: string;
        label: string;
        description: string;
        templateId: string;
        icon?: string;
      }>;
    };
    /** Public-Publishing-Daten (ohne API-Key) */
    publicPublishing?: {
      slugName: string;
      publicName: string;
      description: string;
      icon?: string;
      isPublic: boolean;
      /** Siehe serverseitiges Feld `publicPublishing.showOnHomepage` (fehlend => true) */
      showOnHomepage?: boolean;
      /** Zugriff nur nach Freigabe/Einladung erforderlich */
      requiresAuth?: boolean;
      /** URL für Hintergrundbild auf der Homepage */
      backgroundImageUrl?: string;
      /** Logo-URL der Website-Landingpage (siehe serverseitiges Feld, Phase C2) */
      logoUrl?: string;
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
        /** Name des Galerie-Menüpunkts in der öffentlichen TopNav (leer = „Inhalte") */
        menuLabel?: string;
        /** Text des „mehr Inhalte"-Links auf der Website-Landingpage (leer = Standard) */
        moreLinkLabel?: string;
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
      /** Website-Landingpage am Slug (siehe serverseitiges publicPublishing.siteEnabled) */
      siteEnabled?: boolean;
    };
    /** Nextcloud/WebDAV-Konfiguration (maskiertes App-Passwort fuer die UI) */
    nextcloud?: {
      webdavUrl: string;
      username: string;
      /** Maskierter Wert ('********') oder leer – das echte Passwort bleibt server-seitig */
      appPassword?: string;
    };
    [key: string]: unknown;
  };
  
  /** Optionaler Lucide-Icon-Name (z. B. 'Globe'), aufgeloest von der aufrufenden UI */
  icon?: string;

  /** Markiert Libraries, die ueber eine Einladung geteilt wurden (nicht im Besitz des Users) */
  isShared?: boolean;

  /** Slug fuer die Explore-Seite (bei geteilten Libraries fuer Navigation) */
  slug?: string;

  /**
   * Zugriffsrolle des aktuellen Users fuer diese Library.
   * - 'owner': Voller Zugriff inkl. Settings
   * - 'co-creator': Voller Arbeitszugriff (Archiv, Explore, Story, Templates), kein Settings-Zugang
   * - 'contributor': Darf erfassen (Submissions) + eigenen Preview sehen, nicht publizieren (ADR-0004 E2)
   * - 'moderator': Zugriffsanfragen verwalten
   * - 'reader': Nur Lese-Zugriff (ueber Einladung/Access Request)
   */
  accessRole?: 'owner' | 'co-creator' | 'contributor' | 'moderator' | 'reader';
}
