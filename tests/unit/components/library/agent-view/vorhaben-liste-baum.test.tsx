// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Baum bis zum Artefakt in der Werkbank-Liste (A2).
 *
 * Geprueft wird die Integration: Vorhaben starten zugeklappt, der Pfeil
 * klappt den Teilbaum auf (Ordner- und Artefakt-Zeilen mit Zaehler und
 * Pruef-Kennung), ein Klick aufs Artefakt meldet Vorhaben UND Familie
 * (beide gehoeren in die URL), und der Vorhaben-Zaehler `n/m` steht an der
 * Zeile.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// jsdom misst 0x0 — der Virtualizer liest `offsetWidth`/`offsetHeight` des
// Scroll-Containers und rendert ohne Masse keine Zeilen. Feste Masse stubben.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 800 })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 300 })
})
import { VorhabenListe } from '@/components/library/agent-view/werkbank/vorhaben-liste'
import { baueTeilbaumZeilen, zaehlePruefstand } from '@/lib/agent-view/werkbank-baum'
import type { CoverageTreeNode, LeadingArtifactSummary, TwinFamilySummary, VorhabenCard } from '@/lib/agent-view/types'

afterEach(() => cleanup())

function artefakt(overrides: Partial<LeadingArtifactSummary> = {}): LeadingArtifactSummary {
  return {
    kind: 'transcript', templateName: null, targetLanguage: 'de', twinStatus: null,
    generatedBy: null, generatedAt: null, verifiedBy: null, verifiedAt: null,
    verification: 'unverifiziert', ...overrides,
  }
}

const familie: TwinFamilySummary = {
  sourceId: 's-egger', sourceName: 'Treffen Thomas Egger.m4a', folderId: 'f-klimaclub',
  path: '4. Aktivismus/26.01 Klima/2026-08-04 Klimaclub/Treffen Thomas Egger.m4a',
  artifactCount: 2, leading: artefakt(),
  transkript: artefakt({ verification: 'mensch' }),
  zusammenfassung: artefakt({ kind: 'transformation', templateName: 'standard' }),
}

const knoten: CoverageTreeNode = {
  folderId: 'f-klima', name: '26.01 Klima', path: '4. Aktivismus/26.01 Klima', depth: 2,
  bearbeitungsstand: null, bearbeitungsstandSeit: null, hasIndex: true, hasBericht: true,
  sourceCount: 0, fileCount: 0, ownGaps: 0, totalGaps: 0, gapsByType: {},
  gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, ampel: 'gelb',
  children: [{
    folderId: 'f-klimaclub', name: '2026-08-04 Klimaclub', path: '4. Aktivismus/26.01 Klima/2026-08-04 Klimaclub',
    depth: 3, bearbeitungsstand: null, bearbeitungsstandSeit: null, hasIndex: true, hasBericht: false,
    sourceCount: 1, fileCount: 1, ownGaps: 0, totalGaps: 0, gapsByType: {},
    gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, ampel: 'gelb', children: [],
  }],
}

const karte: VorhabenCard = {
  folderId: 'f-klima', name: '26.01 Klima', path: '4. Aktivismus/26.01 Klima',
  bearbeitungsstand: 'berichtet', bearbeitungsstandSeit: null, hasBericht: true,
  totalGaps: 1, gapsByActor: { mensch: 1, cowork: 0, knowledgescout: 0 },
  gapsByType: {}, widerspruch: false, ampel: 'gelb', berichtTitel: null,
  berichtFileId: null, berichtModifiedAt: null, berichtStatus: null, themen: [],
}

function renderListe(onSelectArtefakt = vi.fn()) {
  render(
    <VorhabenListe
      karten={[karte]}
      gruppierung="bereich"
      leerText={null}
      auswahlId={null}
      onSelect={vi.fn()}
      baum={{
        zeilenFuer: (vorhabenId, ordnerZu) =>
          baueTeilbaumZeilen({ vorhabenFolderId: vorhabenId, knoten, familien: [familie], ordnerZu }),
        zaehlerFuer: () => zaehlePruefstand([familie]),
        artefaktAuswahlId: null,
        onSelectArtefakt,
      }}
    />,
  )
  return { onSelectArtefakt }
}

describe('VorhabenListe — Baum bis zum Artefakt (A2)', () => {
  it('startet zugeklappt und traegt den Zaehler n/m an der Vorhaben-Zeile', () => {
    renderListe()
    expect(screen.getByText('0/1')).toBeTruthy()
    expect(screen.queryByText('Treffen Thomas Egger.m4a')).toBeNull()
  })

  it('der Pfeil klappt Ordner- und Artefakt-Zeilen auf, mit Pruef-Kennung ○', () => {
    renderListe()
    fireEvent.click(screen.getByLabelText(/Teilbaum von 26.01 Klima aufklappen/))
    expect(screen.getByText('2026-08-04 Klimaclub')).toBeTruthy()
    expect(screen.getByText('Treffen Thomas Egger.m4a')).toBeTruthy()
    // Transkript mensch-verifiziert, Zusammenfassung offen ⇒ Familie offen.
    expect(screen.getByText('○')).toBeTruthy()
  })

  it('Ordner-Zeile klappt ihren Inhalt zu', () => {
    renderListe()
    fireEvent.click(screen.getByLabelText(/Teilbaum von 26.01 Klima aufklappen/))
    fireEvent.click(screen.getByText('2026-08-04 Klimaclub'))
    expect(screen.queryByText('Treffen Thomas Egger.m4a')).toBeNull()
  })

  it('Klick aufs Artefakt meldet Vorhaben und Familie (Auswahl in die URL)', () => {
    const { onSelectArtefakt } = renderListe()
    fireEvent.click(screen.getByLabelText(/Teilbaum von 26.01 Klima aufklappen/))
    fireEvent.click(screen.getByText('Treffen Thomas Egger.m4a'))
    expect(onSelectArtefakt).toHaveBeenCalledWith('f-klima', expect.objectContaining({ sourceId: 's-egger' }))
  })
})
