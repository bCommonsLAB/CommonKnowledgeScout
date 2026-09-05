// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Werkbank-Detail (F9, W4 + A3).
 *
 * Seit A3 steht rechts genau EIN Dokument: beim Vorhaben die Tabs
 * Bericht/Ordner-Beschreibung (W2-Route, `datei=`), beim Artefakt die drei
 * Tabs des Artefakt-Dokuments. Geprueft werden Bericht-Render (Happy-Path),
 * `zu_gross`, „veraltet"-Badge, `kein_bericht`, der Ordner-Beschreibungs-Tab,
 * die „Bereit"-Leiste, Teilbaum-Scan, Abnehmen und der Artefakt-Dispatch.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WerkbankDetail } from '@/components/library/agent-view/werkbank/werkbank-detail'
import type { LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'
import type { UseArtefaktKurationResult } from '@/hooks/agent-view/use-artefakt-kuration'

const toastMock = vi.fn()
// Teil-Mock: `useToast`/`toast` liegen seit Welle M4b im Barrel `@ks/ui`.
// Das Barrel darf NICHT komplett ersetzt werden, sonst fehlen der
// Komponente saemtliche UI-Primitives.
vi.mock('@ks/ui', async (orig) => ({
  ...(await orig<typeof import('@ks/ui')>()),
  useToast: () => ({ toast: toastMock }),
}))
import { createGap } from '@/lib/agent-view/gap-registry'
import type { CoverageGap, CoverageReport, CoverageTreeNode, VorhabenCard } from '@/lib/agent-view/types'
import type { BerichtAntwort } from '@/lib/agent-view/bericht-laden'

afterEach(() => cleanup())

function antwort(overrides: Partial<BerichtAntwort> = {}): BerichtAntwort {
  return { bericht: null, grund: 'kein_bericht', ...overrides }
}

function stubBericht(data: BerichtAntwort) {
  // Pro Aufruf eine FRISCHE Response (Bodies sind einmal lesbar) und URL-Routing:
  // das Detail fragt seit W6 auch die Worklists-Route (ZuListeKnopf), seit W7
  // schreibt es ueber die Stand-Route (StandAktionen).
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (eingabe: RequestInfo | URL) => {
      if (String(eingabe).includes('/agent-view/worklists')) {
        return new Response(JSON.stringify({ lists: [] }), { status: 200 })
      }
      if (String(eingabe).includes('/shadow-twins/content')) {
        return new Response(JSON.stringify({ markdown: '# Transkript\n\nInhalt.' }), { status: 200 })
      }
      if (String(eingabe).includes('/agent-view/stand')) {
        return new Response(
          JSON.stringify({ stand: { bearbeitungsstand: 'abgenommen', bearbeitungsstandSeit: '2026-08-24T23:59:59.999Z' } }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify(data), { status: 200 })
    }),
  )
}

beforeEach(() => stubBericht(antwort()))

function fakeThemen() {
  return {
    overrides: new Map<string, string[]>(),
    pendingFolderId: null,
    fehlerByFolder: new Map<string, string>(),
    setzeThemen: vi.fn().mockResolvedValue(true),
  }
}

function fakeKuration(): UseArtefaktKurationResult {
  return {
    overrides: new Map(), pendingKey: null, fehler: new Map(),
    verifiziere: vi.fn().mockResolvedValue(null),
    markiere: vi.fn().mockResolvedValue(null),
    setzeTwinStatus: vi.fn().mockResolvedValue(undefined),
  }
}

function gapAt(path: string, folderId: string, type: CoverageGap['type']): CoverageGap {
  return createGap({ type, scope: 'folder', targetId: folderId, targetName: path, folderId, path, message: 'Test' })
}

function karte(overrides: Partial<VorhabenCard> = {}): VorhabenCard {
  return {
    folderId: 'f-pilot', name: 'Pilot', path: '1. Arbeit/Pilot',
    bearbeitungsstand: 'berichtet', bearbeitungsstandSeit: null, hasBericht: true,
    totalGaps: 1, gapsByActor: { mensch: 1, cowork: 0, knowledgescout: 0 },
    gapsByType: { stand_widerspruch: 1 }, widerspruch: false,
    ampel: 'rot', berichtTitel: 'Pilotbericht', berichtFileId: 'id-b1',
    berichtModifiedAt: null, berichtStatus: 'aktiv', themen: [],
    ...overrides,
  }
}

function knoten(path: string, overrides: Partial<CoverageTreeNode> = {}): CoverageTreeNode {
  return {
    folderId: `f-${path}`, name: path.split('/').pop() ?? '', path, depth: path.split('/').length,
    bearbeitungsstand: null, bearbeitungsstandSeit: null, hasIndex: true, hasBericht: true,
    sourceCount: 2, fileCount: 3, ownGaps: 0, totalGaps: 0, gapsByType: {},
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, ampel: 'gruen', children: [],
  }
}

function report(overrides: Partial<CoverageReport> = {}): CoverageReport {
  return {
    libraryId: 'lib-1', generatedAt: '2026-08-23T12:00:00.000Z', derived: true,
    scope: { folderId: null },
    conventions: {
      standardTemplate: null, vorhabenFolderPattern: null,
      indexRequiredMaxDepth: null, berichtFreshness: true, postfachMaxRueckstandWochen: null, scanExcludeGlobs: [],
    },
    totals: {
      folders: 1, files: 3, sources: 2, twins: 1, gaps: 1,
      gapsByType: {}, gapsByActor: { mensch: 1, cowork: 0, knowledgescout: 0 },
      skippedExcluded: { archive: 0, engine: 0 }, collapsedGaps: 0, scanErrors: 0,
    },
    gaps: [gapAt('1. Arbeit/Pilot', 'f-pilot', 'stand_widerspruch')],
    // Pilot-Knoten traegt die folderId der Karte — die Fusszeile findet ihn darueber.
    tree: [{ ...knoten('1. Arbeit'), children: [{ ...knoten('1. Arbeit/Pilot'), folderId: 'f-pilot' }] }],
    vorhaben: [karte()],
    families: [],
    ...overrides,
  }
}

function renderDetail(r: CoverageReport, k: VorhabenCard | null = karte(), vorhabenId: string | null = 'f-pilot') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <WerkbankDetail
        karte={k}
        vorhabenId={vorhabenId}
        artefaktId={null}
        familie={null}
        familien={[]}
        kuration={fakeKuration()}
        themenVokabular={[]}
        themenHook={fakeThemen()}
        onWaehleArtefakt={vi.fn()}
        report={r}
        generatedAt={r.generatedAt}
        libraryLabel="Testarchiv"
        localRootPath={null}
      />
    </QueryClientProvider>,
  )
}

