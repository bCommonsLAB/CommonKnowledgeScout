/**
 * @fileoverview Media Storage Strategy
 *
 * @description
 * Zentrale, abgeleitete Speicher-Strategie fuer bildliche Binaer-Fragmente in Shadow-Twins.
 * Variante C des Plans `media-storage-determinismus`: kein neues Konfig-Feld, stattdessen
 * eine deterministische Funktion, die aus den vorhandenen Library-Flags + Azure-Verfuegbarkeit
 * den effektiven Modus ableitet.
 *
 * Konsumiert wird das Ergebnis sowohl von Schreib- als auch Lese-Pfaden, sodass die
 * Entscheidung "wo liegt das Bild und wo wird es geladen?" nur an einer Stelle getroffen wird.
 *
 * @module shadow-twin
 *
 * @exports
 * - MediaStorageMode: Diskreter Modus
 * - MediaStorageStrategy: Vollstaendiges Strategie-Objekt
 * - getMediaStorageStrategy: Ableitungsfunktion
 *
 * @usedIn
 * - src/lib/shadow-twin/media-persistence-service.ts (Schreiben)
 * - src/app/api/storage/streaming-url/route.ts (Lesen)
 * - src/components/settings/library-form.tsx (UI-Anzeige)
 *
 * @dependencies
 * - @/types/library: Library-Typ
 * - @/lib/shadow-twin/shadow-twin-config: bestehender Konsument der Shadow-Twin-Flags
 */

import type { Library } from '@/types/library'
import { getShadowTwinConfig } from './shadow-twin-config'

/**
 * Diskreter Modus, der den effektiven Speicher- und Lese-Pfad fuer bildliche Binaer-Fragmente beschreibt.
 *
 * - `azure-only`: Bilder leben ausschliesslich in Azure. Kein Filesystem-Spiegel, kein FS-Fallback.
 * - `azure-with-fs-backup`: Primaer Azure, zusaetzlich Filesystem-Spiegel als Backup. FS-Fallback erlaubt.
 * - `filesystem-only`: Legacy-/lokales Setup ohne Azure (oder Azure absichtlich deaktiviert).
 * - `unavailable`: Konfiguration verlangt Azure, aber Azure ist nicht konfiguriert. Harter Fehler statt Silent-Drop.
 */
export type MediaStorageMode =
  | 'azure-only'
  | 'azure-with-fs-backup'
  | 'filesystem-only'
  | 'unavailable'

/**
 * Vollstaendige, von allen Pfaden konsumierbare Strategie.
 * Enthaelt sowohl die diskrete Mode-Variable als auch abgeleitete boolesche Flags
 * fuer schnelle Verzweigungen im Code.
 */
export interface MediaStorageStrategy {
  /** Diskreter Modus, fuer Trace-/Log-Ausgabe und UI-Anzeige */
  mode: MediaStorageMode
  /** Soll beim Persistieren nach Azure geschrieben werden? */
  writeToAzure: boolean
  /** Soll beim Persistieren zusaetzlich ins Filesystem geschrieben werden? */
  writeToFilesystem: boolean
  /** Bevorzugte Lese-Quelle fuer absolute URL-Aufloesung */
  readPreferredSource: 'azure' | 'filesystem'
  /** Darf beim Lesen das Filesystem als Fallback befragt werden, falls die Primaer-Quelle nichts liefert? */
  allowFilesystemFallbackOnRead: boolean
  /** Menschenlesbare Begruendung der Wahl (UI / Logs) */
  rationale: string
}

/**
 * Leitet die effektive Media-Storage-Strategie fuer eine Library ab.
 *
 * Eingabe:
 * - `library`: das Library-Dokument (oder null/undefined fuer einen sicheren Default).
 * - `azureConfigured`: Laufzeit-Flag, ob Azure tatsaechlich konfiguriert ist.
 *   Bewusst als Parameter, damit diese Funktion keine I/O-Abhaengigkeiten hat und in Tests deterministisch bleibt.
 *
 * Ableitungslogik:
 * - `primaryStore=mongo` + `persistToFilesystem=false` + Azure  ⇒ `azure-only`
 * - `primaryStore=mongo` + `persistToFilesystem=true`  + Azure  ⇒ `azure-with-fs-backup`
 * - `primaryStore=mongo` + `persistToFilesystem=false` + kein Azure ⇒ `unavailable` (harter Fehler bei Schreibversuch)
 * - `primaryStore=filesystem` ⇒ immer `filesystem-only` (auch wenn Azure verfuegbar)
 * - alle anderen Kombinationen ⇒ `filesystem-only` (Defensive Default)
 */
