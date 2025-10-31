'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { activeLibraryIdAtom, librariesAtom } from '@/atoms/library-atom'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
import { FileLogger } from '@/lib/debug/logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, FileText, Calendar, User, MapPin, ExternalLink, Filter, ChevronLeft, MessageSquare, LayoutGrid, BookOpen } from 'lucide-react'
import { ChatPanel } from '@/components/library/chat/chat-panel'
import { IngestionBookDetail } from '@/components/library/ingestion-book-detail'
import { IngestionSessionDetail } from '@/components/library/ingestion-session-detail'
import { EventDetailsAccordion } from '@/components/library/event-details-accordion'
import type { ChatResponse } from '@/types/chat-response'
import type { SessionDetailData } from '@/components/library/session-detail'

interface DocCardMeta {
  id: string
  fileId?: string
  fileName?: string
  title?: string
  shortTitle?: string
  authors?: string[]
  year?: number | string
  region?: string
  upsertedAt?: string
}

interface ChapterInfo {
  title: string
  summary?: string
  pageStart?: number
  pageEnd?: number
}

interface DetailDoc extends DocCardMeta {
  chapters?: ChapterInfo[]
  pdfUrl?: string
}

interface FacetOption { value: string | number; count: number }

interface StatsTotals { docs: number; chunks: number }
interface StatsResponse { ok?: boolean; indexExists?: boolean; totals?: StatsTotals }

