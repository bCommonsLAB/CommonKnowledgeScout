/**
 * @fileoverview Verwaltung der globalen Modell-Liste — Ablauf hinter den Admin-Routen.
 *
 * @description
 * Haelt die Routen duenn: Katalog-Abgleich, Regeln (`regeln.ts`) und
 * Datenzugriff (`llm-models-admin-repo.ts`) laufen hier zusammen. Neue
 * Eintraege starten abgeschaltet; aktiv wird ein Modell erst nach einer
 * erfolgreichen Probe ueber den Secretary.
 *
 * @module llm-models
 */

import {
  aendereModell, findeModell, legeModellAn, listeAlleModelle, setzeReihenfolge, speichereProbe,
  type LlmModelAdmin,
} from '@/lib/db/llm-models-admin-repo'
import type {
  KatalogEintrag, ModellProbe, SprachmodellAenderung, SprachmodellListe, SprachmodellZeile,
} from '@/types/sprachmodell'
import { probiereModell } from './modell-probe'
import { ladeKatalog, sucheImKatalog } from './openrouter-katalog'
import {
  STANDARD_SPRACHEN, SprachmodellFehler, anbieterAus, anzeigeName, neueReihenfolge, pruefeSchalter,
} from './regeln'

function zeile(m: LlmModelAdmin, katalog: Map<string, KatalogEintrag> | null): SprachmodellZeile {
  const k = katalog?.get(m.modelId) ?? null
  return {
    modelId: m.modelId,
    name: m.name,
    strengths: m.strengths,
    ...(m.url ? { url: m.url } : {}),
    isActive: m.isActive,
    order: m.order,
    ...(m.probe ? { probe: m.probe } : {}),
    preisEin: k?.preisEin ?? null,
    preisAus: k?.preisAus ?? null,
    kontext: k?.kontext ?? null,
    imKatalog: katalog ? k !== null : null,
  }
}

async function modellOderFehler(modelId: string): Promise<LlmModelAdmin> {
  const modell = await findeModell(modelId)
  if (!modell) throw new SprachmodellFehler(`"${modelId}" steht nicht in der Liste`)
  return modell
}

/** Alle Eintraege mit Preisen; ist OpenRouter nicht erreichbar, sagt `katalogFehler` es. */
export async function ladeListe(): Promise<SprachmodellListe> {
  const modelle = await listeAlleModelle()
  try {
    const katalog = new Map((await ladeKatalog()).map((e) => [e.modelId, e]))
    return { modelle: modelle.map((m) => zeile(m, katalog)) }
  } catch (error) {
    const katalogFehler = error instanceof Error ? error.message : String(error)
    console.error('[llm-models/verwaltung] Katalog nicht geladen:', katalogFehler)
    return { modelle: modelle.map((m) => zeile(m, null)), katalogFehler }
  }
}

export async function sucheKatalog(frage: string): Promise<KatalogEintrag[]> {
  const vorhanden = new Set((await listeAlleModelle()).map((m) => m.modelId))
  return sucheImKatalog(await ladeKatalog(), frage, vorhanden)
}

/** Legt ein Modell aus dem Katalog an — abgeschaltet und am Ende der Liste. */
export async function fuegeHinzu(modelId: string, von: string): Promise<void> {
  const provider = anbieterAus(modelId)
  const eintrag = (await ladeKatalog()).find((e) => e.modelId === modelId)
  if (!eintrag) throw new SprachmodellFehler(`"${modelId}" steht nicht im OpenRouter-Katalog`)
  const alle = await listeAlleModelle()
  const jetzt = new Date().toISOString()
  await legeModellAn({
    _id: modelId,
    modelId,
    name: anzeigeName(eintrag.name),
    provider,
    supportedLanguages: [...STANDARD_SPRACHEN],
    strengths: '',
    url: `https://openrouter.ai/models/${modelId}`,
    isActive: false,
    order: alle.reduce((max, m) => Math.max(max, m.order), 0) + 1,
    createdAt: jetzt,
    updatedAt: jetzt,
    updatedBy: von,
  })
}

export async function aendere(modelId: string, aenderung: SprachmodellAenderung, von: string): Promise<void> {
  const modell = await modellOderFehler(modelId)
  const felder: SprachmodellAenderung = {}
  if (aenderung.name !== undefined) {
    const name = aenderung.name.trim()
    if (!name) throw new SprachmodellFehler('Der Name darf nicht leer sein')
    felder.name = name
  }
  if (aenderung.strengths !== undefined) felder.strengths = aenderung.strengths.trim()
  if (aenderung.isActive !== undefined && aenderung.isActive !== modell.isActive) {
    const alle = (await listeAlleModelle()).map((m) => ({ modelId: m.modelId, isActive: m.isActive, probe: m.probe }))
    pruefeSchalter({ modelId, isActive: modell.isActive, probe: modell.probe }, aenderung.isActive, alle)
    felder.isActive = aenderung.isActive
  }
  if (Object.keys(felder).length === 0) throw new SprachmodellFehler('Keine Aenderung angegeben')
  await aendereModell(modelId, felder, von)
}

export async function ordneNeu(modelIds: readonly string[], von: string): Promise<void> {
  const vorhanden = (await listeAlleModelle()).map((m) => m.modelId)
  await setzeReihenfolge(neueReihenfolge(vorhanden, modelIds), von)
}

/** Probe ueber den Secretary; das Ergebnis wird gespeichert, auch wenn sie scheitert. */
export async function probiere(modelId: string, von: string): Promise<ModellProbe> {
  await modellOderFehler(modelId)
  const probe = await probiereModell(modelId)
  await speichereProbe(modelId, probe, von)
  return probe
}
