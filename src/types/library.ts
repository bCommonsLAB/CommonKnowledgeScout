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
 * - @ks/contracts: Steckbrief (ClientLibrary, LibraryProfile) und dessen Bausteine
 * - Keine React-Abhaengigkeit: Diese Datei muss serverseitig ladbar bleiben
 */

// Der Steckbrief einer Library liegt seit Welle M4d in @ks/contracts — kurz
// (LibraryProfile) und voll (ClientLibrary). Hier bleibt, was nur der Server
// kennt: StorageConfig mit den echten Zugangsdaten und der Library-Typ darum.
import type {
  StorageProviderType,
  TranslationsConfig,
  CaptureWizardsConfig,
  LibraryChatConfig,
} from '@ks/contracts';

// Re-Export als G2-Fassade, damit die bestehenden Importeure von
// '@/types/library' unveraendert bleiben.
export type {
  StorageProviderType,
  TranslationsConfig,
  CaptureWizardRef,
  CaptureWizardsConfig,
  GalleryGraphConfig,
  LibraryChatConfig,
  ClientLibrary,
  LibraryProfile,
} from '@ks/contracts';

/**
 * Ein einzelner Favoriten-Eintrag (Ordner-Lesezeichen innerhalb einer Library).
 * Wird direkt im Library-Dokument in MongoDB gespeichert.
 */
export interface FavoriteEntry {
  /** Storage-ID des favorisierten Ordners */
  id: string;
  /** Anzeigename des Ordners */
  name: string;
  /** Pfad-Labels fuer die Breadcrumb-Anzeige (z.B. ["root", "Projekte", "2026"]) */
  path?: string[];
  /** ISO-Zeitstempel des Hinzufuegens */
  addedAt: string;
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

  /** Nextcloud/WebDAV Konfiguration */
  nextcloud?: {
    /** WebDAV-URL (z.B. https://cloud.example.com/remote.php/dav/files/username) */
    webdavUrl: string;
    /** Nextcloud-Benutzername */
    username: string;
    /** App-Passwort (server-seitig, nie an Client senden). Optional, da es bei der Erstellung noch fehlen kann. */
    appPassword?: string;
  };

  /** Secretary Service Konfiguration */
  secretaryService?: {
    // === Verbindungskonfiguration ===
    /**
     * Benutzerdefinierte Verbindung aktiv: Wenn true, werden apiUrl/apiKey/useDirectConnection
     * aus dieser Config verwendet. Wenn false, gelten die ENV-Defaults – die gespeicherten
     * Werte bleiben erhalten, damit der Anwender zwischen Standard und Benutzerdefiniert
     * wechseln kann, ohne Eingaben zu verlieren.
     */
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
    /** Standard-Prompt für Cover-Bild-Generierung. Variablen: {{title}}, {{summary}} */
    coverImagePrompt?: string;

    // === Verbindungsmodus ===
    /**
     * Desktop-Modus: Ergebnisse werden aktiv abgeholt (SSE/Sync) statt per Webhook zugestellt.
     * Nur relevant, wenn useCustomConfig=true und apiUrl gesetzt ist.
     * Bei fehlender apiUrl gilt die automatische Erkennung (Electron).
     */
    useDirectConnection?: boolean;
  };

  /**
   * Azure Blob Storage für Ingestion (Medien nach Azure, Phase 3).
   * UI: Einstellungen → Story → „Binary Storage“.
   * useCustomConfig + connectionString + containerName → MongoDB-Werte.
   * Sonst Fallback auf AZURE_STORAGE_* aus der Prozess-Umgebung.
   */
  ingestionStorage?: {
    useCustomConfig?: boolean;
    connectionString?: string;
    containerName?: string;
  };

  /** Chat-/RAG-Konfiguration pro Library (öffentlich sichere Inhalte) */
  chat?: LibraryChatConfig;

  /**
   * Transformation: DIVA-Liefersystem-Daten auswerten.
   * Wenn true, erscheint im Archiv-File-Preview ein zusaetzlicher Tab
   * "DIVA-Info", sobald eine Sidecar-Datei (optionvalues.json) im
   * Grosseltern-Ordner des Texturverzeichnisses liegt UND ein Match fuer
   * die Textur existiert. Default: false.
   */
  analyzeDivaTextureInfo?: boolean;