export function getMediaStorageStrategy(
  library: Library | null | undefined,
  azureConfigured: boolean,
): MediaStorageStrategy {
  // Wir nutzen die bereits etablierte Default-Logik fuer die Markdown-Flags.
  // Bilder folgen derselben Semantik (Symmetrie zur Markdown-Logik).
  const cfg = getShadowTwinConfig(library)

  // Fall 1: explizit Mongo als Primaer + KEIN Filesystem-Persist.
  // Das ist die "Cloud-only"-Konfiguration. Azure ist Pflicht.
  if (cfg.primaryStore === 'mongo' && !cfg.persistToFilesystem) {
    if (!azureConfigured) {
      return {
        mode: 'unavailable',
        writeToAzure: false,
        writeToFilesystem: false,
        readPreferredSource: 'azure',
        allowFilesystemFallbackOnRead: false,
        rationale:
          'primaryStore=mongo, persistToFilesystem=false, aber Azure ist nicht konfiguriert. ' +
          'Bilder koennen weder geschrieben noch gelesen werden. Bitte Azure konfigurieren ' +
          'oder persistToFilesystem=true setzen.',
      }
    }
    return {
      mode: 'azure-only',
      writeToAzure: true,
      writeToFilesystem: false,
      readPreferredSource: 'azure',
      allowFilesystemFallbackOnRead: false,
      rationale:
        'primaryStore=mongo, persistToFilesystem=false, Azure konfiguriert. ' +
        'Bilder werden ausschliesslich nach Azure geschrieben und von dort geladen. Kein Filesystem-Backup.',
    }
  }

  // Fall 2: Mongo als Primaer + Filesystem zusaetzlich (Backup-Spiegel).
  // Symmetrisch zur Markdown-Logik: Mongo + FS sind beide gefuellt.
  if (cfg.primaryStore === 'mongo' && cfg.persistToFilesystem) {
    if (!azureConfigured) {
      // Ohne Azure faellt diese Kombination de facto auf reinen Filesystem-Betrieb zurueck,
      // weil das "Mongo + FS"-Modell fuer Bilder Azure als Primaer braucht.
      return {
        mode: 'filesystem-only',
        writeToAzure: false,
        writeToFilesystem: true,
        readPreferredSource: 'filesystem',
        allowFilesystemFallbackOnRead: true,
        rationale:
          'primaryStore=mongo, persistToFilesystem=true, aber Azure nicht konfiguriert. ' +
          'Bilder werden nur ins Filesystem geschrieben und von dort gelesen.',
      }
    }
    return {
      mode: 'azure-with-fs-backup',
      writeToAzure: true,
      writeToFilesystem: true,
      readPreferredSource: 'azure',
      allowFilesystemFallbackOnRead: cfg.allowFilesystemFallback,
      rationale:
        'primaryStore=mongo, persistToFilesystem=true, Azure konfiguriert. ' +
        'Bilder werden primaer nach Azure geschrieben und zusaetzlich ins Filesystem als Backup-Spiegel. ' +
        'Lesen erfolgt aus Azure; Filesystem dient bei Bedarf als Fallback.',
    }
  }

  // Fall 3: primaryStore=filesystem (Legacy/lokal).
  // Hier bleibt der heutige Filesystem-First-Pfad. Azure-Spiegel optional moeglich,
  // aber nicht von dieser Strategie erzwungen.
  return {
    mode: 'filesystem-only',
    writeToAzure: false,
    writeToFilesystem: true,
    readPreferredSource: 'filesystem',
    allowFilesystemFallbackOnRead: true,
    rationale:
      `primaryStore=${cfg.primaryStore}. ` +
      'Bilder werden ins Filesystem geschrieben und von dort gelesen (Legacy-Pfad).',
  }
}
