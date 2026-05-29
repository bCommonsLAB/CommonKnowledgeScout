/**
 * Pipeline-Integrationstest fuer den 1. LLM-Pass (Stufe 3, Update 2).
 *
 * Mock-LLM (injizierte analyzeImages) + Sample-Sidecar (Fake-Provider) +
 * echtes Bild via sharp (fuer den Basecolor-Crop). Szenarien: Sidecar-Hit
 * mit/ohne Supplier-Preview, Color-Match, Override-Schutz, Crop-Metadaten.
 */

import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import {
  runDivaTextureFirstPass,
  isDivaTextureTemplate,
  type FirstPassImage,
} from '@/lib/diva-texture/first-pass-runner'
import { SIDECAR_FILENAME } from '@/lib/diva-texture/load-supplier-data'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

type AnalyzeArgs = { images: FirstPassImage[]; context: Record<string, unknown> }
type AnalyzeFn = (args: AnalyzeArgs) => Promise<string>

/** Typisiertes Mock-LLM (nimmt die analyzeImages-Argumente entgegen). */
function mockAnalyze(markdown: string) {
  return vi.fn<AnalyzeFn>(async (_args: AnalyzeArgs) => markdown)
}

/** Greift typsicher auf die Argumente des ersten analyzeImages-Aufrufs zu. */
function firstCall(fn: ReturnType<typeof mockAnalyze>): AnalyzeArgs {
  const call = fn.mock.calls[0]
  if (!call) throw new Error('analyzeImages wurde nicht aufgerufen')
  return call[0]
}

/** Erzeugt ein einfarbiges JPEG mit gewuenschter Pixel-Maesse + DPI. */
async function makeJpeg(widthPx: number, heightPx: number, density = 300): Promise<Buffer> {
  return sharp({
    create: {
      width: widthPx,
      height: heightPx,
      channels: 3,
      background: { r: 128, g: 64, b: 32 },
    },
  })
    .withMetadata({ density })
    .jpeg({ quality: 90 })
    .toBuffer()
}

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

/**
 * STOFF-Eintrag mit PFTFile, damit der Matcher (Post-2205e8a: nur PFTFile +
 * TextureName) tatsaechlich greift. Der Matcher normalisiert auf
 * 'st_2031_0477' — der Dateiname `3_ST_2031_0477_basecolor.jpg` matcht
 * dieselbe Normalisierung, sobald PFTFile auf das gleiche Muster zeigt.
 */
const STOFF_ENTRY = {
  OPV3_ST_2031_0477: {
    VCodex: 'ST_2031-0477',
    IsTexture: 'True',
    Material: 'STOFF',
    Name: 'Feincord thyme',
    PFTFile: '3_ST_2031_0477',
  },
}

async function baseParams(provider: StorageProvider, analyzeImages: ReturnType<typeof mockAnalyze>) {
  // 4096x4096 px / 300 DPI → 4-cm-Crop 472x472 px = 4.0x4.0 cm.
  const baseImageBuffer = await makeJpeg(4096, 4096, 300)
  return {
    provider,
    parentId: 'folder',
    fileName: TEXTURE_FILE,
    filePath: PATH_ILN,
    baseImage: { buffer: baseImageBuffer, fileName: TEXTURE_FILE, mimeType: 'image/jpeg' },
    baseContext: { fileName: TEXTURE_FILE, filePath: PATH_ILN },
    analyzeImages,
  }
}

describe('isDivaTextureTemplate', () => {
  it('erkennt das DIVA-Texture-Template am detailViewType-Marker', () => {
    expect(isDivaTextureTemplate('---\ndetailViewType: divaTexture\n---')).toBe(true)
    expect(isDivaTextureTemplate('---\ndetailViewType: video\n---')).toBe(false)
  })
})

