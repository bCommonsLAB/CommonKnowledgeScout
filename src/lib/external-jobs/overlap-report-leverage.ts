/**
 * @fileoverview Enabler-Hebel-Pass des Overlap-Berichts (Plan summen-und-
 * synergie-aggregation, Stufe 4, Todo enabler-leverage-concept).
 *
 * @description
 * Deterministisch (kein LLM): laedt die Computed-Relations-Kanten, rechnet je
 * Enabler die anteilig geerbte, Stufe-3-bereinigte CO2-Wirkung
 * (computeEnablerLeverage, beta-Daempfung, 1 Hop), persistiert die
 * hebel_*-Keys und liefert TOP-N je Cluster als Markdown-Tabellen
 * ({{hebel_tabellen}}) UND strukturiert (context-JSON) — das Bericht-LAYOUT
 * inkl. Erklaertexten lebt seit 2026-07-11 im editierbaren Template
 * (report-templates.ts). Staleness der Kanten ist NUR eine Warnung —
 * Neuberechnung ist teuer, der Anwender entscheidet (Entscheid 2026-07-09).
 *
 * @usedIn
 * - src/lib/external-jobs/phase-enabler-report.ts
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

/** Eine Hebel-Zeile fuer Kontext-JSON und Tabelle. */
export interface LeverageClusterRow {
  nr?: string
  titel: string
  /** Eigene, Stufe-3-bereinigte Wirkung (kt); undefined = ohne CO2-Angabe. */
  eigene?: number
  /** Hebelwirkung (kt, Zuschreibungs-Schaetzung). */
  hebel: number
  /** Wichtigste aktivierte Massnahmen ("Nr. X Titel (NN %)"). */
  aktiviert: string[]
}

export interface LeverageCluster {
  cluster: string
  rows: LeverageClusterRow[]
}

export interface LeveragePassResult {
  /** Markdown-Tabellen je Cluster ({{hebel_tabellen}} im Bericht-Template). */
  tablesMarkdown: string
  /** TOP-Hebel je Cluster, strukturiert (context-JSON des LLM-Passes). */
  clusters: LeverageCluster[]
  /** Anzahl Enabler (>= 1 gueltige Kante). */
  enablers: number
  /** Anzahl persistierter hebel_*-Docs. */
  persisted: number
  /** ISO-Zeitstempel der zugrunde liegenden Relations-Berechnung. */
  relationsStand: string | null
  /** Verwendete Kredit-Daempfung ({{beta}} im Bericht-Template). */
  beta: number
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

/** TOP-Hebel je Cluster strukturiert einsammeln (pure, testbar). */
export function collectLeverageClusters(args: {
  infoByFileId: Map<string, DocInfo>
  leverageByFileId: Map<string, LeverageEntry>
}): LeverageCluster[] {
  const rows = [...args.leverageByFileId.entries()]
    .map(([fileId, entry]) => ({ fileId, entry, info: args.infoByFileId.get(fileId) }))
    .filter((r) => r.info)
    .sort((a, b) => b.entry.leverage - a.entry.leverage)

  const byCluster = new Map<string, LeverageClusterRow[]>()
  // Cluster-Reihenfolge = groesster Hebel zuerst (rows sind global sortiert).
  for (const r of rows) {
    const cluster = r.info!.cluster
    const list = byCluster.get(cluster) ?? []
    if (list.length < TOP_N_PER_CLUSTER) {
      list.push({
        nr: r.info!.nr,
        titel: r.info!.title,
        eigene: r.info!.ownValue,
        hebel: r.entry.leverage,
        aktiviert: r.entry.activated
          .slice(0, TOP_ACTIVATED)
          .map((a) => `${label(args.infoByFileId.get(a.targetId), a.targetId)} (${Math.round(a.share * 100)} %)`),
      })
    }
    byCluster.set(cluster, list)
  }
  return [...byCluster.entries()].map(([cluster, clusterRows]) => ({ cluster, rows: clusterRows }))
}

/** Markdown-Tabellen je Cluster ({{hebel_tabellen}}; Erklaertext lebt im Template). */
export function buildLeverageTables(clusters: LeverageCluster[]): string {
  const parts: string[] = []
  for (const { cluster, rows } of clusters) {
    const lines = [
      `### ${cluster}`,
      '',
      '| Nr | Titel | Eigene Wirkung bereinigt (kt) | Hebelwirkung (kt, Schaetzung) | Aktiviert (Top 3) |',
      '|---|---|---|---|---|',
    ]
    for (const r of rows) {
      lines.push(
        `| ${r.nr ?? '–'} | ${r.titel.replace(/\|/g, '/')} ` +
          `| ${typeof r.eigene === 'number' ? fmt(r.eigene) : '–'} ` +
          `| ${fmt(r.hebel)} | ${r.aktiviert.join('; ') || '–'} |`,
      )
    }
    parts.push(lines.join('\n'))
  }
  return parts.join('\n\n')
}

/** Laedt Kanten, rechnet Hebel, persistiert hebel_* und liefert Tabellen + Cluster. */
export async function runLeveragePass(args: LeveragePassArgs): Promise<LeveragePassResult> {
  const beta = args.beta ?? DEFAULT_LEVERAGE_BETA
  const edges = await getDocRelations(args.libraryId)
  if (edges.length === 0) {
    throw new Error(
      'Enabler-Bericht: keine berechneten Beziehungen vorhanden — zuerst "Beziehungen berechnen" ausfuehren.',
    )
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

  const clusters = collectLeverageClusters({ infoByFileId, leverageByFileId })
  return {
    tablesMarkdown: buildLeverageTables(clusters),
    clusters,
    enablers: leverageByFileId.size,
    persisted,
    relationsStand,
    beta,
  }
}
