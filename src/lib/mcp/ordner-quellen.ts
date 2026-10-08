/**
 * @fileoverview Quellen eines Ordners fuer einen Stapel sammeln (Welle C).
 *
 * @description
 * `index_aktualisieren` nimmt `ordner` + `rekursiv` wie der Batch-Dialog —
 * und laeuft hinter demselben Zaun (`batch-zaun.ts`): Twin-Ordner und
 * test/ werden nicht betreten, und die Antwort nennt, was uebersprungen
 * wurde. Nur Dateien, die die Pipeline kennt. Obergrenze, damit ein
 * Tippfehler im Pfad keinen Stapel ueber die ganze Library startet.
 *
 * @module mcp
 */

import { getMediaKindFromName, isPipelineSupported } from '@/lib/media-types'
import { istVomBatchAusgeschlossen } from '@/lib/pipeline/batch-zaun'
import type { StorageProvider } from '@/lib/storage/types'
import type { ResolvedSource } from './tools-erschliessen-shared'

export interface OrdnerQuellen {
  quellen: ResolvedSource[]
  /** Ordner, die der Zaun ausgelassen hat (Name, nicht Pfad — Pfade kosten Aufrufe). */
  uebersprungeneOrdner: string[]
  /** Dateien, die die Pipeline nicht kennt (z. B. .json, .png). */
  uebersprungeneDateien: number
  abgeschnitten: boolean
}

export async function sammleOrdnerQuellen(args: {
  provider: StorageProvider
  folderId: string
  rekursiv: boolean
  maxQuellen: number
}): Promise<OrdnerQuellen> {
  const { provider, rekursiv, maxQuellen } = args
  const quellen: ResolvedSource[] = []
  const uebersprungeneOrdner: string[] = []
  let uebersprungeneDateien = 0
  let abgeschnitten = false
  // Pfad relativ zum Startordner mitfuehren (Handover 08.10., W4): zwei
  // gleichnamige Dateien in verschiedenen Unterordnern waren in der Antwort
  // nicht unterscheidbar. Kostet keinen Aufruf — die Namen sind schon da.
  const stapel: Array<{ id: string; pfad: string }> = [{ id: args.folderId, pfad: '' }]

  while (stapel.length > 0 && !abgeschnitten) {
    const { id: aktuell, pfad: ordnerPfad } = stapel.shift() as { id: string; pfad: string }
    const eintraege = await provider.listItemsById(aktuell)
    for (const eintrag of eintraege) {
      if (eintrag.type === 'folder') {
        if (!rekursiv) continue
        if (istVomBatchAusgeschlossen(eintrag.metadata.name)) {
          uebersprungeneOrdner.push(eintrag.metadata.name)
          continue
        }
        stapel.push({ id: eintrag.id, pfad: ordnerPfad ? `${ordnerPfad}/${eintrag.metadata.name}` : eintrag.metadata.name })
        continue
      }
      const kind = getMediaKindFromName(eintrag.metadata.name, eintrag.metadata.mimeType ?? '')
      if (!isPipelineSupported(kind)) {
        uebersprungeneDateien += 1
        continue
      }
      if (quellen.length >= maxQuellen) {
        abgeschnitten = true
        break
      }
      quellen.push({
        itemId: eintrag.id, parentId: aktuell, name: eintrag.metadata.name, mimeType: eintrag.metadata.mimeType,
        pfad: ordnerPfad ? `${ordnerPfad}/${eintrag.metadata.name}` : eintrag.metadata.name,
      })
    }
  }
  return { quellen, uebersprungeneOrdner, uebersprungeneDateien, abgeschnitten }
}
