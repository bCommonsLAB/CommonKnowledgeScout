/**
 * @fileoverview Speicher-Wahl von `bibliothek_anlegen` (Handover Library-Anlage
 * 08.10., seit A3 auf Speicher-Verbindungen).
 *
 * @description
 * Der Agent nennt die Verbindung (Id oder Bezeichnung aus
 * `speicher_verbindungen_auflisten`), der Typ folgt aus ihr; ohne Verbindung
 * ist `speicherTyp` noetig. Geheimnisse kommen NIE ueber die Bruecke. Den
 * Entwurf der Library selbst baut `@/lib/library-setup/entwurf` (gemeinsam
 * mit dem Anlege-Wizard).
 *
 * @module mcp
 */

import type { SpeicherAngaben, SpeicherTyp } from '@/lib/library-setup/entwurf'
import type { StorageConnectionSummary } from '@/types/storage-connection'
import { waehleVerbindung } from './speicher-verbindung-wahl'

/** Was der Agent zum Speicher sagt (Eingabe von `bibliothek_anlegen`). */
export interface SpeicherEingabe {
  speicherTyp?: SpeicherTyp
  speicherVerbindung?: string
  verzeichnis?: string
}

/** Aufgeloester Speicher: Typ, Verzeichnis, Verbindung (null = ausstehend oder local). */
export interface SpeicherWahl {
  speicher: SpeicherAngaben
  verbindung: StorageConnectionSummary | null
}

/**
 * Bestimmt den Speicher der neuen Library. Mit `speicherVerbindung` folgt der
 * Typ aus der Verbindung (ein abweichender `speicherTyp` ist ein Fehler);
 * ohne sie ist `speicherTyp` Pflicht, local braucht ein Verzeichnis, und
 * nextcloud/onedrive bleiben ohne Verbindung (ausstehend).
 */
export function bestimmeSpeicher(eingabe: SpeicherEingabe, kandidaten: StorageConnectionSummary[]): SpeicherWahl {
  const verzeichnis = eingabe.verzeichnis?.trim() || undefined
  if (eingabe.speicherVerbindung !== undefined) {
    const verbindung = waehleVerbindung(eingabe.speicherVerbindung, kandidaten)
    if (eingabe.speicherTyp && eingabe.speicherTyp !== verbindung.type) {
      throw new Error(`speicherTyp ${eingabe.speicherTyp} passt nicht zur Verbindung "${verbindung.label}" (${verbindung.type}) — speicherTyp weglassen`)
    }
    return { speicher: { typ: verbindung.type, verzeichnis }, verbindung }
  }
  const typ = eingabe.speicherTyp
  if (!typ) throw new Error('speicherVerbindung (Id oder Bezeichnung) oder speicherTyp angeben')
  switch (typ) {
    case 'local':
      if (!verzeichnis) throw new Error('local: verzeichnis (absoluter Pfad auf dem Server) ist Pflicht')
      return { speicher: { typ, verzeichnis }, verbindung: null }
    case 'nextcloud':
    case 'onedrive':
      return { speicher: { typ, verzeichnis }, verbindung: null }
    default: {
      const nie: never = typ
      throw new Error(`Unbekannter Speicher-Typ "${String(nie)}"`)
    }
  }
}

