/**
 * @fileoverview LIEFERSYSTEM-Kontextblock fuer den 1. LLM-Pass (Stufe 3).
 *
 * @description
 * Baut aus einem gematchten Sidecar-Eintrag den deterministischen
 * LIEFERSYSTEM-Block, der dem LLM neben dem CONTEXT-Block mitgegeben wird
 * (Plan Stufe 3, Stolperfalle #1/#12: Liefersystem hat Vorrang). Wendet das
 * DE→EN-Material-Mapping an (STOFF → fabric), liefert die englische
 * `materialClass` als Pre-Wert. Rein deterministisch, KEIN LLM, KEIN I/O.
 */

import type { OptionvalueEntry } from './types'
import { mapMaterialClass, type MaterialClass } from './material-class-mapping'

/**
 * Deterministischer Liefersystem-Block fuers LLM-Prompt-Context-Feld.
 * Feldnamen folgen dem System-Prompt (z.B. `LIEFERSYSTEM.materialClass`).
 */
export interface LiefersystemBlock {
  VCodex: string
  Name?: string
  GroupName?: string
  RGB?: string
  /** Roh-Materialwert aus den Stammdaten (deutsch, z.B. "STOFF"). */
  Material?: string
  /** DE→EN gemappte Klasse oder null, wenn der DE-Wert unbekannt ist. */
  materialClass: MaterialClass | null
  /** Deterministisch ableitbarer Typ (z.B. faux_leather fuer KUNSTLEDER). */
  materialType?: string
}

/**
 * Baut den LIEFERSYSTEM-Block aus einem gematchten Sidecar-Eintrag.
 *
 * @param entry Gematchter Eintrag oder null (kein Sidecar-Treffer).
 * @returns Block oder null, wenn kein Eintrag vorliegt.
 */
export function buildLiefersystemBlock(entry: OptionvalueEntry | null): LiefersystemBlock | null {
  if (!entry) return null

  const mapping = mapMaterialClass(entry.Material)

  return {
    VCodex: entry.VCodex,
    Name: entry.Name,
    GroupName: entry.GroupName,
    RGB: entry.RGB,
    Material: entry.Material,
    materialClass: mapping.materialClass,
    materialType: mapping.materialType,
  }
}
