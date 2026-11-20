/**
 * Admin der Plattform aus `KS_ADMIN_EMAIL`: eine oder mehrere Adressen, ohne Gross/Klein.
 */
import { describe, it, expect } from 'vitest'
import { adminStatus, leseAdminEmails } from '@/lib/admin/ks-admin'
import { formatKontext, formatPreis } from '@/components/settings/account/sprachmodelle/format'

describe('leseAdminEmails', () => {
  it('trennt mit Komma, normalisiert und laesst Leeres weg', () => {
    expect(leseAdminEmails(' Admin@Example.org , ,zweite@example.org')).toEqual(['admin@example.org', 'zweite@example.org'])
  })
  it('liefert ohne Variable eine leere Liste', () => {
    expect(leseAdminEmails(undefined)).toEqual([])
  })
})

describe('adminStatus', () => {
  it('erkennt den Admin unabhaengig von Gross/Klein', () => {
    expect(adminStatus('ADMIN@example.org', 'admin@example.org')).toEqual({ konfiguriert: true, istAdmin: true })
  })
  it('sagt ausdruecklich, wenn KS_ADMIN_EMAIL fehlt', () => {
    expect(adminStatus('admin@example.org', undefined)).toEqual({ konfiguriert: false, istAdmin: false })
    expect(adminStatus('admin@example.org', '  ')).toEqual({ konfiguriert: false, istAdmin: false })
  })
  it('macht eine leere E-Mail nie zum Admin', () => {
    expect(adminStatus('', 'admin@example.org').istAdmin).toBe(false)
  })
})

describe('Anzeige-Formate', () => {
  it('zeigt Preise je 1 Mio. Token und Kontext kurz', () => {
    expect(formatPreis(0.15, 0.6)).toBe('0,15 / 0,6 $')
    expect(formatPreis(null, 0.6)).toBe('–')
    expect(formatKontext(1048576)).toBe('1 Mio.')
    expect(formatKontext(163840)).toBe('164 Tsd.')
  })
})
