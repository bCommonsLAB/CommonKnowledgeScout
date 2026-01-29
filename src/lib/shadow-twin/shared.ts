/**
 * @fileoverview Shadow-Twin Shared Types and Logic
 * 
 * @description
 * Gemeinsame Typen und Interfaces für Shadow-Twin-States.
 * Werden sowohl im Backend (Job-Dokumente) als auch im Frontend (Jotai-Atoms) verwendet.
 * 
 * @module shadow-twin
 * 
 * @exports
 * - ShadowTwinState: Interface für Shadow-Twin-Informationen
 */

import { StorageItem } from '@/lib/storage/types';

/**
 * Shadow-Twin-State für eine einzelne Datei
 * 
 * Wird sowohl im Job-Dokument (MongoDB) als auch im Frontend-State (Jotai) verwendet.
 * Für MongoDB: baseItem wird als Referenz gespeichert (nur ID und Name),
 * für Frontend: vollständiges StorageItem-Objekt.
 */
/**
 * Verarbeitungsstatus des Shadow-Twins
 * - 'pending': Shadow-Twin wurde noch nicht erstellt (Job noch nicht gestartet)
 * - 'processing': Job läuft noch, Shadow-Twin wird erstellt
 * - 'ready': Shadow-Twin ist vollständig und kann gerendert werden (Job abgeschlossen)
 * - 'error': Fehler bei der Erstellung
 */
export type ShadowTwinProcessingStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface ShadowTwinState {
  /** Die Basis-Datei (Original) - im Job-Dokument nur ID/Name, im Frontend vollständig */
  baseItem: StorageItem | { id: string; metadata: { name: string } };
  /** Finale Markdown-Datei (mit Metadaten/Frontmatter nach Template-Phase) */
  transformed?: StorageItem | { id: string; metadata: { name: string } };
  /** 
   * Audio/Video-Transkripte ODER initiales Markdown ohne Frontmatter (nach Extract-Phase).
   * Für PDFs: Optional das initiale Markdown ohne Frontmatter, falls es als separate Datei gespeichert wurde.
   * In der Regel ist dies jedoch die gleiche Datei wie `transformed`, nur zu einem früheren Zeitpunkt.
   */
  transcriptFiles?: Array<StorageItem | { id: string; metadata: { name: string } }>;
  /** ID des Shadow-Twin-Verzeichnisses (falls vorhanden) */
  shadowTwinFolderId?: string;
  /** Audio/Video-Dateien (falls vorhanden) */
  mediaFiles?: Array<StorageItem | { id: string; metadata: { name: string } }>;
  /** Zeitstempel der Analyse */
  analysisTimestamp: number;
  /** Fehlermeldung bei der Analyse (falls vorhanden) */
  analysisError?: string;
  /** 
   * Verarbeitungsstatus des Shadow-Twins
   * Wird basierend auf dem Job-Status gesetzt:
   * - 'pending': Job noch nicht gestartet oder Shadow-Twin noch nicht erkannt
   * - 'processing': Job läuft noch (status: 'running' oder 'queued')
   * - 'ready': Job abgeschlossen (status: 'completed') und Shadow-Twin vollständig
   * - 'error': Job fehlgeschlagen (status: 'failed') oder Analyse-Fehler
   */
  processingStatus?: ShadowTwinProcessingStatus;
  /** Ingestion-Status (Story/Veröffentlichung) - nur im Frontend verfügbar */
  ingestionStatus?: {
    exists: boolean;
    chunkCount?: number;
    chaptersCount?: number;
  };
  /**
   * Gibt an, ob Binary-Uploads (z.B. Cover-Bilder) für dieses Shadow-Twin möglich sind.
   * 
   * Diese Information abstrahiert die Storage-Implementierung:
   * - MongoDB-Modus: true (Upload geht direkt nach Azure, kein lokales Verzeichnis nötig)
   * - Filesystem-Modus: true wenn shadowTwinFolderId vorhanden
   * 
   * Die UI sollte nur dieses Feld prüfen, nicht die Storage-Implementierung.
   */
  binaryUploadEnabled?: boolean;
  
  /**
   * Validierungsfehler, falls die Daten inkonsistent sind.
   * 
   * Wenn gesetzt, sind schreibende Features (Upload, Generieren) blockiert.
   * Das "Bearbeiten"-Feature bleibt aktiv für manuelle Reparatur.
   * 
   * Beispiele:
   * - "templateName fehlt für Transformation"
   * - "targetLanguage fehlt"
   */
  validationError?: string;
  
  /**
   * Zeigt an, ob eine automatische Reparatur durchgeführt wurde.
   * Falls true, wird eine Info-Meldung angezeigt.
   */
  wasAutoRepaired?: boolean;
  
  /**
   * Details zur automatischen Reparatur (für Logging/UI).
   */
  autoRepairInfo?: string;
}

