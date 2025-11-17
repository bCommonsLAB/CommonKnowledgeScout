/**
 * SSE (Server-Sent Events) Parsing Utilities
 * 
 * Hilfsfunktionen zum Parsen von SSE-Streams für Chat-Processing-Steps
 */

import type { ChatProcessingStep } from '@/types/chat-processing'

/**
 * Parst SSE-Zeilen aus einem Chunk und gibt vollständige Steps zurück
 * 
 * Behandelt unvollständige Zeilen korrekt durch Buffer-Management.
 * 
 * @param chunk - Der aktuelle Chunk vom Stream
 * @param buffer - Der bisherige Buffer mit unvollständigen Zeilen
 * @returns Tuple: [steps, newBuffer] - Array von geparsten Steps und neuer Buffer
 */
export function parseSSELines(
  chunk: string,
  buffer: string
): [ChatProcessingStep[], string] {
  const newBuffer = buffer + chunk
  const lines = newBuffer.split('\n')
  // Letzte Zeile könnte unvollständig sein - behalte sie im Buffer
  const lastLine = lines.pop() || ''
  const steps: ChatProcessingStep[] = []

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const jsonStr = line.slice(6) // Entferne "data: "
        const step = JSON.parse(jsonStr) as ChatProcessingStep
        steps.push(step)
      } catch {
        // Ignoriere Parsing-Fehler für einzelne Zeilen
      }
    }
  }

  return [steps, lastLine]
}



















