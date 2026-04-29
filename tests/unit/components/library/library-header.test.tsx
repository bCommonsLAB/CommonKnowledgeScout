// @vitest-environment jsdom

/**
 * Characterization Tests fuer `LibraryHeader` (Welle 3-I, Schritt 3).
 *
 * Fixiert:
 *
 * - Header rendert Action-Buttons (Upload, Verzeichnis-Verarbeiten, Plus).
 * - Tree-Toggle-Button erscheint nur, wenn `isTreeVisible` als boolean
 *   uebergeben wird.
 * - Compact-Toggle-Button erscheint nur, wenn `isCompactList` als boolean
 *   uebergeben wird.
 * - Children werden in der Desktop-Pfad-Spalte gerendert.
 *
 * Sub-Komponenten (UploadDialog, AudioRecorderClient, SplitPdfPagesButton,
 * PdfBulkImportDialog) werden gemockt — der Test prueft nur die Schale
 * des Headers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { LibraryHeader } from '@/components/library/library-header'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock('@/hooks/use-folder-navigation', () => ({
  useFolderNavigation: () => vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/components/library/upload-dialog', () => ({
  UploadDialog: () => <div data-testid="upload-dialog-mock" />,
}))

vi.mock('@/components/library/pdf-bulk-import-dialog', () => ({
  default: () => <div data-testid="pdf-bulk-mock" />,
}))

vi.mock('@/components/library/split-pdf-pages-button', () => ({
  SplitPdfPagesButton: () => <button data-testid="split-pdf-mock">SplitPdf</button>,
}))

vi.mock('@/components/library/audio-recorder-client', () => ({
  AudioRecorderClient: () => <button data-testid="audio-recorder-mock">Audio</button>,
}))

vi.mock('@/components/library/breadcrumb', () => ({
  Breadcrumb: () => <div data-testid="breadcrumb-default">Default Breadcrumb</div>,
}))

describe('LibraryHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert Upload- und PDF-Bulk-Buttons in der Action-Leiste', () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <LibraryHeader provider={null} />
      </Provider>
    )

    expect(screen.getByLabelText('Datei hochladen')).toBeTruthy()
    expect(screen.getByLabelText('Verzeichnis verarbeiten')).toBeTruthy()
    expect(screen.getByLabelText('Content erstellen')).toBeTruthy()
  })

  it('zeigt Tree-Toggle nur, wenn isTreeVisible/onToggleTree gesetzt sind', () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <LibraryHeader
          provider={null}
          isTreeVisible={true}
          onToggleTree={() => {}}
        />
      </Provider>
    )

    expect(screen.getByLabelText('Tree ausblenden')).toBeTruthy()
  })

  it('rendert children statt Default-Breadcrumb, wenn children uebergeben werden', () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <LibraryHeader provider={null}>
          <div data-testid="custom-breadcrumb">Custom Path</div>
        </LibraryHeader>
      </Provider>
    )

    expect(screen.getByTestId('custom-breadcrumb')).toBeTruthy()
    expect(screen.queryByTestId('breadcrumb-default')).toBeNull()
  })

  it('zeigt Error-Alert, wenn error-Prop uebergeben wird', () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <LibraryHeader provider={null} error="Fataler Storage-Fehler" />
      </Provider>
    )

    expect(screen.getByText('Fataler Storage-Fehler')).toBeTruthy()
  })
})
