import { describe, expect, it } from 'vitest'
import { toEventRunId } from '@/lib/events/event-run-id'

describe('toEventRunId', () => {
  it('creates sortable run ids', () => {
    const d = new Date('2026-01-11T13:00:00.000Z')
    expect(toEventRunId(d)).toBe('2026-01-11-13-00-00')
  })
})

