/**
 * Char-Tests fuer den D5-Fix: Maskierte Secrets duerfen beim Speichern
 * den Bestand nicht ueberschreiben (lib/services/library-service.ts).
 */

import { describe, it, expect } from 'vitest'
import { isMaskedSecret, preserveMaskedSecrets } from '@/lib/services/library-service'
import type { Library } from '@/types/library'

function lib(config: Record<string, unknown>): Library {
  return { id: 'lib-1', label: 'Test', path: '/x', type: 'local', isEnabled: true, config } as unknown as Library
}

describe('isMaskedSecret', () => {
  it('erkennt alle Maskierungs-Sentinels', () => {
    expect(isMaskedSecret('********')).toBe(true)
    expect(isMaskedSecret('••••abcd')).toBe(true)
    expect(isMaskedSecret('sk-pro....................wxyz')).toBe(true)
  })

  it('laesst echte Werte und Leeres durch', () => {
    expect(isMaskedSecret('sk-echterkey123')).toBe(false)
    expect(isMaskedSecret('')).toBe(false)
    expect(isMaskedSecret(undefined)).toBe(false)
    expect(isMaskedSecret(42)).toBe(false)
  })
})

describe('preserveMaskedSecrets', () => {
  it('stellt maskierten secretaryService.apiKey aus dem Bestand wieder her', () => {
    const incoming = lib({ secretaryService: { apiKey: 'sk-pro....................wxyz', template: 'neu' } })
    const existing = lib({ secretaryService: { apiKey: 'sk-echterkey123' } })
    const result = preserveMaskedSecrets(incoming, existing)
    const svc = result.config?.secretaryService as { apiKey?: string; template?: string }
    expect(svc.apiKey).toBe('sk-echterkey123')
    expect(svc.template).toBe('neu')
  })

  it('entfernt Maske, wenn kein Bestandswert existiert', () => {
    const incoming = lib({ ingestionStorage: { connectionString: '********', containerName: 'c1' } })
    const result = preserveMaskedSecrets(incoming, undefined)
    const ing = result.config?.ingestionStorage as { connectionString?: string; containerName?: string }
    expect(ing.connectionString).toBeUndefined()
    expect(ing.containerName).toBe('c1')
  })

  it('speichert neue echte Werte unveraendert', () => {
    const incoming = lib({ secretaryService: { apiKey: 'sk-neuerkey' }, clientSecret: 'neues-secret' })
    const existing = lib({ secretaryService: { apiKey: 'sk-alt' }, clientSecret: 'alt' })
    const result = preserveMaskedSecrets(incoming, existing)
    expect((result.config?.secretaryService as { apiKey?: string }).apiKey).toBe('sk-neuerkey')
    expect((result.config as { clientSecret?: string }).clientSecret).toBe('neues-secret')
  })

  it('behandelt alle Secret-Pfade (clientSecret, nextcloud, publicPublishing)', () => {
    const incoming = lib({
      clientSecret: '********',
      nextcloud: { appPassword: '********', username: 'u' },
      publicPublishing: { apiKey: '••••abcd', slugName: 's' },
    })
    const existing = lib({
      clientSecret: 'cs-alt',
      nextcloud: { appPassword: 'np-alt' },
      publicPublishing: { apiKey: 'pk-alt' },
    })
    const result = preserveMaskedSecrets(incoming, existing)
    const cfg = result.config as Record<string, Record<string, unknown>> & { clientSecret?: string }
    expect(cfg.clientSecret).toBe('cs-alt')
    expect(cfg.nextcloud.appPassword).toBe('np-alt')
    expect(cfg.nextcloud.username).toBe('u')
    expect(cfg.publicPublishing.apiKey).toBe('pk-alt')
    expect(cfg.publicPublishing.slugName).toBe('s')
  })

  it('mutiert das eingehende Objekt nicht', () => {
    const incoming = lib({ secretaryService: { apiKey: '********' } })
    const existing = lib({ secretaryService: { apiKey: 'sk-alt' } })
    preserveMaskedSecrets(incoming, existing)
    expect((incoming.config?.secretaryService as { apiKey?: string }).apiKey).toBe('********')
  })
})
