/**
 * Migrationsplan „Zugangsdaten aus Libraries → Speicher-Verbindungen" (A2):
 * Zusammenlegen gleicher Zugaenge, Anschluss an vorhandene Verbindungen,
 * juengste Tokens, Idempotenz, Uebersprungenes mit Grund.
 */
import { describe, it, expect } from 'vitest'
import { dedupeKeyFor, planStorageConnectionMigration, type LegacyUserDoc } from '@/lib/storage-connections/migration-plan'

const NC = { webdavUrl: 'https://cloud.example.org/remote.php/dav/files/anna', username: 'anna', appPassword: 'pw' }
let n = 0
const neueId = () => `neu-${++n}`

function user(libraries: LegacyUserDoc['libraries']): LegacyUserDoc {
  return { email: 'anna@example.com', libraries }
}

describe('planStorageConnectionMigration', () => {
  it('legt gleiche Nextcloud-Zugaenge zusammen und haengt beide Libraries um', () => {
    n = 0
    const plan = planStorageConnectionMigration([user([
      { id: 'l1', label: 'Eins', type: 'nextcloud', config: { nextcloud: NC, chat: {} } },
      { id: 'l2', label: 'Zwei', type: 'nextcloud', config: { nextcloud: { ...NC, webdavUrl: NC.webdavUrl + '/' } } },
      { id: 'l3', label: 'Lokal', type: 'local', config: {} },
    ])], [], 'T', neueId)
    expect(plan.neueVerbindungen).toHaveLength(1)
    expect(plan.neueVerbindungen[0].connection.nextcloud).toEqual(NC)
    expect(plan.neueVerbindungen[0].libraries).toEqual(['Eins', 'Zwei'])
    expect(plan.libraryUpdates.map((u) => [u.libraryId, u.storageConnectionId, u.removeFields])).toEqual([
      ['l1', 'neu-1', ['nextcloud']],
      ['l2', 'neu-1', ['nextcloud']],
    ])
  })

  it('schliesst an eine schon vorhandene Verbindung des Kontos an statt eine neue anzulegen', () => {
    const plan = planStorageConnectionMigration(
      [user([{ id: 'l1', label: 'Eins', type: 'nextcloud', config: { nextcloud: NC } }])],
      [{ id: 'konto-1', ownerEmail: 'anna@example.com', dedupeKey: dedupeKeyFor('nextcloud', NC) }],
      'T', neueId,
    )
    expect(plan.neueVerbindungen).toHaveLength(0)
    expect(plan.libraryUpdates[0].storageConnectionId).toBe('konto-1')
  })

  it('OneDrive: gleiche App wird eine Verbindung, die juengsten Tokens gewinnen, alle Altfelder werden geleert', () => {
    const app = { tenantId: 't', clientId: 'c', clientSecret: 's' }
    const plan = planStorageConnectionMigration([user([
      { id: 'l1', label: 'A', type: 'onedrive', config: { ...app, accessToken: 'a1', refreshToken: 'r1', tokenExpiry: 100, tempTokensAvailable: false } },
      { id: 'l2', label: 'B', type: 'onedrive', config: { ...app, accessToken: 'a2', refreshToken: 'r2', tokenExpiry: 200 } },
    ])], [], 'T', neueId)
    expect(plan.neueVerbindungen).toHaveLength(1)
    expect(plan.neueVerbindungen[0].connection.onedrive).toMatchObject({ ...app, refreshToken: 'r2', tokenExpiry: 200 })
    expect(plan.libraryUpdates[0].removeFields).toEqual(['clientId', 'clientSecret', 'tenantId', 'accessToken', 'refreshToken', 'tokenExpiry', 'tempTokensAvailable'])
  })

  it('meldet ein fehlendes Geheimnis und uebernimmt es aus einer zweiten Library', () => {
    const plan = planStorageConnectionMigration([user([
      { id: 'l1', label: 'A', type: 'nextcloud', config: { nextcloud: { ...NC, appPassword: '' } } },
    ])], [], 'T', neueId)
    expect(plan.neueVerbindungen[0].geheimnisFehlt).toBe(true)
    const zwei = planStorageConnectionMigration([user([
      { id: 'l1', label: 'A', type: 'nextcloud', config: { nextcloud: { ...NC, appPassword: '' } } },
      { id: 'l2', label: 'B', type: 'nextcloud', config: { nextcloud: NC } },
    ])], [], 'T', neueId)
    expect(zwei.neueVerbindungen[0].geheimnisFehlt).toBe(false)
    expect(zwei.neueVerbindungen[0].connection.nextcloud?.appPassword).toBe('pw')
  })

  it('ist idempotent: umgehaengte Libraries ohne Altfelder bleiben unberuehrt; Rest-Altfelder werden nur geleert', () => {
    const plan = planStorageConnectionMigration([user([
      { id: 'l1', label: 'Fertig', type: 'nextcloud', storageConnectionId: 'c1', config: { chat: {} } },
      { id: 'l2', label: 'Rest', type: 'nextcloud', storageConnectionId: 'c1', config: { nextcloud: NC } },
      { id: 'l3', label: 'Leer', type: 'onedrive', config: {} },
    ])], [], 'T', neueId)
    expect(plan.neueVerbindungen).toHaveLength(0)
    expect(plan.libraryUpdates).toEqual([{ ownerEmail: 'anna@example.com', libraryId: 'l2', label: 'Rest', storageConnectionId: 'c1', removeFields: ['nextcloud'] }])
    expect(plan.uebersprungen.map((u) => u.libraryId)).toEqual(['l1', 'l3'])
  })
})
