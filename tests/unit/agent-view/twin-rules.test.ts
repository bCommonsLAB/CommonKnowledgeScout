import { describe, it, expect } from 'vitest'
import {
  checkFlagged,
  checkKorrekturOffen,
  checkLeadingVerification,
  checkTransformationState,
  checkTwinCoreMissing,
  evaluateTwinRules,
  type TwinArtifactView,
  type TwinFamilyView,
} from '@/lib/agent-view/twin-rules'

const STANDARD = 'standard-konzept'

function transcript(fm: Record<string, unknown> = {}, updatedAt = '2026-08-01T10:00:00.000Z'): TwinArtifactView {
  return {
    kind: 'transcript',
    targetLanguage: '',
    updatedAt,
    frontmatter: {
      type: 'transcript',
      source_file: 'Aufnahme.m4a',
      generated_by: 'knowledgescout/gemini-2.5-pro',
      generated_at: '2026-08-01T10:00:00.000Z',
      ...fm,
    },
  }
}

function transformation(fm: Record<string, unknown> = {}, updatedAt = '2026-08-02T10:00:00.000Z'): TwinArtifactView {
  return {
    kind: 'transformation',
    templateName: STANDARD,
    targetLanguage: 'de',
    updatedAt,
    frontmatter: {
      type: 'transformation',
      source_file: 'Aufnahme.m4a',
      template: STANDARD,
      language: 'de',
      generated_by: 'knowledgescout/gemini-2.5-pro',
      generated_at: '2026-08-02T10:00:00.000Z',
      ...fm,
    },
  }
}

function family(artifacts: TwinArtifactView[]): TwinFamilyView {
  return { sourceId: 's1', sourceName: 'Aufnahme.m4a', folderId: 'f1', path: '25.01 Pilot/Aufnahme.m4a', artifacts }
}

describe('twin-rules — twin_core_missing', () => {
  it('meldet fehlende Kernfelder (Positivfall)', () => {
    const gap = checkTwinCoreMissing(family([transcript({ generated_by: undefined })]))
    expect(gap?.type).toBe('twin_core_missing')
    expect(gap?.detail).toContain('generated_by')
  })

  it('meldet nichts bei vollstaendigem Kern (Negativfall)', () => {
    expect(checkTwinCoreMissing(family([transcript(), transformation()]))).toBeNull()
  })
})

describe('twin-rules — Verifikation ist keine Schuld mehr (ADR 0006)', () => {
  it('meldet NICHTS ohne verified_by — Maschinenarbeit gilt als angenommen', () => {
    expect(checkLeadingVerification(family([transcript(), transformation()]), STANDARD)).toEqual([])
  })

  it('meldet nichts bei gueltiger Verifikation am fuehrenden Artefakt', () => {
    const verified = transformation({ verified_by: 'human:peter', verified_at: '2026-08-02' })
    expect(checkLeadingVerification(family([transcript(), verified]), STANDARD)).toEqual([])
  })

  it('wertet ein unverifiziertes Transkript neben geprueffter Transformation NICHT ab (Contract §2b)', () => {
    const verified = transformation({ verified_by: 'human:peter', verified_at: '2026-08-03' })
    expect(evaluateTwinRules(family([transcript(), verified]), STANDARD)).toEqual([])
  })

  it('meldet auch bei ueberholter Verifikation nichts — sie faellt auf „angenommen" zurueck', () => {
    const stale = transformation({ verified_by: 'human:peter', verified_at: '2026-07-01' })
    expect(checkLeadingVerification(family([stale]), STANDARD)).toEqual([])
  })

  it('meldet self_verified, wenn Erzeuger und Pruefer derselbe Akteur sind', () => {
    const self = transformation({ verified_by: 'knowledgescout/gemini-2.5-pro', verified_at: '2026-08-03' })
    const gaps = checkLeadingVerification(family([self]), STANDARD)
    expect(gaps.map((g) => g.type)).toEqual(['self_verified'])
    expect(gaps[0].severity).toBe('error')
  })
})

