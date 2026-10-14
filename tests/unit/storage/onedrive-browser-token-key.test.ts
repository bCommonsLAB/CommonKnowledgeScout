/**
 * Browser-Schluessel der OneDrive-Tokens (Teil A): je Speicher-Verbindung,
 * nie je Library; eine OneDrive-Library ohne Bindung wirft laut.
 */
import { describe, it, expect } from 'vitest'
import { oneDriveTokenStorageKey, resolveOneDriveTokenScope } from '@/lib/storage/onedrive/browser-token-key'

describe('OneDrive-Token-Schluessel', () => {
  it('nimmt die Verbindungs-Id als Geltungsbereich', () => {
    expect(resolveOneDriveTokenScope({ id: 'lib-1', storageConnectionId: 'c1' })).toBe('c1')
    expect(oneDriveTokenStorageKey('c1')).toBe('onedrive_tokens_c1')
  })

  it('wirft ohne Bindung mit Verweis auf die Migration', () => {
    expect(() => resolveOneDriveTokenScope({ id: 'lib-1', label: 'Klima' })).toThrow(/Klima.*migrate-storage-connections/)
  })
})