describe('runDivaTextureFirstPass — Sidecar + Class-Treffer', () => {
  it('Sidecar-Hit (STOFF): material_class fabric, confidence_class 0.95', async () => {
    const analyzeImages = mockAnalyze(
      llmMarkdown({ material_class: 'fabric', material_type: 'cord', confidence_class: 0.6, confidence_type: 0.7 }),
    )
    const result = await runDivaTextureFirstPass(await baseParams(makeProvider(STOFF_ENTRY), analyzeImages))

    expect(result.supplierMatched).toBe(true)
    expect(result.supplierPreviewSent).toBe(false)
    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.material_class).toBe('fabric')
    expect(meta.confidence_class).toBe(0.95)
    expect(meta.last_pass).toBe(1)
    expect(meta.pass1_status).toBe('done')
    expect(meta.retailer_iln).toBe('0001445679013')
    // Punkt 4: Identitaets-Felder deterministisch aus Pfad + Sidecar.
    expect(meta.iln_nummer).toBe('0001445679013')
    expect(meta.textur_code).toBe('ST_2031-0477')
    expect(meta.title).toBe('Feincord thyme')
    expect(meta.slug).toBe('feincord-thyme')
    // Update 2: review_status wird gesetzt (kein Mismatch erkennbar ohne Preview)
    expect(meta.review_status).toBe('ki_geprueft')
    // null wird vom Frontmatter-Composer geschluckt — Abwesenheit hat hier
    // dieselbe Bedeutung wie explizites null ("kein Vergleich gelaufen").
    expect(meta.color_match_supplier).toBeUndefined()

    // LIEFERSYSTEM-Block + Pass-Marker + Crop-Caption gehen ans LLM
    const ctx = firstCall(analyzeImages).context
    expect(ctx.pass).toBe(1)
    expect((ctx.LIEFERSYSTEM as { materialClass: string }).materialClass).toBe('fabric')
    expect(ctx.basecolor_crop_cm).toBe('4.0x4.0')
    expect(ctx.supplier_preview_sent).toBe(false)
    // Nur 1 Bild ans LLM (kein Preview-Fetcher), und das ist der Crop.
    expect(firstCall(analyzeImages).images).toHaveLength(1)
  })

  it('kein Hit (keine Sidecar-Datei): confidence_class < 0.85, kein LIEFERSYSTEM-Block', async () => {
    const analyzeImages = mockAnalyze(
      llmMarkdown({ material_class: 'wood', material_type: 'oak', confidence_class: 0.99 }),
    )
    const result = await runDivaTextureFirstPass(await baseParams(makeProviderWithoutSidecar(), analyzeImages))

    expect(result.supplierMatched).toBe(false)
    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.material_class).toBe('wood')
    expect(Number(meta.confidence_class)).toBeLessThan(0.85)
    expect(firstCall(analyzeImages).context.LIEFERSYSTEM).toBeUndefined()
  })

  it('Sidecar+LLM-Konflikt: Sidecar-Klasse gewinnt', async () => {
    const analyzeImages = mockAnalyze(llmMarkdown({ material_class: 'leather', confidence_class: 0.99 }))
    const result = await runDivaTextureFirstPass(await baseParams(makeProvider(STOFF_ENTRY), analyzeImages))
    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.material_class).toBe('fabric')
    expect(meta.confidence_class).toBe(0.95)
  })
})

describe('runDivaTextureFirstPass — Supplier-Preview + Color-Match (Update 2)', () => {
  function entryWithPreview(): Record<string, unknown> {
    return {
      OPV3_ST_2031_0477: {
        VCodex: 'ST_2031-0477',
        IsTexture: 'True',
        Material: 'STOFF',
        Name: 'Feincord thyme',
        PFTFile: '3_ST_2031_0477',
        Image: 'https://example.com/preview.jpg',
      },
    }
  }

  it('sendet 2 Bilder, wenn die Supplier-Preview erreichbar ist', async () => {
    const previewBuffer = Buffer.from([0x01, 0x02, 0x03])
    const analyzeImages = mockAnalyze(
      llmMarkdown({ material_class: 'fabric', confidence_class: 0.6, color_match_supplier: true }),
    )
    const fetchPreviewImage = vi.fn(async (_url: string): Promise<FirstPassImage> => ({
      buffer: previewBuffer,
      fileName: 'preview.jpg',
      mimeType: 'image/jpeg',
    }))

    const result = await runDivaTextureFirstPass({
      ...(await baseParams(makeProvider(entryWithPreview()), analyzeImages)),
      fetchPreviewImage,
    })

    expect(result.supplierPreviewSent).toBe(true)
    expect(fetchPreviewImage).toHaveBeenCalledWith('https://example.com/preview.jpg')
    const call = firstCall(analyzeImages)
    expect(call.images).toHaveLength(2)
    expect(call.images[1]!.buffer).toBe(previewBuffer)
    expect(call.context.supplier_preview_sent).toBe(true)

    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.color_match_supplier).toBe(true)
    expect(meta.review_status).toBe('ki_geprueft')
  })

  it('color_match_supplier=false aus dem LLM setzt review_status=zu_ueberarbeiten', async () => {
    const analyzeImages = mockAnalyze(
      llmMarkdown({
        material_class: 'fabric',
        confidence_class: 0.6,
        color_match_supplier: false,
        color_match_notes: 'Basecolor warm-beige, Preview deutlich gruener.',
      }),
    )
    const result = await runDivaTextureFirstPass({
      ...(await baseParams(makeProvider(entryWithPreview()), analyzeImages)),
      fetchPreviewImage: async () => ({ buffer: Buffer.from([0xab]), fileName: 'p.jpg', mimeType: 'image/jpeg' }),
    })
    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.color_match_supplier).toBe(false)
    expect(meta.color_match_notes).toBe('Basecolor warm-beige, Preview deutlich gruener.')
    expect(meta.review_status).toBe('zu_ueberarbeiten')
  })

  it('Preview-Fetch schlaegt fehl → Lauf mit nur 1 Bild + color_match_supplier=null', async () => {
    const analyzeImages = mockAnalyze(
      llmMarkdown({ material_class: 'fabric', confidence_class: 0.6, color_match_supplier: true }),
    )
    const result = await runDivaTextureFirstPass({
      ...(await baseParams(makeProvider(entryWithPreview()), analyzeImages)),
      fetchPreviewImage: async () => {
        throw new Error('404')
      },
    })
    expect(result.supplierPreviewSent).toBe(false)
    expect(firstCall(analyzeImages).images).toHaveLength(1)
    const { meta } = parseFrontmatter(result.markdown)
    // Postprocessor erzwingt null, auch wenn das LLM true geantwortet hat.
    // null wird vom Frontmatter-Composer geschluckt → absent im Output.
    expect(meta.color_match_supplier).toBeUndefined()
    expect(meta.review_status).toBe('ki_geprueft')
  })

  it('Sidecar-Treffer ohne Image-URL → nur 1 Bild, kein Preview-Fetch', async () => {
    const analyzeImages = mockAnalyze(llmMarkdown({ material_class: 'fabric', confidence_class: 0.6 }))
    const fetchPreviewImage = vi.fn(async () => {
      throw new Error('darf nicht aufgerufen werden')
    })
    const result = await runDivaTextureFirstPass({
      ...(await baseParams(makeProvider(STOFF_ENTRY), analyzeImages)),
      fetchPreviewImage,
    })
    expect(fetchPreviewImage).not.toHaveBeenCalled()
    expect(result.supplierPreviewSent).toBe(false)
  })
})

