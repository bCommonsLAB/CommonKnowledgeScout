/**
 * @fileoverview Chat-/Galerie-Konfiguration einer Library
 *
 * @description
 * `LibraryChatConfig` beschreibt, wie Chat und Galerie einer Library sich
 * verhalten — UI-Parameter, Feature-Flags, Modell-Overrides und die
 * Galerie-Facetten. Sie ist Teil beider Steckbriefe: der kurze liefert sie
 * oeffentlich mit, der volle traegt sie unter `config.chat`.
 *
 * @module contracts/library-chat
 */

import type {
  TargetLanguage,
  Character,
  SocialContext,
  AccessPerspective,
} from './chat-vocabulary'

/**
 * Generische Graph-Modus-Konfiguration pro Library
 * (Zielbild §8: `config.chat.gallery.graph`).
 *
 * Macht den Beziehungs-/Metadaten-Graphen GENERISCH: Knoten-Encodings
 * (Größe/Farbe/Deckkraft) und Kantenquellen sind reine Feldnamen-Verweise auf
 * `DocCardMeta`-Schlüssel — der Graph kennt keine Klima-Felder. Die Klima-
 * Belegung (co2_einsparung_kt=Größe, dominant_perspektive=Farbe,
 * durchsetzbarkeit=Deckkraft) ist nur die Konfiguration EINER Library.
 *
 * Flach im Sinne der Frontmatter-Regel ist hier NICHT gefordert: Dies ist
 * Library-Config (MongoDB, downstream), kein Template-Frontmatter.
 */
