/**
 * Tests fuer src/lib/diva-texture/basecolor-crop.ts (Stufe 3, Update 2).
 *
 * Deckt Center-Crop + DPI-Berechnung + Fallback + kleines-Bild-Fall ab.
 * Nutzt sharp zur Erzeugung von Test-Bitmaps (kein Fixture-File noetig).
 */

import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { buildBasecolorCrop, planBasecolorCrop } from '@/lib/diva-texture/basecolor-crop'
import type { ImageTechnicalMetadata } from '@/lib/image/exif-metadata'

/** Erzeugt ein einfarbiges JPEG mit gewuenschter Pixel-Maesse + optional DPI. */
async function makeJpeg(
  widthPx: number,
  heightPx: number,
  options: { density?: number } = {},
): Promise<Buffer> {
  let img = sharp({
    create: {
      width: widthPx,
      height: heightPx,
      channels: 3,
      background: { r: 128, g: 64, b: 32 },
    },
  })
  if (options.density !== undefined) {
    img = img.withMetadata({ density: options.density })
  }
  return img.jpeg({ quality: 90 }).toBuffer()
}

describe('buildBasecolorCrop — Center-Crop bei 4K-Bild', () => {
  it('schneidet bei 4096x4096 px / 300 DPI mittig auf 360x360 px (~3.0x3.0 cm)', async () => {
    const source = await makeJpeg(4096, 4096, { density: 300 })
    const result = await buildBasecolorCrop(source)

    expect(result.cropPx).toBe('360x360')
    expect(result.dpiUsed).toBe(300)
    expect(result.dpiFallback).toBe(false)
    expect(result.cropCm).toBe('3.0x3.0')
    expect(result.mimeType).toBe('image/jpeg')

    // Crop sollte tatsaechlich 360x360 sein
    const cropMeta = await sharp(result.buffer).metadata()
    expect(cropMeta.width).toBe(360)
    expect(cropMeta.height).toBe(360)
  })

  it('rechnet bei 600 DPI eine kleinere Realgroesse (~1.5x1.5 cm)', async () => {
    const source = await makeJpeg(2000, 2000, { density: 600 })
    const result = await buildBasecolorCrop(source)

    expect(result.cropPx).toBe('360x360')
    expect(result.dpiUsed).toBe(600)
    expect(result.cropCm).toBe('1.5x1.5')
  })
})

