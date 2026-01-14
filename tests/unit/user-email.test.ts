import { describe, expect, test } from 'vitest'
import { buildCaseInsensitiveEmailRegex, getPreferredUserEmail, normalizeEmail } from '@/lib/auth/user-email'

describe('user-email helpers', () => {
  test('normalizeEmail trims and lowercases', () => {
    expect(normalizeEmail('  Foo.Bar@Example.COM ')).toBe('foo.bar@example.com')
  })

  test('getPreferredUserEmail prefers primaryEmailAddress', () => {
    const user = {
      primaryEmailAddress: { emailAddress: 'Primary@Example.com' },
      emailAddresses: [{ emailAddress: 'secondary@example.com' }],
    }
    expect(getPreferredUserEmail(user)).toBe('primary@example.com')
  })

  test('getPreferredUserEmail falls back to first emailAddresses entry', () => {
    const user = {
      emailAddresses: [{ emailAddress: 'First@Example.com' }, { emailAddress: 'second@example.com' }],
    }
    expect(getPreferredUserEmail(user)).toBe('first@example.com')
  })

  test('getPreferredUserEmail returns empty string when no email is present', () => {
    expect(getPreferredUserEmail(null)).toBe('')
    expect(getPreferredUserEmail(undefined)).toBe('')
    expect(getPreferredUserEmail({ emailAddresses: [] })).toBe('')
  })

  test('buildCaseInsensitiveEmailRegex matches regardless of casing', () => {
    const re = buildCaseInsensitiveEmailRegex('Foo@Example.com')
    expect(re.test('foo@example.com')).toBe(true)
    expect(re.test('FOO@EXAMPLE.COM')).toBe(true)
    expect(re.test('foo@example.com ')).toBe(false) // anchored + no trim on candidate
  })
})

