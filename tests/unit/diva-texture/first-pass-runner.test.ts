/**
 * Pipeline-Integrationstest fuer den 1. LLM-Pass (Stufe 3).
 *
 * Mock-LLM (injizierte analyzeImage) + Sample-Sidecar (Fake-Provider) +
 * Sample-Bild (Buffer). Szenarien: Sidecar-Hit / kein Hit / Sidecar+LLM-
 * Konflikt / unbekanntes Material / ceramic ohne Type + Quellbild-Wahl.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  runDivaTextureFirstPass,
  isDivaTextureTemplate,
  type FirstPassImage,
} from '@/lib/diva-texture/first-pass-runner'
import { SIDECAR_FILENAME } from '@/lib/diva-texture/load-supplier-data'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

type AnalyzeArgs = { image: FirstPassImage; context: Record<string, unknown> }
type AnalyzeFn = (args: AnalyzeArgs) => Promise<string>

/** Typisiertes Mock-LLM (nimmt die analyzeImage-Argumente entgegen). */
function mockAnalyze(markdown: string) {
  return vi.fn<AnalyzeFn>(async (_args: AnalyzeArgs) => markdown)
}

/** Greift typsicher auf die Argumente des ersten analyzeImage-Aufrufs zu. */
function firstCall(fn: ReturnType<typeof mockAnalyze>): AnalyzeArgs {
  const call = fn.mock.calls[0]
  if (!call) throw new Error('analyzeImage wurde nicht aufgerufen')
  return call[0]
}

const SAMPLE_IMAGE: Buffer = Buffer.from([0xff, 0xd8, 0xff])
const TEXTURE_FILE = '3_ST_2031_0477_basecolor.jpg'
const PATH_ILN = 'S:\\DIVA3DARCHIV\\0001445679013\\textures\\_tex\\' + TEXTURE_FILE

function sidecarFile(): StorageItem {
  return {
    id: 'sidecar-1',
    parentId: 'folder',
    type: 'file',
    metadata: { name: SIDECAR_FILENAME, size: 0, modifiedAt: new Date(), mimeType: 'application/json' },
  }
}

/** Fake-Provider mit genau einer Sidecar-Datei und konfigurierbarem Inhalt. */
function makeProvider(optionvalues: Record<string, unknown>): StorageProvider {
  const json = JSON.stringify({ Optionvalues: optionvalues })
  const provider: Partial<StorageProvider> = {
    listItemsById: async () => [sidecarFile()],
    getBinary: async () => ({ blob: new Blob([json]), mimeType: 'application/json' }),
  }
  return provider as StorageProvider
}

/** Provider ohne Sidecar (kein Treffer-Szenario auf Loader-Ebene). */
function makeProviderWithoutSidecar(): StorageProvider {
  const provider: Partial<StorageProvider> = {
    listItemsById: async () => [],
    getBinary: async () => ({ blob: new Blob(['']), mimeType: 'application/json' }),
  }
  return provider as StorageProvider
}

/** Baut ein Markdown, wie es der Secretary-Image-Analyzer zurueckgibt. */
function llmMarkdown(fields: Record<string, unknown>): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${String(v)}`)
  return `---\n${lines.join('\n')}\n---\n\n## Body\n`
}

const STOFF_ENTRY = {
  OPV3_ST_2031_0477: { VCodex: 'ST_2031-0477', IsTexture: 'True', Material: 'STOFF', Name: 'Feincord thyme' },
}

function baseParams(provider: StorageProvider, analyzeImage: ReturnType<typeof mockAnalyze>) {
  return {
    provider,
    parentId: 'folder',
    fileName: TEXTURE_FILE,
    filePath: PATH_ILN,
    baseImage: { buffer: SAMPLE_IMAGE, fileName: TEXTURE_FILE, mimeType: 'image/jpeg' },
    baseContext: { fileName: TEXTURE_FILE, filePath: PATH_ILN },
    analyzeImage,
  }
}

describe('isDivaTextureTemplate', () => {
  it('erkennt das DIVA-Texture-Template am detailViewType-Marker', () => {
    expect(isDivaTextureTemplate('---\ndetailViewType: divaTexture\n---')).toBe(true)
    expect(isDivaTextureTemplate('---\ndetailViewType: video\n---')).toBe(false)
  })
})

