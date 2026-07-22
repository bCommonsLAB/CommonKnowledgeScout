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
import { resolveTextureItemKey } from './load-supplier-data'

/**
 * Deterministischer Liefersystem-Block fuers LLM-Prompt-Context-Feld.
 * Feldnamen folgen dem System-Prompt (z.B. `LIEFERSYSTEM.materialClass`).
 */
export interface LiefersystemBlock {
  /** Stabiler Textur-Schluessel aus den Stammdaten. */
  PFTFile: string
  /** Optional — Liefersystem liefert VCodex nicht immer. */
  VCodex?: string
  Name?: string
  TextureName?: string
  GroupName?: string
  OPVGroupName?: string
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

  // Beide Gruppen-Felder immer als String an das LLM — auch leer.
  // GroupName kann OPVGroupName verschleiern; das LLM soll beide sehen.
  return {
    PFTFile: resolveTextureItemKey(entry),
    ...(entry.VCodex ? { VCodex: entry.VCodex } : {}),
    Name: entry.Name ?? '',
    TextureName: entry.TextureName ?? '',
    GroupName: entry.GroupName ?? '',
    OPVGroupName: entry.OPVGroupName ?? '',
    RGB: entry.RGB,
    Material: entry.Material,
    materialClass: mapping.materialClass,
    materialType: mapping.materialType,
  }
}
