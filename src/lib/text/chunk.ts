/**
 * Zeichenbasiertes Chunking mit weichen Schnittpunkten und Overlap.
 * - Bevorzugt Zeilenumbrüche, dann Leerzeichen/Punkt.
 * - Harte Kante nur, wenn kein weicher Schnitt nahe genug ist.
 */
export function chunkText(input: string, maxChars: number = 1000, overlap: number = 100): string[] {
  const chunks: string[] = []

  const maxC = Math.max(200, Math.min(maxChars, 2000))
  const ov = Math.max(0, Math.min(overlap, Math.floor(maxC / 2)))

  let i = 0
  const n = input.length
  while (i < n) {
    const sliceEnd = Math.min(i + maxC, n)
    let cut = input.lastIndexOf('\n', sliceEnd)
    if (cut < i + Math.floor(maxC * 0.6)) {
      const spaceCut = input.lastIndexOf(' ', sliceEnd)
      const dotCut = input.lastIndexOf('.', sliceEnd)
      cut = Math.max(cut, spaceCut, dotCut)
    }
    if (cut < i + Math.floor(maxC * 0.5)) cut = sliceEnd

    const part = input.slice(i, cut)
    if (part.trim().length > 0) chunks.push(part)

    i = Math.max(cut - ov, i + maxC)
  }
  return chunks
}



