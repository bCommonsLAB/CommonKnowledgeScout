import { describe, expect, it } from 'vitest'
import { normalizeWebdavUrl } from '@/lib/storage/nextcloud-provider'

describe('normalizeWebdavUrl', () => {
  it('trimmt Whitespace und entfernt trailing Slash', () => {
    const result = normalizeWebdavUrl('  https://cloud.example.com/remote.php/dav/files/user/  ')
    expect(result).toBe('https://cloud.example.com/remote.php/dav/files/user')
  })

  it('kodiert Leerzeichen im Pfad', () => {
    const result = normalizeWebdavUrl('https://cloud.example.com/remote.php/dav/files/peter aichner')
    expect(result).toBe('https://cloud.example.com/remote.php/dav/files/peter%20aichner')
  })
})
