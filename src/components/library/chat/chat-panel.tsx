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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChatMessage } from './chat-message'
import type { ChatResponse } from '@/types/chat-response'
import { MessageSquare, SlidersHorizontal, Loader2 } from 'lucide-react'
import { useSetAtom } from 'jotai'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
import type { Character } from '@/types/character'

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
    targetLanguage?: 'de' | 'en' | 'it' | 'fr' | 'es' | 'ar'
    character?: Character
    socialContext?: 'scientific' | 'popular' | 'youth' | 'senior'
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
  character?: Character
}

export function ChatPanel({ libraryId, variant = 'default' }: ChatPanelProps) {
  const [cfg, setCfg] = useState<ChatConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [answerLength, setAnswerLength] = useState<'kurz' | 'mittel' | 'ausführlich' | 'unbegrenzt'>('mittel')
  const setChatReferences = useSetAtom(chatReferencesAtom)
  const [retriever, setRetriever] = useState<'chunk' | 'doc' | 'auto'>('auto')
  const [targetLanguage, setTargetLanguage] = useState<'de' | 'en' | 'it' | 'fr' | 'es' | 'ar'>('de')
  const [character, setCharacter] = useState<Character>('developer')
  const [socialContext, setSocialContext] = useState<'scientific' | 'popular' | 'youth' | 'senior'>('popular')
  const [isSending, setIsSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const galleryFilters = useAtomValue(galleryFiltersAtom)
  const prevMessagesLengthRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/config`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Fehler beim Laden der Chat-Konfiguration: ${res.statusText}`)
        const data = await res.json() as ChatConfigResponse
        if (!cancelled) {
          setCfg(data)
          // Setze Default-Werte aus Config, falls vorhanden
          if (data.config.targetLanguage) setTargetLanguage(data.config.targetLanguage)
          if (data.config.character) setCharacter(data.config.character)
          if (data.config.socialContext) setSocialContext(data.config.socialContext)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [libraryId])

  // Gemeinsame Hilfsfunktion: Erstelle ChatMessage aus QueryLog-Daten
  function createMessagesFromQueryLog(queryLog: { queryId: string; question: string; answer?: string; references?: ChatResponse['references']; suggestedQuestions?: string[]; createdAt: string | Date }): ChatMessage[] {
    const messages: ChatMessage[] = []
    
    // Frage als Message
    messages.push({
      id: `${queryLog.queryId}-question`,
      type: 'question',
      content: queryLog.question,
      createdAt: typeof queryLog.createdAt === 'string' ? queryLog.createdAt : queryLog.createdAt.toISOString(),
    })
    
    // Antwort als Message (wenn vorhanden)
    if (queryLog.answer) {
      const refs: ChatResponse['references'] = Array.isArray(queryLog.references) ? queryLog.references : []
      const suggestedQuestions = Array.isArray(queryLog.suggestedQuestions)
        ? queryLog.suggestedQuestions.filter((q: unknown): q is string => typeof q === 'string')
        : []
      
      messages.push({
        id: `${queryLog.queryId}-answer`,
        type: 'answer',
        content: queryLog.answer,
        references: refs,
        suggestedQuestions,
        queryId: queryLog.queryId,
        createdAt: typeof queryLog.createdAt === 'string' ? queryLog.createdAt : queryLog.createdAt.toISOString(),
      })
    }
    
    return messages
  }

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
                // Verwende gemeinsame Funktion zur Erstellung der Messages
                const messages = createMessagesFromQueryLog({
                  queryId: item.queryId,
                  question: item.question,
                  answer: queryData.answer,
                  references: Array.isArray(queryData.references) ? queryData.references : undefined,
                  suggestedQuestions: Array.isArray(queryData.suggestedQuestions) ? queryData.suggestedQuestions : undefined,
                  createdAt: item.createdAt,
                })
                historyMessages.push(...messages)
              }
            } catch {
              // Ignoriere Fehler beim Laden einzelner Queries
            }
          }
          // Sortiere nach Datum (neueste zuerst) und kehre um für chronologische Reihenfolge
          historyMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          if (!cancelled) {
            setMessages(historyMessages)
            // Setze prevMessagesLengthRef, damit beim ersten Laden nicht gescrollt wird
            prevMessagesLengthRef.current = historyMessages.length
          }
        }
      } catch {
        if (!cancelled) setMessages([])
      }
    }
    loadHistory()
    return () => { cancelled = true }
  }, [libraryId])

  // Auto-Scroll zum Bereich der letzten Frage/Antwort (nur bei neuen Nachrichten)
  useEffect(() => {
    // Scroll nur, wenn neue Nachrichten hinzugefügt wurden
    if (messages.length <= prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length
      return
    }
    prevMessagesLengthRef.current = messages.length

    if (scrollRef.current && messages.length > 0) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null
      if (viewport) {
        // Finde die letzte Antwort-Message (falls vorhanden), sonst die letzte Frage
        const lastAnswerId = messages.filter(m => m.type === 'answer').pop()?.id
        const targetId = lastAnswerId || messages.filter(m => m.type === 'question').pop()?.id
        if (targetId) {
          const targetElement = messageRefs.current.get(targetId)
          if (targetElement) {
            setTimeout(() => {
              // Verwende scrollIntoView für zuverlässigere Positionierung
              // block: 'center' positioniert die Message in der Mitte des Viewports
              // oder 'start' mit offset für Abstand oben
              const containerRect = viewport.getBoundingClientRect()
              const elementRect = targetElement.getBoundingClientRect()
              const relativeTop = elementRect.top - containerRect.top + viewport.scrollTop
              
              // Scrolle zur Message mit 120px Abstand oben (damit Frage und Antwort sichtbar sind)
              viewport.scrollTo({
                top: Math.max(0, relativeTop - 120),
                behavior: 'smooth'
              })
            }, 150)
          }
        }
      }
    }
  }, [messages])

  async function onSend() {
    if (!cfg) return
    if (!input.trim()) return
    if (isSending) return // Verhindere doppelte Anfragen
    if (cfg.config.maxChars && input.length > cfg.config.maxChars) {
      setError(cfg.config.maxCharsWarningMessage || 'Eingabe zu lang')
      return
    }
    setError(null)
    setIsSending(true)
    const questionText = input.trim()
    const questionId = `question-${Date.now()}`
    
    // Füge Frage als Message hinzu
    const questionMessage: ChatMessage = {
      id: questionId,
      type: 'question',
      content: questionText,
      createdAt: new Date().toISOString(),
      character: character, // Speichere den aktuellen Charakter mit der Frage
    }
    setMessages(prev => [...prev, questionMessage])
    setInput('')
    
    try {
      // Query aus aktiven Facetten filtern
      const params = new URLSearchParams()
      Object.entries(galleryFilters || {}).forEach(([k, arr]) => {
        if (Array.isArray(arr)) for (const v of arr) params.append(k, String(v))
      })
      // Bei 'auto' keinen expliziten retriever-Parameter setzen → Analyse läuft automatisch
      if (retriever !== 'auto') {
        params.set('retriever', retriever)
      }
      // Füge die neuen Optionen als Query-Parameter hinzu
      params.set('targetLanguage', targetLanguage)
      params.set('character', character)
      params.set('socialContext', socialContext)
      const url = `/api/chat/${encodeURIComponent(libraryId)}${params.toString() ? `?${params.toString()}` : ''}`
      
      // Bereite Chatverlauf vor: Nur vollständige Frage-Antwort-Paare aus den letzten Nachrichten
      // Begrenze auf die letzten 5 Paare, um Token-Limit nicht zu überschreiten
      const chatHistory: Array<{ question: string; answer: string }> = []
      const recentMessages = messages.slice(-10) // Letzte 10 Messages (max. 5 Paare)
      for (let i = 0; i < recentMessages.length - 1; i++) {
        const msg = recentMessages[i]
        const nextMsg = recentMessages[i + 1]
        if (msg.type === 'question' && nextMsg.type === 'answer') {
          chatHistory.push({
            question: msg.content,
            answer: nextMsg.content,
          })
        }
      }
      // Begrenze auf die letzten 5 Paare
      const limitedChatHistory = chatHistory.slice(-5)
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug': '1' },
        body: JSON.stringify({ 
          message: questionText, 
          answerLength,
          chatHistory: limitedChatHistory.length > 0 ? limitedChatHistory : undefined,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Fehler bei der Anfrage')
      
      // Handling für NeedsClarificationResponse
      if (data?.status === 'needs_clarification') {
        const clarificationData = data as { status: 'needs_clarification'; analysis: { explanation: string; suggestedQuestions: { chunk?: string; summary?: string } } }
        const suggestedQuestions: string[] = []
        if (clarificationData.analysis.suggestedQuestions.chunk) {
          suggestedQuestions.push(clarificationData.analysis.suggestedQuestions.chunk)
        }
        if (clarificationData.analysis.suggestedQuestions.summary) {
          suggestedQuestions.push(clarificationData.analysis.suggestedQuestions.summary)
        }
        const clarificationMessage: ChatMessage = {
          id: `clarification-${Date.now()}`,
          type: 'answer',
          content: `${clarificationData.analysis.explanation}\n\n**Vorgeschlagene präzisierte Fragen:**`,
          suggestedQuestions,
          createdAt: new Date().toISOString(),
        }
        setMessages(prev => [...prev, clarificationMessage])
        return
      }
      
      // Neue strukturierte Response
      if (typeof data?.answer === 'string') {
        // Verwende gemeinsame Funktion zur Erstellung der Messages
        const answerMessages = createMessagesFromQueryLog({
          queryId: typeof data?.queryId === 'string' ? data.queryId : `temp-${Date.now()}`,
          question: questionText,
          answer: data.answer,
          references: Array.isArray(data.references) ? data.references : undefined,
          suggestedQuestions: Array.isArray(data.suggestedQuestions) ? data.suggestedQuestions : undefined,
          createdAt: new Date(),
        })
        
        // Nur die Antwort-Message verwenden (Frage wurde bereits hinzugefügt)
        const answerMessage = answerMessages.find(m => m.type === 'answer')
        if (answerMessage) {
          // Setze Referenzen im Atom für Gallery
          if (answerMessage.references) {
            setChatReferences(answerMessage.references)
          }
          
          setMessages(prev => [...prev, answerMessage])
        }
      } else {
        throw new Error('Ungültige Antwort vom Server')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      // Entferne die Frage wieder, wenn Fehler auftrat
      setMessages(prev => prev.filter(m => m.id !== questionId))
    } finally {
      setIsSending(false)
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
                messageId={msg.id}
                type={msg.type}
                content={msg.content}
                references={msg.references}
                suggestedQuestions={msg.suggestedQuestions}
                queryId={msg.queryId}
                createdAt={msg.createdAt}
                libraryId={libraryId}
                character={msg.character}
                innerRef={(id, el) => {
                  if (el) {
                    messageRefs.current.set(id, el)
                  } else {
                    messageRefs.current.delete(id)
                  }
                }}
                onQuestionClick={(question) => {
                  setInput(question)
                  inputRef.current?.focus()
                }}
              />
            ))}
            {isSending && (
              <div className="flex gap-3 mb-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-muted/30 border rounded-lg p-3">
                    <div className="text-sm text-muted-foreground">Wird verarbeitet...</div>
                  </div>
                </div>
              </div>
            )}
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
              onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) onSend() }}
              disabled={isSending}
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
                      {(['auto','chunk','doc'] as const).map(v => {
                        const label = v === 'auto' ? 'Auto' : v === 'chunk' ? 'Spezifisch' : 'Übersichtlich'
                        const tip = v === 'auto'
                          ? 'Das System analysiert Ihre Frage automatisch und wählt die beste Methode (Spezifisch oder Übersichtlich).'
                          : v === 'chunk'
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
                    <div className="text-sm font-medium mb-2">Zielsprache:</div>
                    <Select value={targetLanguage} onValueChange={(v) => setTargetLanguage(v as typeof targetLanguage)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="en">Englisch</SelectItem>
                        <SelectItem value="it">Italienisch</SelectItem>
                        <SelectItem value="fr">Französisch</SelectItem>
                        <SelectItem value="es">Spanisch</SelectItem>
                        <SelectItem value="ar">Arabisch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">Charakter/Perspektive:</div>
                    <Select value={character} onValueChange={(v) => setCharacter(v as typeof character)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Knowledge & Innovation */}
                        <SelectItem value="developer">Developer-orientiert</SelectItem>
                        <SelectItem value="technical">Technisch-orientiert</SelectItem>
                        <SelectItem value="open-source">Open-Source-spezifisch</SelectItem>
                        <SelectItem value="scientific">Naturwissenschaftlich</SelectItem>
                        {/* Society & Impact */}
                        <SelectItem value="eco-social">Ökosozial-orientiert</SelectItem>
                        <SelectItem value="social">Sozial-orientiert</SelectItem>
                        <SelectItem value="civic">Bürgerschaftlich-orientiert</SelectItem>
                        <SelectItem value="policy">Politikwissenschaftlich-orientiert</SelectItem>
                        <SelectItem value="cultural">Kulturell-orientiert</SelectItem>
                        {/* Economy & Practice */}
                        <SelectItem value="business">Business-orientiert</SelectItem>
                        <SelectItem value="entrepreneurial">Unternehmerisch-orientiert</SelectItem>
                        <SelectItem value="legal">Rechtskundespezifisch</SelectItem>
                        <SelectItem value="educational">Bildungswissenschaftlich-orientiert</SelectItem>
                        <SelectItem value="creative">Kreativ-orientiert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">Sozialer Kontext/Sprachebene:</div>
                    <Select value={socialContext} onValueChange={(v) => setSocialContext(v as typeof socialContext)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scientific">Wissenschaftlich</SelectItem>
                        <SelectItem value="popular">Populär</SelectItem>
                        <SelectItem value="youth">Jugendlich</SelectItem>
                        <SelectItem value="senior">Seniorengerecht</SelectItem>
                      </SelectContent>
                    </Select>
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
            <Button type="button" size="sm" onClick={onSend} className="h-9" disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Warten...
                </>
              ) : (
                'Senden'
              )}
            </Button>
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
                  messageId={msg.id}
                  type={msg.type}
                  content={msg.content}
                  references={msg.references}
                  suggestedQuestions={msg.suggestedQuestions}
                  queryId={msg.queryId}
                  createdAt={msg.createdAt}
                  libraryId={libraryId}
                  character={msg.character}
                  innerRef={(id, el) => {
                    if (el) {
                      messageRefs.current.set(id, el)
                    } else {
                      messageRefs.current.delete(id)
                    }
                  }}
                  onQuestionClick={(question) => {
                    setInput(question)
                    inputRef.current?.focus()
                  }}
                />
              ))}
              {isSending && (
                <div className="flex gap-3 mb-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-muted/30 border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Wird verarbeitet...</div>
                    </div>
                  </div>
                </div>
              )}
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
                onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) onSend() }}
                disabled={isSending}
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
                        {(['auto','chunk','doc'] as const).map(v => {
                          const label = v === 'auto' ? 'Auto' : v === 'chunk' ? 'Spezifisch' : 'Übersichtlich'
                          const tip = v === 'auto'
                            ? 'Das System analysiert Ihre Frage automatisch und wählt die beste Methode (Spezifisch oder Übersichtlich).'
                            : v === 'chunk'
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
                      <div className="text-sm font-medium mb-2">Zielsprache:</div>
                      <Select value={targetLanguage} onValueChange={(v) => setTargetLanguage(v as typeof targetLanguage)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="de">Deutsch</SelectItem>
                          <SelectItem value="en">Englisch</SelectItem>
                          <SelectItem value="it">Italienisch</SelectItem>
                          <SelectItem value="fr">Französisch</SelectItem>
                          <SelectItem value="es">Spanisch</SelectItem>
                          <SelectItem value="ar">Arabisch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Charakter/Perspektive:</div>
                      <Select value={character} onValueChange={(v) => setCharacter(v as typeof character)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="developer">Developer-orientiert</SelectItem>
                          <SelectItem value="business">Business-orientiert</SelectItem>
                          <SelectItem value="eco-social">Ökosozial-orientiert</SelectItem>
                          <SelectItem value="social">Sozial-orientiert</SelectItem>
                          <SelectItem value="open-source">Open-Source-spezifisch</SelectItem>
                          <SelectItem value="legal">Rechtskundespezifisch</SelectItem>
                          <SelectItem value="scientific">Naturwissenschaftlich</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Sozialer Kontext/Sprachebene:</div>
                      <Select value={socialContext} onValueChange={(v) => setSocialContext(v as typeof socialContext)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scientific">Wissenschaftlich</SelectItem>
                          <SelectItem value="popular">Populär</SelectItem>
                          <SelectItem value="youth">Jugendlich</SelectItem>
                          <SelectItem value="senior">Seniorengerecht</SelectItem>
                        </SelectContent>
                      </Select>
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
              <Button type="button" onClick={onSend} disabled={isSending}>
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Warten...
                  </>
                ) : (
                  'Senden'
                )}
              </Button>
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


