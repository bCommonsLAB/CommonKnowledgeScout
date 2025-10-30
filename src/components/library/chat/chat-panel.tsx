"use client"

import { useEffect, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessage } from './chat-message'
import type { ChatResponse } from '@/types/chat-response'
import { MessageSquare, SlidersHorizontal } from 'lucide-react'
import { useSetAtom } from 'jotai'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'

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

interface ChatMessage {
  id: string
  type: 'question' | 'answer'
  content: string
  references?: ChatResponse['references']
  suggestedQuestions?: string[]
  queryId?: string
  createdAt: string
}

export function ChatPanel({ libraryId, variant = 'default' }: ChatPanelProps) {
  const [cfg, setCfg] = useState<ChatConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [answerLength, setAnswerLength] = useState<'kurz' | 'mittel' | 'ausführlich' | 'unbegrenzt'>('mittel')
  const setChatReferences = useSetAtom(chatReferencesAtom)
  const [retriever, setRetriever] = useState<'chunk' | 'doc'>('chunk')
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
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

  // Lade historische Fragen als Messages
  useEffect(() => {
    let cancelled = false
    async function loadHistory() {
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries?limit=20`, { cache: 'no-store' })
        const data = await res.json() as { items?: Array<{ queryId: string; createdAt: string; question: string; mode: string; status: string }>; error?: unknown }
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Laden der Historie')
        
        if (!cancelled && Array.isArray(data.items)) {
          // Lade für jede historische Frage die vollständige Antwort
          const historyMessages: ChatMessage[] = []
          for (const item of data.items) {
            try {
              const queryRes = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(item.queryId)}`, { cache: 'no-store' })
              const queryData = await queryRes.json()
              if (queryRes.ok && typeof queryData?.answer === 'string') {
                // Frage als Message
                historyMessages.push({
                  id: `${item.queryId}-question`,
                  type: 'question',
                  content: item.question,
                  createdAt: item.createdAt,
                })
                // Antwort als Message
                let refs: ChatResponse['references'] = []
                if (Array.isArray(queryData?.references)) {
                  refs = queryData.references as ChatResponse['references']
                }
                const suggestedQuestions = Array.isArray(queryData?.suggestedQuestions)
                  ? queryData.suggestedQuestions.filter((q: unknown): q is string => typeof q === 'string')
                  : []
                historyMessages.push({
                  id: `${item.queryId}-answer`,
                  type: 'answer',
                  content: queryData.answer,
                  references: refs,
                  suggestedQuestions,
                  queryId: item.queryId,
                  createdAt: item.createdAt,
                })
              }
            } catch {
              // Ignoriere Fehler beim Laden einzelner Queries
            }
          }
          // Sortiere nach Datum (neueste zuerst) und kehre um für chronologische Reihenfolge
          historyMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          if (!cancelled) setMessages(historyMessages)
        }
      } catch {
        if (!cancelled) setMessages([])
      }
    }
    loadHistory()
    return () => { cancelled = true }
  }, [libraryId])

  // Auto-Scroll nach neuen Messages
  useEffect(() => {
    if (scrollRef.current) {
      // ScrollArea erstellt ein Viewport-Element, das wir zum Scrollen benötigen
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null
      if (viewport) {
        setTimeout(() => {
          viewport.scrollTop = viewport.scrollHeight
        }, 100)
      }
    }
  }, [messages])

  async function onSend() {
    if (!cfg) return
    if (!input.trim()) return
    if (cfg.config.maxChars && input.length > cfg.config.maxChars) {
      setError(cfg.config.maxCharsWarningMessage || 'Eingabe zu lang')
      return
    }
    setError(null)
    const questionText = input.trim()
    const questionId = `question-${Date.now()}`
    
    // Füge Frage als Message hinzu
    const questionMessage: ChatMessage = {
      id: questionId,
      type: 'question',
      content: questionText,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, questionMessage])
    setInput('')
    
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
        body: JSON.stringify({ message: questionText, answerLength })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Fehler bei der Anfrage')
      
      // Neue strukturierte Response
      if (typeof data?.answer === 'string') {
        // Referenzen aus neuer strukturierter Response
        let refs: ChatResponse['references'] = []
        if (Array.isArray(data?.references)) {
          refs = data.references as ChatResponse['references']
        } else {
          // Fallback: Generiere Referenzen aus sources (Rückwärtskompatibilität)
          const sources = Array.isArray(data?.sources) ? data.sources : []
          refs = sources.map((s: unknown, index: number) => {
            const src = (s && typeof s === 'object') ? s as Record<string, unknown> : {}
            return {
              number: index + 1,
              fileId: typeof src.fileId === 'string' ? src.fileId : String(src.id || ''),
              fileName: typeof src.fileName === 'string' ? src.fileName : undefined,
              description: typeof src.description === 'string' ? src.description : `Quelle ${index + 1}`,
            }
          })
        }
        // Setze Referenzen im Atom für Gallery
        setChatReferences(refs)
        
        // Suggested Questions
        const suggestedQuestions = Array.isArray(data?.suggestedQuestions) 
          ? data.suggestedQuestions.filter((q: unknown): q is string => typeof q === 'string')
          : []
        
        // Füge Antwort als Message hinzu
        const answerMessage: ChatMessage = {
          id: `answer-${Date.now()}`,
          type: 'answer',
          content: data.answer,
          references: refs,
          suggestedQuestions,
          queryId: typeof data?.queryId === 'string' ? data.queryId : undefined,
          createdAt: new Date().toISOString(),
        }
        setMessages(prev => [...prev, answerMessage])
      } else {
        throw new Error('Ungültige Antwort vom Server')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      // Entferne die Frage wieder, wenn Fehler auftrat
      setMessages(prev => prev.filter(m => m.id !== questionId))
    }
  }

  if (loading) return <div className={variant === 'compact' ? '' : 'p-6'}>Lade Chat...</div>
  if (error) return <div className={(variant === 'compact' ? '' : 'p-6 ') + 'text-destructive'}>{error}</div>
  if (!cfg) return <div className={variant === 'compact' ? '' : 'p-6'}>Keine Konfiguration gefunden.</div>

  if (variant === 'compact') {
    return (
      <div className="flex flex-col h-full min-h-0 rounded border bg-background">
        {/* Header */}
        <div className="p-3 border-b flex-shrink-0 bg-background">
          <div className="font-medium flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Chat‑Archiv · Beta</div>
          {cfg.config.welcomeMessage && (
            <div className="text-xs text-muted-foreground mt-1">{cfg.config.welcomeMessage}</div>
          )}
        </div>

        {/* Scrollbarer Chat-Verlauf */}
        <ScrollArea className="flex-1 min-h-0 overflow-hidden" ref={scrollRef}>
          <div className="p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                {cfg.config.welcomeMessage || 'Stelle eine Frage, um zu beginnen.'}
              </div>
            )}
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                type={msg.type}
                content={msg.content}
                references={msg.references}
                suggestedQuestions={msg.suggestedQuestions}
                queryId={msg.queryId}
                createdAt={msg.createdAt}
                libraryId={libraryId}
                onQuestionClick={(question) => {
                  setInput(question)
                  inputRef.current?.focus()
                }}
              />
            ))}
            {error && (
              <div className="text-sm text-destructive p-3 bg-destructive/10 rounded border border-destructive/20">
                {error}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Fixierter Input-Bereich */}
        <div className="border-t p-3 bg-background flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Input
              ref={inputRef}
              className="flex-1 h-9"
              placeholder={cfg.config.placeholder || 'Ihre Frage...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSend() }}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-2">Antwortlänge:</div>
                    <div className="flex gap-1 flex-wrap">
                      {(['kurz','mittel','ausführlich','unbegrenzt'] as const).map(v => (
                        <Button 
                          key={v} 
                          type="button" 
                          size="sm" 
                          variant={answerLength===v? 'default':'outline'} 
                          onClick={() => setAnswerLength(v)} 
                          className="h-7 px-2 text-xs"
                        >
                          {v}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">Methode:</div>
                    <div className="flex gap-1 flex-wrap">
                      {(['chunk','doc'] as const).map(v => {
                        const label = v === 'chunk' ? 'Spezifisch' : 'Übersichtlich'
                        const tip = v === 'chunk'
                          ? 'Für die Frage interessante Textstellen (Chunks) suchen und daraus die Antwort generieren. Nur spezifische Inhalte – dafür präziser.'
                          : 'Aus den Zusammenfassungen aller Kapitel/Dokumente eine Antwort kreieren. Mehr Überblick – dafür etwas ungenauer.'
                        return (
                          <Tooltip key={v}>
                            <TooltipTrigger asChild>
                              <Button 
                                type="button" 
                                size="sm" 
                                variant={retriever===v? 'default':'outline'} 
                                onClick={() => setRetriever(v)} 
                                className="h-7 px-2 text-xs"
                              >
                                {label}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[320px] text-xs">
                              <div className="max-w-[280px]">{tip}</div>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        setInput('Erzeuge ein Inhaltsverzeichnis der verfügbaren Dokumente: Nenne die 7 wichtigsten Themenbereiche und liste zu jedem Thema die 7 relevantesten Unterkategorien. Nutze ausschließlich die Dokument-Summaries (kind="doc") als Quelle. Antworte in einer strukturierten Liste mit Themen und Unterpunkten.')
                        setRetriever('doc')
                      }}
                    >
                      Inhaltsverzeichnis generieren
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button type="button" size="sm" onClick={onSend} className="h-9">Senden</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto w-full h-full flex flex-col min-h-[600px]">
      <Card className="flex flex-col h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {cfg.config.titleAvatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cfg.config.titleAvatarSrc} alt="Avatar" className="h-8 w-8 rounded" />
            ) : null}
            <span>Chat · {cfg.library.label}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 min-h-0 p-0">
          {/* Scrollbarer Chat-Verlauf */}
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="p-6 space-y-4">
              {cfg.config.welcomeMessage && messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  {cfg.config.welcomeMessage}
                </div>
              )}
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  type={msg.type}
                  content={msg.content}
                  references={msg.references}
                  suggestedQuestions={msg.suggestedQuestions}
                  queryId={msg.queryId}
                  createdAt={msg.createdAt}
                  libraryId={libraryId}
                  onQuestionClick={(question) => {
                    setInput(question)
                    inputRef.current?.focus()
                  }}
                />
              ))}
              {error && (
                <div className="text-sm text-destructive p-3 bg-destructive/10 rounded border border-destructive/20">
                  {error}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Fixierter Input-Bereich */}
          <div className="border-t p-4 bg-background">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                className="flex-1"
                placeholder={cfg.config.placeholder || 'Ihre Frage...'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSend() }}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium mb-2">Antwortlänge:</div>
                      <div className="flex gap-1 flex-wrap">
                        {(['kurz','mittel','ausführlich','unbegrenzt'] as const).map(v => (
                          <Button 
                            key={v} 
                            type="button" 
                            size="sm" 
                            variant={answerLength===v? 'default':'outline'} 
                            onClick={() => setAnswerLength(v)} 
                            className="h-7"
                          >
                            {v}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Methode:</div>
                      <div className="flex gap-1 flex-wrap">
                        {(['chunk','doc'] as const).map(v => {
                          const label = v === 'chunk' ? 'Spezifisch' : 'Übersichtlich'
                          const tip = v === 'chunk'
                            ? 'Für die Frage interessante Textstellen (Chunks) suchen und daraus die Antwort generieren. Nur spezifische Inhalte – dafür präziser.'
                            : 'Aus den Zusammenfassungen aller Kapitel/Dokumente eine Antwort kreieren. Mehr Überblick – dafür etwas ungenauer.'
                          return (
                            <Tooltip key={v}>
                              <TooltipTrigger asChild>
                                <Button 
                                  type="button" 
                                  size="sm" 
                                  variant={retriever===v? 'default':'outline'} 
                                  onClick={() => setRetriever(v)}
                                >
                                  {label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[320px] text-xs">
                                <div className="max-w-[280px]">{tip}</div>
                              </TooltipContent>
                            </Tooltip>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => {
                          setInput('Erzeuge ein Inhaltsverzeichnis der verfügbaren Dokumente: Nenne die 7 wichtigsten Themenbereiche und liste zu jedem Thema die 7 relevantesten Unterkategorien. Nutze ausschließlich die Dokument-Summaries (kind="doc") als Quelle. Antworte in einer strukturierten Liste mit Themen und Unterpunkten.')
                          setRetriever('doc')
                        }}
                      >
                        Inhaltsverzeichnis generieren
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button type="button" onClick={onSend}>Senden</Button>
            </div>
            {cfg.config.footerText && (
              <div className="mt-4 text-xs text-muted-foreground">
                {cfg.config.footerText} {cfg.config.companyLink ? (<a className="underline" href={cfg.config.companyLink} target="_blank" rel="noreferrer">mehr</a>) : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


