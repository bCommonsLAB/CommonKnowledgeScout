// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Artefakt-Dokument (Welle A3, Mockup Zustand B).
 *
 * Drei Tabs — Original ohne Haekchen (Entscheidung 4), Transkript und
 * Zusammenfassung mit eigener Pruef-Kennung. Inhalte kommen aus der
 * bestehenden Shadow-Twin-Content-Route; Frontmatter steht sichtbar UEBER
 * dem Text. Jeder Leerzustand ist benannt (kein Artefakt, nicht in Mongo,
 * Word ohne eingebettete Vorschau).
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { standardTab, WerkbankArtefaktDokument } from '@/components/library/agent-view/werkbank/werkbank-artefakt-dokument'
import type { LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'

afterEach(() => cleanup())

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (eingabe: RequestInfo | URL) => {
      if (String(eingabe).includes('/shadow-twins/content')) {
        return new Response(
          JSON.stringify({ markdown: '---\ntitle: Treffen mit Thomas Egger\nauthors: ["Peter Eichner"]\n---\n# Treffen\n\nGespraech ueber die Vortragsreihe.' }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({}), { status: 404 })
    }),
  )
})

function artefakt(overrides: Partial<LeadingArtifactSummary> = {}): LeadingArtifactSummary {
  return {
    kind: 'transcript', templateName: null, targetLanguage: 'de', twinStatus: null,
    generatedBy: null, generatedAt: null, verifiedBy: null, verifiedAt: null,
    verification: 'unverifiziert', ...overrides,
  }
}

function familie(overrides: Partial<TwinFamilySummary> = {}): TwinFamilySummary {
  return {
    sourceId: 's-egger', sourceName: 'Treffen Thomas Egger.m4a', folderId: 'f-klimaclub',
    path: '26.01 Klima/Klimaclub/Treffen Thomas Egger.m4a', artifactCount: 2, leading: artefakt(),
    transkript: artefakt({ verification: 'mensch' }),
    zusammenfassung: artefakt({ kind: 'transformation', templateName: 'standard' }),
    ...overrides,
  }
}

function renderDokument(f: TwinFamilySummary, tab = standardTab(f)) {
  const onTab = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <WerkbankArtefaktDokument libraryId="lib-1" familie={f} archivHref="/library?x" tab={tab} onTab={onTab} />
    </QueryClientProvider>,
  )
  return { onTab }
}

describe('WerkbankArtefaktDokument (A3)', () => {
  it('standardTab bevorzugt die Zusammenfassung, dann Transkript, dann Original', () => {
    expect(standardTab(familie())).toBe('zusammenfassung')
    expect(standardTab(familie({ zusammenfassung: null }))).toBe('transkript')
    expect(standardTab(familie({ zusammenfassung: null, transkript: null }))).toBe('original')
  })

  it('traegt drei Tabs — Original ohne Haekchen, die anderen mit Pruef-Kennung', () => {
    renderDokument(familie())
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Original', '✓Transkript', '○Zusammenfassung'])
  })

  it('rendert Inhalt mit Frontmatter sichtbar UEBER dem Text', async () => {
    renderDokument(familie())
    expect(await screen.findByText(/Gespraech ueber die Vortragsreihe/)).toBeTruthy()
    expect(screen.getByText('title:')).toBeTruthy()
    expect(screen.getByText(/Peter Eichner/)).toBeTruthy()
  })

  it('Tab-Klick meldet den Wechsel nach aussen (der Kopf verifiziert den aktiven Tab)', () => {
    const { onTab } = renderDokument(familie())
    fireEvent.click(screen.getByRole('tab', { name: /Transkript/ }))
    expect(onTab).toHaveBeenCalledWith('transkript')
  })

  it('benennt ein fehlendes Artefakt statt leer zu bleiben', () => {
    renderDokument(familie({ zusammenfassung: null }), 'zusammenfassung')
    expect(screen.getByText('Kein Zusammenfassung vorhanden')).toBeTruthy()
  })

  it('benennt 404 der Content-Route als „nicht in MongoDB"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'x' }), { status: 404 })))
    renderDokument(familie(), 'transkript')
    expect(await screen.findByText('Transkript nicht in MongoDB')).toBeTruthy()
  })

  it('Original: Audio bekommt einen Abspieler ueber die Streaming-Route', () => {
    renderDokument(familie(), 'original')
    const audio = document.querySelector('audio')
    expect(audio).not.toBeNull()
    expect(audio?.getAttribute('src')).toContain('/api/storage/streaming-url?libraryId=lib-1&fileId=s-egger')
  })

  it('Original: Word hat keine eingebettete Vorschau — benannt, mit Archiv-Link', () => {
    renderDokument(familie({ sourceName: 'detail1-de.docx' }), 'original')
    expect(screen.getByText('Keine eingebettete Vorschau')).toBeTruthy()
    expect(screen.getByText(/Im Archiv oeffnen/)).toBeTruthy()
  })
})