describe('WerkbankDetail — Bericht (W2-Route + bestehende MarkdownPreview)', () => {
  it('rendert den Bericht-Body mit der bestehenden MarkdownPreview (Happy-Path)', async () => {
    stubBericht(antwort({
      grund: undefined,
      bericht: {
        fileId: 'id-b1', name: 'BERICHT.md', modifiedAt: '2026-08-21T07:30:00.000Z', sizeBytes: 100,
        body: '# Pilotbericht\n\nInhalt aus dem Archiv.',
        kopf: { titel: 'Pilotbericht', ersterAbsatz: 'Inhalt aus dem Archiv.', offenePunkte: [] },
      },
    }))
    renderDetail(report())
    expect(await screen.findByText('Inhalt aus dem Archiv.')).toBeTruthy()
    expect(screen.getByText('BERICHT.md')).toBeTruthy()
  })

  it('zu_gross verweist ins Archiv statt abgeschnittener Vorschau', async () => {
    stubBericht(antwort({
      grund: 'zu_gross',
      bericht: {
        fileId: 'id-b1', name: 'BERICHT.md', modifiedAt: null, sizeBytes: 600 * 1024,
        body: null, kopf: null,
      },
    }))
    renderDetail(report())
    expect(await screen.findByText(/zu gross fuer die Vorschau/)).toBeTruthy()
    expect(screen.getAllByText(/im Archiv oeffnen/).length).toBeGreaterThan(0)
  })

  it('traegt das „veraltet"-Badge, wenn der Report bericht_veraltet am Vorhaben meldet', async () => {
    stubBericht(antwort({
      grund: undefined,
      bericht: {
        fileId: 'id-b1', name: 'BERICHT.md', modifiedAt: null, sizeBytes: 10,
        body: '# Pilotbericht', kopf: { titel: 'Pilotbericht', ersterAbsatz: '', offenePunkte: [] },
      },
    }))
    const r = report({
      gaps: [gapAt('1. Arbeit/Pilot', 'f-pilot', 'bericht_veraltet')],
    })
    renderDetail(r)
    expect(await screen.findByText('veraltet')).toBeTruthy()
  })

  it('kein_bericht ist ein Cowork-Befund mit Auftrags-Hinweis, kein Fehler', async () => {
    renderDetail(report())
    expect(await screen.findByText('Kein BERICHT.md')).toBeTruthy()
    expect(screen.getByText(/Auftrag fuer dieses Vorhaben/)).toBeTruthy()
  })

  it('A3: der Tab „Ordner-Beschreibung" laedt datei=index und benennt das Fehlen', async () => {
    renderDetail(report())
    fireEvent.click(await screen.findByRole('tab', { name: 'Ordner-Beschreibung' }))
    expect(await screen.findByText('Kein _INDEX.md')).toBeTruthy()
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>
    const indexCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('datei=index'))
    expect(indexCalls.length).toBeGreaterThan(0)
  })
})

