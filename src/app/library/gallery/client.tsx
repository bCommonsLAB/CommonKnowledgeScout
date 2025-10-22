'use client'

import { useEffect, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { activeLibraryIdAtom, librariesAtom } from '@/atoms/library-atom'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { FileLogger } from '@/lib/debug/logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, FileText, Calendar, User, MapPin, ExternalLink, Filter, ChevronLeft, MessageSquare, LayoutGrid } from 'lucide-react'
import { ChatPanel } from '@/components/library/chat/chat-panel'
import { IngestionBookDetail } from '@/components/library/ingestion-book-detail'

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
  const [facetDefs, setFacetDefs] = useState<Array<{ metaKey: string; label: string; type: string; options: Array<{ value: string; count: number }> }>>([])

  // Hinweis: activeLibrary derzeit ungenutzt
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

  // Facetten-Definitionen + Optionen laden
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
    loadFacets()
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

  if (!libraryId) return <div className='text-sm text-muted-foreground'>Keine aktive Bibliothek.</div>
  if (loading) return <div className='text-sm text-muted-foreground'>Lade Dokumente…</div>
  if (error) return <div className='text-sm text-destructive'>{error}</div>
  if (docs.length === 0) return <div className='text-sm text-muted-foreground'>Keine Dokumente gefunden.</div>

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
          <div className='text-muted-foreground text-sm'>Durchsuchen und befragen Sie Ihre transformierten PDF-Dokumente</div>
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
                <section className={`${spanClass(chatSpan)} space-y-3 relative z-10`}>
                  <ChatPanel libraryId={libraryId} variant='compact' />
                </section>
              ) : null}

              {gallerySpan > 0 ? (
                <section className={`${spanClass(gallerySpan)} relative z-0`}>
                  <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'>
                  {docs.map((pdf) => (
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
                            <IngestionBookDetail libraryId={libraryId} fileId={selected.fileId || selected.id} />
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
