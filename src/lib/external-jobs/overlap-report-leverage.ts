/**
 * @fileoverview Enabler-Hebel-Pass des Overlap-Berichts (Plan summen-und-
 * synergie-aggregation, Stufe 4, Todo enabler-leverage-concept).
 *
 * @description
 * Deterministisch (kein LLM): laedt die Computed-Relations-Kanten, rechnet je
 * Enabler die anteilig geerbte, Stufe-3-bereinigte CO2-Wirkung
 * (computeEnablerLeverage, beta-Daempfung, 1 Hop) und liefert den Markdown-
 * Abschnitt "Hebel-Massnahmen" (TOP-N je Cluster) plus Persistenz der
 * hebel_*-Keys. Staleness der Kanten ist NUR eine Warnung im Bericht —
 * Neuberechnung ist teuer, der Anwender entscheidet (Entscheid 2026-07-09).
 *
 * @usedIn
 * - src/lib/external-jobs/phase-overlap-report.ts
 */

import { getDocRelations, getLatestCatalogHash } from '@/lib/repositories/doc-relations-repo'
import { computeEnablerLeverage, type LeverageEntry } from '@/lib/graph/enabler-leverage'
import { setDocLeverage } from '@/lib/repositories/overlap-report-repo'

/**
 * Minimaler Eingabe-Vertrag je Dokument (strukturell kompatibel zu
 * DocCardMeta): so kann der Pass sowohl aus der Overlap-Phase (findDocs)
 * als auch aus dem eigenstaendigen Enabler-Bericht (lean Mongo-Query)
 * gefuettert werden. Facetten-Felder (groupField) liegen als Zusatz-Keys an.
 */
export interface LeverageDocInput {
  id?: string
  fileId?: string
  title?: string
  shortTitle?: string
  fileName?: string
  co2_einsparung_kt?: number
  massnahme_nr?: string | number
}

/** Plan-Entscheid 2026-07-09: Kredit-Daempfung Default. */
export const DEFAULT_LEVERAGE_BETA = 0.5
/** TOP-Hebel je Cluster im Bericht. */
const TOP_N_PER_CLUSTER = 5
/** Aktivierte Massnahmen je Enabler-Zeile (Anzeige + hebel_aktiviert). */
const TOP_ACTIVATED = 3

const fmt = (v: number): string => v.toLocaleString('de-DE', { maximumFractionDigits: 1 })

export interface LeveragePassArgs {
  libraryId: string
  libraryKey: string
  /** VOLLER Bestand (nicht das Stufe-3-Cap — Enabler haben oft CO2=0). */
  items: LeverageDocInput[]
  /** korrektur_faktor_co2 je fileId aus dem Faktoren-Pass (nur analysierte). */
  factorCo2ByFileId: Map<string, number>
  /** Cluster-Dimension (graphConfig.colorField, z.B. dominant_perspektive). */
  groupField: string
  /** ISO-Zeitstempel des Bericht-Laufs (= hebel_stand). */
  stand: string
  beta?: number
}

export interface LeveragePassResult {
  /** Markdown-Abschnitt fuer den Bericht ('' nie — auch der Hinweis-Fall ist Text). */
  markdownSection: string
  /** Anzahl Enabler (>= 1 gueltige Kante). */
  enablers: number
  /** Anzahl persistierter hebel_*-Docs. */
  persisted: number
}

interface DocInfo {
  fileId: string
  nr?: string
  title: string
  cluster: string
  ownValue?: number
}

function label(info: DocInfo | undefined, fallbackId: string): string {
  if (!info) return fallbackId
  return info.nr ? `Nr. ${info.nr} ${info.title}` : info.title
}

