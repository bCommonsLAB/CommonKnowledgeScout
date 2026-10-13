/**
 * Teil B (Plan speicher-verbindungen-und-library-anlage): jede Seite unter
 * „Erweitert" schickt NUR ihre Config-Schluessel, und zwar vollstaendig —
 * PATCH /api/libraries/[id] ersetzt ein mitgeschicktes Objekt als Ganzes.
 * Dazu der Beleg fuer das geteilte Objekt `secretaryService` (Archive ·
 * Verarbeitung und Erweitert · Verarbeitung): Lesen und Schreiben decken
 * alle Felder ab, Speichern der einen Seite loescht nichts der anderen.
 */
import { describe, it, expect } from 'vitest'
import {
  readAgentViewForm,
  toAgentViewConfig,
} from '@/components/settings/library/advanced/agent-view-form-model'
import { readDivaForm, toDivaConfig } from '@/components/settings/library/advanced/diva-form-model'
import {
  readExtractionForm,
  toExtractionConfig,
} from '@/components/settings/library/advanced/extraction-form-model'
import {
  readShadowTwinFlags,
  readStorageTwinsForm,
  toStorageTwinsConfig,
} from '@/components/settings/library/advanced/storage-twins-form-model'
import {
  buildSecretaryServiceConfig,
  readSecretaryServiceForm,
} from '@/components/settings/hooks/secretary-service-form-model'
import type { ClientLibrary } from '@/types/library'

type Config = ClientLibrary['config']

/** Eine Library, in der jede Seite gespeicherte Werte vorfindet. */
const GESPEICHERT: Config = {
  secretaryService: {
    useCustomConfig: true,
    apiUrl: 'https://secretary.example',
    apiKey: 'geheim',
    pdfExtractionMethod: 'ocr',
    template: 'artikel-de',
    llmModel: 'claude-sonnet-5-5',
    targetLanguage: 'en',
    generateCoverImage: true,
    coverImagePrompt: 'Ein Cover',
    useDirectConnection: true,
  },
  agentView: {
    enabled: true,
    vorhabenFolderPattern: '^\\d{2}\\.\\d{2}',
    indexRequiredMaxDepth: 2,
    berichtFreshness: false,
    postfachMaxRueckstandWochen: 3,
    repoMaxRueckstandTage: 14,
    berichtMaxBytes: { anwendung: 20000, plattform: null },
    statusMaxZeilen: 40,
    ueberholtNachTagen: 90,
    localRootPath: 'C:/Archiv',
    themen: ['Energie', 'Mobilität'],
  },
  analyzeDivaTextureInfo: true,
  autoApplyConfidenceThreshold: 0.75,
  divaArchiveDefaults: { filterMode: 'with', groupByAttribute: 'stoffgruppe', extraColumns: ['_thumbnail', 'Material'] },
  extractionKnownNames: ['Peter Aichner', 'POW'],
  transcriptionLanguages: ['de', 'it'],
  ingestSourceAppendix: false,
  scanExcludeGlobs: ['temp', '*.tmp'],
  shadowTwin: { mode: 'v2', primaryStore: 'mongo', persistToFilesystem: false, allowFilesystemFallback: true },
}

describe('Teil-Seiten unter Erweitert: eigene Schluessel, vollstaendig', () => {
  it('Agentensicht schreibt genau `agentView` und erhaelt alle Werte', () => {
    const patch = toAgentViewConfig(readAgentViewForm(GESPEICHERT))
    expect(Object.keys(patch)).toEqual(['agentView'])
    expect(patch.agentView).toEqual(GESPEICHERT.agentView)
  })

  it('DIVA schreibt genau ihre drei Schluessel und erhaelt alle Werte', () => {
    const patch = toDivaConfig(readDivaForm(GESPEICHERT))
    expect(Object.keys(patch).sort()).toEqual(['analyzeDivaTextureInfo', 'autoApplyConfidenceThreshold', 'divaArchiveDefaults'])
    expect(patch.analyzeDivaTextureInfo).toBe(true)
    expect(patch.autoApplyConfidenceThreshold).toBe(0.75)
    expect(patch.divaArchiveDefaults).toEqual(GESPEICHERT.divaArchiveDefaults)
  })

  it('Extraktion schreibt genau ihre drei Schluessel und erhaelt alle Werte', () => {
    const patch = toExtractionConfig(readExtractionForm(GESPEICHERT))
    expect(Object.keys(patch).sort()).toEqual(['extractionKnownNames', 'ingestSourceAppendix', 'transcriptionLanguages'])
    expect(patch.extractionKnownNames).toEqual(['Peter Aichner', 'POW'])
    expect(patch.transcriptionLanguages).toEqual(['de', 'it'])
    expect(patch.ingestSourceAppendix).toBe(false)
  })

  it('Speicher & Twins schreibt genau `scanExcludeGlobs` und `shadowTwin` (vollstaendig, v2/mongo)', () => {
    const patch = toStorageTwinsConfig(readStorageTwinsForm(GESPEICHERT), readShadowTwinFlags(GESPEICHERT))
    expect(Object.keys(patch).sort()).toEqual(['scanExcludeGlobs', 'shadowTwin'])
    expect(patch.scanExcludeGlobs).toEqual(['temp', '*.tmp'])
    expect(patch.shadowTwin).toEqual(GESPEICHERT.shadowTwin)
  })

  it('leere Library: Lesen liefert die dokumentierten Defaults, nichts wird erfunden', () => {
    expect(readAgentViewForm(undefined).agentViewEnabled).toBe(false)
    expect(readDivaForm(undefined).autoApplyConfidenceThreshold).toBe(0.9)
    expect(readExtractionForm(undefined).ingestSourceAppendix).toBe(true)
    expect(readShadowTwinFlags(undefined)).toEqual({ persistToFilesystem: true, allowFilesystemFallback: true })
  })
})

describe('geteiltes Objekt secretaryService (Archive · Verarbeitung + Erweitert · Verarbeitung)', () => {
  it('Lesen und Schreiben decken ALLE Felder ab — Speichern der einen Seite loescht nichts der anderen', () => {
    // Beide Seiten laden dasselbe Formular und schreiben das Objekt vollstaendig zurueck:
    // was die redaktionelle Seite nicht zeigt (apiUrl, Extraktionsmethode, Modell,
    // Direktverbindung), ueberlebt ihr Speichern — und umgekehrt.
    const geschrieben = buildSecretaryServiceConfig(readSecretaryServiceForm(GESPEICHERT))
    expect(geschrieben).toEqual(GESPEICHERT.secretaryService)
  })

  it('targetLanguage faellt auf chat.targetLanguage zurueck, wenn secretaryService keine hat', () => {
    const config = { chat: { targetLanguage: 'en' } } as unknown as Config
    expect(readSecretaryServiceForm(config).targetLanguage).toBe('en')
  })
})
