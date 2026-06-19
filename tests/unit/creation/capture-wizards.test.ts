import { describe, it, expect, vi } from 'vitest'
import {
  curateCreationTypes,
  buildStandardWizardCreationType,
  type CaptureWizardsConfig,
} from '@/lib/creation/capture-wizards'
import type { LibraryCreationType } from '@/lib/templates/library-creation-config'
import { STANDARD_CAPTURE_FLOW_ID } from '@/lib/creation/wizard-flow-entity'

const standardWizard = buildStandardWizardCreationType()

function type(id: string, extra: Partial<LibraryCreationType> = {}): LibraryCreationType {
  return { id, label: id, description: '', templateId: id, ...extra }
}

const available: LibraryCreationType[] = [
  type('event', { label: 'Event', icon: 'Calendar' }),
  type('book', { label: 'Buch' }),
  type('testimonial', { label: 'Erfahrungsbericht' }),
]

describe('buildStandardWizardCreationType', () => {
  it('ist die Standard-Flow-Karte', () => {
    expect(standardWizard.id).toBe(STANDARD_CAPTURE_FLOW_ID)
    expect(standardWizard.templateId).toBe(STANDARD_CAPTURE_FLOW_ID)
    expect(standardWizard.isReadonly).toBe(true)
  })
})

describe('curateCreationTypes', () => {
  it('ohne Config → nur der Standard-Wizard (Entscheidung #3)', () => {
    expect(curateCreationTypes(available, undefined, { standardWizard })).toEqual([standardWizard])
  })

  it('leere Wizard-Liste → nur der Standard-Wizard', () => {
    const cfg: CaptureWizardsConfig = { wizards: [] }
    expect(curateCreationTypes(available, cfg, { standardWizard })).toEqual([standardWizard])
  })

  it('waehlt + ordnet nur aktivierte Eintraege', () => {
    const cfg: CaptureWizardsConfig = {
      wizards: [
        { flowId: 'testimonial', enabled: true },
        { flowId: 'event', enabled: false },
        { flowId: 'book', enabled: true },
      ],
    }
    expect(curateCreationTypes(available, cfg, { standardWizard }).map((t) => t.id)).toEqual([
      'testimonial',
      'book',
    ])
  })

  it('zieht den defaultFlowId nach vorne', () => {
    const cfg: CaptureWizardsConfig = {
      wizards: [
        { flowId: 'event', enabled: true },
        { flowId: 'book', enabled: true },
      ],
      defaultFlowId: 'book',
    }
    expect(curateCreationTypes(available, cfg, { standardWizard }).map((t) => t.id)).toEqual([
      'book',
      'event',
    ])
  })

  it('loest den Standard-Wizard ueber seine flowId auf', () => {
    const cfg: CaptureWizardsConfig = {
      wizards: [{ flowId: STANDARD_CAPTURE_FLOW_ID, enabled: true }, { flowId: 'book', enabled: true }],
    }
    const ids = curateCreationTypes(available, cfg, { standardWizard }).map((t) => t.id)
    expect(ids).toEqual([STANDARD_CAPTURE_FLOW_ID, 'book'])
  })

  it('ueberspringt unaufloesbare Eintraege mit Warnung (kein stiller Drop)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cfg: CaptureWizardsConfig = {
      wizards: [{ flowId: 'gibtsnicht', enabled: true }, { flowId: 'book', enabled: true }],
    }
    expect(curateCreationTypes(available, cfg, { standardWizard }).map((t) => t.id)).toEqual(['book'])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('wendet Label-/Icon-Ueberschreibungen an', () => {
    const cfg: CaptureWizardsConfig = {
      wizards: [{ flowId: 'event', enabled: true, label: 'Konferenz', icon: 'Mic' }],
    }
    const [row] = curateCreationTypes(available, cfg, { standardWizard })
    expect(row.label).toBe('Konferenz')
    expect(row.icon).toBe('Mic')
  })

  it('dedupliziert mehrfach referenzierte Flows', () => {
    const cfg: CaptureWizardsConfig = {
      wizards: [{ flowId: 'book', enabled: true }, { flowId: 'book', enabled: true }],
    }
    expect(curateCreationTypes(available, cfg, { standardWizard }).map((t) => t.id)).toEqual(['book'])
  })
})
