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
import { Separator } from '@/components/ui/separator'
import { X, FileText, Calendar, User, MapPin, ExternalLink, Filter, ChevronLeft, MessageSquare, LayoutGrid } from 'lucide-react'
import { ChatPanel } from '@/components/library/chat/chat-panel'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

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
  const normalized: FacetOption[] = options.map(o => (typeof o === 'object' && o !== null && 'value' in (o as any) ? o as FacetOption : { value: o as (string | number), count: 0 }))
  const values = new Set(selected)
  function toggle(v: string) {
    const next = new Set(values)
    if (next.has(v)) next.delete(v); else next.add(v)
    onChange(Array.from(next))
  }
  return (
    <div className='border rounded p-2'>
      <div className='flex items-center justify-between mb-2'>
        <div className='text-sm font-medium'>{label}</div>
        <button className='text-xs text-muted-foreground hover:underline' onClick={() => onChange([])}>Zurücksetzen</button>
      </div>
      <div className='max-h-40 overflow-auto space-y-1'>
        {normalized.map((o) => {
          const v = String(o.value)
          const active = values.has(v)
          return (
            <button key={v} type='button' onClick={() => toggle(v)} className={`w-full flex items-center justify-between rounded px-2 py-1 text-left text-sm ${active ? 'bg-primary/10' : 'hover:bg-muted'}`}>
              <span className='truncate'>{v}</span>
              <span className='text-xs text-muted-foreground'>{o.count > 0 ? o.count : ''}</span>
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
  const [facets, setFacets] = useState<{ authors: Array<{value:string,count:number}>; regions: Array<{value:string,count:number}>; years: Array<{value:string|number,count:number}>; docTypes: Array<{value:string,count:number}>; sources: Array<{value:string,count:number}>; tags: Array<{value:string,count:number}> }>({ authors: [], regions: [], years: [], docTypes: [], sources: [], tags: [] })

  const activeLibrary = libraries.find(l => l.id === libraryId)
  const enabledFacetKeys = Array.isArray((activeLibrary?.config?.chat as { gallery?: { facets?: unknown[] } } | undefined)?.gallery?.facets)
    ? ((activeLibrary!.config!.chat as { gallery?: { facets?: unknown[] } }).gallery!.facets as unknown[]).map(v => String(v))
    : ['authors','year','region','docType','source','tags']
  const facetOrder = enabledFacetKeys as Array<'authors'|'year'|'region'|'docType'|'source'|'tags'>

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!libraryId) return
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        filters.author?.forEach(v => params.append('author', v))
        filters.region?.forEach(v => params.append('region', v))
        filters.year?.forEach(v => params.append('year', String(v)))
        filters.docType?.forEach(v => params.append('docType', v))
        filters.source?.forEach(v => params.append('source', v))
        filters.tag?.forEach(v => params.append('tag', v))
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

  // Facetten laden (separat), bei Librarywechsel oder Filteränderung (leichtgewichtiger: nur bei Librarywechsel)
  useEffect(() => {
    let cancelled = false
    async function loadFacets() {
      if (!libraryId) return
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/facets`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) return
        if (!cancelled) {
          setFacets({
            authors: Array.isArray(data?.authors) ? data.authors as Array<{value:string,count:number}> : [],
            regions: Array.isArray(data?.regions) ? data.regions as Array<{value:string,count:number}> : [],
            years: Array.isArray(data?.years) ? data.years as Array<{value:string|number,count:number}> : [],
            docTypes: Array.isArray(data?.docTypes) ? data.docTypes as Array<{value:string,count:number}> : [],
            sources: Array.isArray(data?.sources) ? data.sources as Array<{value:string,count:number}> : [],
            tags: Array.isArray(data?.tags) ? data.tags as Array<{value:string,count:number}> : [],
          })
          // Optional: Library Facettenreihenfolge aus Config lesen (wenn exposed)
          // Hier könnte per API eine Reihenfolge geliefert werden; vorerst statisch
        }
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
    // TODO: PDF-URL aus Storage ermitteln und mit #page öffnen
  }

  // Facetten-Gruppen vorbereiten (Labels, Optionen, Selektion/Update)
  const facetGroups = {
    authors: {
      label: 'Autor',
      options: facets.authors,
      selected: filters.author || [],
      onChange: (vals: string[]) => setFilters(f => ({ ...f, author: vals.length ? vals : undefined })),
    },
    region: {
      label: 'Region',
      options: facets.regions,
      selected: filters.region || [],
      onChange: (vals: string[]) => setFilters(f => ({ ...f, region: vals.length ? vals : undefined })),
    },
    year: {
      label: 'Jahr',
      options: facets.years,
      selected: (filters.year || []).map(String),
      onChange: (vals: string[]) => setFilters(f => ({ ...f, year: vals.length ? vals : undefined })),
    },
    docType: {
      label: 'Dokumenttyp',
      options: facets.docTypes,
      selected: filters.docType || [],
      onChange: (vals: string[]) => setFilters(f => ({ ...f, docType: vals.length ? vals : undefined })),
    },
    source: {
      label: 'Quelle',
      options: facets.sources,
      selected: filters.source || [],
      onChange: (vals: string[]) => setFilters(f => ({ ...f, source: vals.length ? vals : undefined })),
    },
    tags: {
      label: 'Tag',
      options: facets.tags,
      selected: filters.tag || [],
      onChange: (vals: string[]) => setFilters(f => ({ ...f, tag: vals.length ? vals : undefined })),
    },
  } as const

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

      <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
        {showFilterPanel ? (
          <aside className='hidden lg:block lg:col-span-2'>
            <div className='rounded border p-3 space-y-3'>
              <div className='font-medium flex items-center gap-2'><Filter className='h-4 w-4' /> Filter</div>
              <div className='grid gap-2'>
                {facetOrder.map(key => (
                  <FacetGroup
                    key={key}
                    label={facetGroups[key].label}
                    options={facetGroups[key].options}
                    selected={facetGroups[key].selected}
                    onChange={facetGroups[key].onChange}
                  />
                ))}
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
                <section className={`${spanClass(chatSpan)} space-y-3`}>
                  <ChatPanel libraryId={libraryId} variant='compact' />
                </section>
              ) : null}

              {gallerySpan > 0 ? (
                <section className={`${spanClass(gallerySpan)} relative`}>
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
                    <div className='lg:relative fixed inset-0 lg:inset-auto lg:h-0 lg:w-0 bg-black/50 lg:bg-transparent z-50 lg:z-auto lg:flex lg:justify-end'>
                      <div className='w-full max-w-2xl lg:absolute lg:right-0 lg:top-0 lg:h-full bg-background shadow-2xl animate-in slide-in-from-right duration-300'>
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

                        <ScrollArea className='h-[calc(100vh-80px)]'>
                          <div className='p-6'>
                            <article className='prose prose-gray max-w-none dark:prose-invert'>
                              <header className='mb-8'>
                                <h1 className='text-3xl font-bold text-foreground mb-2 leading-tight'>{selected.title || selected.fileName || 'Dokument'}</h1>
                                {selected.shortTitle ? <p className='text-xl text-muted-foreground mb-4'>{selected.shortTitle}</p> : null}
                                <div className='flex flex-wrap gap-4 text-sm text-muted-foreground mb-6'>
                                  {Array.isArray(selected.authors) && selected.authors.length > 0 ? (
                                    <div className='flex items-center'>
                                      <User className='h-4 w-4 mr-2' />
                                      <span>{selected.authors.join(', ')}</span>
                                    </div>
                                  ) : null}
                                  {selected.year ? (
                                    <div className='flex items-center'>
                                      <Calendar className='h-4 w-4 mr-2' />
                                      <span>{String(selected.year)}</span>
                                    </div>
                                  ) : null}
                                  {selected.region ? (
                                    <div className='flex items-center'>
                                      <MapPin className='h-4 w-4 mr-2' />
                                      <span>{selected.region}</span>
                                    </div>
                                  ) : null}
                                </div>
                              </header>

                              <Separator className='my-8' />

                              {Array.isArray(selected.chapters) && selected.chapters.length > 0 ? (
                                <section>
                                  <h2 className='text-xl font-semibold text-foreground mb-4'>Kapitel</h2>
                                  <div className='space-y-4'>
                                    {selected.chapters.map((chapter, index) => (
                                      <div key={index} className='border-l-2 border-l-muted pl-4 py-2'>
                                        <div className='flex items-center justify-between mb-2'>
                                          <h3
                                            className='font-medium text-foreground hover:text-primary cursor-pointer transition-colors'
                                            onClick={() => openPDFAtPage('', chapter.pageStart || 1)}
                                          >
                                            {chapter.title}
                                          </h3>
                                          {(chapter.pageStart && chapter.pageEnd) ? (
                                            <span className='text-xs text-muted-foreground bg-muted px-2 py-1 rounded'>
                                              S. {chapter.pageStart}-{chapter.pageEnd}
                                            </span>
                                          ) : null}
                                        </div>
                                        {chapter.summary ? <p className='text-sm text-muted-foreground leading-relaxed'>{chapter.summary}</p> : null}
                                      </div>
                                    ))}
                                  </div>
                                </section>
                              ) : null}

                              <Separator className='my-8' />

                              <section>
                                <h3 className='text-lg font-semibold text-foreground mb-4'>Dokumentinformationen</h3>
                                <div className='bg-muted/50 rounded-lg p-4 space-y-2 text-sm'>
                                  {selected.fileName ? <div><strong>Dateiname:</strong> {selected.fileName}</div> : null}
                                  {selected.upsertedAt ? <div><strong>Hochgeladen:</strong> {new Date(selected.upsertedAt).toLocaleString('de-DE')}</div> : null}
                                  {selected.fileId ? <div><strong>Dokument-ID:</strong> <code className='text-xs bg-muted px-1 py-0.5 rounded'>{selected.fileId}</code></div> : null}
                                </div>
                              </section>
                            </article>
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
              {facetOrder.map(key => (
                <FacetGroup
                  key={key}
                  label={facetGroups[key].label}
                  options={facetGroups[key].options}
                  selected={facetGroups[key].selected}
                  onChange={facetGroups[key].onChange}
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
