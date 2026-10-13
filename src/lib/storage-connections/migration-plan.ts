/**
 * @fileoverview Migrationsplan „Zugangsdaten aus Libraries → Speicher-Verbindungen"
 * (reine Funktion; das Skript `scripts/migrate-storage-connections.ts` fuehrt ihn aus).
 *
 * Je Library mit Zugangsdaten entsteht eine Verbindung des Besitzers; gleiche
 * Zugaenge werden zusammengelegt (Nextcloud: WebDAV-URL plus Benutzer,
 * OneDrive: Tenant plus Client-Id), vorhandene Tokens wandern mit (die
 * juengsten gewinnen), die Library wird umgehaengt und die Altfelder geleert.
 * Idempotent: schon umgehaengte Libraries ohne Altfelder werden uebersprungen.
 */

import type { StorageConnection, StorageConnectionType } from '@/types/storage-connection'

/** Alt-Felder in `library.config`, die nach der Migration geleert sind. */
export const LEGACY_STORAGE_FIELDS = [
  'clientId', 'clientSecret', 'tenantId', 'redirectUri', 'scope', 'nextcloud',
  'accessToken', 'refreshToken', 'tokenExpiry',
  'tempAccessToken', 'tempRefreshToken', 'tempTokenExpiry', 'tempTokensAvailable',
] as const

export interface LegacyLibraryDoc {
  id: string
  label: string
  type: string
  storageConnectionId?: string
  config?: Record<string, unknown>
}

export interface LegacyUserDoc {
  email: string
  libraries: LegacyLibraryDoc[]
}

/** Schon vorhandene Verbindung (nur Nicht-Geheimnisse), gegen die zusammengelegt wird. */
export interface ExistingConnectionKey {
  id: string
  ownerEmail: string
  dedupeKey: string
}

export interface PlannedLibraryUpdate {
  ownerEmail: string
  libraryId: string
  label: string
  storageConnectionId: string
  removeFields: string[]
}

