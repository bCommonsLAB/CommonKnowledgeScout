/**
 * @fileoverview Frage-Kontext einer Library fuer Laeufer und Bruecke (Welle F).
 *
 * @description
 * Was der Golden-Set-Laeufer (`scripts/golden-set-run.ts`) und die
 * Bruecken-Werkzeuge `frage_stellen`/`golden_set_fahren` gemeinsam brauchen:
 * Library-Kontext, Facetten, das Modell, die aufgeloesten Antwortregeln und
 * der Facetten-Kontext fuer den Cache — einmal gebaut, nicht dreimal.
 * `baseline` nimmt dem Modell Woerterbuch und Antwortregeln (Stand vor
 * m1–m4), die Pruefung behaelt das volle Schema.
 *
 * @module chat/golden-set
 */

import { loadLibraryChatContext, type LibraryChatContext } from '@/lib/chat/loader'
import { parseFacetDefs, type FacetDef } from '@/lib/chat/dynamic-facets'
import { loeseAntwortregelnAuf } from '@/lib/chat/antwortregeln'
import { facettenKontextFuerCache } from '@/lib/chat/quellen-kontext'
import { getDefaultLlmModel } from '@/lib/db/llm-models-repo'
import { getCollectionNameForLibrary } from '@/lib/repositories/vector-repo'
import type { NormalizedChatConfig } from '@/lib/chat/config'

export interface FrageKontext {
  ctx: LibraryChatContext
  /** Der handelnde User — Owner, sonst fehlen Entwuerfe als Quelle. */
  userEmail: string
  libraryKey: string
  /** Volles Schema — fuer Pruefung und Nachpruefung. */
  facetDefs: FacetDef[]
  /** Schema, wie es das Modell sieht (ohne Woerterbuch bei baseline). */
  facetDefsFuerModell: FacetDef[]
  chatConfig: NormalizedChatConfig
  antwortregeln: string | undefined
  facettenKontext: string | undefined
  apiKey: string | undefined
  model: string
  baseline: boolean
}

export async function baueFrageKontext(args: {
  libraryId: string
  userEmail: string
  baseline: boolean
  /** Weglassen = Standard-Modell der App. */
  model?: string
}): Promise<FrageKontext> {
  const ctx = await loadLibraryChatContext(args.userEmail, args.libraryId)
  if (!ctx) throw new Error(`Library ${args.libraryId} fuer ${args.userEmail} nicht gefunden`)
  const facetDefs = parseFacetDefs(ctx.library)
  const model = args.model ?? (await getDefaultLlmModel())?.modelId
  if (!model) throw new Error('Kein Modell: model fehlt und die App hat kein Standard-Modell')
  const facetDefsFuerModell = args.baseline
    ? facetDefs.map((f) => { const ohne = { ...f }; delete ohne.werte; return ohne })
    : facetDefs
  const chatConfig = args.baseline ? { ...ctx.chat, antwortregeln: undefined } : ctx.chat
  return {
    ctx,
    userEmail: args.userEmail,
    libraryKey: getCollectionNameForLibrary(ctx.library),
    facetDefs,
    facetDefsFuerModell,
    chatConfig,
    antwortregeln: loeseAntwortregelnAuf(chatConfig.antwortregeln, facetDefsFuerModell),
    facettenKontext: facettenKontextFuerCache(facetDefsFuerModell),
    apiKey: ctx.library.config?.publicPublishing?.apiKey,
    model,
    baseline: args.baseline,
  }
}