  /**
   * Ausschluss-Muster fuer Storage-Scans (Welle 0b). Library-relative Globs:
   * ohne `/` = jeder Pfad-Abschnitt (`temp`, `*.tmp`), mit `/` = Pfad ab
   * Wurzel (`alt/archiv/**`). Uebersprungenes wird im Report gezaehlt.
   */
  scanExcludeGlobs?: string[];

  /**
   * E1 (Pilot-Wunschliste): Bekannte Namen/Organisationen der Library —
   * die Extraktion gleicht authors/participants/tags dagegen ab
   * (Hoerfehler wie „Eichner“ statt Aichner). KEIN Secret.
   */
  extractionKnownNames?: string[];

  /**
   * Agentensicht (Welle 1): Archiv-Konventionen sind ARCHIV-Wissen, nicht
   * Plattform-Wissen — deshalb pro Library konfigurierbar statt hartkodiert
   * (Projektauftrag F2). Fehlt das Feld, gelten die dokumentierten Defaults:
   * Vorhaben erkennt die Sicht dann ausschliesslich an der Selbstdeklaration
   * (`_INDEX.md` mit `bearbeitungsstand`), `_INDEX.md`-Pflicht ist inaktiv und
   * `bericht_veraltet` ist aktiv. KEIN Secret.
   */
  agentView?: {
    /** Agentensicht sichtbar/nutzbar (Menuepunkt + Seite). Default: false. */
    enabled?: boolean;
    /** Regex fuer Vorhabensordner (z. B. `^\\d{2}\\.\\d{2} `). Leer = nur Selbstdeklaration. */
    vorhabenFolderPattern?: string;
    /** Bis zu dieser Ordnertiefe ist `_INDEX.md` Pflicht; fehlt = Regel inaktiv. */
    indexRequiredMaxDepth?: number;
    /** `bericht_veraltet` pruefen (Default: true). */
    berichtFreshness?: boolean;
    /**
     * A7b: Ab wie vielen vollen Wochen Rueckstand meldet der Scan
     * `postfach_veraltet`? Grundlage ist `postfach_bis` im `BERICHT.md`
     * (Korrespondenz-Methode, Format `JJJJ-KWnn`). Fehlt das Feld, ist die
     * Regel INAKTIV — Libraries ohne Postfach-Auswertung sollen davon nichts
     * merken. Kein Secret.
     */
    postfachMaxRueckstandWochen?: number;
    /**
     * Lokaler Wurzelpfad des Archivs (F3): rendert im Auftrags-Generator
     * absolute Pfade fuer die Cowork-Session. Leer = archiv-relative Pfade.
     * KS kennt nur Provider-Pfade — dieser Wert ist reine Anzeige-Hilfe.
     */
    localRootPath?: string;
    /**
     * A6: kuratiertes Themen-Vokabular der Werkbank — hier organisiert und
     * normalisiert der Mensch seine Themen; der Themen-Editor bietet sie im
     * Dropdown an. Je Vorhaben wohnen die zugewiesenen Themen im `_INDEX.md`.
     */
    themen?: string[];
  };

  /**
   * Plan 2 · W-C (Δ2): Per-Library-Kuratierung der „Inhalte erfassen"-Wizards.
   * Fehlt das Feld, gilt das Bestandsverhalten; gesetzt → kuratierte Auswahl/
   * Reihenfolge (siehe `curateCreationTypes`). KEIN Secret.
   */
  captureWizards?: CaptureWizardsConfig;

  /**
   * Schwellwert fuer die Auto-Uebernahme der Stoffgruppen-Klassifikation
   * (Stufe 4). Wenn die Klassifikations-Konfidenz `confidence_class` einer
   * Gruppe diesen Wert erreicht, darf die UI "Alle Gruppen ueber dem Schwell-
   * wert uebernehmen" propagieren. Default: 0.9. Bereich [0, 1].
   */
  autoApplyConfidenceThreshold?: number;

