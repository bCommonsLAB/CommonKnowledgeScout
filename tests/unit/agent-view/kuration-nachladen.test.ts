/**
 * @fileoverview Unit-Tests: K1-Nachladen des Kurationszustands (Testsession 25.08.2026).
 *
 * K1-Szenario: Die Verifikation steht in den Mongo-Twins
 * (`verified_by: human:…`), der gespeicherte Report stammt von VOR den
 * Verifikationen. Das Nachladen (eine Mongo-Abfrage → Eintraege → Overrides)
 * muss den Report ueberlagern, ohne Scan — mit exakt der Artefakt-Auswahl
 * des Coverage-Scans (Standard-Template = Zusammenfassung).
 */

import { describe, it, expect } from 'vitest'
import { baueKurationsEintraege } from '@/lib/agent-view/kuration-nachladen'
import { baueNachladeOverrides, mergeOverrides } from '@/lib/agent-view/kuration-overlay'
import type { LeadingArtifactSummary, TwinFamilySummary } from '@/lib/agent-view/types'
import { artefaktKey, effektiveFamilie, familienPruefstand } from '@/lib/agent-view/werkbank-baum'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'

const GENERIERT = '2026-08-25T10:00:00.000Z'
const VERIFIZIERT = '2026-08-25T14:19:07.656Z'

function twinDoc(overrides: Partial<ShadowTwinDocument> = {}): ShadowTwinDocument {
  return {
    libraryId: 'lib-1',
    sourceId: 'src-1',
    sourceName: 'Aufnahme.m4a',
    parentId: 'ordner-1',
    userEmail: 'peter@example.org',
    createdAt: GENERIERT,
    updatedAt: VERIFIZIERT,
    artifacts: {
      transcript: {
        markdown: '# Transkript',
        frontmatter: {
          generated_by: 'knowledgescout/whisper',
          generated_at: GENERIERT,
          verified_by: 'human:peter@example.org',
          verified_at: VERIFIZIERT,
        },
        createdAt: GENERIERT,
        updatedAt: VERIFIZIERT,
      },
      transformation: {
        zusammenfassung: {
          de: {
            markdown: '# Zusammenfassung',
            frontmatter: { generated_by: 'knowledgescout/llm', generated_at: GENERIERT },
            createdAt: GENERIERT,
            updatedAt: GENERIERT,
          },
        },
        anderes: {
          de: {
            markdown: '# Anderes',
            frontmatter: { generated_at: GENERIERT },
            createdAt: GENERIERT,
            updatedAt: GENERIERT,
          },
        },
      },
    },
    ...overrides,
  }
}

/** Familie, wie sie im VERALTETEN Report steht (Scan vor den Verifikationen). */
function reportFamilie(): TwinFamilySummary {
  const unverifiziert = (kind: 'transcript' | 'transformation', templateName: string | null, lang: string): LeadingArtifactSummary => ({
    kind, templateName, targetLanguage: lang,
    twinStatus: null, generatedBy: 'knowledgescout/x', generatedAt: GENERIERT,
    verifiedBy: null, verifiedAt: null,
    flaggedBy: null, flaggedAt: null, flaggedNote: null,
    verification: 'unverifiziert',
  })
  return {
    sourceId: 'src-1', sourceName: 'Aufnahme.m4a', folderId: 'ordner-1', path: 'Vorhaben/Aufnahme.m4a',
    artifactCount: 3,
    leading: unverifiziert('transformation', 'zusammenfassung', 'de'),
    transkript: unverifiziert('transcript', null, ''),
    zusammenfassung: unverifiziert('transformation', 'zusammenfassung', 'de'),
  }
}

describe('baueKurationsEintraege', () => {
  it('liest die Verifikation aus den Mongo-Twins — Zusammenfassung ist EXAKT das Standard-Template', () => {
    const [eintrag] = baueKurationsEintraege([twinDoc()], 'zusammenfassung')
    expect(eintrag.sourceId).toBe('src-1')
    expect(eintrag.transkript?.verification).toBe('mensch')
    expect(eintrag.transkript?.verifiedBy).toBe('human:peter@example.org')
    expect(eintrag.zusammenfassung?.templateName).toBe('zusammenfassung')
    expect(eintrag.zusammenfassung?.verification).toBe('unverifiziert')
  })

  it('ohne Standard-Template bleibt die Zusammenfassung null (kein Raten)', () => {
    const [eintrag] = baueKurationsEintraege([twinDoc()], null)
    expect(eintrag.zusammenfassung).toBeNull()
    expect(eintrag.transkript?.verification).toBe('mensch')
  })
})

describe('baueNachladeOverrides + mergeOverrides', () => {
  it('K1: Overlay macht die Mongo-Verifikation im veralteten Report sichtbar — ohne Scan', () => {
    const eintraege = baueKurationsEintraege([twinDoc()], 'zusammenfassung')
    const basis = baueNachladeOverrides(eintraege)
    const familie = reportFamilie()

    // Vorher: Report kennt die Verifikation nicht.
    expect(familienPruefstand(familie)).toBe('offen')
    expect(familie.transkript?.verification).toBe('unverifiziert')

    const effektiv = effektiveFamilie(familie, mergeOverrides(basis, new Map()))
    expect(effektiv.transkript?.verification).toBe('mensch')
    // Zusammenfassung ist in Mongo weiter unverifiziert — Familie bleibt offen (korrekt).
    expect(familienPruefstand(effektiv)).toBe('offen')
  })

  it('Session-Overrides gewinnen gegen den nachgeladenen Snapshot', () => {
    const eintraege = baueKurationsEintraege([twinDoc()], 'zusammenfassung')
    const basis = baueNachladeOverrides(eintraege)
    const familie = reportFamilie()

    const frisch: LeadingArtifactSummary = {
      ...familie.zusammenfassung!,
      verifiedBy: 'human:peter@example.org', verifiedAt: VERIFIZIERT, verification: 'mensch',
    }
    const session = new Map([[artefaktKey('src-1', frisch), frisch]])
    const effektiv = effektiveFamilie(familie, mergeOverrides(basis, session))

    expect(effektiv.zusammenfassung?.verification).toBe('mensch')
    expect(effektiv.transkript?.verification).toBe('mensch')
    expect(familienPruefstand(effektiv)).toBe('geprueft')
  })

  it('fehlende Artefakte erzeugen keine Overrides — dort gilt weiter der Report', () => {
    const doc = twinDoc()
    delete doc.artifacts.transformation
    const basis = baueNachladeOverrides(baueKurationsEintraege([doc], 'zusammenfassung'))
    expect([...basis.keys()]).toEqual([artefaktKey('src-1', { kind: 'transcript', templateName: null, targetLanguage: '' })])
  })
})