function FacetGroup({ label, options, selected, onChange }: { label: string; options: Array<string | number | FacetOption>; selected: Array<string>; onChange: (values: string[]) => void }) {
  const isFacetOption = (o: unknown): o is FacetOption => !!o && typeof o === 'object' && 'value' in (o as Record<string, unknown>)
  const normalized: FacetOption[] = options.map(o => (isFacetOption(o) ? o : { value: o as (string | number), count: 0 }))
  const values = new Set(selected)
  function toggle(v: string) {
    const next = new Set(values)
    if (next.has(v)) next.delete(v); else next.add(v)
    onChange(Array.from(next))
  }
  return (
    <div className='border rounded p-2'>
      <div className='flex items-center gap-2 mb-2 min-w-0'>
        <div className='text-sm font-medium truncate flex-1 min-w-0'>{label}</div>
        <button className='text-xs text-muted-foreground hover:underline shrink-0' onClick={() => onChange([])}>Zurücksetzen</button>
      </div>
      <div className='max-h-40 overflow-auto space-y-1'>
        {normalized.map((o) => {
          const v = String(o.value)
          const active = values.has(v)
          return (
            <button
              key={v}
              type='button'
              onClick={() => toggle(v)}
              className={`w-full grid grid-cols-[1fr_auto] items-center rounded px-2 py-1 text-left text-sm ${active ? 'bg-primary/10' : 'hover:bg-muted'} min-w-0`}
            >
              <span title={v} className='truncate min-w-0 pr-2'>{v}</span>
              <span className='text-xs text-muted-foreground justify-self-end ml-2 min-w-[2.5rem] text-right tabular-nums'>{o.count > 0 ? o.count : ''}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function GalleryClient() {
  const libraryId = useAtomValue(activeLibraryIdAtom)
  const libraries = useAtomValue(librariesAtom)
  const [docs, setDocs] = useState<DocCardMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<DetailDoc | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(true)
  const [showChatPanel, setShowChatPanel] = useState(true)
  const [showGalleryPanel, setShowGalleryPanel] = useState(true)
  const [filters, setFilters] = useAtom(galleryFiltersAtom)
  const [showReferenceLegend, setShowReferenceLegend] = useState(false)
  const chatReferences = useAtomValue(chatReferencesAtom)
  const [facetDefs, setFacetDefs] = useState<Array<{ metaKey: string; label: string; type: string; options: Array<{ value: string; count: number }> }>>([])
  // Stats werden aktuell nicht gerendert; um Linter zu erfüllen, Status lokal halten
  const [, setStats] = useState<StatsResponse | null>(null)
  // Detail-View-Typ aus Library-Config (default: 'book')
  const [detailViewType, setDetailViewType] = useState<'book' | 'session'>('book')
  // Session-Daten für Header-Button
  const [sessionUrl, setSessionUrl] = useState<string | undefined>(undefined)
  const [sessionTitle, setSessionTitle] = useState<string | undefined>(undefined)
  const [sessionData, setSessionData] = useState<SessionDetailData | undefined>(undefined)

  // Hinweis: libraries derzeit ungenutzt – bewusst markiert
  void libraries

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!libraryId) return
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        Object.entries(filters as Record<string, string[] | undefined>).forEach(([k, arr]) => {
          // fileId-Filter nicht an Docs-API senden (nur für Client-seitige Filterung)
          if (k === 'fileId') return
          if (Array.isArray(arr)) for (const v of arr) params.append(k, String(v))
        })
        const url = `/api/chat/${encodeURIComponent(libraryId)}/docs${params.toString() ? `?${params.toString()}` : ''}`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Laden der Dokumente')
        if (!cancelled && Array.isArray(data?.items)) setDocs(data.items as DocCardMeta[])
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
        if (!cancelled) setError(msg)
        FileLogger.error('Gallery', 'Docs laden fehlgeschlagen', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [libraryId, filters])

  // Event-Listener für 'open-document-detail' (von Chat-Panel)
  useEffect(() => {
    const handleOpenDocument = (event: Event) => {
      const customEvent = event as CustomEvent<{ fileId: string; fileName?: string; libraryId: string }>
      const { fileId } = customEvent.detail || {}
      
      if (!fileId || !libraryId) return
      
      // Finde Dokument in der aktuellen Liste
      const doc = docs.find(d => d.fileId === fileId || d.id === fileId)
      
      if (doc) {
        // Öffne Detailansicht
        openDocDetail(doc)
      } else {
        // Dokument nicht gefunden → lade es neu und öffne dann
        // Setze Filter auf fileId, um Dokument zu laden
        setFilters({ fileId: [fileId] })
        // Warte kurz und öffne dann (nach dem nächsten Load)
        setTimeout(() => {
          const docAfterLoad = docs.find(d => d.fileId === fileId || d.id === fileId)
          if (docAfterLoad) {
            openDocDetail(docAfterLoad)
          }
        }, 500)
      }
    }
    
    window.addEventListener('open-document-detail', handleOpenDocument)
    return () => {
      window.removeEventListener('open-document-detail', handleOpenDocument)
    }
  }, [docs, libraryId, setFilters])

  // Event-Listener für 'show-reference-legend' (von Chat-Panel)
  useEffect(() => {
    const handleShowLegend = (event: Event) => {
      const customEvent = event as CustomEvent<{ references: ChatResponse['references']; libraryId: string }>
      const { references: refs } = customEvent.detail || {}
      
      if (!refs || refs.length === 0) return
      
      // Zeige Legende an
      setShowReferenceLegend(true)
      
      // Filtere Dokumente nach Referenzen
      const fileIds = Array.from(new Set(refs.map(r => r.fileId)))
      setFilters({ fileId: fileIds })
      
      // Scroll zur Gallery
      const galleryElement = document.querySelector('[data-gallery-section]')
      if (galleryElement) {
        galleryElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    
    window.addEventListener('show-reference-legend', handleShowLegend)
    return () => {
      window.removeEventListener('show-reference-legend', handleShowLegend)
    }
  }, [setFilters])

  // Facetten-Definitionen + Optionen laden + detailViewType aus Config
  useEffect(() => {
    let cancelled = false
    async function loadFacets() {
      if (!libraryId) return
      try {
        // Filter als Query-Parameter mitgeben, damit Facetten-Counts korrekt berechnet werden
        const params = new URLSearchParams()
        Object.entries(filters as Record<string, string[] | undefined>).forEach(([k, arr]) => {
          // fileId-Filter nicht an Facetten-API senden (nur für Client-seitige Filterung)
          if (k === 'fileId') return
          if (Array.isArray(arr)) for (const v of arr) params.append(k, String(v))
        })
        const url = `/api/chat/${encodeURIComponent(libraryId)}/facets${params.toString() ? `?${params.toString()}` : ''}`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) return
        if (!cancelled) setFacetDefs(Array.isArray(data?.facets) ? data.facets as Array<{ metaKey: string; label: string; type: string; options: Array<{ value: string; count: number }> }> : [])
      } catch {
        // ignorieren
      }
    }
    async function loadConfig() {
      if (!libraryId) {
        console.warn('[Gallery] Kein libraryId - Config-Load abgebrochen')
        return
      }
      try {
        const url = `/api/chat/${encodeURIComponent(libraryId)}/config`
        console.log('[Gallery] Lade Config für Library:', libraryId)
        console.log('[Gallery] Request URL:', url)
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        // Gallery-Config ist unter data.config.gallery, NICHT data.gallery!
        const galleryConfig = (data?.config as { gallery?: { detailViewType?: string } })?.gallery
        console.log('[Gallery] Config Response:', { 
          ok: res.ok, 
          status: res.status,
          fullData: JSON.stringify(data, null, 2),
          gallery: galleryConfig,
          detailViewType: galleryConfig?.detailViewType
        })
        if (!res.ok) {
          console.warn('[Gallery] Config Response nicht OK:', res.status, res.statusText)
          return
        }
        const viewType = galleryConfig?.detailViewType
        console.log('[Gallery] DetailViewType aus Config:', viewType)
        if (!cancelled && (viewType === 'book' || viewType === 'session')) {
          console.log('[Gallery] ✅ Setze detailViewType auf:', viewType)
          setDetailViewType(viewType)
        } else {
          console.log('[Gallery] ⚠️ Ungültiger oder fehlender detailViewType, verwende default: book')
        }
      } catch (e) {
        console.error('[Gallery] Fehler beim Laden der Config:', e)
        // ignorieren, default 'book' bleibt
      }
    }
    loadFacets()
    loadConfig()
    return () => { cancelled = true }
  }, [libraryId, filters])

  // Stats laden (indizierte/transformierte Dokumente insgesamt)
  useEffect(() => {
    let cancelled = false
    async function loadStats() {
      if (!libraryId) return
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/stats`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) return
        if (!cancelled) setStats(data as StatsResponse)
      } catch {
        // optional: ignorieren
      }
    }
    loadStats()
    return () => { cancelled = true }
  }, [libraryId])

  function openDocDetail(doc: DocCardMeta) {
    const detail: DetailDoc = { ...doc }
    setSelected(detail)
    void (async () => {
      try {
        if (!doc.fileId || !libraryId) return
        // PERFORMANCE: Verwende nur den schnellen doc-meta Endpunkt (nur MongoDB, kein Pinecone)
        // Alle benötigten Daten (inkl. chapters) sind bereits in MongoDB verfügbar
        const url = `/api/chat/${encodeURIComponent(libraryId)}/doc-meta?fileId=${encodeURIComponent(doc.fileId)}`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok || !data?.exists) return
        
        // Extrahiere Kapitel aus der Antwort
        // Kapitel können sowohl im Top-Level chapters-Feld als auch in docMetaJson.chapters sein
        let chapters: ChapterInfo[] | undefined
        
        const mapChapters = (raw: unknown): ChapterInfo[] | undefined => {
          if (!Array.isArray(raw)) return undefined
          const out = raw
            .map((c: unknown) => {
              if (!c || typeof c !== 'object') return undefined
              const t = (c as { title?: unknown }).title
              const s = (c as { summary?: unknown }).summary
              // Unterstütze sowohl pageStart/pageEnd als auch startPage/endPage
              const ps = (c as { pageStart?: unknown; startPage?: unknown }).pageStart ?? (c as { startPage?: unknown }).startPage
              const pe = (c as { pageEnd?: unknown; endPage?: unknown }).pageEnd ?? (c as { endPage?: unknown }).endPage
              return {
                title: typeof t === 'string' && t ? t : 'Kapitel',
                summary: typeof s === 'string' ? s : undefined,
                pageStart: typeof ps === 'number' ? ps : undefined,
                pageEnd: typeof pe === 'number' ? pe : undefined,
              } as ChapterInfo
            })
            .filter((v): v is ChapterInfo => !!v)
          return out && out.length > 0 ? out : undefined
        }
        
        // 1) Versuche Top-Level chapters Feld
        if (data.chapters) {
          chapters = mapChapters(data.chapters)
        }
        
        // 2) Falls leer: versuche docMetaJson.chapters
        if (!chapters && data.docMetaJson && typeof data.docMetaJson === 'object') {
          const docMeta = data.docMetaJson as Record<string, unknown>
          if (docMeta.chapters) {
            chapters = mapChapters(docMeta.chapters)
          }
        }
        
        if (chapters && chapters.length > 0) {
          setSelected(s => (s ? { ...s, chapters } : s))
        }
      } catch {
        // optional: ignorieren
      }
    })()
  }

  function openPDFAtPage(_pdfUrl: string, _page: number) {
    // Parameter bewusst "benutzt", um Linter zu erfüllen
    void _pdfUrl;
    void _page;
  }

  // Dynamische Facettensteuerung
  function setFacet(name: string, values: string[]) {
    setFilters(f => {
      const next = { ...(f as Record<string, string[] | undefined>) }
      next[name] = values.length ? values : undefined
      return next as typeof f
    })
  }

  const isFiltered = Object.entries(filters as Record<string, string[] | undefined>).some(([k, arr]) => {
    // fileId-Filter zählt nicht als Facetten-Filter
    if (k === 'fileId') return false
    return Array.isArray(arr) && arr.length > 0
  })

  // Filtere Dokumente nach fileId (wenn Filter gesetzt)
  const filteredDocs = useMemo(() => {
    const fileIdFilter = filters.fileId
    if (!fileIdFilter || !Array.isArray(fileIdFilter) || fileIdFilter.length === 0) {
      return docs
    }
    return docs.filter(d => fileIdFilter.includes(d.fileId || '') || fileIdFilter.includes(d.id || ''))
  }, [docs, filters])

  // Statusanzeigen werden im rechten Panel gerendert (keine frühen Returns),
  // damit der Facettenbereich immer sichtbar bleibt und Filter zurückgesetzt werden können.

  return (
    <div className='h-full overflow-hidden flex flex-col'>
      <div className='mb-6 flex items-center justify-start gap-2 flex-shrink-0'>
        <div className='flex items-center gap-1'>
          <Button
            variant={showFilterPanel ? 'default' : 'outline'}
            size='icon'
            className='h-7 w-7'
            aria-pressed={showFilterPanel}
            onClick={() => {
              if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
                setShowFilters(true)
              } else {
                setShowFilterPanel(v => !v)
              }
            }}
            title='Filter anzeigen/ausblenden'
          >
            <Filter className='h-3 w-3' />
          </Button>
          <Button
            variant={showChatPanel ? 'default' : 'outline'}
            size='icon'
            className='h-7 w-7'
            aria-pressed={showChatPanel}
            onClick={() => setShowChatPanel(v => {
              const next = !v
              if (!next && !showGalleryPanel) return v
              return next
            })}
            title='Chat anzeigen/ausblenden'
          >
            <MessageSquare className='h-3 w-3' />
          </Button>
          <Button
            variant={showGalleryPanel ? 'default' : 'outline'}
            size='icon'
            className='h-7 w-7'
            aria-pressed={showGalleryPanel}
            onClick={() => setShowGalleryPanel(v => {
              const next = !v
              if (!next && !showChatPanel) return v
              return next
            })}
            title='Galerie anzeigen/ausblenden'
          >
            <LayoutGrid className='h-3 w-3' />
          </Button>
        </div>
        <div>
          <div className='text-muted-foreground text-sm'>
            {isFiltered
              ? `Durchsuchen und befragen Sie ${docs.length.toLocaleString('de-DE')} gefilterten Dokumente`
              : `Durchsuchen und befragen Sie ${docs.length.toLocaleString('de-DE')} Dokumente`}
          </div>
        </div>
      </div>

      <div className='flex flex-row gap-6 flex-1 min-h-0'>
        {showFilterPanel ? (
          <aside className='hidden lg:flex flex-col w-[16.666%] flex-shrink-0'>
            <div className='rounded border p-3 space-y-3 overflow-y-auto overflow-x-hidden bg-background h-full'>
              <div className='font-medium flex items-center gap-2'><Filter className='h-4 w-4' /> Filter</div>
              <div className='grid gap-2'>
                {facetDefs.filter(d => d).map(def => {
                  const cols = (def as { columns?: number })?.columns || 1
                  return (
                    <div key={def.metaKey} className={cols === 2 ? 'grid grid-cols-2 gap-2' : ''}>
                      <FacetGroup
                        label={def.label || def.metaKey}
                        options={def.options}
                        selected={(filters as Record<string, string[] | undefined>)[def.metaKey] || []}
                        onChange={(vals: string[]) => setFacet(def.metaKey, vals)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </aside>
        ) : null}

        {showChatPanel && showGalleryPanel ? (
          <>
            <section className="flex-1 flex flex-col min-h-0">
              <ChatPanel libraryId={libraryId} variant='compact' />
            </section>

            <section className="flex-1 flex flex-col min-h-0" data-gallery-section>
                  {/* Flex-Container mit fester Höhe für ScrollArea */}
                  <div className="flex flex-col h-full min-h-0">
                    {/* Legende und Verwendete Dokumente - außerhalb ScrollArea */}
                    {showReferenceLegend && chatReferences.length > 0 && (
                      <div className="mb-6 rounded border bg-muted/30 p-4 shrink-0">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Legende und Verwendete Dokumente
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowReferenceLegend(false)
                            setFilters({} as Record<string, string[]>)
                          }}
                          className="h-7 text-xs"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Schließen
                        </Button>
                      </div>
                      
                      {/* Legende: Nummer-Zuordnung */}
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-2">Legende (Nummer → Dokument/Abschnitt):</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                          {chatReferences.map((ref) => (
                            <div
                              key={ref.number}
                              className="flex items-start gap-2 text-xs p-2 rounded bg-background border hover:bg-muted/50"
                            >
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] shrink-0 font-mono">
                                [{ref.number}]
                              </Badge>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-[11px] mb-0.5">
                                  {ref.fileName || ref.fileId.split('/').pop() || ref.fileId.slice(0, 25)}
                                </div>
                                <div className="text-[10px] text-muted-foreground leading-relaxed">
                                  {ref.description}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* ScrollArea für Dokumentenliste - nimmt den restlichen Platz ein */}
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="pr-4">
                      {/* Zustände im rechten Panel anzeigen, damit Facetten links erhalten bleiben */}
                      {!libraryId ? (
                        <div className='text-sm text-muted-foreground'>Keine aktive Bibliothek.</div>
                      ) : error ? (
                        <div className='text-sm text-destructive'>{error}</div>
                      ) : loading ? (
                        <div className='text-sm text-muted-foreground'>Lade Dokumente…</div>
                      ) : docs.length === 0 ? (
                        <div className='flex flex-col items-start gap-3 text-sm text-muted-foreground'>
                          <div>Keine Dokumente gefunden.</div>
                          <Button
                            variant='secondary'
                            onClick={() => setFilters({} as Record<string, string[]>) }
                          >
                            Filter zurücksetzen
                          </Button>
                        </div>
                      ) : (
                        <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'>
                      {filteredDocs.map((pdf) => (
                        <Card
                          key={pdf.id}
                          className='cursor-pointer hover:shadow-lg transition-shadow duration-200'
                          onClick={() => openDocDetail(pdf)}
                        >
                          <CardHeader>
                            <div className='flex items-start justify-between'>
                              <FileText className='h-8 w-8 text-primary mb-2' />
                              {pdf.year ? <Badge variant='secondary'>{String(pdf.year)}</Badge> : null}
                            </div>
                            <CardTitle className='text-lg line-clamp-2'>{pdf.shortTitle || pdf.title || pdf.fileName || 'Dokument'}</CardTitle>
                            <CardDescription className='line-clamp-2'>{pdf.title || pdf.fileName}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className='space-y-2'>
                              {Array.isArray(pdf.authors) && pdf.authors.length > 0 ? (
                                <div className='flex items-center text-sm text-muted-foreground'>
                                  <User className='h-4 w-4 mr-2' />
                                  <span className='line-clamp-1'>
                                    {pdf.authors[0]}
                                    {pdf.authors.length > 1 ? ` +${pdf.authors.length - 1} weitere` : ''}
                                  </span>
                                </div>
                              ) : null}
                              {pdf.region ? (
                                <div className='flex items-center text-sm text-muted-foreground'>
                                  <MapPin className='h-4 w-4 mr-2' />
                                  <span>{pdf.region}</span>
                                </div>
                              ) : null}
                              {pdf.upsertedAt ? (
                                <div className='flex items-center text-sm text-muted-foreground'>
                                  <Calendar className='h-4 w-4 mr-2' />
                                  <span>{new Date(pdf.upsertedAt).toLocaleDateString('de-DE')}</span>
                                </div>
                              ) : null}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </section>
          </>
        ) : showChatPanel ? (
          <section className="flex-1 flex flex-col min-h-0">
            <ChatPanel libraryId={libraryId} variant='compact' />
          </section>
        ) : showGalleryPanel ? (
          <section className="flex-1 flex flex-col min-h-0" data-gallery-section>
            <div className="flex flex-col h-full min-h-0">
              {showReferenceLegend && chatReferences.length > 0 && (
                <div className="mb-6 rounded border bg-muted/30 p-4 shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Legende und Verwendete Dokumente
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowReferenceLegend(false)
                        setFilters({} as Record<string, string[]>)
                      }}
                      className="h-7 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Schließen
                    </Button>
                  </div>
                  
                  {/* Legende: Nummer-Zuordnung */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">Legende (Nummer → Dokument/Abschnitt):</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {chatReferences.map((ref) => (
                        <div
                          key={ref.number}
                          className="flex items-start gap-2 text-xs p-2 rounded bg-background border hover:bg-muted/50"
                        >
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] shrink-0 font-mono">
                            [{ref.number}]
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-[11px] mb-0.5">
                              {ref.fileName || ref.fileId.split('/').pop() || ref.fileId.slice(0, 25)}
                            </div>
                            <div className="text-[10px] text-muted-foreground leading-relaxed">
                              {ref.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <ScrollArea className="flex-1 min-h-0">
                <div className="pr-4">
                  {!libraryId ? (
                    <div className='text-sm text-muted-foreground'>Keine aktive Bibliothek.</div>
                  ) : error ? (
                    <div className='text-sm text-destructive'>{error}</div>
                  ) : loading ? (
                    <div className='text-sm text-muted-foreground'>Lade Dokumente…</div>
                  ) : docs.length === 0 ? (
                    <div className='flex flex-col items-start gap-3 text-sm text-muted-foreground'>
                      <div>Keine Dokumente gefunden.</div>
                      <Button variant='secondary' onClick={() => setFilters({} as Record<string, string[]>)}>
                        Filter zurücksetzen
                      </Button>
                    </div>
                  ) : (
                    <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'>
                      {filteredDocs.map((pdf) => (
                        <Card
                          key={pdf.id}
                          className='cursor-pointer hover:shadow-lg transition-shadow duration-200'
                          onClick={() => openDocDetail(pdf)}
                        >
                          <CardHeader>
                            <div className='flex items-start justify-between'>
                              <FileText className='h-8 w-8 text-primary mb-2' />
                              {pdf.year ? <Badge variant='secondary'>{String(pdf.year)}</Badge> : null}
                            </div>
                            <CardTitle className='text-lg line-clamp-2'>{pdf.shortTitle || pdf.title || pdf.fileName || 'Dokument'}</CardTitle>
                            <CardDescription className='line-clamp-2'>{pdf.title || pdf.fileName}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className='space-y-2'>
                              {Array.isArray(pdf.authors) && pdf.authors.length > 0 && (
                                <div className='flex items-center text-sm text-muted-foreground'>
                                  <User className='h-4 w-4 mr-2' />
                                  <span className='line-clamp-1'>
                                    {pdf.authors[0]}
                                    {pdf.authors.length > 1 ? ` +${pdf.authors.length - 1} weitere` : ''}
                                  </span>
                                </div>
                              )}
                              {pdf.region && (
                                <div className='flex items-center text-sm text-muted-foreground'>
                                  <MapPin className='h-4 w-4 mr-2' />
                                  <span>{pdf.region}</span>
                                </div>
                              )}
                              {pdf.upsertedAt && (
                                <div className='flex items-center text-sm text-muted-foreground'>
                                  <Calendar className='h-4 w-4 mr-2' />
                                  <span>{new Date(pdf.upsertedAt).toLocaleDateString('de-DE')}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </section>
        ) : null}
      </div>

      {/* Dokumentdetails-Overlay - außerhalb der Grid-Struktur */}
      {selected && (
        <div className='fixed inset-0 z-50'>
          {/* Overlay mobil */}
          <div className='absolute inset-0 bg-black/50 lg:bg-transparent' onClick={() => setSelected(null)} />
          {/* Panel stets rechts fixiert */}
          <div className='absolute right-0 top-0 h-full w-full max-w-2xl bg-background shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col'>
            {/* Header mit Buttons (ohne Titel, da dieser in der Hero-Section ist) */}
            <div className='flex items-center justify-between p-6 border-b shrink-0 relative'>
              {/* Event Details Accordion für Sessions - links */}
              {sessionData && detailViewType === 'session' ? (
                <div className="relative">
                  <EventDetailsAccordion data={sessionData} />
                </div>
              ) : (
                <h2 className='text-xl font-semibold'>Dokumentdetails</h2>
              )}
              <div className='flex items-center gap-2 shrink-0'>
                {sessionUrl && detailViewType === 'session' ? (
                  <Button
                    variant='outline'
                    size='sm'
                    asChild
                    className='flex items-center gap-2'
                  >
                    <a href={sessionUrl} target='_blank' rel='noopener noreferrer'>
                      <ExternalLink className='h-4 w-4' />
                      Event Webseite öffnen
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => openPDFAtPage('', 1)}
                    className='flex items-center gap-2'
                  >
                    <ExternalLink className='h-4 w-4' />
                    Dokument öffnen
                  </Button>
                )}
                <Button variant='ghost' size='icon' onClick={() => {
                  setSelected(null)
                  setSessionUrl(undefined)
                  setSessionTitle(undefined)
                  setSessionData(undefined)
                }}>
                  <X className='h-4 w-4' />
                </Button>
              </div>
            </div>

            <ScrollArea className='flex-1'>
              <div className='p-0'>
                {(() => {
                  console.log('[Gallery] Rendering Detail View:', { detailViewType, fileId: selected.fileId || selected.id })
                  if (detailViewType === 'session') {
                    console.log('[Gallery] ✅ Verwende IngestionSessionDetail')
                    return (
                      <IngestionSessionDetail 
                        libraryId={libraryId} 
                        fileId={selected.fileId || selected.id}
                        onDataLoaded={(data) => {
                          setSessionUrl(data.url)
                          setSessionTitle(data.title || data.shortTitle)
                          setSessionData(data)
                        }}
                      />
                    )
                  } else {
                    console.log('[Gallery] ℹ️ Verwende IngestionBookDetail (default)')
                    return <IngestionBookDetail libraryId={libraryId} fileId={selected.fileId || selected.id} />
                  }
                })()}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Mobile Filter Sheet */}
      {showFilters ? (
        <div className='fixed inset-0 z-50 lg:hidden'>
          <div className='absolute inset-0 bg-black/50' onClick={() => setShowFilters(false)} />
          <div className='absolute inset-y-0 left-0 w-[85vw] max-w-[420px] bg-background shadow-2xl flex flex-col'>
            <div className='p-4 border-b flex items-center gap-2'>
              <ChevronLeft className='h-4 w-4' />
              <div className='font-medium'>Filter</div>
            </div>
            <div className='p-4 space-y-3 overflow-auto'>
              {facetDefs.filter(d => d).map(def => (
                <FacetGroup
                  key={def.metaKey}
                  label={def.label || def.metaKey}
                  options={def.options}
                  selected={(filters as Record<string, string[] | undefined>)[def.metaKey] || []}
                  onChange={(vals: string[]) => setFacet(def.metaKey, vals)}
                />
              ))}
              <Button variant='secondary' className='w-full' onClick={() => setShowFilters(false)}>Fertig</Button>
            </div>
          </div>
        </div>
      ) : null}

      
    </div>
  )
}