  /**
   * Default-Voreinstellungen fuer das DIVA-Toolbar-Popover in der
   * Archiv-Dateiliste. Werden beim Library-Switch in die Atoms uebernommen;
   * Aenderungen im Popover sind danach per-Session, ueberschreiben aber nicht
   * automatisch die Defaults. Speichern als Standard erfolgt nur ueber das
   * Settings-Formular.
   */
  divaArchiveDefaults?: {
    /** 3-Wege-Filter: alle / nur mit DIVA-Info / nur ohne. */
    filterMode?: 'all' | 'with' | 'without';
    /** Gruppierungs-Attribut (z.B. `stoffgruppe`, `material`) oder `null` fuer keine. */
    groupByAttribute?: string | null;
    /** Zusatzspalten in der Dateiliste (z.B. `_thumbnail`, `Material`). */
    extraColumns?: string[];
  };

  /**
   * Doc-Translations-Konfiguration (Sprachen, in die publizierte Dokumente uebersetzt werden).
   * Vom globalen LanguageSwitcher konsumiert; Backend-Jobs erzeugen Uebersetzungen pro Locale.
   */
  translations?: TranslationsConfig;

  /** Shadow-Twin-Modus pro Library */
  shadowTwin?: {
    /** Modus: 'legacy' (alte Heuristik) oder 'v2' (neue Namenskonventionen) */
    mode?: 'legacy' | 'v2';
    /**
     * @deprecated Wird seit Welle 2 (Legacy-Ausbau) NICHT mehr gelesen —
     * Mongo ist immer primaerer Store. Das Feld bleibt nur fuer
     * DB-/Rollback-Kompatibilitaet im Typ und wird weiterhin mit 'mongo'
     * geschrieben.
     */
    primaryStore?: 'filesystem' | 'mongo';
    /** Shadow-Twins zusaetzlich ins Filesystem schreiben */
    persistToFilesystem?: boolean;
    /** Nach Migration Shadow-Twins aus dem Filesystem entfernen */
    cleanupFilesystemOnMigrate?: boolean;
    /** Legacy-Fallback lesen, falls Mongo-Eintrag fehlt */
    allowFilesystemFallback?: boolean;
  };

  /** Creation-Flow-Konfiguration pro Library */
  creation?: {
    /** Liste der verfügbaren Creation-Typen in dieser Library */
    types?: Array<{
      /** Eindeutige ID des Creation-Typs (z.B. 'event', 'testimonial', 'job') */
      id: string;
      /** Anzeigename für die UI */
      label: string;
      /** Beschreibung für die UI */
      description: string;
      /** Template-ID (Name ohne .md) */
      templateId: string;
      /** Icon-Name (z.B. 'calendar', 'quote', 'briefcase') */
      icon?: string;
    }>;
  };

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
    /**
     * Flag: Auf der Homepage listen.
     * Wenn `false`, bleibt die Library über ihren Slug erreichbar, wird aber nicht in der Homepage-Liste angezeigt.
     *
     * WICHTIG (Backwards-Compatibility):
     * Wenn das Feld fehlt, behandeln wir es als `true`, damit bestehende Libraries weiterhin gelistet werden.
     */
    showOnHomepage?: boolean;
    /** Zugriff nur nach Freigabe/Einladung erforderlich */
    requiresAuth?: boolean;
    /** URL für Hintergrundbild auf der Homepage */
    backgroundImageUrl?: string;
    /**
     * Logo-URL der Website-Landingpage (Phase C2). Wird in der TopNav im
     * Site-Kontext (Explore-Slug/Domain-Root) links angezeigt. Muss anonym
     * ladbar sein (oeffentliche Blob-URL, keine auth-gegatete Route).
     */
    logoUrl?: string;
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
      /** Untertitel unter der Überschrift */
      subtitle?: string;
      /** Absatz unter der Headline */
      intro?: string;
      /** Titel „Themenübersicht" */
      topicsTitle?: string;
      /** Erklärungstext zur Themenübersicht */
      topicsIntro?: string;
    };
    /**
     * Website-Landingpage am Slug: Wenn `true`, zeigt `/explore/<slug>` die aus
     * Live-Dokumenten (`detailViewType: website`, Menue nach `menu_order`)
     * gerenderte Landingpage statt der Galerie. Ersetzt das fruehere
     * `web/`-Snapshot-Publishing (kein Azure-Snapshot mehr).
     */
    siteEnabled?: boolean;
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
  
  /** Optionaler Lucide-Icon-Name (z. B. 'Globe'), aufgeloest von der aufrufenden UI */
  icon?: string;
  
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

  /** Favorisierte Ordner (Lesezeichen) – in MongoDB persistiert */
  favorites?: FavoriteEntry[];
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