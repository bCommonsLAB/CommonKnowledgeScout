import { describe, expect, it, vi } from 'vitest'
import { getJobEventBus } from '@/lib/events/job-event-bus'

/**
 * Diese Tests sind bewusst sehr klein:
 * - Wir wollen sicherstellen, dass `result.savedItemId` technisch im JobUpdateEvent
 *   transportiert werden kann und nicht versehentlich "weg-typisiert" wird.
 * - Der eigentliche SSE-Transport serialisiert JSON 1:1 (siehe Stream-Route).
 */
describe('JobEventBus', () => {
  it('emits JobUpdateEvent with result.savedItemId', () => {
    const bus = getJobEventBus()
    const handler = vi.fn()
    const unsubscribe = bus.subscribe('user@example.com', handler)

    const savedItemId = 'result-file-id'
    bus.emitUpdate('user@example.com', {
      type: 'job_update',
      jobId: 'job-1',
      status: 'completed',
      updatedAt: new Date().toISOString(),
      result: { savedItemId },
    })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      type: 'job_update',
      jobId: 'job-1',
      status: 'completed',
      result: { savedItemId },
    }))

    unsubscribe()
  })
})


