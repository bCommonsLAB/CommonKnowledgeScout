'use client'

/**
 * DocGraph — generischer Beziehungs-/Metadaten-Graph als dritter Galerie-Modus.
 *
 * Orchestriert die Kantenquellen-Auswahl, hält den LIVE-Editier-State (Felder,
 * Modus, minShared, colorMap — ephemer, ohne Config-Persistenz) und rendert
 * Selector + Live-Controls + Szene + Legende. Knoten = die übergebenen,
 * gefilterten Dokumente; Klick öffnet die bestehende Detailansicht.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DocCardMeta } from '@/lib/gallery/types'
import type { GalleryGraphConfig } from '@/types/library'
import { useTranslation } from '@/lib/i18n/hooks'
import { useSharedMetaEdges } from '@/hooks/gallery/use-shared-meta-edges'
import { useSimilarityEdges } from '@/hooks/gallery/use-similarity-edges'
import { useRelationsEdges } from '@/hooks/gallery/use-relations-edges'
import { EdgeSourceSelector } from './edge-source-selector'
import { GraphControls } from './graph-controls'
import { DocGraphScene } from './doc-graph-scene'
import { DocGraphLegend } from './doc-graph-legend'
import { DocGraphRelationsBar } from './doc-graph-relations-bar'
import { readString } from './graph-encodings'
import type { EdgeSourceSelection } from './graph-types'

interface DocGraphProps {
  docs: DocCardMeta[]
  graph: GalleryGraphConfig
  onOpenDocument: (doc: DocCardMeta) => void
  /** Optionale Anzeigenamen je meta-Feld (aus den Facetten-Definitionen). */
  fieldLabels?: Record<string, string>
  /** Library-ID — für Quelle C (Ähnlichkeit) zum Laden der Nachbarn nötig. */
  libraryId?: string
  /**
   * Nur Owner: aktuelle Live-Einstellung als Library-Default speichern. Fehlt
   * der Callback (Nicht-Owner), wird kein Speichern-Button gezeigt.
   */
  onSaveDefault?: (graph: GalleryGraphConfig) => Promise<void> | void
  /** Owner/Co-Creator: berechnete Beziehungen (Quelle A) neu berechnen. */
  canManageRelations?: boolean
}

/** Default-Nachbarzahl je Knoten für Quelle C, wenn nicht konfiguriert. */
const DEFAULT_SIMILARITY_TOP_K = 6

const EXCLUDE_FIELDS = new Set([
  'id', 'fileId', 'slug', 'title', 'shortTitle', 'fileName', 'sourcePath',
  'sourceFileName', 'coverImageUrl', 'coverThumbnailUrl', 'date', 'upsertedAt',
  'bewertung_stand', 'bewertung_modell', 'detailViewType', 'docType',
])

