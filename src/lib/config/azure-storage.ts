/**
 * Azure Storage Konfiguration
 * Lädt Konfiguration aus Umgebungsvariablen oder — bei aktivierter Library-Config —
 * aus MongoDB (Transformation → Azure Ingestion Storage).
 */

import type { StorageConfig } from '@/types/library'

export interface AzureStorageConfig {
  connectionString: string
  containerName: string
  uploadDir: string
  accountName: string
  baseUrl: string
}

/**
 * Liest Azure Storage Account Name aus Connection String
 */
function extractAccountName(connectionString: string): string {
  const match = connectionString.match(/AccountName=([^;]+)/)
  return match ? match[1] : ''
}

/**
 * Generiert Base URL für öffentliche Azure Blob URLs
 */
function generateBaseUrl(accountName: string, containerName: string): string {
  if (!accountName || !containerName) return ''
  return `https://${accountName}.blob.core.windows.net/${containerName}`
}

/**
 * Azure Storage Konfiguration aus Umgebungsvariablen (Prozess-ENV).
 */
export function getAzureStorageConfig(): AzureStorageConfig | null {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || ''
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || ''
  const uploadDir = process.env.UPLOAD_DIR || 'sessions'

  // Wenn nicht konfiguriert, gibt null zurück (optional)
  if (!connectionString || !containerName) {
    return null
  }

  const accountName = extractAccountName(connectionString)
  const baseUrl = generateBaseUrl(accountName, containerName)

  return {
    connectionString,
    containerName,
    uploadDir,
    accountName,
    baseUrl,
  }
}

/**
 * Auflösung für einen konkreten Library-Kontext: zuerst benutzerdefinierte Ingestion-Storage-Config,
 * sonst globale ENV-Variablen (wie bisher für Server/Electron-.env).
 */
export function resolveAzureStorageConfig(
  libraryConfig?: StorageConfig | null
): AzureStorageConfig | null {
  const ing = libraryConfig?.ingestionStorage
  if (ing?.useCustomConfig) {
    const connectionString = (ing.connectionString || '').trim()
    const containerName = (ing.containerName || '').trim()
    if (connectionString && containerName) {
      const uploadDir = process.env.UPLOAD_DIR || 'sessions'
      const accountName = extractAccountName(connectionString)
      const baseUrl = generateBaseUrl(accountName, containerName)
      return {
        connectionString,
        containerName,
        uploadDir,
        accountName,
        baseUrl,
      }
    }
  }
  return getAzureStorageConfig()
}

/**
 * Validiert Azure Storage Konfiguration
 * Gibt Warnung zurück wenn nicht konfiguriert, aber wirft keinen Fehler
 */
export function validateAzureStorageConfig(): void {
  const config = getAzureStorageConfig() // Nur globale ENV-Warnung beim Start
  if (!config) {
    console.warn('[AzureStorage] Warnung: Azure Storage Konfiguration ist unvollständig. Bilder werden nicht auf Azure hochgeladen.')
  }
}








































