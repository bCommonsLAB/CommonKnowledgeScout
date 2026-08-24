/**
 * @fileoverview W8-Kerntest: Voll-Scan ≡ Merge (§F10) + benannte Fallbacks.
 *
 * Der Invarianz-Test faehrt den ECHTEN `runCoverageScan` gegen die
 * Fixture-Welt: Voll-Report bei T0, Mutation NUR im Scope, Teil-Scan bei T1,
 * Merge — und vergleicht das Ergebnis per Deep-Equal mit einem frischen
 * Voll-Scan bei T1 (gleiche Uhr → vollstaendig identisch, kein „modulo").
 * Das deckt insbesondere die teilbaum-uebergreifenden Regeln ab: die
 * Mutation im Scope muss `bericht_veraltet` und `stand_widerspruch` am
 * VORFAHREN ausserhalb des Scopes ausloesen.
 */

import { describe, it, expect } from 'vitest'
import { runCoverageScan } from '@/lib/agent-view/coverage-service'
import { mergeTeilbaumReport } from '@/lib/agent-view/report-merge'
import type { CoverageReport } from '@/lib/agent-view/types'
import { KONVENTIONEN, baueWelt, teilRequest, vollRequest, weltPorts, type Welt } from './report-merge.fixtures'

const T0 = '2026-08-15T12:00:00.000Z'
const T1 = '2026-08-24T12:00:00.000Z'
const SCOPE = 'f-pilot'

function mutiereImScope(welt: Welt): void {
  // Neue Quelle in „Pilot/Unter": juenger als BERICHT und `seit` von
  // „1. Arbeit" (Vorfahr AUSSERHALB des Scopes) UND von „Unter" selbst.
  const unter = welt.folders.find((folder) => folder.folderId === 'f-unter')
  if (!unter) throw new Error('Fixture kaputt: f-unter fehlt')
  unter.files.push({
    fileId: 'src-neu', name: 'Neu.m4a',
    path: '1. Arbeit/Pilot/Unter/Neu.m4a', modifiedAt: '2026-08-20T10:00:00.000Z',
  })
}

async function szenario(): Promise<{ voll0: CoverageReport; teil1: CoverageReport; voll1: CoverageReport }> {
  const welt = baueWelt()
  const voll0 = await runCoverageScan(vollRequest(), weltPorts(welt, { now: T0 }))
  mutiereImScope(welt)
  const teil1 = await runCoverageScan(teilRequest(SCOPE), weltPorts(welt, { now: T1 }))
  const voll1 = await runCoverageScan(vollRequest(), weltPorts(welt, { now: T1 }))
  return { voll0, teil1, voll1 }
}

describe('mergeTeilbaumReport — Invarianz (§F10)', () => {
  it('Merge-Ergebnis ist vom Voll-Scan desselben Zustands ununterscheidbar', async () => {
    const { voll0, teil1, voll1 } = await szenario()

    // Vorbedingung des Szenarios: Der Voll-Scan bei T1 sieht die Querschnitts-
    // Befunde am Vorfahren AUSSERHALB des Scopes — genau das muss der Merge
    // reproduzieren, obwohl er „1. Arbeit" nie neu gescannt hat.
    const typenBei = (report: CoverageReport, folderId: string) =>
      report.gaps.filter((gap) => gap.folderId === folderId).map((gap) => gap.type).sort()
    expect(typenBei(voll1, 'f-arbeit')).toContain('bericht_veraltet')
    expect(typenBei(voll1, 'f-arbeit')).toContain('stand_widerspruch')
    expect(typenBei(voll0, 'f-arbeit')).not.toContain('bericht_veraltet')

    const ergebnis = mergeTeilbaumReport({ voll: voll0, teil: teil1 })
    if (!ergebnis.merged) throw new Error(`Merge fiel zurueck: ${ergebnis.grund}`)
    expect(ergebnis.report).toEqual(voll1)
  })

  it('Befunde ausserhalb des Scopes ueberleben den Merge unveraendert', async () => {
    const { voll0, teil1 } = await szenario()
    const ergebnis = mergeTeilbaumReport({ voll: voll0, teil: teil1 })
    if (!ergebnis.merged) throw new Error(`Merge fiel zurueck: ${ergebnis.grund}`)
    const anders = ergebnis.report.gaps.filter((gap) => gap.folderId === 'f-anders')
    expect(anders).toEqual(voll0.gaps.filter((gap) => gap.folderId === 'f-anders'))
    expect(anders.length).toBeGreaterThan(0)
  })

  it('der Report ist reproduzierbar, egal in welcher Reihenfolge der Scan die Ordner liefert', async () => {
    const welt = baueWelt()
    const sortiert = await runCoverageScan(vollRequest(), weltPorts(welt, { now: T0 }))
    const gemischt = await runCoverageScan(vollRequest(), weltPorts(welt, { now: T0, mische: true }))
    expect(gemischt).toEqual(sortiert)
  })
})