/**
 * Validiert und repariert einen Shadow-Twin-State.
 * 
 * Prüft auf Pflichtfelder und versucht fehlende Daten zu rekonstruieren.
 * Wenn eine Reparatur nicht möglich ist, wird ein Fehler gesetzt.
 * 
 * @param state Der zu validierende State
 * @param frontmatter Frontmatter aus dem Markdown (falls verfügbar)
 * @param libraryConfig Library-Konfiguration (für Fallback-Werte)
 * @returns Der validierte/reparierte State (Mutation des Inputs)
 */
export function validateAndRepairShadowTwin(
  state: ShadowTwinState,
  frontmatter?: Record<string, unknown>,
  libraryConfig?: { templateName?: string; targetLanguage?: string }
): ShadowTwinState {
  // Reset vorheriger Validierung
  state.validationError = undefined;
  state.wasAutoRepaired = false;
  state.autoRepairInfo = undefined;
  
  // Nur Transformationen validieren (haben transformed-Feld)
  if (!state.transformed) {
    // Kein Shadow-Twin mit Transformation → keine Validierung nötig
    return state;
  }
  
  // Prüfe: Ist die transformed-ID eine Mongo-Shadow-Twin-ID?
  const transformedId = state.transformed.id;
  const isMongoId = transformedId.startsWith('mongo-shadow-twin:');
  
  if (isMongoId) {
    // Parse die ID um templateName zu prüfen
    // Format: mongo-shadow-twin:libraryId::sourceId::kind::lang::templateName
    const parts = transformedId.split('::');
    const kind = parts[2]; // 'transformation' oder 'transcript'
    const templateName = parts[4]; // templateName (kann leer sein)
    
    if (kind === 'transformation' && (!templateName || templateName.trim() === '')) {
      // templateName fehlt - versuche Reparatur
      const repairedTemplateName = 
        (frontmatter?.template_used as string) ||
        libraryConfig?.templateName;
      
      if (repairedTemplateName) {
        // Reparatur möglich - aber wir können die ID nicht ändern
        // Markiere als repariert für Logging, aber der Fix muss serverseitig passieren
        state.wasAutoRepaired = true;
        state.autoRepairInfo = `templateName="${repairedTemplateName}" aus ${frontmatter?.template_used ? 'Frontmatter' : 'Library-Config'} rekonstruiert`;
        
        // TODO: Server-seitige Reparatur implementieren
        // Für jetzt: Warnung setzen, Features erlauben
      } else {
        // Reparatur nicht möglich
        state.validationError = 
          'Template-Name fehlt für Transformation. ' +
          'Bitte bearbeiten Sie das Dokument und setzen Sie "template_used" im Frontmatter.';
      }
    }
  }
  
  return state;
}

/**
 * Konvertiert einen vollständigen ShadowTwinState zu einer MongoDB-kompatiblen Version
 * (nur IDs und Namen, keine vollständigen StorageItem-Objekte)
 */
export function toMongoShadowTwinState(state: ShadowTwinState): ShadowTwinState {
  return {
    baseItem: {
      id: state.baseItem.id,
      metadata: { name: state.baseItem.metadata.name }
    },
    transformed: state.transformed ? {
      id: state.transformed.id,
      metadata: { name: state.transformed.metadata.name }
    } : undefined,
    transcriptFiles: state.transcriptFiles?.map(item => ({
      id: item.id,
      metadata: { name: item.metadata.name }
    })),
    shadowTwinFolderId: state.shadowTwinFolderId,
    mediaFiles: state.mediaFiles?.map(item => ({
      id: item.id,
      metadata: { name: item.metadata.name }
    })),
    analysisTimestamp: state.analysisTimestamp,
    analysisError: state.analysisError,
    processingStatus: state.processingStatus,
    binaryUploadEnabled: state.binaryUploadEnabled,
  };
}


