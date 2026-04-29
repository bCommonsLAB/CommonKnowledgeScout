// @vitest-environment jsdom

/**
 * Characterization Tests fuer `UploadDialog` (Welle 3-I, Schritt 3).
 *
 * Geprueft wird der **derzeitige** Vertrag, sodass der Modul-Split in
 * Schritt 4b nichts unbemerkt aendert:
 *
 * - Geschlossener Dialog (`open=false`) rendert keinen Dialog-Inhalt.
 * - Offener Dialog (`open=true`) rendert Titel + Hochlade-Bereich.
 * - Bei Provider-Verfuegbarkeit wird `getPathById(currentFolderId)`
 *   aufgerufen und das Ergebnis als Zielverzeichnis angezeigt.
 *
 * Keine Storage-Live-Calls, keine echten Uploads.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { UploadDialog } from '@/components/library/upload-dialog'
import type { StorageProvider } from '@/lib/storage/types'

// UploadArea ist eine Drag&Drop-Komponente mit `react-dropzone`. Wir
// ersetzen sie durch ein simples Marker-Element, weil Schritt 3 nur den
// Dialog-Vertrag fixieren soll, nicht das Upload-Verhalten.
vi.mock('@/components/library/upload-area', () => ({
  UploadArea: ({ currentFolderId }: { currentFolderId: string }) => (
    <div data-testid="upload-area" data-folder={currentFolderId}>
      UploadArea-Mock
    </div>
  ),
}))

function makeMockProvider(pathResult: string): StorageProvider {
  // Nur die Methoden, die UploadDialog nutzt.
  const provider = {
    id: 'lib-test',
    name: 'Test Provider',
    getPathById: vi.fn().mockResolvedValue(pathResult),
  } as unknown as StorageProvider
  return provider
}

describe('UploadDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert keinen Dialog-Inhalt, wenn open=false', () => {
    const provider = makeMockProvider('/library/root')
    render(
      <UploadDialog
        open={false}
        onOpenChange={() => {}}
        provider={provider}
        currentFolderId="root"
      />
    )

    expect(screen.queryByText('Dateien hochladen')).toBeNull()
    expect(screen.queryByTestId('upload-area')).toBeNull()
  })

  it('rendert Titel und UploadArea, wenn open=true', () => {
    const provider = makeMockProvider('/library/root')
    render(
      <UploadDialog
        open={true}
        onOpenChange={() => {}}
        provider={provider}
        currentFolderId="root"
      />
    )

    expect(screen.getByText('Dateien hochladen')).toBeTruthy()
    expect(screen.getByTestId('upload-area')).toBeTruthy()
    expect(screen.getByTestId('upload-area').getAttribute('data-folder')).toBe('root')
  })

  it('zeigt das via getPathById aufgeloeste Zielverzeichnis an', async () => {
    const provider = makeMockProvider('/library/Documents/Reports')
    render(
      <UploadDialog
        open={true}
        onOpenChange={() => {}}
        provider={provider}
        currentFolderId="folder-42"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('/library/Documents/Reports')).toBeTruthy()
    })
    expect(provider.getPathById).toHaveBeenCalledWith('folder-42')
  })
})