describe('WerkbankDetail — Kopf und Aktionen', () => {
  it('A4: „Vorhaben abnehmen" sperrt bei Widerstaenden — Maschine ODER Fehler-Markierung (ADR 0006)', () => {
    renderDetail(report())
    expect(screen.getByRole('button', { name: 'Vorhaben abnehmen' }).hasAttribute('disabled')).toBe(false)
    cleanup()
    renderDetail(report(), karte({ gapsByActor: { mensch: 1, cowork: 1, knowledgescout: 0 } }))
    expect(screen.getByRole('button', { name: 'Vorhaben abnehmen' }).hasAttribute('disabled')).toBe(true)
    cleanup()
    // Neu: Was der Mensch als fehlerhaft markiert hat, sperrt ebenfalls.
    renderDetail(report(), karte({ gapsByType: { twin_flagged: 1 } }))
    expect(screen.getByRole('button', { name: 'Vorhaben abnehmen' }).hasAttribute('disabled')).toBe(true)
  })




  it('Teilbaum-Scan (W8): Knopf nur mit Handler, meldet die folderId; Fallback-Hinweis sichtbar', () => {
    renderDetail(report())
    fireEvent.click(screen.getByRole('button', { name: 'Menue zu Pilot' }))
    expect(screen.queryByRole('button', { name: /Teilbaum neu scannen/ })).toBeNull()
    cleanup()

    const onScan = vi.fn()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <WerkbankDetail
          karte={karte()} vorhabenId="f-pilot" artefaktId={null} familie={null}
          familien={[]} kuration={fakeKuration()} themenVokabular={[]} themenHook={fakeThemen()} onWaehleArtefakt={vi.fn()}
          report={report()} generatedAt="2026-08-23T12:00:00.000Z"
          libraryLabel="Testarchiv" localRootPath={null}
          teilbaumScan={{ onScan, isScanning: false, hinweis: 'Der gespeicherte Report stammt von vor W8' }}
        />
      </QueryClientProvider>,
    )
    // A4: der Knopf wohnt im Menue ⋯ (alles Seltene).
    fireEvent.click(screen.getByRole('button', { name: 'Menue zu Pilot' }))
    fireEvent.click(screen.getByRole('button', { name: /Teilbaum neu scannen/ }))
    expect(onScan).toHaveBeenCalledWith('f-pilot')
    expect(screen.getByText(/Nicht gemergt: Der gespeicherte Report stammt von vor W8/)).toBeTruthy()
  })

  it('Abnehmen (W7) ueberlagert den Stand lokal und sagt dazu, dass der Report alt ist', async () => {
    renderDetail(report())
    fireEvent.click(screen.getByRole('button', { name: 'Vorhaben abnehmen' }))
    expect(await screen.findByText(/Report zeigt noch den alten Scan/)).toBeTruthy()
    expect(screen.getByText('Abgenommen')).toBeTruthy()
    // Das seit-Datum wohnt im Chip-Titel (A4: Zeile 1 bleibt eine Zeile).
    expect(screen.getByTitle('seit 2026-08-24')).toBeTruthy()
  })

})

