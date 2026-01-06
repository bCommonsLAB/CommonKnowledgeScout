/**
 * @fileoverview Shadow-Twin Artefakt Types - Zentrale Typdefinitionen
 * 
 * @description
 * Definiert die zentralen Typen für Shadow-Twin-Artefakte (Transkript vs Transformation).
 * Diese Types sind die Basis für deterministische IDs und eindeutige Artefakt-Identifikation.
 * 
 * @module shadow-twin
 * 
 * @exports
 * - ArtifactKind: Art des Artefakts (transcript vs transformation)
 * - SourceId: ID der Quelle (Storage-Item-ID)
 * - ArtifactKey: Vollständiger Schlüssel für ein Artefakt
 * - ParsedArtifactName: Ergebnis des Parsings eines Dateinamens
 */

/**
 * Art des Artefakts.
 * 
 * - 'transcript': Authentisches Abbild der Quelle (UC-A), Autor = Quelle
 * - 'transformation': User-autored, Template-basierte Interpretation (UC-B)
 */
export type ArtifactKind = 'transcript' | 'transformation';

/**
 * ID der Quelle (Storage-Item-ID).
 * 
 * WICHTIG: Dies ist die Storage-Item-ID, nicht der Dateiname oder Pfad.
 * Pfadunabhängig für Stabilität beim File-Sharing.
 */
export type SourceId = string;

/**
 * Vollständiger Schlüssel für ein Artefakt.
 * 
 * Bestimmt eindeutig ein Artefakt und ermöglicht deterministische Dateinamen-Generierung.
 * Gleicher ArtifactKey → gleicher Dateiname → Update statt Duplikat bei Re-Runs.
 */
export interface ArtifactKey {
  /** ID der Quelle (Storage-Item-ID) */
  sourceId: SourceId;
  /** Art des Artefakts */
  kind: ArtifactKind;
  /** Zielsprache (z.B. 'de', 'en') */
  targetLanguage: string;
  /** Template-Name (nur bei Transformation, sonst undefined) */
  templateName?: string;
}

/**
 * Ergebnis des Parsings eines Dateinamens.
 * 
 * Extrahiert ArtifactKind, targetLanguage und templateName aus einem Dateinamen.
 */
export interface ParsedArtifactName {
  /** Art des Artefakts (oder null wenn nicht erkennbar) */
  kind: ArtifactKind | null;
  /** Zielsprache (oder null wenn nicht erkennbar) */
  targetLanguage: string | null;
  /** Template-Name (nur bei Transformation, sonst null) */
  templateName: string | null;
  /** Basisname ohne Suffixe (für Rekonstruktion) */
  baseName: string;
}







