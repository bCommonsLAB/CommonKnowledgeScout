import { describe, expect, it } from 'vitest'
import { isAbsoluteLoopbackMediaUrl } from '@/lib/storage/non-portable-media-url'

describe('isAbsoluteLoopbackMediaUrl', () => {
  it('leaves relative API paths valid (false)', () => {
    expect(isAbsoluteLoopbackMediaUrl('/api/storage/nextcloud?x=1')).toBe(false)
    expect(isAbsoluteLoopbackMediaUrl('')).toBe(false)
  })

  it('flags localhost absolute URLs', () => {
    expect(
      isAbsoluteLoopbackMediaUrl('http://localhost:3000/api/storage/nextcloud?action=binary&fileId=a'),
    ).toBe(true)
    expect(isAbsoluteLoopbackMediaUrl('https://127.0.0.1:3000/foo')).toBe(true)
    expect(isAbsoluteLoopbackMediaUrl('http://[::1]/x')).toBe(true)
  })

  it('does not flag real Azure hosts', () => {
    expect(isAbsoluteLoopbackMediaUrl('https://example.blob.core.windows.net/c/x.png')).toBe(false)
  })
})
