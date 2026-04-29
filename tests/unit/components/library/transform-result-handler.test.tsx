// @vitest-environment jsdom

/**
 * Characterization Tests fuer `TransformResultHandler` (Welle 3-II, Schritt 3).
 *
 * Fixiert das Render-as-Function-Pattern (`childrenAction(handler, isProcessing)`)
 * und den Vertrag, dass `selectFile` mit `result.savedItem` aufgerufen wird.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { TransformResultHandler } from '@/components/library/transform-result-handler'

const mockSelectFile = vi.fn()

vi.mock('@/hooks/use-selected-file', () => ({
  useSelectedFile: () => ({
    selectFile: mockSelectFile,
  }),
}))

describe('TransformResultHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('ruft childrenAction mit Handler und isProcessing=false auf', () => {
    const childrenAction = vi.fn(() => <div data-testid="child" />)
    render(<TransformResultHandler childrenAction={childrenAction} />)

    expect(childrenAction).toHaveBeenCalled()
    const [handler, isProcessing] = childrenAction.mock.calls[0]
    expect(typeof handler).toBe('function')
    expect(isProcessing).toBe(false)
    expect(screen.getByTestId('child')).toBeTruthy()
  })

  it('ruft selectFile mit result.savedItem auf, wenn Handler ausgeloest wird', () => {
    const childrenAction = (handler: (r: unknown) => void) => (
      <button
        data-testid="trigger"
        onClick={() => handler({
          text: 'irgendwas',
          savedItem: { id: 'item-42', metadata: { name: 'neu.md' } },
          updatedItems: [],
        })}
      >
        Trigger
      </button>
    )

    render(<TransformResultHandler childrenAction={childrenAction} />)
    fireEvent.click(screen.getByTestId('trigger'))

    expect(mockSelectFile).toHaveBeenCalledWith({
      id: 'item-42',
      metadata: { name: 'neu.md' },
    })
  })

  it('ruft onResultProcessed-Callback auf, wenn Handler durch ist', () => {
    const onResultProcessed = vi.fn()
    const childrenAction = (handler: (r: unknown) => void) => (
      <button
        data-testid="trigger"
        onClick={() => handler({
          text: 't',
          savedItem: undefined,
          updatedItems: [],
        })}
      >
        Trigger
      </button>
    )
    render(
      <TransformResultHandler
        onResultProcessed={onResultProcessed}
        childrenAction={childrenAction}
      />
    )
    fireEvent.click(screen.getByTestId('trigger'))
    expect(onResultProcessed).toHaveBeenCalled()
  })
})