export interface GalleryGraphConfig {
  /** Graph-Modus als dritter ViewMode (`grid|table|graph`) aktivieren. */
  enabled?: boolean;
  /** Vorausgewählte Kantenquelle. */
  defaultEdgeSource?: 'relations' | 'sharedMeta' | 'similarity';
  /** Numerischer meta-Key → Knotengröße (z.B. `co2_einsparung_kt`). */
  sizeField?: string;
  /** `0..1` meta-Key → Knoten-Deckkraft (z.B. `durchsetzbarkeit`). */
  opacityField?: string;
  /** Kategorischer meta-Key → Knoten-Farbe (z.B. `dominant_perspektive`). */
  colorField?: string;
  /** Wert → Farbe (Hex/CSS) für `colorField`. */
  colorMap?: Record<string, string>;
  /** Anzeige-Begrenzung: max. Kanten pro Knoten (Hairball-Schutz). */
  maxEdgesPerNode?: number;
  /** Anzeige-Begrenzung: max. Kanten gesamt. */
  maxEdgesTotal?: number;
  /** Mindest-Gewicht, ab dem eine Kante gezeigt wird (`0..1`). */
  minWeight?: number;
  /** Umschaltbare Kantenquellen (Zielbild §5). */
  edgeSources?: {
    /** Quelle A — berechnete Beziehungen (LLM), ab Welle 4. */
    relations?: { enabled?: boolean; relationType?: string; relationPrompt?: string };
    /** Quelle B — gemeinsame Metadaten (Obsidian-Stil), ab Welle 2. */
    sharedMeta?: {
      enabled?: boolean;
      /** Meta-Felder, über die sich Dokumente verbinden (z.B. `category`, `tags`). */
      fields?: string[];
      /** `hub` = bipartite Tag-Hubs, `projection` = Dokument↔Dokument. */
      mode?: 'hub' | 'projection';
      /** Projektion: Mindestanzahl geteilter Werte für eine Kante. */
      minShared?: number;
    };
    /** Quelle C — Embedding-Ähnlichkeit, ab Welle 3. */
    similarity?: { enabled?: boolean; topK?: number };
  };
}

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

  /** Embedding-Provider-Konfiguration (Secretary Service RAG API) */
  embeddings?: {
    /** Embedding-Modell (z.B. 'voyage-3-large', 'text-embedding-3-large') */
    embeddingModel?: string;
    /** Chunk-Größe in Zeichen (Standard: 1000) */
    chunkSize?: number;
    /** Chunk-Overlap in Zeichen (Standard: 200) */
    chunkOverlap?: number;
    /** Embedding-Dimension (Standard: 2048 für voyage-3-large, 3072 für text-embedding-3-large) */
    dimensions?: number;
  };

  /** Vektor-Store-Overrides; Index = Libraryname, außer es wird überschrieben */
  vectorStore?: {
    /** MongoDB Collection-Name (wird automatisch gesetzt bei Migration) */
    collectionName?: string;
  };

  /** Zielsprache für Chat-Antworten */
  targetLanguage?: TargetLanguage;

  /** Charakter/Profil für die Antwort-Perspektive (Array mit max. 3 Werten, kann leer sein) */
  character?: Character[];

  /** Zugangsperspektive (Array mit max. 3 Werten, kann leer sein) */
  accessPerspective?: AccessPerspective[];

  /** Sozialer Kontext/Sprachebene */
  socialContext?: SocialContext;

  /** Gendergerechte Formulierung aktivieren/deaktivieren */
  genderInclusive?: boolean;

  /** Benutzer-Präferenzen für Chat-Einstellungen (werden beim Start gespeichert) */
  userPreferences?: {
    targetLanguage?: TargetLanguage;
    /** Charakter/Profil für die Antwort-Perspektive (Array mit max. 3 Werten, kann leer sein) */
    character?: Character[];
    /** Zugangsperspektive (Array mit max. 3 Werten, kann leer sein) */
    accessPerspective?: AccessPerspective[];
    socialContext?: SocialContext;
    genderInclusive?: boolean;
  };

  /** Gallery-Konfiguration für die Wissensgalerie */
  gallery?: {
    /** Typ der Detailansicht für verschiedene Dokumenttypen */
    detailViewType?: 'book' | 'session' | 'climateAction' | 'testimonial' | 'blog' | 'divaDocument' | 'divaTexture' | 'refurbedDevice' | 'website';
    /**
     * Anzeige: Generisches SDG-Profil (SDG-Rad, 17 Nachhaltigkeitsziele) in der
     * Detailansicht. Wenn true, wird das Rad gerendert, sofern die Felder
     * `sdg_1..sdg_17` (+ optional `sdg_begruendung`) in `docMetaJson` vorhanden
     * sind. Library-/Story-uebergreifend nutzbar. Default: false.
     */
    showSdgProfile?: boolean;
    /**
     * Raster der Karten in der Grid-Ansicht: kompakt (mehr Spalten) vs. komfortabel (weniger, größere Kacheln).
     * Default in der App: comfortable, wenn nicht gesetzt.
     */
    galleryCardDensity?: 'compact' | 'comfortable';
    /** Gruppierungsfeld für die Galerie-Ansicht: 'none', 'year', oder ein Facetten-Key (z.B. 'category') */
    groupByField?: string;
    /**
     * Default-Sortierfeld der Galerie-Liste (innerhalb der Gruppen bzw. der
     * flachen Liste): 'upsertedAt' (Standard, zuletzt aktualisiert) oder ein
     * Facetten-Key (z.B. 'date'). Sortiert wird auf `docMetaJson.<feld>`.
     */
    defaultSortField?: string;
    /** Richtung der Default-Sortierung. Default: 'desc'. */
    defaultSortDirection?: 'asc' | 'desc';
    /** Facetten-Definitionen für Filter */
    facets?: Array<{
      metaKey: string;
      label?: string;
      type?: 'string' | 'number' | 'boolean' | 'string[]' | 'date' | 'integer-range';
      multi?: boolean;
      visible?: boolean;
      buckets?: Array<{ label: string; min: number; max: number }>;
    }>;
    /**
     * Generische Graph-Modus-Konfiguration (Zielbild §8). Liegt unter
     * `chat.gallery`, damit sie neben `detailViewType`/`facets` editierbar ist.
     */
    graph?: GalleryGraphConfig;
  };

  }