describe('mergeTeilbaumReport — benannte Fallbacks', () => {
  async function paar(): Promise<{ voll0: CoverageReport; teil1: CoverageReport }> {
    const { voll0, teil1 } = await szenario()
    return { voll0, teil1 }
  }

  it('gespeicherter Teilbaum-Report → voll_report_ist_teilbaum', async () => {
    const { voll0, teil1 } = await paar()
    const kaputt = { ...voll0, scope: { folderId: 'irgendwo', path: null } }
    const ergebnis = mergeTeilbaumReport({ voll: kaputt, teil: teil1 })
    expect(ergebnis).toMatchObject({ merged: false, grund: 'voll_report_ist_teilbaum' })
  })

  it('unbekannter Scope → scope_nicht_im_report', async () => {
    const { voll0, teil1 } = await paar()
    const fremd = { ...teil1, scope: { folderId: 'f-weg', path: null } }
    const ergebnis = mergeTeilbaumReport({ voll: voll0, teil: fremd })
    expect(ergebnis).toMatchObject({ merged: false, grund: 'scope_nicht_im_report' })
  })

  it('ungesichteter Vorfahr des Scopes → ungesichteter_vorfahr (Sammel-Gap kreuzt die Grenze)', async () => {
    const { voll0, teil1 } = await paar()
    const doctored = structuredClone(voll0)
    // „1. Arbeit" (Vorfahr des Scopes) als ungesichtet erklaeren.
    doctored.tree[0].children.find((n) => n.folderId === 'f-arbeit')!.bearbeitungsstand = 'ungesichtet'
    const ergebnis = mergeTeilbaumReport({ voll: doctored, teil: teil1 })
    expect(ergebnis).toMatchObject({ merged: false, grund: 'ungesichteter_vorfahr' })
  })

  it('Report vor W8 (ohne Merge-Skalare) → report_vor_w8', async () => {
    const { voll0, teil1 } = await paar()
    const alt = structuredClone(voll0)
    const entferne = (nodes: typeof alt.tree): void =>
      nodes.forEach((node) => {
        delete node.neuesteEigeneAenderung
        delete node.berichtFileId
        entferne(node.children)
      })
    entferne(alt.tree)
    const ergebnis = mergeTeilbaumReport({ voll: alt, teil: teil1 })
    expect(ergebnis).toMatchObject({ merged: false, grund: 'report_vor_w8' })
  })

  it('geaenderte Konventionen → konventionen_geaendert', async () => {
    const { voll0, teil1 } = await paar()
    const andere = { ...teil1, conventions: { ...KONVENTIONEN, berichtFreshness: false } }
    const ergebnis = mergeTeilbaumReport({ voll: voll0, teil: andere })
    expect(ergebnis).toMatchObject({ merged: false, grund: 'konventionen_geaendert' })
  })

  it('Voll-Scan als „Teil" ist ein Aufruffehler, kein Fallback', async () => {
    const { voll0 } = await paar()
    expect(() => mergeTeilbaumReport({ voll: voll0, teil: voll0 })).toThrow(/scope\.folderId/)
  })
})
