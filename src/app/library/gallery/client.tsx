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
import type { ChatResponse } from '@/types/chat-response'

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
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/facets`, { cache: 'no-store' })
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
  }, [libraryId])

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
        const url = `/api/external/jobs?bySourceItemId=${encodeURIComponent(doc.fileId)}&libraryId=${encodeURIComponent(libraryId)}`
        const res = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) return
        const job = Array.isArray(data?.items) && data.items[0] ? data.items[0] : undefined
        const history = Array.isArray(job?.metaHistory) ? (job.metaHistory as Array<unknown>) : []
        const cumulative = job && typeof job === 'object' ? (job as { cumulativeMeta?: unknown }).cumulativeMeta : undefined
        let chapters: ChapterInfo[] | undefined

        const mapChapters = (raw: unknown): ChapterInfo[] | undefined => {
          if (!Array.isArray(raw)) return undefined
          const out = raw
            .map((c: unknown) => {
              if (!c || typeof c !== 'object') return undefined
              const t = (c as { title?: unknown }).title
              const s = (c as { summary?: unknown }).summary
              const ps = (c as { pageStart?: unknown }).pageStart
              const pe = (c as { pageEnd?: unknown }).pageEnd
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

        // 1) Versuche cumulativeMeta.chapters
        if (cumulative && typeof cumulative === 'object') {
          chapters = mapChapters((cumulative as { chapters?: unknown }).chapters)
        }

        // 2) Falls leer: suche rückwärts in metaHistory nach dem letzten Eintrag mit Kapiteln
        if (!chapters && history.length > 0) {
          for (let i = history.length - 1; i >= 0; i--) {
            const entry = history[i]
            if (!entry || typeof entry !== 'object') continue
            const meta = (entry as { meta?: unknown }).meta
            if (!meta || typeof meta !== 'object') continue
            const mapped = mapChapters((meta as { chapters?: unknown }).chapters)
            if (mapped) { chapters = mapped; break }
          }
        }
        if (chapters && chapters.length > 0) setSelected(s => (s ? { ...s, chapters } : s))
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

  const isFiltered = Object.values(filters as Record<string, string[] | undefined>).some(arr => Array.isArray(arr) && arr.length > 0)

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
    <div className='min-h-screen'>
      <div className='mb-6 flex items-center justify-start gap-2'>
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

      <div className='grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'>
        {showFilterPanel ? (
          <aside className='hidden lg:block lg:col-span-2 relative z-0'>
            <div className='rounded border p-3 space-y-3 sticky top-20 max-h-[calc(100vh-140px)] overflow-y-auto overflow-x-hidden bg-background'>
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

        {(() => {
          const filterSpan = showFilterPanel ? 2 : 0
          const remaining = 12 - filterSpan
          let chatSpan = 0
          let gallerySpan = 0
          if (showChatPanel && showGalleryPanel) {
            chatSpan = Math.floor(remaining / 2)
            gallerySpan = remaining - chatSpan
          } else if (showChatPanel) {
            chatSpan = remaining
          } else if (showGalleryPanel) {
            gallerySpan = remaining
          } else {
            gallerySpan = remaining
          }
          const spanClass = (n: number) => n === 12 ? 'lg:col-span-12' : n === 10 ? 'lg:col-span-10' : n === 9 ? 'lg:col-span-9' : n === 8 ? 'lg:col-span-8' : n === 7 ? 'lg:col-span-7' : n === 6 ? 'lg:col-span-6' : n === 5 ? 'lg:col-span-5' : n === 4 ? 'lg:col-span-4' : 'lg:col-span-3'

          return (
            <>
              {chatSpan > 0 ? (
                <section className={`${spanClass(chatSpan)} relative z-10`}>
                  <div className="sticky top-20 h-[calc(100vh-140px)] flex flex-col">
                    <ChatPanel libraryId={libraryId} variant='compact' />
                  </div>
                </section>
              ) : null}

              {gallerySpan > 0 ? (
                <section className={`${spanClass(gallerySpan)} relative z-0 sticky top-20 self-start`} data-gallery-section>
                  {/* Legende und Verwendete Dokumente */}
                  {showReferenceLegend && chatReferences.length > 0 && (
                    <div className="mb-6 rounded border bg-muted/30 p-4">
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
                      
                      {/* Kompakte Legende mit Nummern */}
                      <div className="mb-4">
                        <div className="text-xs text-muted-foreground mb-2">Legende:</div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {chatReferences.map((ref) => (
                            <div
                              key={ref.number}
                              className="flex items-center gap-2 text-xs p-2 rounded bg-background border"
                            >
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] shrink-0">
                                [{ref.number}]
                              </Badge>
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{ref.fileName || ref.fileId.slice(0, 20)}</div>
                                <div className="text-[10px] text-muted-foreground truncate">{ref.description}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Gruppierte Dokumente */}
                      <div>
                        <div className="text-xs text-muted-foreground mb-2">
                          Verwendete Dokumente ({new Set(chatReferences.map(r => r.fileId)).size}):
                        </div>
                        <div className="space-y-2">
                          {Array.from(new Set(chatReferences.map(r => r.fileId))).map((fileId) => {
                            const refsForDoc = chatReferences.filter(r => r.fileId === fileId)
                            const docRef = refsForDoc[0]
                            const refNumbers = refsForDoc.map(r => r.number).sort((a, b) => a - b)
                            const refNumbersStr = refNumbers.length <= 3
                              ? refNumbers.join(', ')
                              : `${refNumbers[0]}-${refNumbers[refNumbers.length - 1]}`
                            
                            return (
                              <div
                                key={fileId}
                                className="flex items-center justify-between gap-2 p-2 rounded border bg-background hover:bg-muted/50 cursor-pointer"
                                onClick={() => {
                                  const doc = docs.find(d => d.fileId === fileId || d.id === fileId)
                                  if (doc) openDocDetail(doc)
                                }}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                        [{refNumbersStr}]
                                      </Badge>
                                      <span className="text-xs font-medium truncate">
                                        {docRef.fileName || fileId.slice(0, 30)}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                                      {refsForDoc.map(r => r.description).join(', ')}
                                    </div>
                                  </div>
                                </div>
                                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  
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
                  {selected && (
                    <div className='fixed inset-0 z-50'>
                      {/* Overlay mobil */}
                      <div className='absolute inset-0 bg-black/50 lg:bg-transparent' onClick={() => setSelected(null)} />
                      {/* Panel stets rechts fixiert */}
                      <div className='absolute right-0 top-0 h-full w-full max-w-2xl bg-background shadow-2xl animate-in slide-in-from-right duration-300'>
                        <div className='flex items-center justify-between p-6 border-b'>
                          <h2 className='text-xl font-semibold'>Dokumentdetails</h2>
                          <div className='flex items-center gap-2'>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => openPDFAtPage('', 1)}
                              className='flex items-center gap-2'
                            >
                              <ExternalLink className='h-4 w-4' />
                              Dokument öffnen
                            </Button>
                            <Button variant='ghost' size='icon' onClick={() => setSelected(null)}>
                              <X className='h-4 w-4' />
                            </Button>
                          </div>
                        </div>

                        <ScrollArea className='h-[calc(100vh-80px)] lg:h-[calc(100vh-80px)]'>
                          <div className='p-0'>
                            {(() => {
                              console.log('[Gallery] Rendering Detail View:', { detailViewType, fileId: selected.fileId || selected.id })
                              if (detailViewType === 'session') {
                                console.log('[Gallery] ✅ Verwende IngestionSessionDetail')
                                return <IngestionSessionDetail libraryId={libraryId} fileId={selected.fileId || selected.id} />
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
                </section>
              ) : null}
            </>
          )
        })()}
      </div>

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
