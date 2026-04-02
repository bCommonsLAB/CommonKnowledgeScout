// @vitest-environment jsdom

import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AppLayout } from '@/components/layouts/app-layout'

const mockUsePathname = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}))

vi.mock('@/components/top-nav-wrapper', () => ({
  TopNavWrapper: () => <div data-testid="top-nav-wrapper">TopNav</div>,
}))

vi.mock('@/components/debug/debug-footer-wrapper', () => ({
  DebugFooterWrapper: () => <div data-testid="debug-footer-wrapper">DebugFooter</div>,
}))

vi.mock('@/components/shared/job-monitor-panel', () => ({
  JobMonitorPanel: () => <div data-testid="job-monitor-panel">JobMonitor</div>,
}))

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('zeigt die globale TopNav auch auf Explore-Slug-Seiten', () => {
    mockUsePathname.mockReturnValue('/explore/oldiesforfuture')

    render(
      <AppLayout>
        <div>Explore Inhalt</div>
      </AppLayout>
    )

    expect(screen.getAllByTestId('top-nav-wrapper')).toHaveLength(1)
    expect(screen.getByText('Explore Inhalt')).toBeTruthy()
  })

  it('zeigt im Fixed-Height-Layout weiterhin TopNav und JobMonitor', () => {
    mockUsePathname.mockReturnValue('/library')

    render(
      <AppLayout>
        <div>Library Inhalt</div>
      </AppLayout>
    )

    expect(screen.getAllByTestId('top-nav-wrapper')).toHaveLength(1)
    expect(screen.getAllByTestId('job-monitor-panel')).toHaveLength(1)
    expect(screen.getByText('Library Inhalt')).toBeTruthy()
  })
})
