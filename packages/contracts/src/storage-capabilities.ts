/**
 * @fileoverview Selbstauskunft eines Storage-Providers (Welle ST4).
 *
 * @description
 * „Ohne dieses Werkzeug kann ein Agent nicht sicher arbeiten." — aus den
 * Anforderungen, und der Beleg steht daneben: Umlaute in jedem zweiten Pfad
 * („4. Ökosozialer Aktivismus", „Klimamaßnahmen heute.docx"). OneDrive und
 * Nextcloud normalisieren unterschiedlich; ein Agent, der das nicht weiss,
 * sucht Dateien, die da sind.
 *
 * Der Weg dahin ist vom Storage-Contract vorgegeben: **abstrakte
 * Faehigkeiten abfragen, nicht den Typ** (`storage-abstraction.md` §3). Jeder
 * Provider sagt selbst, was er kann — die aufrufende Schicht verzweigt nicht
 * ueber `library.type`.
 *
 * Die entscheidende Regel fuer diese Datei: **`null` heisst „weiss ich
 * nicht", und das ist eine erlaubte Antwort.** Eine geratene Normalisierung
 * oder ein geratenes Pfadlimit waere schlimmer als keines — der Agent wuerde
 * darauf bauen. Wo ein Provider etwas nicht sicher sagen kann, sagt er `null`
 * und legt einen Hinweis dazu.
 *
 * @module contracts
 */

/** Was ein Provider ueber sich selbst sagen kann. */
export interface StorageCapabilityInfo {
  /** Technischer Name des Backends — fuer Diagnose, NICHT fuer Feature-Verzweigungen. */
  provider: string

  /**
   * Unterscheidet der Speicher Gross-/Kleinschreibung in Namen?
   * `null` = haengt vom darunterliegenden Dateisystem ab und ist nicht
   * zuverlaessig feststellbar.
   */
  grossKleinSchreibungRelevant: boolean | null

  /** Maximale Pfadlaenge in Zeichen; `null` = kein bekanntes hartes Limit. */
  pfadLimit: number | null

  /** Maximale Groesse eines einzelnen Namensteils in Bytes; `null` = unbekannt. */
  namensLimit: number | null

  /** Maximale Dateigroesse in Bytes; `null` = unbekannt. */
  maxDateigroesse: number | null

  /**
   * Landet Geloeschtes in einem Papierkorb? Diese Angabe traegt die
   * Archiv-Grundregel „Geloescht wird nie" — sie darf nicht geraten werden.
   */
  papierkorbVorhanden: boolean

  /** Aufbewahrung im Papierkorb in Tagen; `null` = unbekannt oder unbegrenzt. */
  aufbewahrungTage: number | null

  /** Unicode-Normalform der Namen; `null` = nicht zugesichert. */
  unicodeNormalisierung: 'NFC' | 'NFD' | null

  /** Genauigkeit von `modifiedAt`; `null` = unbekannt. */
  zeitstempelGenauigkeit: 'sekunde' | 'millisekunde' | null

  /**
   * Trennt der Provider Inhalts- von Metadatenaenderung (Q4)? Wer das kann,
   * laesst einen reinen Verifikationsklick einen Bericht NICHT altern lassen.
   */
  trenntInhaltVonMetadaten: boolean

  /** Klartext zu allem, was oben `null` ist oder eine Einschraenkung hat. */
  hinweise: string[]
}

/** Optionale Faehigkeit: der Provider beschreibt sich selbst. */
export interface StorageCapabilities {
  beschreibeFaehigkeiten(): StorageCapabilityInfo
}

/** Feature-Detection fuer {@link StorageCapabilities}. */
export function supportsCapabilities<T extends object>(provider: T): provider is T & StorageCapabilities {
  return typeof (provider as { beschreibeFaehigkeiten?: unknown }).beschreibeFaehigkeiten === 'function'
}
