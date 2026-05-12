// @vitest-environment jsdom

import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  JobMonitorRowActions,
  JobMonitorRowOpenButtons,
  type JobMonitorRowItem,
} from '@/components/shared/job-monitor-row-actions'

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastMocks.success,
    error: toastMocks.error,
  },
}))

function baseItem(overrides: Partial<JobMonitorRowItem> = {}): JobMonitorRowItem {
  return {
    jobId: 'job-1',
    status: 'failed',
    fileName: 'doc.md',
    sourceItemId: 'src-1',
    sourceParentId: 'parent-1' as unknown as string,
    libraryId: 'lib-1',
    ...overrides,
  } as JobMonitorRowItem
}

describe('JobMonitorRowOpenButtons', () => {
  beforeEach(() => {
    toastMocks.success.mockClear()
    toastMocks.error.mockClear()
  })
  afterEach(() => {
    cleanup()
  })

  it('zeigt keinen Button, wenn weder sourceItemId noch resultItemId vorhanden', () => {
    const { container } = render(
      <JobMonitorRowOpenButtons
        item={baseItem({ sourceItemId: undefined, resultItemId: undefined })}
        onOpenFile={vi.fn()}
        onOpenResult={vi.fn()}
      />,
    )
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('zeigt "Datei öffnen", wenn sourceItemId gesetzt ist', () => {
    render(
      <JobMonitorRowOpenButtons
        item={baseItem({ sourceItemId: 'src-1', resultItemId: undefined })}
        onOpenFile={vi.fn()}
        onOpenResult={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Datei öffnen' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ergebnis öffnen' })).toBeNull()
  })

  it('zeigt "Ergebnis öffnen" auch wenn shadowTwinFolderId fehlt (Mongo-only Fallback)', () => {
    render(
      <JobMonitorRowOpenButtons
        item={baseItem({
          sourceItemId: undefined,
          shadowTwinFolderId: undefined,
          resultItemId: 'result-1',
        })}
        onOpenFile={vi.fn()}
        onOpenResult={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Ergebnis öffnen' })).toBeTruthy()
  })

  it('ruft onOpenFile mit dem Item auf', async () => {
    const user = userEvent.setup()
    const onOpenFile = vi.fn().mockResolvedValue(undefined)
    render(
      <JobMonitorRowOpenButtons
        item={baseItem()}
        onOpenFile={onOpenFile}
        onOpenResult={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Datei öffnen' }))
    expect(onOpenFile).toHaveBeenCalledTimes(1)
    expect(onOpenFile.mock.calls[0][0]).toMatchObject({ jobId: 'job-1' })
    expect(toastMocks.error).not.toHaveBeenCalled()
  })

  it('feuert Sonner-Error-Toast, wenn onOpenFile wirft', async () => {
    const user = userEvent.setup()
    const onOpenFile = vi.fn().mockRejectedValue(new Error('boom'))
    render(
      <JobMonitorRowOpenButtons
        item={baseItem()}
        onOpenFile={onOpenFile}
        onOpenResult={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Datei öffnen' }))
    expect(toastMocks.error).toHaveBeenCalledTimes(1)
    expect(toastMocks.error.mock.calls[0][0]).toContain('boom')
  })
})

describe('JobMonitorRowActions', () => {
  beforeEach(() => {
    toastMocks.success.mockClear()
    toastMocks.error.mockClear()
  })
  afterEach(() => {
    cleanup()
  })

  it('zeigt Trace, Delete und Copy immer; Retry nur für failed/completed', () => {
    const { rerender } = render(
      <JobMonitorRowActions
        item={baseItem({ status: 'running' })}
        isTraceOpen={false}
        onToggleTrace={vi.fn()}
        onRetry={vi.fn()}
        onDelete={vi.fn()}
        onCopyMarkdown={vi.fn()}
        disableAutoReset
      />,
    )
    expect(screen.getByRole('button', { name: 'Trace anzeigen' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Job löschen' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Als Markdown kopieren' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Neu starten' })).toBeNull()

    rerender(
      <JobMonitorRowActions
        item={baseItem({ status: 'failed' })}
        isTraceOpen={false}
        onToggleTrace={vi.fn()}
        onRetry={vi.fn()}
        onDelete={vi.fn()}
        onCopyMarkdown={vi.fn()}
        disableAutoReset
      />,
    )
    expect(screen.getByRole('button', { name: 'Neu starten' })).toBeTruthy()
  })

  it('zeigt Retry auch für completed', () => {
    render(
      <JobMonitorRowActions
        item={baseItem({ status: 'completed' })}
        isTraceOpen={false}
        onToggleTrace={vi.fn()}
        onRetry={vi.fn()}
        onDelete={vi.fn()}
        onCopyMarkdown={vi.fn()}
        disableAutoReset
      />,
    )
    expect(screen.getByRole('button', { name: 'Neu starten' })).toBeTruthy()
  })

  it('Trace-Button ruft onToggleTrace mit der jobId auf', async () => {
    const user = userEvent.setup()
    const onToggleTrace = vi.fn()
    render(
      <JobMonitorRowActions
        item={baseItem({ status: 'failed' })}
        isTraceOpen={false}
        onToggleTrace={onToggleTrace}
        onRetry={vi.fn()}
        onDelete={vi.fn()}
        onCopyMarkdown={vi.fn()}
        disableAutoReset
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Trace anzeigen' }))
    expect(onToggleTrace).toHaveBeenCalledWith('job-1')
  })

  it('Inline-Bestätigung: erst zweiter Klick löscht', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(
      <JobMonitorRowActions
        item={baseItem({ status: 'failed' })}
        isTraceOpen={false}
        onToggleTrace={vi.fn()}
        onRetry={vi.fn()}
        onDelete={onDelete}
        onCopyMarkdown={vi.fn()}
        disableAutoReset
      />,
    )

    const deleteBtn = screen.getByRole('button', { name: 'Job löschen' })
    await user.click(deleteBtn)
    expect(onDelete).not.toHaveBeenCalled()

    const confirmBtn = screen.getByRole('button', { name: 'Löschen bestätigen' })
    expect(confirmBtn.getAttribute('data-confirming')).toBe('true')

    await user.click(confirmBtn)
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('job-1')
    expect(toastMocks.success).toHaveBeenCalledWith('Job gelöscht')
  })

  it('Löschen-Fehler erzeugt error-Toast und kein success-Toast', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockRejectedValue(new Error('500 Server'))
    render(
      <JobMonitorRowActions
        item={baseItem({ status: 'failed' })}
        isTraceOpen={false}
        onToggleTrace={vi.fn()}
        onRetry={vi.fn()}
        onDelete={onDelete}
        onCopyMarkdown={vi.fn()}
        disableAutoReset
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Job löschen' }))
    await user.click(screen.getByRole('button', { name: 'Löschen bestätigen' }))
    expect(toastMocks.error).toHaveBeenCalledTimes(1)
    expect(toastMocks.error.mock.calls[0][0]).toContain('500 Server')
    expect(toastMocks.success).not.toHaveBeenCalled()
  })

  it('Retry zeigt Erfolgs-Toast', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn().mockResolvedValue(undefined)
    render(
      <JobMonitorRowActions
        item={baseItem({ status: 'failed' })}
        isTraceOpen={false}
        onToggleTrace={vi.fn()}
        onRetry={onRetry}
        onDelete={vi.fn()}
        onCopyMarkdown={vi.fn()}
        disableAutoReset
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Neu starten' }))
    expect(onRetry).toHaveBeenCalledWith('job-1')
    expect(toastMocks.success).toHaveBeenCalledWith('Job neu gestartet')
  })

  it('Retry-Button ist während des Requests deaktiviert', async () => {
    const user = userEvent.setup()
    let resolveRetry: (() => void) | undefined
    const onRetry = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveRetry = resolve
      }),
    )
    render(
      <JobMonitorRowActions
        item={baseItem({ status: 'failed' })}
        isTraceOpen={false}
        onToggleTrace={vi.fn()}
        onRetry={onRetry}
        onDelete={vi.fn()}
        onCopyMarkdown={vi.fn()}
        disableAutoReset
      />,
    )
    const retryBtn = screen.getByRole('button', { name: 'Neu starten' })
    await user.click(retryBtn)
    expect(retryBtn.hasAttribute('disabled')).toBe(true)
    resolveRetry?.()
  })

  it('Copy zeigt Erfolgs-Toast', async () => {
    const user = userEvent.setup()
    const onCopy = vi.fn().mockResolvedValue(undefined)
    render(
      <JobMonitorRowActions
        item={baseItem({ status: 'failed' })}
        isTraceOpen={false}
        onToggleTrace={vi.fn()}
        onRetry={vi.fn()}
        onDelete={vi.fn()}
        onCopyMarkdown={onCopy}
        disableAutoReset
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Als Markdown kopieren' }))
    expect(onCopy).toHaveBeenCalledWith('job-1')
    expect(toastMocks.success).toHaveBeenCalledWith('Markdown kopiert')
  })

  it('Copy-Fehler erzeugt error-Toast', async () => {
    const user = userEvent.setup()
    const onCopy = vi.fn().mockRejectedValue(new Error('403 forbidden'))
    render(
      <JobMonitorRowActions
        item={baseItem({ status: 'failed' })}
        isTraceOpen={false}
        onToggleTrace={vi.fn()}
        onRetry={vi.fn()}
        onDelete={vi.fn()}
        onCopyMarkdown={onCopy}
        disableAutoReset
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Als Markdown kopieren' }))
    expect(toastMocks.error).toHaveBeenCalledTimes(1)
    expect(toastMocks.error.mock.calls[0][0]).toContain('403 forbidden')
  })
})
