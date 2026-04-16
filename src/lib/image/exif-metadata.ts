/**
 * @fileoverview EXIF-/Bild-Metadaten-Extraktion
 *
 * Extrahiert technische Metadaten aus Bild-Binaries via sharp.
 * Wird in der Image-Pipeline verwendet, um Frontmatter-Felder
 * programmatisch zu füllen (nicht via LLM).
 */

import sharp from 'sharp'

/** Technische Bild-Metadaten für Frontmatter-Injection */
export interface ImageTechnicalMetadata {
  breite_px: number
  hoehe_px: number
  dpi_horizontal: number | null
  dpi_vertikal: number | null
  bittiefe: number | null
  breite_cm: number | null
  hoehe_cm: number | null
  komprimierung: string
  farbraum: string
  erstellungsdatum: string | null
  erstellungsprogramm: string
}

/**
 * Extrahiert technische Metadaten aus einem Bild-Buffer.
 *
 * sharp liest nur den Datei-Header — auch bei großen Bildern (50+ MB)
 * dauert das nur wenige Millisekunden, weil keine Pixel dekodiert werden.
 */
export async function extractImageMetadata(
  buffer: Buffer | ArrayBuffer
): Promise<ImageTechnicalMetadata> {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const meta = await sharp(buf).metadata()

  const width = meta.width ?? 0
  const height = meta.height ?? 0

  // DPI: sharp liefert density (Pixel pro Inch)
  const dpiH = meta.density ?? null
  const dpiV = meta.density ?? null

  // Physische Maße berechnen: px / dpi * 2.54 = cm
  const widthCm = dpiH ? Math.round((width / dpiH) * 2.54 * 10) / 10 : null
  const heightCm = dpiV ? Math.round((height / dpiV) * 2.54 * 10) / 10 : null

  // Bittiefe: channels * bitsPerChannel (sharp gibt channels und depth separat)
  const channels = meta.channels ?? 0
  const bitsPerSample = parseBitsPerSample(meta.depth)
  const bitDepth = channels > 0 && bitsPerSample > 0 ? channels * bitsPerSample : null

  // Komprimierung aus dem Format ableiten
  const compression = meta.format?.toUpperCase() ?? ''

  // Farbraum: sharp liefert space (z.B. 'srgb', 'rgb', 'cmyk')
  const colorSpace = formatColorSpace(meta.space)

  // EXIF-Daten: Erstellungsdatum und Software
  const exif = meta.exif ? parseExifBasic(meta.exif) : { date: null, software: '' }

  return {
    breite_px: width,
    hoehe_px: height,
    dpi_horizontal: dpiH,
    dpi_vertikal: dpiV,
    bittiefe: bitDepth,
    breite_cm: widthCm,
    hoehe_cm: heightCm,
    komprimierung: compression,
    farbraum: colorSpace,
    erstellungsdatum: exif.date,
    erstellungsprogramm: exif.software,
  }
}

/**
 * sharp depth-Werte in Bits pro Sample umwandeln.
 * sharp liefert: 'uchar' (8), 'ushort' (16), 'float' (32), etc.
 */
function parseBitsPerSample(depth: string | undefined): number {
  if (!depth) return 0
  const map: Record<string, number> = {
    uchar: 8,
    char: 8,
    ushort: 16,
    short: 16,
    uint: 32,
    int: 32,
    float: 32,
    double: 64,
    complex: 64,
    dpcomplex: 128,
  }
  return map[depth] ?? 0
}

/** Farbraum-String normalisieren */
function formatColorSpace(space: string | undefined): string {
  if (!space) return ''
  const map: Record<string, string> = {
    srgb: 'sRGB',
    rgb: 'RGB',
    rgb16: 'RGB 16-bit',
    cmyk: 'CMYK',
    'b-w': 'Graustufen',
    grey16: 'Graustufen 16-bit',
    lab: 'CIELAB',
    scrgb: 'scRGB',
  }
  return map[space] ?? space
}

/**
 * Minimaler EXIF-Parser für Erstellungsdatum und Software.
 * sharp liefert EXIF als rohen Buffer. Wir suchen die relevanten Tags
 * über einfaches String-Matching statt einer vollständigen EXIF-Library.
 */
function parseExifBasic(exifBuffer: Buffer): { date: string | null; software: string } {
  let date: string | null = null
  let software = ''

  try {
    const exifString = exifBuffer.toString('binary')

    // DateTimeOriginal (Tag 0x9003) oder DateTime (Tag 0x0132)
    // Format im EXIF: "YYYY:MM:DD HH:MM:SS"
    const dateMatch = exifString.match(/(\d{4}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}/)
    if (dateMatch) {
      date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    }

    // Software (Tag 0x0131) — suche nach bekannten Programmnamen
    const swMatch = exifString.match(
      /(Adobe Photoshop[^\\x00\0]*|GIMP[^\\x00\0]*|Illustrator[^\\x00\0]*|Affinity[^\\x00\0]*|Capture One[^\\x00\0]*)/i
    )
    if (swMatch) {
      software = swMatch[1].replace(/\0/g, '').trim()
    }
  } catch {
    // EXIF-Parsing darf die Pipeline nicht brechen
  }

  return { date, software }
}