describe('runDivaTextureFirstPass — Override-Schutz', () => {
  it('existingReviewStatus=abgenommen bleibt erhalten, auch bei Mismatch', async () => {
    const analyzeImages = mockAnalyze(
      llmMarkdown({
        material_class: 'fabric',
        color_match_supplier: false,
        color_match_notes: 'Abweichung',
      }),
    )
    const result = await runDivaTextureFirstPass({
      ...(await baseParams(makeProvider({
        OPV3_ST_2031_0477: { VCodex: 'X', IsTexture: 'True', Material: 'STOFF', PFTFile: 'ST_2031_0477', Image: 'https://x' },
      }), analyzeImages)),
      fetchPreviewImage: async () => ({ buffer: Buffer.from([0xab]), fileName: 'p.jpg', mimeType: 'image/jpeg' }),
      existingReviewStatus: 'abgenommen',
    })
    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.review_status).toBe('abgenommen')
  })
})

describe('runDivaTextureFirstPass — Basecolor-Crop-Metadaten', () => {
  it('liefert basecolorCrop-Metadaten fuer den analysisRuns-Eintrag (Stufe 6)', async () => {
    const analyzeImages = mockAnalyze(llmMarkdown({ material_class: 'wood', confidence_class: 0.5 }))
    const result = await runDivaTextureFirstPass(
      await baseParams(makeProviderWithoutSidecar(), analyzeImages),
    )
    expect(result.basecolorCrop.crop_px).toBe('472x472')
    expect(result.basecolorCrop.crop_cm).toBe('4.0x4.0')
    expect(result.basecolorCrop.dpi_used).toBe(300)
    expect(result.basecolorCrop.dpi_fallback).toBe(false)
  })
})

describe('runDivaTextureFirstPass — Identitaets-Felder Hallu-Schutz (Punkt 4)', () => {
  it('LLM liefert FALSCHE iln_nummer/textur_code/title/slug → Postprocessor ueberschreibt', async () => {
    // Boeses LLM, das halluziniert: falsche ILN, falscher Code, falscher Title.
    // Der Postprocessor MUSS die deterministischen Werte aus Pfad+Sidecar
    // durchsetzen — sonst wandern halluzinierte Identitaeten in die Galerie.
    const analyzeImages = mockAnalyze(
      llmMarkdown({
        material_class: 'fabric',
        confidence_class: 0.6,
        iln_nummer: '9999999999999',
        textur_code: 'HALLU_XXXX-9999',
        title: 'Halluziniertes Material',
        slug: 'halluziniertes-material',
      }),
    )
    const result = await runDivaTextureFirstPass(await baseParams(makeProvider(STOFF_ENTRY), analyzeImages))
    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.iln_nummer).toBe('0001445679013')
    expect(meta.textur_code).toBe('ST_2031-0477')
    expect(meta.title).toBe('Feincord thyme')
    expect(meta.slug).toBe('feincord-thyme')
  })

  it('ohne Sidecar → textur_code/title aus Filename, iln_nummer aus Pfad', async () => {
    const analyzeImages = mockAnalyze(llmMarkdown({ material_class: 'wood', confidence_class: 0.5 }))
    const result = await runDivaTextureFirstPass(
      await baseParams(makeProviderWithoutSidecar(), analyzeImages),
    )
    const { meta } = parseFrontmatter(result.markdown)
    expect(meta.iln_nummer).toBe('0001445679013')
    expect(meta.textur_code).toBe('ST_2031-0477')
    expect(meta.title).toBe('3_ST_2031_0477')
    expect(meta.slug).toBe('3-st-2031-0477')
  })
})
