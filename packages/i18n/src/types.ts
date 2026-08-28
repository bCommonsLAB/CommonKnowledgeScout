/**
 * TypeScript-Typen für i18n
 * 
 * Diese Datei definiert die Typen für Übersetzungsschlüssel
 * für bessere Autocomplete-Unterstützung in der IDE
 */

import type enTranslations from './translations/en.json'

/**
 * Typ für die gesamte Übersetzungsstruktur
 */
export type TranslationKeys = typeof enTranslations

/**
 * Rekursive Typ-Hilfsfunktion zum Erstellen von verschachtelten Schlüsselpfaden
 */
type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`
}[keyof ObjectType & (string | number)]

/**
 * Alle möglichen Übersetzungsschlüssel als Union-Typ
 */
export type TranslationKey = NestedKeyOf<TranslationKeys>

/**
 * Parameter-Typ für Übersetzungen mit Platzhaltern
 */
export interface TranslationParams {
  [key: string]: string | number
}