describe('runDivaTextureFirstPass — Szenarien', () => {
  it('Sidecar-Hit (STOFF): material_class fabric, confidence_class 0.95', async () => {
    const analyzeImage = mockAnalyze(
      llmMarkdown({ material_class: 'fabric', material_type: 'cord', confidence_class: 0.6, confidence_type: 0.7 }),
    )
    const result = await runDivaTextureFirstPass(baseParams(makeProvider(STOFF_ENTRY), analyzeImage))

    expect(result.supplierMatched).toBe(true)
    expect(result.sourceImage).toBe('basecolor')
    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.material_class).toBe('fabric')
    expect(meta.confidence_class).toBe(0.95)
    expect(meta.last_pass).toBe(1)
    expect(meta.pass1_status).toBe('done')
    expect(meta.retailer_iln).toBe('0001445679013')

    // LIEFERSYSTEM-Block + Pass-Marker gehen ans LLM
    const ctx = firstCall(analyzeImage).context
    expect(ctx.pass).toBe(1)
    expect((ctx.LIEFERSYSTEM as { materialClass: string }).materialClass).toBe('fabric')
  })

  it('kein Hit (keine Sidecar-Datei): confidence_class < 0.85', async () => {
    const analyzeImage = mockAnalyze(
      llmMarkdown({ material_class: 'wood', material_type: 'oak', confidence_class: 0.99 }),
    )
    const result = await runDivaTextureFirstPass(baseParams(makeProviderWithoutSidecar(), analyzeImage))

    expect(result.supplierMatched).toBe(false)
    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.material_class).toBe('wood')
    expect(Number(meta.confidence_class)).toBeLessThan(0.85)
    // Ohne Treffer kein LIEFERSYSTEM-Block
    expect(firstCall(analyzeImage).context.LIEFERSYSTEM).toBeUndefined()
  })

  it('Sidecar+LLM-Konflikt: Sidecar-Klasse gewinnt', async () => {
    const analyzeImage = mockAnalyze(llmMarkdown({ material_class: 'leather', confidence_class: 0.99 }))
    const result = await runDivaTextureFirstPass(baseParams(makeProvider(STOFF_ENTRY), analyzeImage))
    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.material_class).toBe('fabric')
    expect(meta.confidence_class).toBe(0.95)
  })

  it('unbekanntes Sidecar-Material (BETON, isKnown=false): LLM bestimmt, < 0.85', async () => {
    const provider = makeProvider({
      OPV3_ST_2031_0477: { VCodex: 'ST_2031-0477', IsTexture: 'True', Material: 'BETON', Name: 'Sichtbeton' },
    })
    const analyzeImage = mockAnalyze(llmMarkdown({ material_class: 'stone', confidence_class: 0.95 }))
    const result = await runDivaTextureFirstPass(baseParams(provider, analyzeImage))

    expect(result.supplierMatched).toBe(true)
    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.material_class).toBe('stone')
    expect(Number(meta.confidence_class)).toBeLessThan(0.85)
  })

  it('ceramic ohne Type: material_type bleibt leer', async () => {
    const analyzeImage = mockAnalyze(
      llmMarkdown({ material_class: 'ceramic', material_type: 'porcelain', confidence_class: 0.7 }),
    )
    const result = await runDivaTextureFirstPass(baseParams(makeProviderWithoutSidecar(), analyzeImage))
    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.material_class).toBe('ceramic')
    expect(meta.material_type === '' || meta.material_type === undefined).toBe(true)
  })
})

describe('runDivaTextureFirstPass — Quellbild-Wahl', () => {
  it('supplier-preview: laedt das Liefersystem-Bild serverseitig', async () => {
    const previewBuffer = Buffer.from([0x01, 0x02, 0x03])
    const provider = makeProvider({
      OPV3_ST_2031_0477: {
        VCodex: 'ST_2031-0477',
        IsTexture: 'True',
        Material: 'STOFF',
        Image: 'https://example.com/preview.jpg',
      },
    })
    const analyzeImage = mockAnalyze(llmMarkdown({ material_class: 'fabric', confidence_class: 0.6 }))
    const fetchPreviewImage = vi.fn(async (_url: string): Promise<FirstPassImage> => ({
      buffer: previewBuffer,
      fileName: 'preview.jpg',
      mimeType: 'image/jpeg',
    }))

    const result = await runDivaTextureFirstPass({
      ...baseParams(provider, analyzeImage),
      getImageChoice: async () => 'supplier-preview',
      fetchPreviewImage,
    })

    expect(result.sourceImage).toBe('supplier-preview')
    expect(fetchPreviewImage).toHaveBeenCalledWith('https://example.com/preview.jpg')
    expect(firstCall(analyzeImage).image.buffer).toBe(previewBuffer)
  })

  it('faellt auf basecolor zurueck, wenn das Preview-Bild nicht ladbar ist (kein URL)', async () => {
    const provider = makeProvider(STOFF_ENTRY) // Eintrag ohne Image-URL
    const analyzeImage = mockAnalyze(llmMarkdown({ material_class: 'fabric', confidence_class: 0.6 }))
    const result = await runDivaTextureFirstPass({
      ...baseParams(provider, analyzeImage),
      getImageChoice: async () => 'supplier-preview',
      fetchPreviewImage: vi.fn(async (_url: string): Promise<FirstPassImage> => {
        throw new Error('sollte nicht aufgerufen werden')
      }),
    })
    expect(result.sourceImage).toBe('basecolor')
    expect(firstCall(analyzeImage).image.buffer).toBe(SAMPLE_IMAGE)
  })
})