describe('buildBasecolorCrop — DPI ohne explizite Aufloesung', () => {
  it('uebernimmt den sharp-Default 72 DPI, wenn keine Metadaten gesetzt sind', async () => {
    // Hinweis: sharp setzt bei `create` immer einen Default-density von 72.
    // Der dpiFallback-Pfad in basecolor-crop greift nur bei
    // `dpi_horizontal === null` oder `<= 0` — siehe naechster Test mit Mock.
    const source = await sharp({
      create: { width: 4096, height: 4096, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg({ quality: 85 })
      .toBuffer()
    const result = await buildBasecolorCrop(source)
    expect(result.dpiUsed).toBe(72)
    expect(result.dpiFallback).toBe(false)
    expect(result.cropPx).toBe('360x360')
    // 360 / 72 * 2.54 = 12.7
    expect(result.cropCm).toBe('12.7x12.7')
  })

  it('faellt deterministisch auf 300 DPI zurueck, wenn dpi_horizontal null ist (Edge-Case #19)', async () => {
    // Wir injizieren einen Metadaten-Reader, der dpi_horizontal=null liefert
    // — so testen wir den Fallback-Pfad ohne Abhaengigkeit vom JPEG-Encoder.
    const source = await makeJpeg(4096, 4096, { density: 300 })
    const fakeMeta: ImageTechnicalMetadata = {
      breite_px: 4096,
      hoehe_px: 4096,
      dpi_horizontal: null,
      dpi_vertikal: null,
      bittiefe: 24,
      breite_cm: null,
      hoehe_cm: null,
      komprimierung: 'JPEG',
      farbraum: 'sRGB',
      erstellungsdatum: null,
      erstellungsprogramm: '',
    }
    const result = await buildBasecolorCrop(source, async () => fakeMeta)
    expect(result.dpiUsed).toBe(300)
    expect(result.dpiFallback).toBe(true)
    expect(result.cropPx).toBe('360x360')
    expect(result.cropCm).toBe('3.0x3.0')
  })
})

describe('buildBasecolorCrop — kleines Bild (Edge-Case #20)', () => {
  it('gibt bei 256x256 px das Voll-Bild zurueck (kein Crop)', async () => {
    const source = await makeJpeg(256, 256, { density: 300 })
    const result = await buildBasecolorCrop(source)

    expect(result.cropPx).toBe('256x256')
    // 256 / 300 * 2.54 = 2.1675 → 2.2 cm
    expect(result.cropCm).toBe('2.2x2.2')

    const cropMeta = await sharp(result.buffer).metadata()
    expect(cropMeta.width).toBe(256)
    expect(cropMeta.height).toBe(256)
  })

  it('gibt bei genau 360x360 px ebenfalls das Voll-Bild zurueck (Crop wuerde nichts aendern)', async () => {
    const source = await makeJpeg(360, 360, { density: 300 })
    const result = await buildBasecolorCrop(source)
    expect(result.cropPx).toBe('360x360')
    expect(result.cropCm).toBe('3.0x3.0')
  })
})

describe('buildBasecolorCrop — Reproducibility', () => {
  it('ist deterministisch (gleicher Input → gleiche Pixel- + cm-Masse)', async () => {
    const source = await makeJpeg(4096, 2048, { density: 300 })
    const a = await buildBasecolorCrop(source)
    const b = await buildBasecolorCrop(source)
    expect(a.cropPx).toBe(b.cropPx)
    expect(a.cropCm).toBe(b.cropCm)
    expect(a.dpiUsed).toBe(b.dpiUsed)
  })
})

describe('planBasecolorCrop — pure Plan-Berechnung', () => {
  function meta(overrides: Partial<ImageTechnicalMetadata> = {}): ImageTechnicalMetadata {
    return {
      breite_px: 4096,
      hoehe_px: 4096,
      dpi_horizontal: 300,
      dpi_vertikal: 300,
      bittiefe: 24,
      breite_cm: null,
      hoehe_cm: null,
      komprimierung: 'JPEG',
      farbraum: 'sRGB',
      erstellungsdatum: null,
      erstellungsprogramm: '',
      ...overrides,
    }
  }

  it('4K mit 300 DPI → 360x360 px ≈ 3.0x3.0 cm, fullImage=false', () => {
    expect(planBasecolorCrop(meta())).toEqual({
      cropPx: '360x360',
      cropCm: '3.0x3.0',
      dpiUsed: 300,
      dpiFallback: false,
      fullImage: false,
    })
  })

  it('kleines Bild (256x256) → Voll-Bild, fullImage=true', () => {
    const plan = planBasecolorCrop(meta({ breite_px: 256, hoehe_px: 256 }))
    expect(plan.fullImage).toBe(true)
    expect(plan.cropPx).toBe('256x256')
    expect(plan.cropCm).toBe('2.2x2.2')
  })

  it('fehlende DPI → Fallback 300, dpiFallback=true', () => {
    const plan = planBasecolorCrop(meta({ dpi_horizontal: null }))
    expect(plan.dpiUsed).toBe(300)
    expect(plan.dpiFallback).toBe(true)
  })

  it('Plan stimmt mit buildBasecolorCrop ueberein (gleiches Meta → gleiche Masse)', async () => {
    const source = await sharp({
      create: { width: 4096, height: 4096, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .withMetadata({ density: 600 })
      .jpeg()
      .toBuffer()
    const built = await buildBasecolorCrop(source)
    const planned = planBasecolorCrop({
      breite_px: 4096,
      hoehe_px: 4096,
      dpi_horizontal: 600,
      dpi_vertikal: 600,
      bittiefe: 24,
      breite_cm: null,
      hoehe_cm: null,
      komprimierung: 'JPEG',
      farbraum: 'sRGB',
      erstellungsdatum: null,
      erstellungsprogramm: '',
    })
    expect(built.cropPx).toBe(planned.cropPx)
    expect(built.cropCm).toBe(planned.cropCm)
    expect(built.dpiUsed).toBe(planned.dpiUsed)
    expect(built.dpiFallback).toBe(planned.dpiFallback)
    expect(built.fullImage).toBe(planned.fullImage)
  })
})
