/**
 * @fileoverview Library-Credentials – Encryption-at-rest fuer Library-Config-Secrets.
 *
 * @description
 * Single-Source-of-Truth fuer die Liste der geheimen Felder einer Library-Config
 * und fuer das transparente Ver-/Entschluesseln dieser Felder am Persistenz-Rand
 * (MongoDB). Anwendung:
 * - `encryptLibrarySecrets` beim Schreiben (LibraryService.updateUserLibraries)
 * - `decryptLibrarySecrets` beim Lesen (alle LibraryService-Getter)
 *
 * Die In-Memory-Repraesentation einer `Library` traegt damit IMMER Klartext-
 * Secrets; verschluesselt liegen sie ausschliesslich in der Datenbank.
 *
 * Die Feldliste deckt sich bewusst mit der Deny-List in
 * `lib/library/config-export.ts` (plus OAuth-Tokens, die nur serverseitig in der
 * Config landen). Neue Secret-Felder MUESSEN hier UND dort ergaenzt werden.
 *
 * @module security
 *
 * @exports
 * - LIBRARY_SECRET_FIELDS: deklarative Liste der geheimen Config-Pfade
 * - encryptLibrarySecrets / decryptLibrarySecrets: pro Library
 * - encryptLibrariesSecrets / decryptLibrariesSecrets: pro Array
 *
 * @dependencies
 * - @/lib/security/credential-cipher: AES-256-GCM Primitive
 * - @/types/library: Library-Typ
 */

import { decryptSecret, encryptSecret, isEncryptedSecret } from './credential-cipher'
import { isMaskedSecret } from './masked-secret'
import type { Library } from '@/types/library'

/**
 * Geheime Config-Pfade.
 * - `top`: Schluessel direkt unter `config` (z.B. OAuth `clientSecret`, Tokens)
 * - `nested`: Schluessel unter einem Unter-Objekt (z.B. `nextcloud.appPassword`)
 */
export type LibrarySecretField =
  | { readonly kind: 'top'; readonly key: string }
  | { readonly kind: 'nested'; readonly parent: string; readonly key: string }

export const LIBRARY_SECRET_FIELDS: readonly LibrarySecretField[] = [
  // OAuth (OneDrive/GDrive)
  { kind: 'top', key: 'clientSecret' },
  // OAuth-Tokens (nur serverseitig in der Config; via /tokens-Route persistiert)
  { kind: 'top', key: 'accessToken' },
  { kind: 'top', key: 'refreshToken' },
  { kind: 'top', key: 'tempAccessToken' },
  { kind: 'top', key: 'tempRefreshToken' },
  // Nextcloud/WebDAV
  { kind: 'nested', parent: 'nextcloud', key: 'appPassword' },
  // Secretary Service
  { kind: 'nested', parent: 'secretaryService', key: 'apiKey' },
  // Azure Ingestion
  { kind: 'nested', parent: 'ingestionStorage', key: 'connectionString' },
  // Public Publishing (OpenAI-Key fuer anonyme Anfragen)
  { kind: 'nested', parent: 'publicPublishing', key: 'apiKey' },
] as const

/**
 * Wendet `transform` auf jeden vorhandenen, nicht-leeren Secret-String an und
 * gibt eine Kopie der Library zurueck (Eingabe wird nicht mutiert).
 */
function mapLibrarySecrets(
  library: Library,
  transform: (value: string) => string,
): Library {
  if (!library.config) return library

  const config = { ...(library.config as Record<string, unknown>) }

  for (const field of LIBRARY_SECRET_FIELDS) {
    if (field.kind === 'top') {
      const value = config[field.key]
      if (typeof value === 'string' && value !== '') {
        config[field.key] = transform(value)
      }
      continue
    }

    const parent = config[field.parent]
    if (!parent || typeof parent !== 'object') continue
    const parentCopy = { ...(parent as Record<string, unknown>) }
    const value = parentCopy[field.key]
    if (typeof value === 'string' && value !== '') {
      parentCopy[field.key] = transform(value)
    }
    config[field.parent] = parentCopy
  }

  return { ...library, config: config as Library['config'] }
}

/**
 * Verschluesselt alle Secret-Felder einer Library (Schreib-Rand).
 *
 * Bereits verschluesselte Werte bleiben unveraendert (idempotent). Maskierte
 * Sentinels ('********' etc.) werden NICHT verschluesselt – sie duerfen den
 * Persistenz-Rand ohnehin nicht erreichen (vgl. `preserveMaskedSecrets`); diese
 * Absicherung verhindert, dass eine Maske als Secret gespeichert wird.
 */
export function encryptLibrarySecrets(library: Library): Library {
  return mapLibrarySecrets(library, (value) => {
    if (isEncryptedSecret(value) || isMaskedSecret(value)) return value
    return encryptSecret(value)
  })
}

/**
 * Entschluesselt alle Secret-Felder einer Library (Lese-Rand).
 * Legacy-Klartext bleibt – via `decryptSecret` – unveraendert.
 */
export function decryptLibrarySecrets(library: Library): Library {
  return mapLibrarySecrets(library, (value) => decryptSecret(value))
}

/** Array-Variante von `encryptLibrarySecrets`. */
export function encryptLibrariesSecrets(libraries: Library[]): Library[] {
  return libraries.map(encryptLibrarySecrets)
}

/** Array-Variante von `decryptLibrarySecrets`. */
export function decryptLibrariesSecrets(libraries: Library[]): Library[] {
  return libraries.map(decryptLibrarySecrets)
}
