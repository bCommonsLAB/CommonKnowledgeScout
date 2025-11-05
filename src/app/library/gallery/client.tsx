'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAtom, useAtomValue } from 'jotai'
import { activeLibraryIdAtom, librariesAtom } from '@/atoms/library-atom'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
import { FileLogger } from '@/lib/debug/logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, FileText, Calendar, User, MapPin, ExternalLink, Filter, ChevronLeft, MessageSquare, LayoutGrid, BookOpen, Feather } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FilterContextBar } from '@/components/library/filter-context-bar'
import { ChatPanel } from '@/components/library/chat/chat-panel'
import { IngestionBookDetail } from '@/components/library/ingestion-book-detail'
import { IngestionSessionDetail } from '@/components/library/ingestion-session-detail'
import { EventDetailsAccordion } from '@/components/library/event-details-accordion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ChatResponse } from '@/types/chat-response'
import type { SessionDetailData } from '@/components/library/session-detail'

interface DocCardMeta {
  id: string
  fileId?: string
  fileName?: string
  title?: string
  shortTitle?: string
  authors?: string[]
  speakers?: string[] // Speaker-Namen für Sessions
  speakers_image_url?: string[] // Speaker-Bild-URLs für Sessions
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
    <div className='border rounded p-2 bg-gradient-to-br from-blue-50/30 to-cyan-50/30 dark:from-blue-950/10 dark:to-cyan-950/10'>
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

/**
 * Rendert Speaker/Authors als Icons statt Dokumentensymbol
 * Gemeinsames Layout für Sessions (speakers) und Books (authors)
 * Falls mehrere vorhanden, werden sie nebeneinander mit Tooltips angezeigt
 * Zeigt Speaker-Bilder an, falls verfügbar, sonst Initialen
 * Mehrere Icons überlappen sich leicht, um zu zeigen, dass sie zusammen präsentiert haben
 * Icons sind größer und schneiden den oberen Rand der Card leicht an
 */
function SpeakerOrAuthorIcons({ doc }: { doc: DocCardMeta }) {
  // Priorität: speakers für Sessions, authors für Books
  const names = doc.speakers && doc.speakers.length > 0 
    ? doc.speakers 
    : (doc.authors && doc.authors.length > 0 ? doc.authors : undefined)
  
  // Falls keine Namen vorhanden, zeige Standard-Icon
  if (!names || names.length === 0) {
    return <FileText className='h-8 w-8 text-primary mb-2' />
  }
  
  // Speaker-Bilder verfügbar? (nur für Sessions)
  const images = doc.speakers_image_url && doc.speakers_image_url.length > 0 
    ? doc.speakers_image_url 
    : undefined
  
  // Mehrere Namen nebeneinander mit Tooltips - überlappen sich leicht
  // Negative margin-top schneidet den oberen Rand der Card deutlich an, sodass die Bilder darüber hinausragen
  return (
    <div className='flex items-center gap-0 -mt-10 mb-2 flex-wrap -ml-2'>
      {names.slice(0, 3).map((name, idx) => {
        const imageUrl = images && images[idx] ? images[idx] : undefined
        return (
          <div 
            key={idx}
            className={idx > 0 ? '-ml-2' : ''}
            style={{ zIndex: names.length - idx }}
          >
            <SpeakerIcon name={name} imageUrl={imageUrl} />
          </div>
        )
      })}
      {names.length > 3 && (
        <div className='-ml-2' style={{ zIndex: 0 }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className='flex items-center justify-center h-20 w-20 rounded-full bg-muted text-muted-foreground text-sm font-medium shrink-0 border-2 border-background shadow-sm'>
                +{names.length - 3}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className='space-y-1'>
                {names.slice(3).map((name, idx) => (
                  <p key={idx}>{name}</p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  )
}

/**
 * Einzelnes Speaker-Icon mit Bild oder Initialen
 * Doppelt so groß wie vorher, mit Border für bessere Sichtbarkeit bei Überlappung
 */
function SpeakerIcon({ name, imageUrl }: { name: string; imageUrl?: string }) {
  const [imageError, setImageError] = useState(false)
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className='flex items-center justify-center h-20 w-20 rounded-full bg-primary/10 text-primary text-base font-medium border-2 border-background hover:border-primary/30 transition-colors overflow-hidden shrink-0 shadow-sm'>
          {imageUrl && !imageError ? (
            <img 
              src={imageUrl} 
              alt={name}
              className='w-full h-full object-cover'
              onError={() => setImageError(true)}
            />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{name}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default function GalleryClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const libraryId = useAtomValue(activeLibraryIdAtom)
  const libraries = useAtomValue(librariesAtom)
  const [docs, setDocs] = useState<DocCardMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<DetailDoc | null>(null)
  const [showFilters, setShowFilters] = useState(false)
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
  const [, setSessionTitle] = useState<string | undefined>(undefined)
  const [sessionData, setSessionData] = useState<SessionDetailData | undefined>(undefined)
  // Suchfeld-Query (nur im Gallery-Modus)
  const [searchQuery, setSearchQuery] = useState('')
  
  // State für Mobile/Desktop-Erkennung
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    // Prüfe Bildschirmgröße beim Mount und bei Resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Modus-State: 'gallery' oder 'story'
  const modeParam = searchParams?.get('mode')
  const mode = (modeParam === 'story' ? 'story' : 'gallery') as 'gallery' | 'story'
  
  // Debug-Logging
  useEffect(() => {
    console.log('[Gallery] Mode Debug:', {
      modeParam,
      mode,
      searchParams: searchParams?.toString(),
      url: typeof window !== 'undefined' ? window.location.href : 'N/A'
    })
  }, [modeParam, mode, searchParams])
  
  // Funktion zum Wechseln des Modus
  const setMode = (newMode: 'gallery' | 'story') => {
    const params = new URLSearchParams(searchParams?.toString() || '')
    if (newMode === 'story') {
      params.set('mode', 'story')
    } else {
      params.delete('mode')
    }
    router.push(`/library/gallery${params.toString() ? `?${params.toString()}` : ''}`)
  }

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

  // Filtere Dokumente nach fileId (wenn Filter gesetzt) und Suchfeld, gruppiere nach Jahrgang
  const filteredDocs = useMemo(() => {
    const fileIdFilter = filters.fileId
    let result = docs
    
    // Filtere nach fileId (wenn Filter gesetzt)
    if (fileIdFilter && Array.isArray(fileIdFilter) && fileIdFilter.length > 0) {
      result = docs.filter(d => fileIdFilter.includes(d.fileId || '') || fileIdFilter.includes(d.id || ''))
    }
    
    // Filtere nach Suchfeld (nur im Gallery-Modus)
    if (mode === 'gallery' && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(doc => {
        // Suche in Titel
        const titleMatch = doc.title?.toLowerCase().includes(query) || doc.shortTitle?.toLowerCase().includes(query)
        // Suche in Speaker-Namen
        const speakerMatch = doc.speakers?.some(speaker => speaker.toLowerCase().includes(query))
        // Suche in Author-Namen
        const authorMatch = doc.authors?.some(author => author.toLowerCase().includes(query))
        // Suche in Topics (falls vorhanden)
        // Hinweis: Topics könnten in einem separaten Feld sein, hier nur die verfügbaren Felder durchsuchen
        return titleMatch || speakerMatch || authorMatch
      })
    }
    
    // Gruppiere nach Jahrgang und sortiere
    // 1. Sortiere zuerst nach Jahrgang (absteigend - neueste zuerst), dann nach upsertedAt (absteigend)
    result = [...result].sort((a, b) => {
      // Jahrgang-Vergleich (neueste zuerst)
      const yearA = a.year ? (typeof a.year === 'string' ? parseInt(a.year, 10) : a.year) : 0
      const yearB = b.year ? (typeof b.year === 'string' ? parseInt(b.year, 10) : b.year) : 0
      if (yearA !== yearB) {
        return yearB - yearA // Absteigend: neueste zuerst
      }
      
      // Innerhalb des gleichen Jahrgangs: nach upsertedAt sortieren (neueste zuerst)
      const dateA = a.upsertedAt ? new Date(a.upsertedAt).getTime() : 0
      const dateB = b.upsertedAt ? new Date(b.upsertedAt).getTime() : 0
      return dateB - dateA // Absteigend: neueste zuerst
    })
    
    return result
  }, [docs, filters, mode, searchQuery])
  
  // Gruppiere Dokumente nach Jahrgang für die Anzeige
  const docsByYear = useMemo(() => {
    const grouped = new Map<number | string, DocCardMeta[]>()
    for (const doc of filteredDocs) {
      const year = doc.year || 'Ohne Jahrgang'
      if (!grouped.has(year)) {
        grouped.set(year, [])
      }
      grouped.get(year)!.push(doc)
    }
    // Sortiere Jahrgänge absteigend (neueste zuerst)
    const sortedEntries = Array.from(grouped.entries()).sort((a, b) => {
      const yearA = a[0] === 'Ohne Jahrgang' ? 0 : (typeof a[0] === 'string' ? parseInt(a[0], 10) : a[0])
      const yearB = b[0] === 'Ohne Jahrgang' ? 0 : (typeof b[0] === 'string' ? parseInt(b[0], 10) : b[0])
      return yearB - yearA
    })
    return sortedEntries
  }, [filteredDocs])

  // Funktion zum Zurücksetzen aller Filter
  const handleClearFilters = () => {
    // Wenn ein fileId-Filter gesetzt ist (Legenden-Modus), schließe auch die Legende
    if (filters.fileId && Array.isArray(filters.fileId) && filters.fileId.length > 0) {
      setShowReferenceLegend(false)
    }
    setFilters({} as Record<string, string[]>)
  }

  // Funktion zum Rendern des Dokumenten-Grids
  const renderDocumentGrid = () => {
    if (!libraryId) {
      return <div className='text-sm text-muted-foreground'>Keine aktive Bibliothek.</div>
    }
    if (error) {
      return <div className='text-sm text-destructive'>{error}</div>
    }
    if (loading) {
      return <div className='text-sm text-muted-foreground'>Lade Dokumente…</div>
    }
    if (docs.length === 0) {
                  return (
        <div className='flex flex-col items-start gap-3 text-sm text-muted-foreground'>
          <div>Keine Dokumente gefunden.</div>
          <Button variant='secondary' onClick={handleClearFilters}>
            Filter zurücksetzen
                        </Button>
                      </div>
      )
    }
    if (filteredDocs.length === 0) {
      return (
                        <div className='flex flex-col items-start gap-3 text-sm text-muted-foreground'>
          <div>Keine Dokumente entsprechen den aktuellen Filtern.</div>
          <Button variant='secondary' onClick={handleClearFilters}>
                            Filter zurücksetzen
                          </Button>
                        </div>
      )
    }
    return (
                        <div className='space-y-8'>
                          {docsByYear.map(([year, yearDocs]) => (
                            <div key={year}>
                              <h3 className='text-lg font-semibold mb-4 pb-2 border-b'>
                                {year === 'Ohne Jahrgang' ? 'Ohne Jahrgang' : `Jahrgang ${year}`}
                              </h3>
                              <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'>
                                {yearDocs.map((pdf) => (
                                  <Card
                                    key={pdf.id}
                                    className='cursor-pointer hover:shadow-lg transition-shadow duration-200 overflow-visible bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20'
                                    onClick={() => openDocDetail(pdf)}
                                  >
                                    <CardHeader className='relative'>
                                      <div className='flex items-start justify-between'>
                                        <SpeakerOrAuthorIcons doc={pdf} />
                                        {pdf.year ? <Badge variant='secondary'>{String(pdf.year)}</Badge> : null}
                                      </div>
                                      <CardTitle className='text-lg line-clamp-2'>{pdf.shortTitle || pdf.title || pdf.fileName || 'Dokument'}</CardTitle>
                                      <CardDescription className='line-clamp-2'>{pdf.title || pdf.fileName}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                      <div className='space-y-2'>
                                        {Array.isArray(pdf.authors) && pdf.authors.length > 0 ? (
                                          <div className='flex items-center text-sm text-muted-foreground'>
                                            <User className='h-2.5 w-2.5 mr-2' />
                                            <span className='line-clamp-1'>
                                              {pdf.authors[0]}
                                              {pdf.authors.length > 1 ? ` +${pdf.authors.length - 1} weitere` : ''}
                                            </span>
                                          </div>
                                        ) : null}
                                        {pdf.region ? (
                                          <div className='flex items-center text-sm text-muted-foreground'>
                                            <MapPin className='h-2.5 w-2.5 mr-2' />
                                            <span>{pdf.region}</span>
                                          </div>
                                        ) : null}
                                        {pdf.upsertedAt ? (
                                          <div className='flex items-center text-sm text-muted-foreground'>
                                            <Calendar className='h-2.5 w-2.5 mr-2' />
                                            <span>{new Date(pdf.upsertedAt).toLocaleDateString('de-DE')}</span>
                                          </div>
                                        ) : null}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
    )
  }

  // Statusanzeigen werden im rechten Panel gerendert (keine frühen Returns),
  // damit der Facettenbereich immer sichtbar bleibt und Filter zurückgesetzt werden können.

  return (
    <div className='h-full overflow-hidden flex flex-col'>
      {/* Header mit dynamischem Titel */}
      <div className='mb-4 flex items-center justify-between flex-shrink-0'>
        <div>
          <h1 className='text-2xl font-semibold'>
            {mode === 'story' ? 'Story Mode' : 'Knowledge Gallery'}
          </h1>
          {mode === 'story' && (
            <p className='text-sm text-muted-foreground mt-1'>
              Wissen verstehen – aus deiner Perspektive
            </p>
          )}
          {mode === 'story' && (
            <p className='text-xs text-muted-foreground mt-2 max-w-2xl'>
              Im Story Mode kannst du die Talks und Dokumente so betrachten, wie sie für dich relevant sind.
              Wähle deine Sprache, Rolle und Kontext – und lass dir die Inhalte erzählen aus deiner Sichtweise.
            </p>
          )}
          {mode === 'gallery' && (
            <p className='text-sm text-muted-foreground mt-1'>
              Sofortiges Verständnis: Übersicht über alles
            </p>
          )}
          {mode === 'gallery' && (
            <p className='text-xs text-muted-foreground mt-2 max-w-2xl'>
              Durchsuche alle Talks, filtere nach Themen oder Jahren. 
              Starte ein Gespräch im Story-Modus, um Fragen zu stellen und Zusammenhänge zu entdecken.
            </p>
                      )}
                    </div>
        <div className='flex items-center gap-2'>
          {/* Filter-Button und Zurück-Button nur im Story-Modus oben */}
          {mode === 'story' && (
            <>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setShowFilters(true)}
                className='flex items-center gap-2'
              >
                <Filter className='h-4 w-4' />
                Filter
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setMode('gallery')}
                className='flex items-center gap-2'
              >
                <ChevronLeft className='h-4 w-4' />
                Zurück zur Gallery
              </Button>
            </>
          )}
          
          {/* Suchfeld nur im Gallery-Modus */}
          {mode === 'gallery' && (
            <Input
              type='text'
              placeholder='Durchsuchen nach Titel, Speaker, Topics...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-64'
            />
          )}
          {/* Story-Button nur im Gallery-Modus */}
          {mode === 'gallery' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='outline'
                    onClick={() => setMode('story')}
                    className='flex items-center gap-2'
                  >
                    <Feather className='h-4 w-4' />
                    In Story Mode wechseln
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Entdecke Wissen neu: Der Story Mode erzählt die Talks aus deiner Sicht – in deiner Sprache und mit deinem Fokus.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Hauptinhalt je nach Modus */}
      <div className='flex-1 min-h-0 overflow-hidden relative'>
        {mode === 'story' ? (
          /* Story-Modus: Chat prominent, Gallery nur auf Desktop oder als Overlay */
          <>
            {/* Chat-Panel - immer sichtbar */}
            <section className="w-full lg:w-1/2 flex flex-col min-h-0 h-full relative z-10">
              <ChatPanel libraryId={libraryId} variant='default' />
            </section>

            {/* Gallery-Overlay - nur wenn showReferenceLegend aktiv (Mobile) */}
            {showReferenceLegend && isMobile && (
              <div className="fixed inset-0 z-50">
                {/* Overlay-Hintergrund */}
                <div 
                  className="absolute inset-0 bg-black/50" 
                  onClick={() => {
                    setShowReferenceLegend(false)
                    setFilters({} as Record<string, string[]>)
                  }}
                />
                
                {/* Gallery-Panel von rechts */}
                <div className="absolute right-0 top-0 h-full w-full bg-background shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col overflow-hidden">
                  {/* Header mit Zurück-Button */}
                  <div className="flex items-center justify-between p-4 border-b shrink-0">
                    <h2 className="text-lg font-semibold">Legende und Dokumente</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowReferenceLegend(false)
                        setFilters({} as Record<string, string[]>)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Filter-Kontext-Bar direkt über der Gallery */}
                  <div className="mb-4 flex-shrink-0 px-4">
                    <FilterContextBar
                      docCount={filteredDocs.length}
                      onOpenFilters={() => setShowFilters(true)}
                      onClear={handleClearFilters}
                      showReferenceLegend={showReferenceLegend}
                    />
                  </div>
                  
                  <div className="flex flex-col h-full min-h-0 flex-1 px-4 overflow-hidden">
                    {/* Legende und Verwendete Dokumente */}
                    {chatReferences.length > 0 && (
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
                          <div className="text-xs font-medium text-muted-foreground mb-2">Legende (Nummer → Dokument/Textchunk):</div>
                          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
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
                    
                    {/* Dokumente-Grid */}
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="pr-4">
                        {renderDocumentGrid()}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            )}
            
            {/* Desktop-Layout: Gallery als Sidebar rechts (immer sichtbar außer wenn Legende aktiv) */}
            <section className="hidden lg:flex lg:w-1/2 lg:absolute lg:right-0 lg:top-0 lg:h-full flex-col min-h-0" data-gallery-section>
              {/* Filter-Kontext-Bar direkt über der Gallery */}
              <div className="mb-4 flex-shrink-0">
                <FilterContextBar
                  docCount={filteredDocs.length}
                  onOpenFilters={() => setShowFilters(true)}
                  onClear={handleClearFilters}
                  showReferenceLegend={showReferenceLegend}
                />
              </div>
              
              <div className="flex flex-col h-full min-h-0 flex-1">
                {/* Legende und Verwendete Dokumente (Desktop) */}
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
                      <div className="text-xs font-medium text-muted-foreground mb-2">Legende (Nummer → Dokument/Textchunk):</div>
                      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
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
                
                {/* Dokumente-Grid */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="pr-4">
                    {renderDocumentGrid()}
                  </div>
                </ScrollArea>
              </div>
            </section>
          </>
        ) : (
          /* Gallery-Modus: Nur Dokumente-Grid */
          <>
            {/* Filter-Kontext-Bar nur im Gallery-Modus über dem gesamten Bereich */}
            <FilterContextBar
              docCount={filteredDocs.length}
              onOpenFilters={() => setShowFilters(true)}
              onClear={handleClearFilters}
              showReferenceLegend={showReferenceLegend}
            />
            <section className="w-full flex flex-col min-h-0 h-full" data-gallery-section>
              <ScrollArea className="flex-1 min-h-0">
                <div className="pr-4">
                  {renderDocumentGrid()}
                                      </div>
              </ScrollArea>
            </section>
          </>
                  )}
                </div>

      {/* Filter-Panel als Slide-In (Sheet) - für beide Modi */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-3">
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
        </SheetContent>
      </Sheet>

      {/* Dokumentdetails-Overlay - außerhalb der Grid-Struktur */}
      {selected && (
        <div className='fixed inset-0 z-50'>
          {/* Overlay mobil */}
          <div className='absolute inset-0 bg-black/50 lg:bg-transparent' onClick={() => setSelected(null)} />
          {/* Panel stets rechts fixiert */}
          <div className='absolute right-0 top-0 h-full w-full max-w-2xl bg-background shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col overflow-hidden'>
            {/* Header mit Buttons (ohne Titel, da dieser in der Hero-Section ist) */}
            <div className='flex items-center justify-between p-6 border-b shrink-0 relative w-full'>
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

            <ScrollArea className='flex-1 w-full overflow-hidden'>
              <div className='p-0 w-full max-w-full overflow-x-hidden'>
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
    </div>
  )
}