describe('WerkbankDetail — Verifizieren im Fluss (A5)', () => {
  function artefaktSummary(overrides: Partial<LeadingArtifactSummary> = {}): LeadingArtifactSummary {
    return {
      kind: 'transcript', templateName: null, targetLanguage: 'de', twinStatus: null,
      generatedBy: null, generatedAt: null, verifiedBy: null, verifiedAt: null,
      verification: 'unverifiziert', ...overrides,
    }
  }
  function twinFamilie(sourceId: string, overrides: Partial<TwinFamilySummary> = {}): TwinFamilySummary {
    return {
      sourceId, sourceName: `${sourceId}.m4a`, folderId: 'f-eins', path: `1. Arbeit/Pilot/Ordner Eins/${sourceId}.m4a`,
      artifactCount: 1, leading: artefaktSummary(),
      transkript: artefaktSummary(), zusammenfassung: null,
      ...overrides,
    }
  }

  it('Markierung aufgeloest: Sprung zum naechsten Widerstand im anderen Ordner', async () => {
    toastMock.mockClear()
    // Der eigene Fehler ist geklaert, im Ordner Zwei wartet der naechste.
    const aktuelle = twinFamilie('s-a')
    const naechste = twinFamilie('s-b', {
      folderId: 'f-zwei',
      path: '1. Arbeit/Pilot/Ordner Zwei/s-b.m4a',
      transkript: artefaktSummary({ twinStatus: 'flagged', flaggedNote: 'Zahlen falsch' }),
    })
    const frisch = artefaktSummary({ verification: 'mensch', verifiedBy: 'human:peter' })
    const kuration: UseArtefaktKurationResult = {
      overrides: new Map(), pendingKey: null, fehler: new Map(),
      verifiziere: vi.fn().mockResolvedValue(frisch),
      markiere: vi.fn().mockResolvedValue(null),
      setzeTwinStatus: vi.fn(),
    }
    const onWaehleArtefakt = vi.fn()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <WerkbankDetail
          karte={karte()} vorhabenId="f-pilot" artefaktId="s-a" familie={aktuelle}
          familien={[aktuelle, naechste]} kuration={kuration}
          themenVokabular={[]} themenHook={fakeThemen()} onWaehleArtefakt={onWaehleArtefakt}
          report={report()} generatedAt="G1" libraryLabel="Testarchiv" localRootPath={null}
        />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Verifizieren' }))
    await vi.waitFor(() => expect(onWaehleArtefakt).toHaveBeenCalledWith('s-b'))
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Ordner Eins') }),
    )
  })

  it('ohne Widerstand bleibt die Auswahl stehen — Verifizieren treibt nichts weiter', async () => {
    toastMock.mockClear()
    const aktuelle = twinFamilie('s-a')
    const andere = twinFamilie('s-b', { folderId: 'f-zwei', path: '1. Arbeit/Pilot/Ordner Zwei/s-b.m4a' })
    const frisch = artefaktSummary({ verification: 'mensch', verifiedBy: 'human:peter' })
    const kuration: UseArtefaktKurationResult = {
      overrides: new Map(), pendingKey: null, fehler: new Map(),
      verifiziere: vi.fn().mockResolvedValue(frisch),
      markiere: vi.fn().mockResolvedValue(null),
      setzeTwinStatus: vi.fn(),
    }
    const onWaehleArtefakt = vi.fn()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <WerkbankDetail
          karte={karte()} vorhabenId="f-pilot" artefaktId="s-a" familie={aktuelle}
          familien={[aktuelle, andere]} kuration={kuration}
          themenVokabular={[]} themenHook={fakeThemen()} onWaehleArtefakt={onWaehleArtefakt}
          report={report()} generatedAt="G1" libraryLabel="Testarchiv" localRootPath={null}
        />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Verifizieren' }))
    await vi.waitFor(() => expect(kuration.verifiziere).toHaveBeenCalledTimes(1))
    expect(onWaehleArtefakt).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Kein Widerstand') }),
    )
  })
})