export interface MigrationPlan {
  neueVerbindungen: Array<{ connection: StorageConnection; dedupeKey: string; libraries: string[]; geheimnisFehlt: boolean }>
  libraryUpdates: PlannedLibraryUpdate[]
  uebersprungen: Array<{ libraryId: string; label: string; grund: string }>
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Zusammenlege-Schluessel: gleicher Zugang = gleiche Verbindung. */
export function dedupeKeyFor(type: StorageConnectionType, data: { webdavUrl?: string; username?: string; tenantId?: string; clientId?: string }): string {
  if (type === 'nextcloud') return `nextcloud|${(data.webdavUrl ?? '').replace(/\/+$/, '').toLowerCase()}|${(data.username ?? '').toLowerCase()}`
  return `onedrive|${(data.tenantId || 'common').toLowerCase()}|${(data.clientId ?? '').toLowerCase()}`
}

function legacyFieldsPresent(config: Record<string, unknown>): string[] {
  return LEGACY_STORAGE_FIELDS.filter((feld) => config[feld] !== undefined)
}

function hostLabel(webdavUrl: string): string {
  try {
    return new URL(webdavUrl).host
  } catch {
    return webdavUrl
  }
}

interface Extracted {
  type: StorageConnectionType
  dedupeKey: string
  label: string
  nextcloud?: StorageConnection['nextcloud']
  onedrive?: StorageConnection['onedrive']
  geheimnisFehlt: boolean
}

/** Zugangsdaten aus den Altfeldern; `null` = nichts Verwertbares (Library bleibt, wie sie ist). */
function extract(lib: LegacyLibraryDoc): Extracted | null {
  const cfg = lib.config ?? {}
  if (lib.type === 'nextcloud') {
    const nc = (cfg.nextcloud ?? {}) as Record<string, unknown>
    const webdavUrl = text(nc.webdavUrl)
    const username = text(nc.username)
    if (!webdavUrl || !username) return null
    const appPassword = text(nc.appPassword)
    return {
      type: 'nextcloud', dedupeKey: dedupeKeyFor('nextcloud', { webdavUrl, username }),
      label: `Nextcloud ${hostLabel(webdavUrl)} (${username})`,
      nextcloud: { webdavUrl, username, appPassword }, geheimnisFehlt: appPassword === '',
    }
  }
  if (lib.type === 'onedrive') {
    const clientId = text(cfg.clientId)
    if (!clientId) return null
    const tenantId = text(cfg.tenantId) || 'common'
    const clientSecret = text(cfg.clientSecret)
    const accessToken = text(cfg.accessToken)
    const refreshToken = text(cfg.refreshToken)
    const expiry = Number(cfg.tokenExpiry ?? 0)
    const tokens = accessToken && refreshToken ? { accessToken, refreshToken, tokenExpiry: Number.isFinite(expiry) ? expiry : 0 } : {}
    return {
      type: 'onedrive', dedupeKey: dedupeKeyFor('onedrive', { tenantId, clientId }),
      label: `OneDrive ${tenantId} (${clientId.slice(0, 8)}…)`,
      onedrive: { tenantId, clientId, clientSecret, ...tokens }, geheimnisFehlt: clientSecret === '',
    }
  }
  return null
}

export function planStorageConnectionMigration(
  users: LegacyUserDoc[],
  existing: ExistingConnectionKey[],
  now: string,
  neueId: () => string,
): MigrationPlan {
  const plan: MigrationPlan = { neueVerbindungen: [], libraryUpdates: [], uebersprungen: [] }
  for (const user of users) {
    const bekannt = new Map<string, string>(existing.filter((e) => e.ownerEmail === user.email).map((e) => [e.dedupeKey, e.id]))
    const geplant = new Map<string, MigrationPlan['neueVerbindungen'][number]>()
    for (const lib of user.libraries) {
      if (lib.type !== 'nextcloud' && lib.type !== 'onedrive') continue
      const cfg = lib.config ?? {}
      const altfelder = legacyFieldsPresent(cfg)
      if (lib.storageConnectionId && altfelder.length === 0) {
        plan.uebersprungen.push({ libraryId: lib.id, label: lib.label, grund: 'schon umgehaengt' })
        continue
      }
      if (lib.storageConnectionId) {
        plan.libraryUpdates.push({ ownerEmail: user.email, libraryId: lib.id, label: lib.label, storageConnectionId: lib.storageConnectionId, removeFields: altfelder })
        continue
      }
      const daten = extract(lib)
      if (!daten) {
        plan.uebersprungen.push({ libraryId: lib.id, label: lib.label, grund: `keine Zugangsdaten in den Altfeldern (${lib.type}) — in Archive · 1 Quelle eine Verbindung waehlen` })
        continue
      }
      let connectionId = bekannt.get(daten.dedupeKey)
      if (!connectionId) {
        const vorhanden = geplant.get(daten.dedupeKey)
        if (vorhanden) {
          connectionId = vorhanden.connection.id
          vorhanden.libraries.push(lib.label)
          // Juengste Tokens gewinnen; ein fehlendes Geheimnis wird durch ein vorhandenes ersetzt.
          const alt = vorhanden.connection.onedrive
          const neu = daten.onedrive
          if (alt && neu) {
            if ((neu.tokenExpiry ?? 0) > (alt.tokenExpiry ?? 0) && neu.refreshToken) {
              vorhanden.connection.onedrive = { ...alt, accessToken: neu.accessToken, refreshToken: neu.refreshToken, tokenExpiry: neu.tokenExpiry }
            }
            if (alt.clientSecret === '' && neu.clientSecret !== '') {
              vorhanden.connection.onedrive = { ...(vorhanden.connection.onedrive ?? alt), clientSecret: neu.clientSecret }
              vorhanden.geheimnisFehlt = false
            }
          }
          if (vorhanden.connection.nextcloud && daten.nextcloud && vorhanden.connection.nextcloud.appPassword === '' && daten.nextcloud.appPassword !== '') {
            vorhanden.connection.nextcloud = { ...vorhanden.connection.nextcloud, appPassword: daten.nextcloud.appPassword }
            vorhanden.geheimnisFehlt = false
          }
        } else {
          connectionId = neueId()
          const connection: StorageConnection = {
            id: connectionId, ownerEmail: user.email, label: daten.label, type: daten.type,
            ...(daten.nextcloud ? { nextcloud: daten.nextcloud } : {}),
            ...(daten.onedrive ? { onedrive: daten.onedrive } : {}),
            lastTest: null, createdAt: now, updatedAt: now,
          }
          const eintrag = { connection, dedupeKey: daten.dedupeKey, libraries: [lib.label], geheimnisFehlt: daten.geheimnisFehlt }
          geplant.set(daten.dedupeKey, eintrag)
          plan.neueVerbindungen.push(eintrag)
        }
      }
      plan.libraryUpdates.push({ ownerEmail: user.email, libraryId: lib.id, label: lib.label, storageConnectionId: connectionId, removeFields: altfelder })
    }
  }
  return plan
}
