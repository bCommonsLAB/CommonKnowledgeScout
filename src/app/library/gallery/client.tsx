'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { activeLibraryIdAtom, librariesAtom } from '@/atoms/library-atom'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
import { FileLogger } from '@/lib/debug/logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, FileText, Calendar, User, MapPin, ExternalLink, Filter, ChevronLeft, Feather, Search } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChatReferenceList } from '@/components/library/chat/chat-reference-list'
import { FilterContextBar } from '@/components/library/filter-context-bar'
import { ChatPanel } from '@/components/library/chat/chat-panel'
import { StoryModeHeader } from '@/components/library/story/story-mode-header'
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
  track?: string // Track/Topic für Sessions
  date?: string // Datum aus docMetaJson.date (für Sessions)
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

interface GalleryClientProps {
  libraryIdProp?: string
}

export default function GalleryClient(props: GalleryClientProps = {}) {
  const { libraryIdProp } = props
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const libraryIdFromAtom = useAtomValue(activeLibraryIdAtom)
  // Verwende Prop wenn vorhanden (für anonyme Zugriffe), sonst Atom
  const libraryId = libraryIdProp || libraryIdFromAtom
  const libraries = useAtomValue(librariesAtom)
  const [docs, setDocs] = useState<DocCardMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<DetailDoc | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useAtom(galleryFiltersAtom)
  const [showReferenceLegend, setShowReferenceLegend] = useState(false)
  const chatReferences = useAtomValue(chatReferencesAtom)
  const setChatReferences = useSetAtom(chatReferencesAtom)
  const [facetDefs, setFacetDefs] = useState<Array<{ metaKey: string; label: string; type: string; options: Array<{ value: string; count: number }> }>>([])
  // Stats werden aktuell nicht gerendert; um Linter zu erfüllen, Status lokal halten
  const [, setStats] = useState<StatsResponse | null>(null)
  // Gallery-Texte: Berechne initial aus Libraries, wenn verfügbar (verhindert Flackern)
  const activeLibrary = libraries.find(lib => lib.id === libraryId)
  const initialGalleryTexts = useMemo(() => {
    const gallery = activeLibrary?.config?.publicPublishing?.gallery
    return {
      headline: gallery?.headline || 'Entdecke, was Menschen auf der SFSCon gesagt haben',
      subtitle: gallery?.subtitle || 'Befrage das kollektive Wissen',
      description: gallery?.description || 'Verschaffe dir zuerst einen Überblick über alle verfügbaren Talks. Filtere nach Themen oder Jahren, die dich interessieren. Wenn du bereit bist, wechsle in den Story-Modus, um Fragen zu stellen und dir die Inhalte erzählen zu lassen.',
      filterDescription: gallery?.filterDescription || 'Filtere nach Themen, um dir einen Überblick über die Vorträge zu verschaffen, die dich interessieren.',
    }
  }, [activeLibrary?.config?.publicPublishing?.gallery])

  // Detail-View-Typ aus Library-Config (default: 'book')
  const [detailViewType, setDetailViewType] = useState<'book' | 'session'>('book')
  // Gallery-Texte: Verwende initial die aus Libraries berechneten Werte, überschreibe nur bei Config-Updates
  const [galleryHeadline, setGalleryHeadline] = useState<string>(initialGalleryTexts.headline)
  const [gallerySubtitle, setGallerySubtitle] = useState<string>(initialGalleryTexts.subtitle)
  const [galleryDescription, setGalleryDescription] = useState<string>(initialGalleryTexts.description)
  const [galleryFilterDescription, setGalleryFilterDescription] = useState<string>(initialGalleryTexts.filterDescription)

  // OpenDocDetail-Funktion mit useCallback für stabile Referenz
  const openDocDetail = useCallback((doc: DocCardMeta) => {
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
  }, [libraryId, setSelected])

  // Aktualisiere Gallery-Texte, wenn sich die Libraries ändern (z.B. nach Speichern)
  useEffect(() => {
    setGalleryHeadline(initialGalleryTexts.headline)
    setGallerySubtitle(initialGalleryTexts.subtitle)
    setGalleryDescription(initialGalleryTexts.description)
    setGalleryFilterDescription(initialGalleryTexts.filterDescription)
  }, [initialGalleryTexts])

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

  // Ref für den äußersten Container
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Im Story-Modus: Setze Container-Höhe auf verfügbare Viewport-Höhe
  useEffect(() => {
    if (mode !== 'story') {
      // Im Gallery-Modus: Entferne gesetzte Höhe
      if (containerRef.current) {
        containerRef.current.style.height = ''
        containerRef.current.style.maxHeight = ''
      }
      return
    }
    
    const updateHeight = () => {
      if (!containerRef.current) return
      // Berechne verfügbare Höhe: Viewport-Höhe minus Navbar
      const navHeight = document.querySelector('nav')?.offsetHeight || 0
      const availableHeight = window.innerHeight - navHeight
      containerRef.current.style.height = `${availableHeight}px`
      containerRef.current.style.maxHeight = `${availableHeight}px`
    }
    
    // Warte auf Layout-Berechnung
    requestAnimationFrame(() => {
      requestAnimationFrame(updateHeight)
    })
    
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [mode])
  
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
    
    // Erkenne, ob wir auf einer Explore-Seite sind
    const isExplorePage = pathname?.startsWith('/explore/')
    
    if (isExplorePage) {
      // Auf Explore-Seite: Bleibe auf derselben Route und füge nur den mode-Parameter hinzu
      // Verwende replace statt push, um Redirect-Schleifen zu vermeiden
      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`
      router.replace(newUrl)
    } else {
      // Auf Library-Seite: Navigiere zu /library/gallery
      router.push(`/library/gallery${params.toString() ? `?${params.toString()}` : ''}`)
    }
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
        
        // Prüfe Content-Type, um HTML-Fehlerseiten abzufangen
        const contentType = res.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
          // Wenn HTML zurückgegeben wurde, ist es wahrscheinlich eine Fehlerseite
          throw new Error(`Ungültige Antwort vom Server: ${res.status} ${res.statusText}`)
        }
        
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
        // Setze Filter auf fileId, um Dokument zu laden - BEHALTE bestehende Facettenfilter
        setFilters(f => {
          const next = { ...(f as Record<string, string[] | undefined>) }
          next.fileId = [fileId]
          return next as typeof f
        })
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
  }, [docs, libraryId, setFilters, openDocDetail])

  // Event-Listener für 'show-reference-legend' (von Chat-Panel)
  useEffect(() => {
    const handleShowLegend = (event: Event) => {
      const customEvent = event as CustomEvent<{ references: ChatResponse['references']; libraryId: string }>
      const { references: refs } = customEvent.detail || {}
      
      if (!refs || refs.length === 0) return
      
      // Speichere Referenzen im Atom
      setChatReferences(refs)
      
      // Zeige Quellenverzeichnis an
      setShowReferenceLegend(true)
      
      // Filtere Dokumente nach Referenzen - BEHALTE bestehende Facettenfilter
      const fileIds = Array.from(new Set(refs.map(r => r.fileId)))
      setFilters(f => {
        const next = { ...(f as Record<string, string[] | undefined>) }
        next.fileId = fileIds
        return next as typeof f
      })
      
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
  }, [setFilters, setChatReferences])

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
        
        // Prüfe Content-Type, um HTML-Fehlerseiten abzufangen
        const contentType = res.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
          // Wenn HTML zurückgegeben wurde, ist es wahrscheinlich eine Fehlerseite
          return
        }
        
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
        const galleryConfig = (data?.config as { gallery?: { 
          detailViewType?: string
        } })?.gallery
        // Gallery-Texte sind unter data.publicPublishing.gallery
        const publicPublishing = data?.publicPublishing as { 
          gallery?: {
            headline?: string
            subtitle?: string
            description?: string
            filterDescription?: string
          }
        } | undefined
        const galleryTexts = publicPublishing?.gallery
        console.log('[Gallery] Config Response:', { 
          ok: res.ok, 
          status: res.status,
          gallery: galleryConfig,
          publicPublishing,
          galleryTexts,
          detailViewType: galleryConfig?.detailViewType
        })
        if (!res.ok) {
          console.warn('[Gallery] Config Response nicht OK:', res.status, res.statusText)
          return
        }
        if (!cancelled) {
          const viewType = galleryConfig?.detailViewType
          console.log('[Gallery] DetailViewType aus Config:', viewType)
          if (viewType === 'book' || viewType === 'session') {
            console.log('[Gallery] ✅ Setze detailViewType auf:', viewType)
            setDetailViewType(viewType)
          } else {
            console.log('[Gallery] ⚠️ Ungültiger oder fehlender detailViewType, verwende default: book')
          }
          
          // Gallery-Texte laden aus publicPublishing.gallery (immer setzen, entweder gespeicherte Werte oder Defaults)
          // Aktualisiere nur, wenn sich die Werte ändern (verhindert unnötige Re-Renders)
          const newHeadline = galleryTexts?.headline || 'Entdecke, was Menschen auf der SFSCon gesagt haben'
          const newSubtitle = galleryTexts?.subtitle || 'Befrage das kollektive Wissen'
          const newDescription = galleryTexts?.description || 'Verschaffe dir zuerst einen Überblick über alle verfügbaren Talks. Filtere nach Themen oder Jahren, die dich interessieren. Wenn du bereit bist, wechsle in den Story-Modus, um Fragen zu stellen und dir die Inhalte erzählen zu lassen.'
          const newFilterDescription = galleryTexts?.filterDescription || 'Filtere nach Themen, um dir einen Überblick über die Vorträge zu verschaffen, die dich interessieren.'
          
          if (galleryHeadline !== newHeadline) setGalleryHeadline(newHeadline)
          if (gallerySubtitle !== newSubtitle) setGallerySubtitle(newSubtitle)
          if (galleryDescription !== newDescription) setGalleryDescription(newDescription)
          if (galleryFilterDescription !== newFilterDescription) setGalleryFilterDescription(newFilterDescription)
        }
      } catch (e) {
        console.error('[Gallery] Fehler beim Laden der Config:', e)
        // ignorieren, default 'book' bleibt
      }
    }
    loadFacets()
    loadConfig()
    return () => { cancelled = true }
  }, [libraryId, filters, galleryDescription, galleryFilterDescription, galleryHeadline, gallerySubtitle])

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
    // 1. Sortiere zuerst nach Jahrgang (absteigend - neueste zuerst), dann nach Track, dann nach upsertedAt (absteigend)
    result = [...result].sort((a, b) => {
      // Jahrgang-Vergleich (neueste zuerst)
      const yearA = a.year ? (typeof a.year === 'string' ? parseInt(a.year, 10) : a.year) : 0
      const yearB = b.year ? (typeof b.year === 'string' ? parseInt(b.year, 10) : b.year) : 0
      if (yearA !== yearB) {
        return yearB - yearA // Absteigend: neueste zuerst
      }
      
      // Innerhalb des gleichen Jahrgangs: nach Track sortieren (alphabetisch)
      const trackA = a.track || ''
      const trackB = b.track || ''
      if (trackA !== trackB) {
        return trackA.localeCompare(trackB, 'de', { sensitivity: 'base' })
      }
      
      // Innerhalb des gleichen Jahrgangs und Tracks: nach upsertedAt sortieren (neueste zuerst)
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

  // Funktion zum Schließen des Quellenverzeichnisses: Entfernt nur den fileId-Filter, behält andere Facettenfilter
  const handleCloseReferenceLegend = () => {
    setShowReferenceLegend(false)
    setChatReferences([])
    // Entferne nur den fileId-Filter, behalte alle anderen Facettenfilter
    setFilters(f => {
      const current = f as Record<string, string[] | undefined>
      // Erstelle ein neues Objekt ohne fileId, behalte alle anderen Filter
      const next: Record<string, string[]> = {}
      Object.entries(current).forEach(([key, value]) => {
        // Überspringe fileId, behalte alle anderen Filter
        if (key !== 'fileId' && Array.isArray(value) && value.length > 0) {
          next[key] = value
        }
      })
      return next as typeof f
    })
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
                              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6'>
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
                                        {pdf.date ? (
                                          <div className='flex items-center justify-between text-sm text-muted-foreground'>
                                            <div className='flex items-center'>
                                              <Calendar className='h-2.5 w-2.5 mr-2' />
                                              <span>{new Date(pdf.date).toLocaleDateString('de-DE')}</span>
                                            </div>
                                            {pdf.track && (
                                              <Badge variant='outline' className='text-xs'>
                                                {pdf.track}
                                              </Badge>
                                            )}
                                          </div>
                                        ) : pdf.track ? (
                                          <div className='flex items-center justify-end text-sm text-muted-foreground'>
                                            <Badge variant='outline' className='text-xs'>
                                              {pdf.track}
                                            </Badge>
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
    <div ref={containerRef} className={`${mode === 'story' ? '' : 'h-full'} overflow-hidden flex flex-col`}>
      {/* Tab-Layout oben - Tabs links, Story-Button rechts */}
      <div className='mb-6 flex items-center justify-between flex-shrink-0'>
        <Tabs value={mode} onValueChange={(value) => setMode(value as 'gallery' | 'story')} className="w-auto">
          <TabsList>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
            <TabsTrigger value="story">Story</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Story-Button rechts */}
        {mode === 'gallery' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='outline'
                  onClick={() => setMode('story')}
                  className='flex items-center gap-2 bg-transparent'
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
        
        {/* Zurück-Button im Story-Modus */}
        {mode === 'story' && (
          <Button
            variant='outline'
            size='sm'
            onClick={() => setMode('gallery')}
            className='flex items-center gap-2'
          >
            <ChevronLeft className='h-4 w-4' />
            Zurück zur Gallery
          </Button>
        )}
      </div>

      {/* Content je nach Modus */}
      <Tabs value={mode} className="flex-1 min-h-0 flex flex-col">
        <TabsContent value="gallery" className="flex-1 min-h-0 m-0">
              {/* Titelbereich im Konzept-Stil (nur im Gallery-Modus) */}
              <div className='mb-6 space-y-4 flex-shrink-0'>
                <div className='space-y-2'>
                  <h2 className='text-3xl font-bold'>{galleryHeadline}</h2>
                  <p className='text-sm text-muted-foreground font-medium'>{gallerySubtitle}</p>
                </div>
                <p className='text-sm leading-relaxed text-muted-foreground max-w-3xl'>
                  {galleryDescription}
                </p>

            {/* Suchfeld prominent unter Beschreibung */}
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                type='text'
                placeholder='Durchsuchen nach Titel, Speaker, Topic...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-10'
              />
            </div>
          </div>

          {/* Hauptinhalt Gallery-Modus */}
          <div className='flex-1 min-h-0 overflow-hidden relative'>
            {/* Mobile: Filter-Kontext-Bar über dem gesamten Bereich */}
            <div className="lg:hidden">
              <FilterContextBar
                docCount={filteredDocs.length}
                onOpenFilters={() => setShowFilters(true)}
                onClear={handleClearFilters}
                showReferenceLegend={showReferenceLegend}
                facetDefs={facetDefs}
              />
            </div>
            
            {/* Desktop: Grid-Layout mit Filter-Panel links und Grid rechts */}
            <div className="hidden lg:grid lg:grid-cols-[280px_1fr] lg:gap-6 flex-1 min-h-0 h-full">
              {/* Filter-Panel als Card (Desktop) - separat scrollbar */}
              <aside className="flex flex-col min-h-0 h-full">
                <ScrollArea className="flex-1 min-h-0 h-full">
                  <div className="pr-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Filter className="h-4 w-4" />
                          Filter
                        </CardTitle>
                            <CardDescription className="text-sm">
                              {galleryFilterDescription}
                            </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
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
                        {facetDefs.length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-8">
                            Keine Filter verfügbar
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </aside>

              {/* Dokumente-Grid rechts (Desktop) */}
              <div className="flex flex-col min-h-0 h-full">
                {/* Filter-Kontext-Bar mit aktiven Filtern - nur anzeigen wenn kein Quellenverzeichnis aktiv */}
                {!showReferenceLegend && (
                  <div className="flex-shrink-0">
                    <FilterContextBar
                      docCount={filteredDocs.length}
                      onOpenFilters={() => setShowFilters(true)}
                      onClear={handleClearFilters}
                      showReferenceLegend={showReferenceLegend}
                      hideFilterButton={true}
                      facetDefs={facetDefs}
                    />
                  </div>
                )}
                
                {/* Quellenverzeichnis - nur anzeigen wenn aktiv */}
                {showReferenceLegend && chatReferences && chatReferences.length > 0 && (
                  <div className="flex-shrink-0 border-b bg-background px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-semibold">Quellenverzeichnis</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCloseReferenceLegend}
                        className="h-7 px-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Die Antwort wurde aus diesen Dokumenten generiert.
                    </p>
                    <ChatReferenceList
                      references={chatReferences}
                      libraryId={libraryId}
                      onDocumentClick={(fileId) => {
                        // Öffne Dokument-Detailansicht
                        const doc = docs.find(d => d.id === fileId)
                        if (doc) {
                          openDocDetail(doc)
                        }
                      }}
                    />
                  </div>
                )}
                
                <section className="flex-1 flex flex-col min-h-0 h-full" data-gallery-section>
                  <ScrollArea className="flex-1 min-h-0 h-full">
                    <div>
                      {renderDocumentGrid()}
                    </div>
                  </ScrollArea>
                </section>
              </div>
            </div>
            
            {/* Mobile: Nur Dokumente-Grid (volle Breite) */}
            <section className="lg:hidden w-full flex flex-col min-h-0 h-full" data-gallery-section>
              <ScrollArea className="flex-1 min-h-0">
                <div className="pr-4">
                  {renderDocumentGrid()}
                </div>
              </ScrollArea>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="story" className="flex-1 min-h-0 m-0 flex flex-col overflow-hidden">
          {/* Story Mode Header-Bereich (fest oben) */}
          <div className="flex-shrink-0">
            <StoryModeHeader 
              libraryId={libraryId} 
              onBackToGallery={() => setMode('gallery')}
            />
          </div>

          {/* Hauptinhalt Story-Modus: Grid-Layout */}
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] flex-1 min-h-0 overflow-hidden">
            {/* Links: Story Content (Chat mit Topics im Scroll-Bereich) */}
            <div className="min-h-0 flex flex-col overflow-hidden rounded-md">
              {/* Chat-Panel - enthält StoryTopics im Scroll-Bereich */}
              <ChatPanel libraryId={libraryId} variant='embedded' />
            </div>

            {/* Rechts: Gallery mit Filter-Kontext-Bar und Dokumente-Grid */}
            <div className="hidden lg:flex flex-col min-h-0 overflow-hidden rounded-md">
              {/* Filter-Kontext-Bar mit aktiven Filtern - nur anzeigen wenn kein Quellenverzeichnis aktiv */}
              {!showReferenceLegend && (
                <div className="flex-shrink-0">
                  <FilterContextBar
                    docCount={filteredDocs.length}
                    onOpenFilters={() => setShowFilters(true)}
                    onClear={handleClearFilters}
                    showReferenceLegend={showReferenceLegend}
                    hideFilterButton={true}
                    facetDefs={facetDefs}
                  />
                </div>
              )}
              
              {/* Quellenverzeichnis - nur anzeigen wenn aktiv */}
              {showReferenceLegend && chatReferences && chatReferences.length > 0 && (
                <div className="flex-shrink-0 border-b bg-background px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold">Quellenverzeichnis</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCloseReferenceLegend}
                      className="h-7 px-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Die Antwort wurde aus diesen Dokumenten generiert.
                  </p>
                  <ChatReferenceList
                    references={chatReferences}
                    libraryId={libraryId}
                    onDocumentClick={(fileId) => {
                      // Öffne Dokument-Detailansicht
                      const doc = docs.find(d => d.id === fileId)
                      if (doc) {
                        openDocDetail(doc)
                      }
                    }}
                  />
                </div>
              )}
              
              {/* Dokumente-Grid - eigener Scrollbereich */}
              <section
                className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain"
                data-gallery-section
                onWheel={(e: React.WheelEvent<HTMLElement>) => {
                  // Prevent parent scrolling when scrolling within this section
                  const target = e.currentTarget;
                  if (target.scrollHeight > target.clientHeight) {
                    const { scrollTop, scrollHeight, clientHeight } = target;
                    const deltaY = e.deltaY;
                    const isAtTop = scrollTop <= 0;
                    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
                    if ((deltaY > 0 && isAtBottom) || (deltaY < 0 && isAtTop)) {
                      e.stopPropagation();
                    }
                  }
                }}
              >
                <div>
                  {renderDocumentGrid()}
                </div>
              </section>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Filter-Panel als Slide-In (Sheet) - nur auf Mobile */}
      <Sheet open={showFilters && isMobile} onOpenChange={(open) => {
        // Nur auf Mobile öffnen/schließen
        if (isMobile) {
          setShowFilters(open)
        } else {
          setShowFilters(false)
        }
      }}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </SheetTitle>
            <SheetDescription className="text-sm">
              {galleryFilterDescription}
            </SheetDescription>
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

      {/* Mobile Gallery Sheet im Story-Modus - öffnet wenn Quellenverzeichnis aktiv ist */}
      {mode === 'story' && (
        <Sheet open={showReferenceLegend && isMobile} onOpenChange={(open) => {
          if (!open && isMobile) {
            handleCloseReferenceLegend()
          }
        }}>
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
            <SheetHeader className="flex-shrink-0">
              <SheetTitle>Quellenverzeichnis</SheetTitle>
              <SheetDescription className="text-sm">
                Die Antwort wurde aus diesen Dokumenten generiert.
              </SheetDescription>
            </SheetHeader>
            
            {/* Quellenverzeichnis */}
            {chatReferences && chatReferences.length > 0 && (
              <div className="flex-shrink-0 border-b bg-background py-3 mt-4">
                <ChatReferenceList
                  references={chatReferences}
                  libraryId={libraryId}
                  onDocumentClick={(fileId) => {
                    // Öffne Dokument-Detailansicht
                    const doc = docs.find(d => d.id === fileId)
                    if (doc) {
                      openDocDetail(doc)
                    }
                  }}
                />
              </div>
            )}
            
            {/* Dokumente-Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto mt-4">
              <ScrollArea className="h-full">
                <div>
                  {renderDocumentGrid()}
                </div>
              </ScrollArea>
            </div>
          </SheetContent>
        </Sheet>
      )}

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

