/**
 * SSE-Zeilen des Chat-Streams lesen (D6b; wie `src/utils/sse.ts` der App).
 *
 * Ein Chunk endet nicht zwingend an einer Zeilengrenze — die letzte,
 * womoeglich unvollstaendige Zeile bleibt im Puffer und wird mit dem
 * naechsten Chunk vervollstaendigt.
 */

import type { ChatProcessingStep } from '@ks/contracts'

export function sseSchritte(chunk: string, puffer: string): [ChatProcessingStep[], string] {
  const zeilen = (puffer + chunk).split('\n')
  const rest = zeilen.pop() ?? ''
  const schritte: ChatProcessingStep[] = []
  for (const zeile of zeilen) {
    if (!zeile.startsWith('data: ')) continue
    try {
      schritte.push(JSON.parse(zeile.slice(6)) as ChatProcessingStep)
    } catch (e) {
      // Eine kaputte Zeile verwirft nur sich selbst, nicht den Stream — aber sichtbar.
      console.warn('[useStoryStream] SSE-Zeile nicht lesbar', { zeile: zeile.slice(0, 120), e })
    }
  }
  return [schritte, rest]
}