describe('twin-rules — twin_flagged (Fehler-Markierung, ADR 0006)', () => {
  const markiert = {
    twin_status: 'flagged',
    flagged_by: 'human:peter@example.org',
    flagged_at: '2026-08-26T09:00:00.000Z',
    flagged_note: 'Sprecher vertauscht',
  }

  it('meldet die Markierung als Mensch-Befund mit Schritt 4 und Severity error', () => {
    const gap = checkFlagged(family([transcript(), transformation(markiert)]))
    expect(gap?.type).toBe('twin_flagged')
    expect(gap?.actor).toBe('mensch')
    expect(gap?.zyklusSchritt).toBe(4)
    expect(gap?.severity).toBe('error')
  })

  it('nennt Notiz und Urheber im Beleg — der Widerstand muss lesbar sein', () => {
    const gap = checkFlagged(family([transformation(markiert)]))
    expect(gap?.detail).toContain('Sprecher vertauscht')
    expect(gap?.detail).toContain('human:peter@example.org')
  })

  it('benennt eine fehlende Notiz, statt sie zu erfinden (Altbestand)', () => {
    const ohneNotiz = { twin_status: 'flagged', flagged_by: 'human:peter' }
    expect(checkFlagged(family([transformation(ohneNotiz)]))?.detail).toContain('(ohne Notiz)')
  })

  it('zaehlt JEDES markierte Artefakt, nicht nur das fuehrende', () => {
    const gap = checkFlagged(family([transcript(markiert), transformation(markiert)]))
    expect(gap?.message).toContain('2 Artefakte')
  })

  it('meldet nichts ohne Markierung (Negativfall)', () => {
    expect(checkFlagged(family([transcript(), transformation()]))).toBeNull()
  })

  it('haengt in der Familien-Auswertung mit drin', () => {
    const typen = evaluateTwinRules(family([transcript(), transformation(markiert)]), STANDARD).map((g) => g.type)
    expect(typen).toContain('twin_flagged')
  })
})

describe('twin-rules — transformation_missing / transformation_stale', () => {
  it('meldet transformation_missing, wenn das Standard-Template fehlt (Positivfall)', () => {
    const gaps = checkTransformationState(family([transcript()]), STANDARD)
    expect(gaps.map((g) => g.type)).toEqual(['transformation_missing'])
  })

  it('meldet nichts, wenn die Standard-Transformation da ist (Negativfall)', () => {
    expect(checkTransformationState(family([transcript(), transformation()]), STANDARD)).toEqual([])
  })

  it('ist ohne konfiguriertes Standard-Template inaktiv (kein Raten)', () => {
    expect(checkTransformationState(family([transcript()]), null)).toEqual([])
  })

  it('meldet transformation_stale, wenn das Transkript juenger ist (informativ)', () => {
    const gaps = checkTransformationState(
      family([transcript({}, '2026-08-05T10:00:00.000Z'), transformation({}, '2026-08-02T10:00:00.000Z')]),
      STANDARD,
    )
    expect(gaps.map((g) => g.type)).toEqual(['transformation_stale'])
    expect(gaps[0].severity).toBe('info')
  })
})

describe('checkKorrekturOffen (K3) — der Widerstand, der auf Cowork zeigt', () => {
  const beauftragt = {
    korrektur_auftrag: 'Gehoert unter 26.02, gesprochen hat Maria S.',
    korrektur_von: 'human:peter@example.org',
    korrektur_at: '2026-08-30T09:12:00.000Z',
  }

  it('meldet den Auftrag als COWORK-Befund mit Schritt 1 und Severity error', () => {
    const gap = checkKorrekturOffen(family([transcript(beauftragt)]))
    expect(gap?.type).toBe('korrektur_offen')
    // Genau das ist der Unterschied zu twin_flagged: der Befund zeigt auf die
    // Maschine, nicht auf den Menschen zurueck.
    expect(gap?.actor).toBe('cowork')
    expect(gap?.zyklusSchritt).toBe(1)
    expect(gap?.severity).toBe('error')
  })

  it('nennt Auftragstext und Urheber im Beleg — Cowork muss ihn lesen koennen', () => {
    const gap = checkKorrekturOffen(family([transcript(beauftragt)]))
    expect(gap?.detail).toContain('Gehoert unter 26.02')
    expect(gap?.detail).toContain('human:peter@example.org')
  })

  it('schweigt ohne Auftrag', () => {
    expect(checkKorrekturOffen(family([transcript()]))).toBeNull()
  })

  it('schweigt, sobald ein Agent Vollzug gemeldet hat (K4)', () => {
    const gap = checkKorrekturOffen(
      family([transcript({ ...beauftragt, korrektur_erledigt_at: '2026-08-30T11:40:00.000Z' })]),
    )
    expect(gap).toBeNull()
  })

  it('zaehlt jedes Artefakt der Familie, nicht nur das fuehrende', () => {
    const gap = checkKorrekturOffen(
      family([transcript(beauftragt), transformation(beauftragt)]),
    )
    expect(gap?.message).toContain('2 Korrekturauftraege')
  })

  it('steht neben der Markierung, nicht statt ihr — beides kann gelten', () => {
    const gaps = evaluateTwinRules(
      family([
        transcript({
          ...beauftragt,
          twin_status: 'flagged',
          flagged_by: 'human:peter@example.org',
          flagged_at: '2026-08-30T09:00:00.000Z',
          flagged_note: 'Ort ist falsch',
        }),
      ]),
      STANDARD,
    )
    const typen = gaps.map((gap) => gap.type)
    expect(typen).toContain('twin_flagged')
    expect(typen).toContain('korrektur_offen')
  })
})
