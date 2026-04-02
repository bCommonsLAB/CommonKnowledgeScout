// @vitest-environment jsdom

import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Footer } from '@/components/home/footer'
import { CTASection } from '@/components/home/cta-section'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/i18n/hooks', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'footer.transparency': 'Transparency text',
        'footer.learnMore': 'Learn more',
        'footer.privacy': 'Privacy',
        'footer.imprint': 'Imprint',
        'footer.legalNotice': 'Legal Notice',
        'footer.about': 'About the Project',
        'footer.documentation': 'Documentation',
        'footer.projectInfo': `Project by ${params?.crystalDesign ?? ''} and ${params?.bcommonslab ?? ''}`,
        'footer.crystalDesign': 'Crystal Design',
        'footer.bcommonslab': 'bcommonsLAB',
        'footer.collaboration': 'Collaboration text',
        'home.cta.title': 'CTA Title',
        'home.cta.description1': 'Description 1',
        'home.cta.description2': 'Description 2',
        'home.cta.description3': 'Description 3',
        'home.cta.buttonContact': 'Contact',
        'home.cta.buttonView': 'About',
      }
      return translations[key] ?? key
    },
  }),
}))

describe('public home links', () => {
  it('renders footer without duplicate legal links', () => {
    render(<Footer />)

    expect(screen.queryByText('Imprint')).toBeNull()
    expect(screen.getAllByText('Legal Notice')).toHaveLength(1)
  })

  it('renders github cta with explicit label', () => {
    render(<CTASection />)

    expect(
      screen.getByRole('link', { name: 'View on GitHub' }).getAttribute('href')
    ).toBe('https://github.com/bCommonsLAB/CommonKnowledgeScout')
  })

  afterEach(() => {
    cleanup()
  })
})
