import { describe, expect, it } from 'vitest'
import { formatUpsertedAt } from '@/utils/format-upserted-at'

describe('formatUpsertedAt', () => {
  it('returns fallback for undefined', () => {
    expect(formatUpsertedAt(undefined)).toBe('-')
  })

  it('returns fallback for invalid date strings', () => {
    expect(formatUpsertedAt('not-a-date')).toBe('-')
  })

  it('formats ISO strings using Intl.DateTimeFormat (deterministic with UTC)', () => {
    const iso = '2025-01-05T10:20:30.000Z'
    const expected = new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(iso))

    expect(formatUpsertedAt(iso, { locale: 'en', timeZone: 'UTC' })).toBe(expected)
  })
})






