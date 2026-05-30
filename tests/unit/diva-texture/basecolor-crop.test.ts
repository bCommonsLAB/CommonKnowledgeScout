/**
 * Tests fuer src/lib/diva-texture/basecolor-crop.ts (Stufe 3, Update 2).
 *
 * Deckt die 4-cm-Crop-Strategie (konstante physische Groesse) + DPI-
 * Berechnung + Fallback + kleines-Bild-Fall ab. Nutzt sharp zur Erzeugung
 * von Test-Bitmaps (kein Fixture-File noetig).
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

describe('buildBasecolorCrop — 4-cm-Crop bei 4K-Bild', () => {
  it('schneidet bei 4096x4096 px / 300 DPI mittig 472x472 px (= 4.0x4.0 cm) heraus', async () => {
    // 4 cm * 300 DPI / 2.54 ≈ 472 px → unter MAX_OUTPUT_PX=512, nativ ausgegeben.
    const source = await makeJpeg(4096, 4096, { density: 300 })
    const result = await buildBasecolorCrop(source)

    expect(result.cropPx).toBe('472x472')
    expect(result.dpiUsed).toBe(300)
    expect(result.dpiFallback).toBe(false)
    expect(result.cropCm).toBe('4.0x4.0')
    expect(result.mimeType).toBe('image/jpeg')

    const cropMeta = await sharp(result.buffer).metadata()
    expect(cropMeta.width).toBe(472)
    expect(cropMeta.height).toBe(472)
  })

  it('kappt bei 600 DPI auf 512 px (4 cm wuerde 944 px ergeben → Downsample)', async () => {
    const source = await makeJpeg(2000, 2000, { density: 600 })
    const result = await buildBasecolorCrop(source)

    expect(result.cropPx).toBe('512x512')
    expect(result.dpiUsed).toBe(600)
    expect(result.cropCm).toBe('4.0x4.0')

    const cropMeta = await sharp(result.buffer).metadata()
    expect(cropMeta.width).toBe(512)
    expect(cropMeta.height).toBe(512)
  })
})

describe('buildBasecolorCrop — DPI ohne explizite Aufloesung', () => {
  it('uebernimmt den sharp-Default 72 DPI; 4 cm = 113 px, nativ ausgegeben', async () => {
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
    // 4 cm * 72 / 2.54 = 113.39 → 113 px (unter MAX_OUTPUT_PX, kein Upsample).
    expect(result.cropPx).toBe('113x113')
    expect(result.cropCm).toBe('4.0x4.0')
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
    expect(result.cropPx).toBe('472x472')
    expect(result.cropCm).toBe('4.0x4.0')
  })
})

describe('buildBasecolorCrop — kleines Bild (Edge-Case #20)', () => {
  it('gibt bei 256x256 px / 300 DPI das Voll-Bild zurueck (kleiner als 4 cm)', async () => {
    const source = await makeJpeg(256, 256, { density: 300 })
    const result = await buildBasecolorCrop(source)

    expect(result.fullImage).toBe(true)
    expect(result.cropPx).toBe('256x256')
    // 256 / 300 * 2.54 = 2.1675 → 2.2 cm
    expect(result.cropCm).toBe('2.2x2.2')

    const cropMeta = await sharp(result.buffer).metadata()
    expect(cropMeta.width).toBe(256)
    expect(cropMeta.height).toBe(256)
  })

  it('kappt das Voll-Bild auf 512 px, wenn Source-Edge groesser als MAX_OUTPUT_PX ist', async () => {
    // 800 px @ 600 DPI = 3.4 cm → kleiner als 4 cm → fullImage true,
    // aber 800 > 512 → proportionaler Downsample auf 512.
    const source = await makeJpeg(800, 800, { density: 600 })
    const result = await buildBasecolorCrop(source)

    expect(result.fullImage).toBe(true)
    expect(result.cropPx).toBe('512x512')
    expect(result.cropCm).toBe('3.4x3.4')

    const cropMeta = await sharp(result.buffer).metadata()
    expect(cropMeta.width).toBe(512)
  })

  it('liefert bei genau 4 cm Source (= 472 px @ 300 DPI) regulaeren Crop, kein fullImage', async () => {
    const source = await makeJpeg(472, 472, { density: 300 })
    const result = await buildBasecolorCrop(source)
    expect(result.fullImage).toBe(false)
    expect(result.cropPx).toBe('472x472')
    expect(result.cropCm).toBe('4.0x4.0')
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

  it('behandelt rechteckige Quellbilder symmetrisch (4096x2048 → quadratischer 4-cm-Crop)', async () => {
    // 4 cm @ 300 DPI = 472 px; passt in shorter dimension (2048) → regulaerer Crop.
    const source = await makeJpeg(4096, 2048, { density: 300 })
    const result = await buildBasecolorCrop(source)
    expect(result.fullImage).toBe(false)
    expect(result.cropPx).toBe('472x472')
    expect(result.cropCm).toBe('4.0x4.0')
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

  it('4K mit 300 DPI → 472x472 px = 4.0x4.0 cm, fullImage=false', () => {
    expect(planBasecolorCrop(meta())).toEqual({
      cropPx: '472x472',
      cropCm: '4.0x4.0',
      dpiUsed: 300,
      dpiFallback: false,
      fullImage: false,
    })
  })

  it('600 DPI → 512x512 px (gekappt) = 4.0x4.0 cm', () => {
    expect(planBasecolorCrop(meta({ dpi_horizontal: 600, dpi_vertikal: 600 }))).toEqual({
      cropPx: '512x512',
      cropCm: '4.0x4.0',
      dpiUsed: 600,
      dpiFallback: false,
      fullImage: false,
    })
  })

  it('72 DPI → 113x113 px = 4.0x4.0 cm (kein Upsample)', () => {
    expect(planBasecolorCrop(meta({ dpi_horizontal: 72, dpi_vertikal: 72 }))).toEqual({
      cropPx: '113x113',
      cropCm: '4.0x4.0',
      dpiUsed: 72,
      dpiFallback: false,
      fullImage: false,
    })
  })

  it('kleines Bild (256x256 @ 300 DPI) → Voll-Bild, fullImage=true', () => {
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