export function DocGraph({ docs, graph, onOpenDocument, fieldLabels, libraryId, onSaveDefault, canManageRelations }: DocGraphProps) {
  const { t } = useTranslation()
  const sharedMeta = graph.edgeSources?.sharedMeta
  const defaultMode = sharedMeta?.mode ?? 'projection'
  const configFields = useMemo(() => sharedMeta?.fields?.filter((f) => f.length > 0) ?? [], [sharedMeta?.fields])

  // Quelle C ist generisch immer verfügbar (Vektoren existieren ohnehin pro
  // Dokument, Zielbild §5.3) — sie braucht KEINE Feld-Konfiguration wie Quelle B.
  // Daher standardmäßig aktiv; nur explizit `enabled: false` blendet sie aus.
  // Libraries ohne Embeddings zeigen dann sauber "Keine Verbindungen".
  const similarityEnabled = graph.edgeSources?.similarity?.enabled !== false
  const similarityTopK = graph.edgeSources?.similarity?.topK ?? DEFAULT_SIMILARITY_TOP_K

  // Quelle A (berechnete Beziehungen, Welle 4): nur aktiv, wenn explizit
  // konfiguriert (`edgeSources.relations.enabled`), da sie einen Vorberechnungs-
  // Lauf braucht. Kein impliziter Default.
  const relationsEnabled = graph.edgeSources?.relations?.enabled === true

  // Anfangsauswahl: Config-Default respektieren, sonst erstes sharedMeta-Feld,
  // sonst (falls aktiv) Ähnlichkeit. Kein Silent Fallback auf eine inaktive Quelle.
  const initialSelection = useMemo<EdgeSourceSelection | null>(() => {
    if (graph.defaultEdgeSource === 'relations' && relationsEnabled) return { kind: 'relations' }
    if (graph.defaultEdgeSource === 'similarity' && similarityEnabled) return { kind: 'similarity' }
    if (configFields.length) return { kind: 'sharedMeta', field: configFields[0], mode: defaultMode }
    if (similarityEnabled) return { kind: 'similarity' }
    if (relationsEnabled) return { kind: 'relations' }
    return null
  }, [graph.defaultEdgeSource, similarityEnabled, relationsEnabled, configFields, defaultMode])

  // Live-Editier-State (ephemer; aus der Config geseedet, beim Library-Wechsel neu).
  const [liveFields, setLiveFields] = useState<string[]>(configFields)
  const [liveColorMap, setLiveColorMap] = useState<Record<string, string>>(graph.colorMap ?? {})
  const [minShared, setMinShared] = useState<number>(sharedMeta?.minShared ?? 1)
  const [selection, setSelection] = useState<EdgeSourceSelection | null>(initialSelection)
  useEffect(() => {
    setLiveFields(configFields)
    setLiveColorMap(graph.colorMap ?? {})
    setMinShared(sharedMeta?.minShared ?? 1)
    setSelection(initialSelection)
  }, [graph, configFields, sharedMeta?.minShared, initialSelection])

  // sharedMeta-Auswahl gültig halten, wenn Felder live hinzugefügt/entfernt
  // werden. Ähnlichkeits-/Relations-Auswahl bleibt davon unberührt.
  useEffect(() => {
    if (selection?.kind === 'sharedMeta' && !liveFields.includes(selection.field)) {
      if (liveFields.length) setSelection({ kind: 'sharedMeta', field: liveFields[0], mode: selection.mode })
      else if (similarityEnabled) setSelection({ kind: 'similarity' })
      else setSelection(null)
    } else if (!selection) {
      if (liveFields.length) setSelection({ kind: 'sharedMeta', field: liveFields[0], mode: defaultMode })
      else if (similarityEnabled) setSelection({ kind: 'similarity' })
    }
  }, [liveFields, selection, defaultMode, similarityEnabled])

  const isSimilarity = selection?.kind === 'similarity'
  const isRelations = selection?.kind === 'relations'

  // Vorschläge: kategorische/Array-meta-Keys aus den Docs + Facetten-Felder.
  const availableFields = useMemo(() => {
    const set = new Set<string>([...configFields, ...Object.keys(fieldLabels ?? {})])
    for (const d of docs.slice(0, 100)) {
      for (const [k, v] of Object.entries(d as unknown as Record<string, unknown>)) {
        if (typeof v === 'string' && v.length > 0) set.add(k)
        else if (Array.isArray(v) && v.some((x) => typeof x === 'string')) set.add(k)
      }
    }
    return [...set].filter((k) => !EXCLUDE_FIELDS.has(k) && !k.endsWith('_begruendung')).sort()
  }, [docs, fieldLabels, configFields])

  const colorValues = useMemo(() => {
    if (!graph.colorField) return []
    const set = new Set<string>()
    for (const d of docs) { const v = readString(d, graph.colorField); if (v) set.add(v) }
    return [...set].slice(0, 50)
  }, [docs, graph.colorField])

  // Container messen (ResizeObserver) für das SVG-Layout.
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) setSize({ width: Math.floor(r.width), height: Math.floor(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const activeField = selection?.kind === 'sharedMeta' ? selection.field : ''
  const activeMode = selection?.kind === 'sharedMeta' ? selection.mode : defaultMode
  // Beide Quellen-Hooks laufen immer (Rules of Hooks); aktiv ist nur eine.
  const sharedData = useSharedMetaEdges({
    docs, field: activeField, mode: activeMode, minShared,
    maxEdgesPerNode: graph.maxEdgesPerNode, maxEdgesTotal: graph.maxEdgesTotal,
  })
  const similarity = useSimilarityEdges({
    docs, libraryId, enabled: isSimilarity, topK: similarityTopK,
    minWeight: graph.minWeight,
    maxEdgesPerNode: graph.maxEdgesPerNode, maxEdgesTotal: graph.maxEdgesTotal,
  })
  const relations = useRelationsEdges({
    docs, libraryId, enabled: isRelations,
    minWeight: graph.minWeight,
    maxEdgesPerNode: graph.maxEdgesPerNode, maxEdgesTotal: graph.maxEdgesTotal,
  })
  const data = isRelations ? relations.data : isSimilarity ? similarity.data : sharedData

  return (
    <div className="flex h-full min-h-[60vh] flex-col gap-2">
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {selection && (
            <EdgeSourceSelector
              selection={selection}
              onChange={setSelection}
              sharedMetaFields={liveFields}
              fieldLabels={fieldLabels}
              similarityEnabled={similarityEnabled}
              relationsEnabled={relationsEnabled}
            />
          )}
          {/* Live-Editor (Felder/Modus/Farben) ist sharedMeta-spezifisch. */}
          {!isSimilarity && !isRelations && (
            <GraphControls
              fields={liveFields}
              onFieldsChange={setLiveFields}
              availableFields={availableFields}
              fieldLabels={fieldLabels}
              mode={activeMode}
              onModeChange={(mode) => setSelection((s) => (s?.kind === 'sharedMeta' ? { ...s, mode } : s))}
              minShared={minShared}
              onMinSharedChange={setMinShared}
              colorField={graph.colorField}
              colorValues={colorValues}
              colorMap={liveColorMap}
              onColorMapChange={setLiveColorMap}
              onSave={onSaveDefault ? () => onSaveDefault({
                ...graph,
                colorMap: liveColorMap,
                defaultEdgeSource: 'sharedMeta',
                edgeSources: {
                  ...graph.edgeSources,
                  sharedMeta: {
                    ...(graph.edgeSources?.sharedMeta ?? {}),
                    enabled: true,
                    fields: liveFields,
                    mode: activeMode,
                    minShared,
                  },
                },
              }) : undefined}
            />
          )}
          {/* Quelle A: Staleness-Hinweis + Recompute (Owner/Co-Creator). */}
          {isRelations && (
            <DocGraphRelationsBar
              libraryId={libraryId}
              canManage={canManageRelations}
              stale={relations.stale}
              computedAt={relations.computedAt}
            />
          )}
        </div>
      </div>
      <div ref={containerRef} className="relative flex-1 overflow-hidden rounded-md border bg-muted/20">
        {isRelations ? (
          relations.loading ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
              {t('gallery.graph.relationsLoading')}
            </div>
          ) : relations.error ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md text-center text-sm text-destructive">
              {t('gallery.graph.relationsError')}: {relations.error}
            </div>
          ) : size.width > 0 && data.links.length === 0 ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md text-center text-sm text-muted-foreground">
              {t('gallery.graph.relationsNoEdges')}
            </div>
          ) : null
        ) : isSimilarity ? (
          similarity.loading ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
              {t('gallery.graph.similarityLoading')}
            </div>
          ) : similarity.error ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md text-center text-sm text-destructive">
              {t('gallery.graph.similarityError')}: {similarity.error}
            </div>
          ) : size.width > 0 && data.links.length === 0 ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {t('gallery.graph.noEdges')}
            </div>
          ) : null
        ) : liveFields.length === 0 ? (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">
            {t('gallery.graph.noFields')}
          </div>
        ) : size.width > 0 && data.links.length === 0 ? (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {t('gallery.graph.noEdges')}
          </div>
        ) : null}
        {size.width > 0 && (isRelations || isSimilarity || liveFields.length > 0) && (
          <DocGraphScene
            data={data}
            docs={docs}
            encodings={{
              sizeField: graph.sizeField,
              colorField: graph.colorField,
              opacityField: graph.opacityField,
              colorMap: liveColorMap,
            }}
            width={size.width}
            height={size.height}
            onOpenDocument={onOpenDocument}
          />
        )}
        <DocGraphLegend
          sizeField={graph.sizeField}
          colorField={graph.colorField}
          opacityField={graph.opacityField}
          colorMap={liveColorMap}
          nodeCount={data.nodes.length}
          edgeCount={data.links.length}
        />
      </div>
    </div>
  )
}