/** Markdown-Tabellen je Cluster aus den Hebel-Eintraegen (pure, testbar). */
export function buildLeverageSection(args: {
  infoByFileId: Map<string, DocInfo>
  leverageByFileId: Map<string, LeverageEntry>
  beta: number
  relationsStand: string | null
}): string {
  const rows = [...args.leverageByFileId.entries()]
    .map(([fileId, entry]) => ({ fileId, entry, info: args.infoByFileId.get(fileId) }))
    .filter((r) => r.info)
    .sort((a, b) => b.entry.leverage - a.entry.leverage)

  const byCluster = new Map<string, typeof rows>()
  for (const r of rows) {
    const cluster = r.info!.cluster
    const list = byCluster.get(cluster) ?? []
    list.push(r)
    byCluster.set(cluster, list)
  }
  // Cluster absteigend nach ihrem groessten Hebel (rows sind global sortiert).
  const clusterParts: string[] = []
  for (const [cluster, list] of byCluster) {
    const lines = [
      `### ${cluster}`,
      '',
      '| Nr | Titel | Eigene Wirkung bereinigt (kt) | Hebelwirkung (kt, Schaetzung) | Aktiviert (Top 3) |',
      '|---|---|---|---|---|',
    ]
    for (const r of list.slice(0, TOP_N_PER_CLUSTER)) {
      const activated = r.entry.activated
        .slice(0, TOP_ACTIVATED)
        .map((a) => `${label(args.infoByFileId.get(a.targetId), a.targetId)} (${Math.round(a.share * 100)} %)`)
        .join('; ')
      lines.push(
        `| ${r.info!.nr ?? '–'} | ${r.info!.title.replace(/\|/g, '/')} ` +
          `| ${typeof r.info!.ownValue === 'number' ? fmt(r.info!.ownValue) : '–'} ` +
          `| ${fmt(r.entry.leverage)} | ${activated || '–'} |`,
      )
    }
    clusterParts.push(lines.join('\n'))
  }

  const standNote = args.relationsStand
    ? `Beziehungs-Stand: ${args.relationsStand.slice(0, 10)} — der Katalog kann sich seither geaendert haben; ` +
      `eine Neuberechnung der Beziehungen ist teuer, ob sie sich lohnt, entscheidet der Anwender.`
    : 'Beziehungs-Stand unbekannt.'

  return (
    `\n\n## Hebel-Massnahmen (Enabler)\n\n` +
    `Enabler erben ANTEILIG die bereinigte CO2-Wirkung der Massnahmen, die sie ermoeglichen ` +
    `(1 Hop; mehrere Enabler teilen sich die Wirkung; Daempfung beta = ${fmt(args.beta)}). ` +
    `Die Hebelwirkung ist eine ZUSCHREIBUNGS-SCHAETZUNG und wird NIE zur eigenen Wirkung addiert ` +
    `— sonst wuerde dieselbe Einsparung doppelt gezaehlt. ${standNote}\n\n` +
    clusterParts.join('\n\n')
  )
}

/** Hinweis-Abschnitt, wenn (noch) keine Beziehungen berechnet wurden. */
const NO_RELATIONS_SECTION =
  `\n\n## Hebel-Massnahmen (Enabler)\n\n` +
  `Fuer diese Library sind keine berechneten Beziehungen vorhanden — zuerst ` +
  `"Beziehungen berechnen" ausfuehren, dann liefert der naechste Bericht die TOP-Hebel je Cluster.`

/** Laedt Kanten, rechnet Hebel, persistiert hebel_* und baut den Abschnitt. */
export async function runLeveragePass(args: LeveragePassArgs): Promise<LeveragePassResult> {
  const beta = args.beta ?? DEFAULT_LEVERAGE_BETA
  const edges = await getDocRelations(args.libraryId)
  if (edges.length === 0) {
    return { markdownSection: NO_RELATIONS_SECTION, enablers: 0, persisted: 0 }
  }
  const { computedAt } = await getLatestCatalogHash(args.libraryId)
  const relationsStand = computedAt ? computedAt.toISOString() : null

  const infoByFileId = new Map<string, DocInfo>()
  const nodes: Array<{ id: string; value?: number }> = []
  for (const d of args.items) {
    const fileId = d.fileId || d.id
    if (!fileId) continue
    const co2 = typeof d.co2_einsparung_kt === 'number' ? d.co2_einsparung_kt : undefined
    // Vererbt wird die STUFE-3-BEREINIGTE Wirkung; ohne Faktor naive CO2
    // (naive Summe bleibt Obergrenze, kein stilles Auslassen).
    const factor = args.factorCo2ByFileId.get(fileId)
    const ownValue = typeof co2 === 'number' ? co2 * (factor ?? 1) : undefined
    const clusterRaw = (d as unknown as Record<string, unknown>)[args.groupField]
    infoByFileId.set(fileId, {
      fileId,
      nr: typeof d.massnahme_nr === 'string' || typeof d.massnahme_nr === 'number' ? String(d.massnahme_nr) : undefined,
      title: d.shortTitle || d.title || d.fileName || 'Ohne Titel',
      cluster: typeof clusterRaw === 'string' && clusterRaw.length > 0 ? clusterRaw : 'Ohne Zuordnung',
      ownValue,
    })
    nodes.push({ id: fileId, value: ownValue })
  }

  const leverageByFileId = computeEnablerLeverage(
    nodes,
    edges.map((e) => ({ source: e.sourceFileId, target: e.targetFileId, weight: e.weight })),
    beta,
  )

  let persisted = 0
  for (const [fileId, entry] of leverageByFileId) {
    const ok = await setDocLeverage(args.libraryKey, fileId, {
      hebelCo2Kt: entry.leverage,
      aktiviert: entry.activated.slice(0, TOP_ACTIVATED).map((a) => label(infoByFileId.get(a.targetId), a.targetId)),
      beta,
      stand: args.stand,
      relationsStand,
    })
    if (ok) persisted += 1
  }

  const markdownSection = buildLeverageSection({ infoByFileId, leverageByFileId, beta, relationsStand })
  return { markdownSection, enablers: leverageByFileId.size, persisted }
}
