// @vitest-environment jsdom

import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditDraftStep } from '@/components/creation-wizard/steps/edit-draft-step'
import type { TemplateMetadataSchema } from '@/lib/templates/template-types'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

// Mock fetch
global.fetch = vi.fn()

describe('EditDraftStep image upload', () => {
  const mockTemplateMetadata: TemplateMetadataSchema = {
    fields: [
      {
        key: 'author_name',
        variable: 'author_name',
        description: 'Vollständiger Name',
        rawValue: '{{author_name|Vollständiger Name}}',
      },
      {
        key: 'author_image_url',
        variable: 'author_image_url',
        description: 'Bild oder Selfie',
        rawValue: '{{author_image_url|Bild oder Selfie}}',
      },
    ],
    rawFrontmatter: '---\ntitle: Test\n---',
  }

  const mockOnMetadataChange = vi.fn()
  const mockOnDraftTextChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render image field as upload component when in imageFieldKeys', () => {
    render(
      <EditDraftStep
        templateMetadata={mockTemplateMetadata}
        draftMetadata={{}}
        draftText=""
        onMetadataChange={mockOnMetadataChange}
        onDraftTextChange={mockOnDraftTextChange}
        userRelevantFields={['author_name', 'author_image_url']}
        imageFieldKeys={['author_image_url']}
        libraryId="test-library"
      />
    )

    // Prüfe, ob Upload-Button vorhanden ist
    expect(screen.getAllByText(/Bild hochladen/i).length).toBeGreaterThan(0)
  })

  it('should upload image immediately when file is selected', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const mockResponse = { url: 'https://example.com/image.jpg' }

    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    render(
      <EditDraftStep
        templateMetadata={mockTemplateMetadata}
        draftMetadata={{}}
        draftText=""
        onMetadataChange={mockOnMetadataChange}
        onDraftTextChange={mockOnDraftTextChange}
        userRelevantFields={['author_image_url']}
        imageFieldKeys={['author_image_url']}
        libraryId="test-library"
      />
    )

    const fileInputs = screen.getAllByLabelText(/Bild hochladen/i) as unknown as HTMLInputElement[]
    expect(fileInputs.length).toBeGreaterThan(0)
    // In der UI können mehrere (hidden) Inputs existieren – wir triggern alle defensiv.
    for (const fileInput of fileInputs) {
      await userEvent.upload(fileInput, mockFile)
    }

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/creation/upload-image',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'X-Library-Id': 'test-library',
          },
        })
      )
    })

    // Hinweis: Wir testen hier bewusst nur, dass der Upload-Request ausgelöst wird.
    // Die restliche Verarbeitung (state updates, toast) hängt an asynchronen UI-Flows.
  })
})









