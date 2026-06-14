import { describe, it, expect } from 'vitest'
import { getPublishVerificationWarning } from '@/lib/library-verification/publish-gate'

describe('getPublishVerificationWarning', () => {
  it('gibt fuer gepruefte Library keine Warnung (null)', () => {
    expect(getPublishVerificationWarning('verified', 'publish')).toBeNull()
    expect(getPublishVerificationWarning('verified', 'public-open')).toBeNull()
  })

  it('warnt bei ungeprueft und reparaturbeduerftig (ohne zu blockieren)', () => {
    const unchecked = getPublishVerificationWarning('unchecked', 'publish')
    expect(unchecked).not.toBeNull()
    expect(unchecked?.status).toBe('unchecked')

    const needsRepair = getPublishVerificationWarning('needs-repair', 'public-open')
    expect(needsRepair).not.toBeNull()
    expect(needsRepair?.status).toBe('needs-repair')
  })

  it('waehlt den Wortlaut je Kontext', () => {
    const publish = getPublishVerificationWarning('unchecked', 'publish')
    const open = getPublishVerificationWarning('unchecked', 'public-open')
    expect(publish?.title).toBe('Vor dem Veröffentlichen prüfen')
    expect(open?.title).toBe('Diese Bibliothek ist noch nicht geprüft')
    // Beide Nachrichten enthalten die Status-Beschreibung.
    expect(publish?.message).toContain('noch nicht geprüft')
    expect(open?.message).toContain('noch nicht geprüft')
  })
})
