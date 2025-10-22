"use client"

import { useEffect, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { FileText, MessageSquare } from 'lucide-react'

interface ChatPanelProps {
  libraryId: string
  variant?: 'default' | 'compact'
}

interface ChatConfigResponse {
  library: { id: string; label: string }
  config: {
    public: boolean
    titleAvatarSrc?: string
    welcomeMessage: string
    errorMessage?: string
    placeholder?: string
    maxChars: number
    maxCharsWarningMessage?: string
    footerText?: string
    companyLink?: string
    features?: { citations?: boolean; streaming?: boolean }
  }
  vectorIndex: string
}

export function ChatPanel({ libraryId, variant = 'default' }: ChatPanelProps) {
  const [cfg, setCfg] = useState<ChatConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [answer, setAnswer] = useState<string>('')
  const [results, setResults] = useState<Array<{ id: string; score?: number; fileName?: string; chunkIndex?: number; text?: string }>>([])
  const [queryId, setQueryId] = useState<string | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [debugJson, setDebugJson] = useState<unknown | null>(null)
  const [answerLength, setAnswerLength] = useState<'kurz' | 'mittel' | 'ausführlich'>('mittel')
  const [retriever, setRetriever] = useState<'chunk' | 'doc'>('chunk')
  const inputRef = useRef<HTMLInputElement>(null)
  const galleryFilters = useAtomValue(galleryFiltersAtom)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/config`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Fehler beim Laden der Chat-Konfiguration: ${res.statusText}`)
        const data = await res.json() as ChatConfigResponse
        if (!cancelled) setCfg(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [libraryId])

  async function onSend() {
    if (!cfg) return
    if (!input.trim()) return
    if (cfg.config.maxChars && input.length > cfg.config.maxChars) {
      setError(cfg.config.maxCharsWarningMessage || 'Eingabe zu lang')
      return
    }
    setError(null)
    setAnswer('')
    setResults([])
    try {
      // Query aus aktiven Facetten filtern
      const params = new URLSearchParams()
      Object.entries(galleryFilters || {}).forEach(([k, arr]) => {
        if (Array.isArray(arr)) for (const v of arr) params.append(k, String(v))
      })
      params.set('retriever', retriever)
      const url = `/api/chat/${encodeURIComponent(libraryId)}${params.toString() ? `?${params.toString()}` : ''}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug': '1' },
        body: JSON.stringify({ message: input, answerLength })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Fehler bei der Anfrage')
      if (typeof data?.answer === 'string' && Array.isArray(data?.sources)) {
        setAnswer(data.answer)
        setResults(data.sources)
        setQueryId(typeof data?.queryId === 'string' ? data.queryId : null)
      } else if (Array.isArray(data?.results)) {
        const safe = (data.results as Array<unknown>).map((r): { id: string; score?: number; fileName?: string; chunkIndex?: number; text?: string } => {
          const obj = (r && typeof r === 'object') ? r as Record<string, unknown> : {}
          const id = String(obj.id ?? '')
          const score = typeof obj.score === 'number' ? obj.score : undefined
          const meta = (obj.metadata && typeof obj.metadata === 'object') ? obj.metadata as Record<string, unknown> : undefined
          const fileName = meta && typeof meta.fileName === 'string' ? meta.fileName : undefined
          const chunkIndex = meta && typeof meta.chunkIndex === 'number' ? meta.chunkIndex : undefined
          const text = meta && typeof meta.text === 'string' ? meta.text : undefined
          return { id, score, fileName, chunkIndex, text }
        })
        setResults(safe)
        setAnswer('')
        setQueryId(typeof (data as { queryId?: unknown }).queryId === 'string' ? (data as { queryId: string }).queryId : null)
      } else {
        setAnswer(typeof data.echo === 'string' ? data.echo : JSON.stringify(data))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    }
  }

  if (loading) return <div className={variant === 'compact' ? '' : 'p-6'}>Lade Chat...</div>
  if (error) return <div className={(variant === 'compact' ? '' : 'p-6 ') + 'text-destructive'}>{error}</div>
  if (!cfg) return <div className={variant === 'compact' ? '' : 'p-6'}>Keine Konfiguration gefunden.</div>

  if (variant === 'compact') {
    return (<>
      <div className="rounded border p-3 space-y-3">
        <div className="font-medium flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Chat‑Archiv · Beta</div>
        {cfg.config.welcomeMessage && (
          <div className="text-xs text-muted-foreground">{cfg.config.welcomeMessage}</div>
        )}
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => {
            setInput('Erzeuge ein Inhaltsverzeichnis der verfügbaren Dokumente: Nenne die 7 wichtigsten Themenbereiche und liste zu jedem Thema die 7 relevantesten Unterkategorien. Nutze ausschließlich die Dokument-Summaries (kind="doc") als Quelle. Antworte in einer strukturierten Liste mit Themen und Unterpunkten.')
            setRetriever('doc')
          }}>Inhaltsverzeichnis</Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            className="flex-1 h-9"
            placeholder={cfg.config.placeholder || 'Ihre Frage...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSend() }}
          />
          <Button type="button" size="sm" onClick={onSend}>Senden</Button>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          <span>Antwortlänge:</span>
          <div className="flex gap-1">
            {(['kurz','mittel','ausführlich'] as const).map(v => (
              <Button key={v} type="button" size="sm" variant={answerLength===v? 'default':'outline'} onClick={() => setAnswerLength(v)} className="h-7 px-2">
                {v}
              </Button>
            ))}
          </div>
          <span>Datenbasis:</span>
          <div className="flex gap-1">
            {(['chunk','doc'] as const).map(v => (
              <Button key={v} type="button" size="sm" variant={retriever===v? 'default':'outline'} onClick={() => setRetriever(v)} className="h-7 px-2 capitalize">
                {v === 'chunk' ? 'Chunks' : 'Summaries'}
              </Button>
            ))}
          </div>
        </div>
        
        {error && <div className="text-sm text-destructive">{error}</div>}
        {answer && (
          <div className="p-3 rounded border bg-muted/30">
            <div className="text-xs text-muted-foreground mb-1">Antwort:</div>
            <div className="text-sm whitespace-pre-wrap break-words">{answer}</div>
            {queryId ? (
              <div className="mt-2">
                <Button type="button" variant="outline" size="sm" onClick={async () => {
                  try {
                    setDebugOpen(true)
                    setDebugJson(null)
                    const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`, { cache: 'no-store' })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data?.error || 'Debug laden fehlgeschlagen')
                    setDebugJson(data)
                  } catch (e) {
                    setDebugJson({ error: e instanceof Error ? e.message : 'Unbekannter Fehler' })
                  }
                }}>Debug</Button>
              </div>
            ) : null}
          </div>
        )}
        {results.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {results.map((r, i) => (
              <Tooltip key={`${r.id}-${i}`}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Quelle ${i + 1}`}>
                    <FileText className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[420px] p-3">
                  <div className="text-xs text-muted-foreground mb-1">Quelle {i + 1}</div>
                  <div className="text-sm font-medium break-all">{r.fileName || r.id}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    {typeof r.score === 'number' && <Badge variant="secondary">Score {r.score.toFixed(3)}</Badge>}
                    {typeof r.chunkIndex === 'number' && <Badge variant="outline">Chunk {r.chunkIndex}</Badge>}
                  </div>
                  {r.text && <div className="mt-2 text-sm whitespace-pre-wrap break-words">{r.text}</div>}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>

      {debugOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDebugOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-background shadow-2xl">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-medium">Debug Query</div>
              <Button variant="ghost" size="sm" onClick={() => setDebugOpen(false)}>Schließen</Button>
            </div>
            <div className="p-4 h-[calc(100vh-56px)] overflow-auto">
              <pre className="text-xs whitespace-pre-wrap break-words">{debugJson !== null ? (typeof debugJson === 'string' ? debugJson : JSON.stringify(debugJson, null, 2)) : 'Lade…'}</pre>
            </div>
          </div>
        </div>
      ) : null}
    </>)
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto w-full">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {cfg.config.titleAvatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cfg.config.titleAvatarSrc} alt="Avatar" className="h-8 w-8 rounded" />
            ) : null}
            <span>Chat · {cfg.library.label}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">{cfg.config.welcomeMessage}</div>
          <Separator className="my-3" />
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>Antwortlänge:</span>
            <div className="flex gap-1">
              {(['kurz','mittel','ausführlich'] as const).map(v => (
                <Button key={v} type="button" size="sm" variant={answerLength===v? 'default':'outline'} onClick={() => setAnswerLength(v)} className="h-7">
                  {v}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Input
              ref={inputRef}
              className="flex-1"
              placeholder={cfg.config.placeholder || 'Ihre Frage...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSend() }}
            />
            <Button type="button" onClick={onSend}>Senden</Button>
          </div>
          {error && <div className="mt-3 text-sm text-destructive">{error}</div>}
          {answer && (
            <div className="mt-4 p-3 rounded border bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">Antwort:</div>
              <div className="whitespace-pre-wrap break-words">{answer}</div>
            </div>
          )}
          {results.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {results.map((r, i) => (
                <Tooltip key={`${r.id}-${i}`}>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Quelle ${i + 1}`}>
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[420px] p-3">
                    <div className="text-xs text-muted-foreground mb-1">Quelle {i + 1}</div>
                    <div className="text-sm font-medium break-all">{r.fileName || r.id}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      {typeof r.score === 'number' && <Badge variant="secondary">Score {r.score.toFixed(3)}</Badge>}
                      {typeof r.chunkIndex === 'number' && <Badge variant="outline">Chunk {r.chunkIndex}</Badge>}
                    </div>
                    {r.text && <div className="mt-2 text-sm whitespace-pre-wrap break-words">{r.text}</div>}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
          {cfg.config.footerText && (
            <div className="mt-6 text-xs text-muted-foreground">
              {cfg.config.footerText} {cfg.config.companyLink ? (<a className="underline" href={cfg.config.companyLink} target="_blank" rel="noreferrer">mehr</a>) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


