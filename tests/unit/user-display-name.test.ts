import { describe, expect, test } from 'vitest'
import { getPreferredUserDisplayName } from '@/lib/auth/user-display-name'

describe('getPreferredUserDisplayName', () => {
  test('verbindet firstName + lastName', () => {
    const user = { firstName: 'Anna', lastName: 'Apfel' }
    expect(getPreferredUserDisplayName(user)).toBe('Anna Apfel')
  })

  test('faellt auf firstName allein zurueck', () => {
    const user = { firstName: 'Anna', lastName: '   ' }
    expect(getPreferredUserDisplayName(user)).toBe('Anna')
  })

  test('faellt auf lastName allein zurueck', () => {
    const user = { firstName: null, lastName: 'Apfel' }
    expect(getPreferredUserDisplayName(user)).toBe('Apfel')
  })

  test('nutzt username als naechsten Fallback', () => {
    const user = {
      firstName: '',
      lastName: '',
      username: 'anna_apfel',
    }
    expect(getPreferredUserDisplayName(user)).toBe('anna_apfel')
  })

  test('nutzt E-Mail-Prefix als letzten Fallback', () => {
    const user = {
      primaryEmailAddress: { emailAddress: 'Anna.Apfel@Example.com' },
    }
    expect(getPreferredUserDisplayName(user)).toBe('anna.apfel')
  })

  test('liefert leeren String, wenn nichts vorhanden ist', () => {
    expect(getPreferredUserDisplayName(null)).toBe('')
    expect(getPreferredUserDisplayName(undefined)).toBe('')
    expect(getPreferredUserDisplayName({})).toBe('')
  })

  test('trimt Whitespace vor dem Vergleichen', () => {
    const user = { firstName: '  Anna  ', lastName: '  Apfel  ' }
    expect(getPreferredUserDisplayName(user)).toBe('Anna Apfel')
  })
})
