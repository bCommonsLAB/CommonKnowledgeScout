/**
 * @fileoverview DIVA-Texture-Liefersystem — gemeinsame Typen (Stufe 1).
 *
 * @description
 * Typen fuer den Sidecar-Loader, den heuristischen Matcher und die
 * API-/UI-Schicht. Rein deterministisch, kein LLM. Feldquelle:
 * docs/diva-texture-analysen/api2_GetJsonOptionValues_sample.json.
 */

/**
 * Ein einzelner Eintrag aus `Optionvalues` der Sidecar-Datei.
 * 1:1-Abbild der Liefersystem-Stammdaten (Felder optional, da extern).
 * Stabiler Schluessel fuer Texturen ist `PFTFile` (nicht VCodex).
 */
export interface OptionvalueEntry {
  /** Optional — Liefersystem liefert VCodex nicht immer. */
  VCodex?: string
  Name?: string
  Image?: string
  ImageIndex?: string
  ImageHeight?: string
  /** Achtung: Tippfehler stammt aus den Original-Stammdaten ("Widht"). */
  ImageWidht?: string
  IsTexture: string
  RGB?: string
  UseMapping?: string
  /**
   * Stabiler Textur-Schluessel (Dateistamm ohne Map-Suffix).
   * Pflicht fuer IsTexture==="True"-Eintraege im Loader.
   */
  PFTFile?: string
  IsOPVG?: string
  /**
   * Stoffgruppe aus dem Liefersystem (kann Verschleierung sein).
   * Parallel immer auch OPVGroupName auslesen — kein Fallback dazwischen.
   */
  GroupName?: string
  /**
   * OPV-Stoffgruppe aus dem Liefersystem (z.B. "PERLA-Kollektion (Stoff)").
   * Eigenstaendiges Feld neben GroupName — beide an UI und LLM.
   */
  OPVGroupName?: string
  TextureName?: string
  Material?: string
}

/** Sidecar-Eintrag samt seines Schluessels im `Optionvalues`-Objekt. */
export interface SupplierEntry {
  /** Schluessel im Optionvalues-Objekt, z.B. "OPV3_ST_2031_0477". */
  key: string
  entry: OptionvalueEntry
}

/** Welches Feld ein Match-Versuch geprueft hat. */
export type MatchField = 'PFTFile' | 'TextureName'

/** Protokoll eines einzelnen Match-Versuchs (auch Misses) fuer User-Verifikation. */
export interface MatchAttempt {
  /** Strategie-ID, z.B. "pftfile-exact" | "texturename-exact". */
  strategy: string
  field: MatchField
  /** Optionvalues-Schluessel des geprueften Eintrags. */
  entryKey: string
  /** Aus dem Dateinamen abgeleiteter, normalisierter Vergleichswert. */
  candidate: string
  /** Normalisierter Wert des Sidecar-Felds. */
  target: string
  matched: boolean
}

/** Ergebnis des Matchers: erster Treffer (oder null) + alle Versuche. */
export interface MatchResult {
  match: { entry: OptionvalueEntry; entryKey: string; strategy: string } | null
  attempts: MatchAttempt[]
}

/** Ergebnis des Sidecar-Loaders. */
export interface SupplierData {
  /** Dateiname der Sidecar-Datei (fuer Logging/UI). */
  sourceFileName: string
  /** Aenderungsdatum der Sidecar-Datei (Storage-Metadaten). */
  modifiedAt: Date
  /** Nur Eintraege mit IsTexture === "True". */
  entries: SupplierEntry[]
  /** Anzahl ausgefilterter Eintraege mit IsTexture !== "True" (ignoriert). */
  ignoredNonTextureCount: number
}

/** Quellbild-Wahl fuer die spaetere Analyse (Stufe 3). */
export type AnalysisSourceImage = 'basecolor' | 'supplier-preview'

/** Eine annotierte Datei (generische Attribut-Sicht fuer Filter/Gruppierung). */
export interface ItemAnnotation {
  fileName: string
  fileId: string
  /** Stabiler Item-Key (= PFTFile bei DIVA-Texturen). */
  itemKey: string
  /** Flache, gruppier-/filterbare Attribute (z.B. stoffgruppe, material, divaTexture). */
  attributes: Record<string, unknown>
  /**
   * Rohes Sidecar-Snapshot (1:1 OptionvalueEntry) — wird vom Frontend genutzt,
   * um zusaetzliche Spalten in der Dateiliste anzuzeigen (Material, TextureName,
   * Preview-Bitmap aus `Image`, …). Optional, weil nicht jede Annotation einen
   * Sidecar-Treffer haben muss.
   */
  entry?: OptionvalueEntry
}

/** Antwortschema GET /api/library/[libraryId]/item-annotations?parentId=X. */
export interface ItemAnnotationsResponse {
  parentId: string
  annotations: ItemAnnotation[]
}

/** Antwortschema der API-Route GET /api/diva-texture/supplier-data. */
export interface SupplierDataApiResponse {
  matched: boolean
  /** Sidecar-Datei im Texturverzeichnis gefunden (unabhaengig vom Match). */
  sidecarFound: boolean
  /** Anzahl IsTexture==="True"-Eintraege in der Sidecar (nur wenn sidecarFound). */
  entryCount?: number
  entry?: OptionvalueEntry
  /** Stabile Material-ID (= PFTFile des Treffers); Bindung der Bildwahl. */
  materialId?: string
  strategy?: string
  attempts: MatchAttempt[]
}
