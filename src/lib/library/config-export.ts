/**
 * @fileoverview Export-/Import-Sanitizer fuer Library-Configs (Variante B).
 *
 * @description
 * Zentrale Single-Source-of-Truth fuer die Secret-Behandlung beim Export und
 * Import einer Library. Statt einer Allow-List (die bei jedem neuen Config-Feld
 * nachgezogen werden muss und sonst still Felder verliert) verwenden wir eine
 * Deny-List: Die KOMPLETTE `config` wird uebernommen, nur die hier definierten
 * geheimen Felder werden entfernt bzw. zurueckgesetzt.
 *
 * Dadurch sind neue Config-Felder automatisch round-trip-sicher. Das vermeidet
 * den stillen Parameter-Verlust (siehe no-silent-fallbacks.mdc) und haelt sich
 * an die Checkliste in library-config-field.mdc.
 *
 * @module library/config-export
 */

import type { StorageConfig } from '@/types/library'

/**
 * Tiefe Kopie einer reinen Daten-Config.
 * Die Library-Config ist JSON-serialisierbar (MongoDB-Persistenz + JSON-Export),
 * deshalb ist der JSON-Clone hier sicher und einfach.
 */
function deepCloneConfig(config: StorageConfig): StorageConfig {
  return JSON.parse(JSON.stringify(config)) as StorageConfig
}

/**
 * Entfernt alle geheimen Felder aus einer Library-Config (Deny-List).
 * Nicht-geheime Verbindungsdaten (z.B. Nextcloud `webdavUrl` + `username`,
 * OAuth `clientId`/`redirectUri`/`tenantId`) bleiben erhalten.
 *
 * Verwendung: Library-Export.
 */
export function stripLibraryConfigSecrets(config: StorageConfig): StorageConfig {
  const clone = deepCloneConfig(config)

  // OAuth (OneDrive/GDrive): Client-Secret nie exportieren.
  if (clone.clientSecret !== undefined) clone.clientSecret = undefined

  // Nextcloud: App-Passwort ist Secret. URL + Username sind keine Secrets und
  // bleiben erhalten, damit nach dem Import nur noch das Passwort fehlt.
  if (clone.nextcloud) clone.nextcloud.appPassword = undefined

  // Secretary Service: API-Key nie exportieren (apiUrl bleibt erhalten).
  if (clone.secretaryService) clone.secretaryService.apiKey = ''

  // Azure Ingestion: Connection-String ist ein Voll-Secret.
  if (clone.ingestionStorage) clone.ingestionStorage.connectionString = ''

  // Public Publishing: OpenAI-Key fuer anonyme Anfragen nie exportieren.
  if (clone.publicPublishing) clone.publicPublishing.apiKey = undefined

  return clone
}

/**
 * Bereitet eine importierte Library-Config fuer die Persistenz auf.
 * Uebernimmt die komplette Config 1:1, entfernt aber defensiv alle Secrets
 * (das Import-JSON koennte noch welche enthalten) und deaktiviert die
 * benutzerdefinierten Verbindungen, bis der Anwender die Secrets neu eingibt —
 * sonst liefe die App gegen leere `apiKey`/`connectionString`.
 *
 * Verwendung: Library-Import.
 */
export function prepareImportedLibraryConfig(config: StorageConfig): StorageConfig {
  const clone = stripLibraryConfigSecrets(config)

  // Benutzerdefinierte Verbindungen deaktivieren, bis Secrets neu eingegeben
  // wurden. Die gespeicherten Werte (apiUrl, containerName) bleiben erhalten.
  if (clone.secretaryService) clone.secretaryService.useCustomConfig = false
  if (clone.ingestionStorage) clone.ingestionStorage.useCustomConfig = false

  return clone
}
