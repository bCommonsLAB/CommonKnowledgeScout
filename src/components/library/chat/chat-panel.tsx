"use client"

import { useEffect, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { ChatMessage } from './chat-message'
import { ChatSelector } from './chat-selector'
import { ChatConfigDisplay } from './chat-config-display'
import { ProcessingStatus } from './processing-status'
import { ChatConversationItem } from './chat-conversation-item'
import type { ChatResponse } from '@/types/chat-response'
import type { ChatProcessingStep } from '@/types/chat-processing'
import { Loader2, Settings, Bot, BookOpen } from 'lucide-react'
import { useSetAtom } from 'jotai'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
import { Switch } from '@/components/ui/switch'
import {
  type Character,
  type AnswerLength,
  type Retriever,
  type TargetLanguage,
  type SocialContext,
  GENDER_INCLUSIVE_DEFAULT,
  ANSWER_LENGTH_VALUES,
  ANSWER_LENGTH_LABELS,
  ANSWER_LENGTH_DEFAULT,
  RETRIEVER_VALUES,
  RETRIEVER_LABELS,
  RETRIEVER_DEFAULT,
  TARGET_LANGUAGE_VALUES,
  TARGET_LANGUAGE_LABELS,
  TARGET_LANGUAGE_DEFAULT,
  CHARACTER_VALUES,
  CHARACTER_LABELS,
  CHARACTER_DEFAULT,
  SOCIAL_CONTEXT_VALUES,
  SOCIAL_CONTEXT_LABELS,
  SOCIAL_CONTEXT_DEFAULT,
} from '@/lib/chat/constants'

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
    targetLanguage?: TargetLanguage
    character?: Character
    socialContext?: SocialContext
    genderInclusive?: boolean
    userPreferences?: {
      targetLanguage?: TargetLanguage
      character?: Character
      socialContext?: SocialContext
      genderInclusive?: boolean
    }
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
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  socialContext?: SocialContext
}

export function ChatPanel({ libraryId, variant = 'default' }: ChatPanelProps) {
  const [cfg, setCfg] = useState<ChatConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [answerLength, setAnswerLength] = useState<AnswerLength>(ANSWER_LENGTH_DEFAULT)
  const setChatReferences = useSetAtom(chatReferencesAtom)
  const [retriever, setRetriever] = useState<Retriever>(RETRIEVER_DEFAULT)
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>(TARGET_LANGUAGE_DEFAULT)
  const [character, setCharacter] = useState<Character>(CHARACTER_DEFAULT)
  const [socialContext, setSocialContext] = useState<SocialContext>(SOCIAL_CONTEXT_DEFAULT)
  const [genderInclusive, setGenderInclusive] = useState<boolean>(GENDER_INCLUSIVE_DEFAULT)
  const [isSending, setIsSending] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<ChatProcessingStep[]>([])
  // State für geöffnete Accordions (conversationId -> boolean)
  const [openConversations, setOpenConversations] = useState<Set<string>>(new Set())
  const [configPopoverOpen, setConfigPopoverOpen] = useState(false)
  // State für gecachtes Inhaltsverzeichnis
  const [cachedTOC, setCachedTOC] = useState<{
    answer: string
    references?: ChatResponse['references']
    suggestedQuestions?: string[]
    queryId: string
    createdAt: string
  } | null>(null)
  const [isCheckingTOC, setIsCheckingTOC] = useState(false)
  const [tocOpen, setTocOpen] = useState(true) // TOC standardmäßig geöffnet
  const tocAccordionRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const galleryFilters = useAtomValue(galleryFiltersAtom)
  const prevMessagesLengthRef = useRef(0)

  // Beobachte TOC-Accordion-Status über MutationObserver
  useEffect(() => {
    const accordionElement = tocAccordionRef.current
    if (!accordionElement) return
    
    const observer = new MutationObserver(() => {
      const accordionItem = accordionElement.querySelector('[data-state]')
      const currentState = accordionItem?.getAttribute('data-state')
      const isCurrentlyOpen = currentState === 'open'
      if (isCurrentlyOpen !== tocOpen) {
        setTocOpen(isCurrentlyOpen)
      }
    })
    
    observer.observe(accordionElement, {
      attributes: true,
      attributeFilter: ['data-state'],
      subtree: true,
    })
    
    return () => observer.disconnect()
  }, [tocOpen])

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
          console.log('[ChatPanel] Config geladen:', {
            hasUserPreferences: !!data.config.userPreferences,
            userPreferences: data.config.userPreferences,
            welcomeMessage: data.config.welcomeMessage,
          })
          // Setze Default-Werte aus Config, falls vorhanden
          // Priorität: userPreferences > Config-Defaults
          const prefs = data.config.userPreferences
          if (prefs?.targetLanguage) {
            setTargetLanguage(prefs.targetLanguage)
          } else if (data.config.targetLanguage) {
            setTargetLanguage(data.config.targetLanguage)
          }
          if (prefs?.character) {
            setCharacter(prefs.character)
          } else if (data.config.character) {
            setCharacter(data.config.character)
          }
          if (prefs?.socialContext) {
            setSocialContext(prefs.socialContext)
          } else if (data.config.socialContext) {
            setSocialContext(data.config.socialContext)
          }
          if (prefs?.genderInclusive !== undefined) {
            setGenderInclusive(prefs.genderInclusive)
          } else if (data.config.genderInclusive !== undefined) {
            setGenderInclusive(data.config.genderInclusive)
          }
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
  function createMessagesFromQueryLog(queryLog: { queryId: string; question: string; answer?: string; references?: ChatResponse['references']; suggestedQuestions?: string[]; createdAt: string | Date; answerLength?: AnswerLength; retriever?: Retriever; targetLanguage?: TargetLanguage; character?: string; socialContext?: SocialContext }): ChatMessage[] {
    const messages: ChatMessage[] = []
    
    // Frage als Message
    messages.push({
      id: `${queryLog.queryId}-question`,
      type: 'question',
      content: queryLog.question,
      createdAt: typeof queryLog.createdAt === 'string' ? queryLog.createdAt : queryLog.createdAt.toISOString(),
      queryId: queryLog.queryId, // Setze queryId, damit wir historische Fragen erkennen können
      answerLength: queryLog.answerLength,
      retriever: queryLog.retriever,
      targetLanguage: queryLog.targetLanguage,
      character: queryLog.character as Character | undefined,
      socialContext: queryLog.socialContext,
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
        answerLength: queryLog.answerLength,
        retriever: queryLog.retriever,
        targetLanguage: queryLog.targetLanguage,
        character: queryLog.character as Character | undefined,
        socialContext: queryLog.socialContext,
      })
    }
    
    return messages
  }

  // Gruppiere Messages zu Frage-Antwort-Paaren
  function groupMessagesToConversations(messages: ChatMessage[]): Array<{ conversationId: string; question: ChatMessage; answer?: ChatMessage }> {
    const conversations: Array<{ conversationId: string; question: ChatMessage; answer?: ChatMessage }> = []
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.type === 'question') {
        // Prüfe, ob die nächste Message eine Antwort ist
        const nextMsg = messages[i + 1]
        const conversationId = msg.queryId || msg.id.replace('-question', '') || `conv-${i}`
        
        conversations.push({
          conversationId,
          question: msg,
          answer: nextMsg && nextMsg.type === 'answer' ? nextMsg : undefined,
        })
        
        // Überspringe die Antwort-Message im nächsten Durchlauf
        if (nextMsg && nextMsg.type === 'answer') {
          i++
        }
      }
    }
    
    return conversations
  }

  // Zeige Welcome-Assistent nicht mehr benötigt - Konfiguration ist jetzt in der Kontextbar

  // Lade historische Fragen als Messages
  useEffect(() => {
    let cancelled = false
    async function loadHistory() {
      if (!activeChatId) {
        // Wenn kein aktiver Chat, setze Messages leer
        if (!cancelled) setMessages([])
        return
      }
      
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries?limit=20&chatId=${encodeURIComponent(activeChatId)}`, { cache: 'no-store' })
        const data = await res.json() as { items?: Array<{ queryId: string; createdAt: string; question: string; mode: string; status: string }>; error?: unknown }
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Laden der Historie')
        
        if (!cancelled && Array.isArray(data.items)) {
          // Lade für jede historische Frage die vollständige Antwort
          // Filtere TOC-Queries heraus - diese werden separat unter der Kontextbar angezeigt
          const historyMessages: ChatMessage[] = []
          console.log('[ChatPanel] Lade Historie für Chat:', activeChatId, 'Anzahl Items:', data.items.length)
          for (const item of data.items) {
            try {
              const queryRes = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(item.queryId)}`, { cache: 'no-store' })
              const queryData = await queryRes.json()
              if (queryRes.ok && typeof queryData?.answer === 'string') {
                // Überspringe TOC-Queries - diese werden separat angezeigt
                if (queryData.queryType === 'toc') {
                  continue
                }
                // Verwende gemeinsame Funktion zur Erstellung der Messages
                const messages = createMessagesFromQueryLog({
                  queryId: item.queryId,
                  question: item.question,
                  answer: queryData.answer,
                  references: Array.isArray(queryData.references) ? queryData.references : undefined,
                  suggestedQuestions: Array.isArray(queryData.suggestedQuestions) ? queryData.suggestedQuestions : undefined,
                  createdAt: item.createdAt,
                  answerLength: queryData.answerLength,
                  retriever: queryData.retriever,
                  targetLanguage: queryData.targetLanguage,
                  character: queryData.character,
                  socialContext: queryData.socialContext,
                })
                historyMessages.push(...messages)
              }
            } catch {
              // Ignoriere Fehler beim Laden einzelner Queries
            }
          }
          // Sortiere nach Datum (neueste zuerst) und kehre um für chronologische Reihenfolge
          historyMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          console.log('[ChatPanel] Historie geladen:', historyMessages.length, 'Messages')
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
  }, [libraryId, activeChatId])

  // Auto-Scroll zum neuesten Accordion (nur bei neuen Nachrichten)
  useEffect(() => {
    // Scroll nur, wenn neue Nachrichten hinzugefügt wurden
    if (messages.length <= prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length
      return
    }
    prevMessagesLengthRef.current = messages.length

    // Prüfe, ob es ein neues geöffnetes Accordion gibt
    const conversations = groupMessagesToConversations(messages)
    const lastConversation = conversations[conversations.length - 1]
    if (lastConversation && openConversations.has(lastConversation.conversationId)) {
      setTimeout(() => {
        const element = document.querySelector(`[data-conversation-id="${lastConversation.conversationId}"]`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }, 500)
    }
  }, [messages, openConversations])

  // Handler für das Löschen einer Query
  async function handleDeleteQuery(queryId: string): Promise<void> {
    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
        const errorMessage = typeof errorData?.error === 'string' ? errorData.error : 'Fehler beim Löschen der Query'
        console.error('[ChatPanel] Fehler beim Löschen der Query:', {
          status: res.status,
          statusText: res.statusText,
          error: errorMessage,
        })
        throw new Error(errorMessage)
      }
      
      // Prüfe, ob die gelöschte Query eine TOC-Query war, bevor wir sie aus den Messages entfernen
      const tocQuestion = 'Welche Themen werden hier behandelt, können wir die übersichtlich als Inhaltsverzeichnis ausgeben.'
      const wasTOCQuery = messages.some(msg => msg.queryId === queryId && msg.type === 'question' && msg.content.trim() === tocQuestion.trim())
      
      // Entferne die Query aus den Messages
      setMessages(prev => prev.filter(msg => msg.queryId !== queryId))
      
      // Wenn eine TOC-Query gelöscht wurde, prüfe den Cache neu
      if (wasTOCQuery) {
        setTimeout(() => {
          checkTOCCache()
        }, 500)
      }
    } catch (error) {
      console.error('[ChatPanel] Fehler beim Löschen der Query:', error)
      throw error
    }
  }

  // Handler für das Neustellen einer Frage
  async function handleReloadQuestion(
    question: string,
    config: { character?: Character; answerLength?: AnswerLength; retriever?: Retriever; targetLanguage?: TargetLanguage; socialContext?: SocialContext }
  ): Promise<void> {
    // Setze die Config-Parameter
    if (config.character) setCharacter(config.character)
    if (config.answerLength) setAnswerLength(config.answerLength)
    if (config.retriever) setRetriever(config.retriever)
    if (config.targetLanguage) setTargetLanguage(config.targetLanguage)
    if (config.socialContext) setSocialContext(config.socialContext)
    
    // Setze die Frage in das Input-Feld
    setInput(question)
    
    // Warte kurz, damit die Config-Parameter gesetzt sind
    await new Promise(resolve => setTimeout(resolve, 150))
    
    // Rufe onSend direkt auf - die Config-Parameter sollten jetzt gesetzt sein
    // Da React State-Updates asynchron sind, müssen wir sicherstellen, dass sie durch sind
    // Wir verwenden die aktuellen Werte direkt
    const currentCharacter = config.character || character
    const currentAnswerLength = config.answerLength || answerLength
    const currentRetriever = config.retriever || retriever
    const currentTargetLanguage = config.targetLanguage || targetLanguage
    const currentSocialContext = config.socialContext || socialContext
    
    // Setze Input mit der Frage
    setInput(question)
    
    // Warte kurz und rufe dann onSend auf
    setTimeout(() => {
      if (input.trim()) {
        onSend()
      }
    }, 100)
  }

  // Speichere User-Präferenzen in Library-Config
  async function saveUserPreferences(settings: {
    targetLanguage: TargetLanguage
    character: Character
    socialContext: SocialContext
    genderInclusive: boolean
  }): Promise<void> {
    try {
      const response = await fetch(`/api/libraries/${encodeURIComponent(libraryId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: libraryId,
          config: {
            chat: {
              userPreferences: settings,
            },
          },
        }),
      })
      if (!response.ok) {
        throw new Error('Fehler beim Speichern der Präferenzen')
      }
      // Aktualisiere lokalen State
      setTargetLanguage(settings.targetLanguage)
      setCharacter(settings.character)
      setSocialContext(settings.socialContext)
      setGenderInclusive(settings.genderInclusive)
    } catch (error) {
      console.error('[ChatPanel] Fehler beim Speichern der Präferenzen:', error)
      throw error
    }
  }

  // Handler für Inhaltsverzeichnis-Generierung
  async function handleGenerateTOC() {
    if (isSending) return // Verhindere doppelte Ausführung
    const tocQuestion = 'Welche Themen werden hier behandelt, können wir die übersichtlich als Inhaltsverzeichnis ausgeben.'
    // Starte die Anfrage direkt, OHNE sie als normale Message hinzuzufügen
    // Die Antwort wird über den TOC-Cache-Mechanismus unter der Kontextbar angezeigt
    await sendQuestionDirectly(tocQuestion, 'summary', true) // true = isTOCQuery
    // Nach erfolgreicher Generierung Cache prüfen
    checkTOCCache()
  }

  // Prüfe, ob Inhaltsverzeichnis bereits gecacht ist
  async function checkTOCCache() {
    if (!cfg) return
    
    setIsCheckingTOC(true)
    try {
      const tocQuestion = 'Welche Themen werden hier behandelt, können wir die übersichtlich als Inhaltsverzeichnis ausgeben.'
      const params = new URLSearchParams()
      params.set('question', tocQuestion)
      params.set('targetLanguage', targetLanguage)
      params.set('character', character)
      params.set('socialContext', socialContext)
      params.set('genderInclusive', String(genderInclusive))
      params.set('retriever', 'summary')
      
      // Füge Filter-Parameter hinzu
      if (galleryFilters) {
        Object.entries(galleryFilters).forEach(([key, values]) => {
          if (Array.isArray(values) && values.length > 0) {
            values.forEach(value => {
              params.append(key, String(value))
            })
          }
        })
      }
      
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/toc-cache?${params.toString()}`, {
        cache: 'no-store',
      })
      
      if (res.ok) {
        const data = await res.json() as { found: boolean; answer?: string; references?: ChatResponse['references']; suggestedQuestions?: string[]; queryId?: string; createdAt?: string }
        if (data.found && data.answer && data.queryId) {
          setCachedTOC({
            answer: data.answer,
            references: data.references,
            suggestedQuestions: data.suggestedQuestions,
            queryId: data.queryId,
            createdAt: data.createdAt || new Date().toISOString(),
          })
        } else {
          setCachedTOC(null)
        }
      } else {
        setCachedTOC(null)
      }
    } catch (error) {
      console.error('[ChatPanel] Fehler beim Prüfen des TOC-Cache:', error)
      setCachedTOC(null)
    } finally {
      setIsCheckingTOC(false)
    }
  }

  // Prüfe Cache bei Änderungen der Kontext-Parameter oder Filter
  useEffect(() => {
    if (!cfg) return
    // Prüfe Cache, wenn sich Kontext-Parameter oder Filter ändern
    checkTOCCache()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, targetLanguage, character, socialContext, genderInclusive, libraryId, galleryFilters])
  
  // Prüfe auch nach erfolgreicher Generierung
  useEffect(() => {
    // Prüfe Cache nachdem eine neue Antwort hinzugefügt wurde
    // (wenn die letzte Nachricht eine Antwort ist und die Frage eine TOC-Frage war)
    // ABER: TOC-Queries werden nicht mehr als normale Messages hinzugefügt,
    // daher müssen wir den Cache anders prüfen
    // Cache wird nach erfolgreicher Generierung direkt geprüft (in handleGenerateTOC)
  }, [messages.length])

  // Direkter Versand einer Frage ohne Input-Feld
  async function sendQuestionDirectly(questionText: string, retrieverOverride?: Retriever, isTOCQuery = false): Promise<void> {
    if (!cfg) return
    if (isSending) return // Verhindere doppelte Anfragen
    if (cfg.config.maxChars && questionText.length > cfg.config.maxChars) {
      setError(cfg.config.maxCharsWarningMessage || 'Eingabe zu lang')
      return
    }
    setError(null)
    setIsSending(true)
    
    // Für TOC-Queries: Nicht als normale Message hinzufügen, nur Cache prüfen
    const tocQuestion = 'Welche Themen werden hier behandelt, können wir die übersichtlich als Inhaltsverzeichnis ausgeben.'
    const isTOC = isTOCQuery || questionText.trim() === tocQuestion.trim()
    
    // Prüfe, ob diese Frage bereits in den Messages vorhanden ist (nur für normale Fragen)
    if (!isTOC) {
      const alreadyExists = messages.some(msg => 
        msg.type === 'question' && msg.content.trim() === questionText.trim()
      )
      
      if (alreadyExists) {
        console.log('[ChatPanel] Frage bereits vorhanden, überspringe doppelten Eintrag')
        setIsSending(false)
        return
      }
    }
    
    const questionId = `question-${Date.now()}`
    const effectiveRetriever = retrieverOverride || retriever
    
    // Füge Frage als Message hinzu (nur für normale Fragen, nicht für TOC)
    if (!isTOC) {
    const questionMessage: ChatMessage = {
      id: questionId,
      type: 'question',
      content: questionText,
      createdAt: new Date().toISOString(),
        character: character,
      answerLength,
        retriever: effectiveRetriever === 'auto' ? undefined : effectiveRetriever,
      targetLanguage,
      socialContext,
    }
    setMessages(prev => [...prev, questionMessage])
    
    // Schließe alle vorherigen Accordions, wenn eine neue Frage gestellt wird
    setOpenConversations(new Set())
    }
    
    try {
      // Query aus aktiven Facetten filtern
      const params = new URLSearchParams()
      Object.entries(galleryFilters || {}).forEach(([k, arr]) => {
        if (Array.isArray(arr)) for (const v of arr) params.append(k, String(v))
      })
      // Bei 'auto' keinen expliziten retriever-Parameter setzen → Analyse läuft automatisch
      if (effectiveRetriever !== 'auto') {
        params.set('retriever', effectiveRetriever)
      }
      // Füge die neuen Optionen als Query-Parameter hinzu
      params.set('targetLanguage', targetLanguage)
      params.set('character', character)
      params.set('socialContext', socialContext)
      params.set('genderInclusive', String(genderInclusive))
      
      // Bereite Chatverlauf vor: Nur vollständige Frage-Antwort-Paare aus den letzten Nachrichten
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
      
      // Verwende Stream-Endpoint für Status-Updates
      const streamUrl = `/api/chat/${encodeURIComponent(libraryId)}/stream${params.toString() ? `?${params.toString()}` : ''}`
      setProcessingSteps([]) // Reset Steps
      
      const res = await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: questionText, 
          answerLength,
          chatHistory: limitedChatHistory.length > 0 ? limitedChatHistory : undefined,
          chatId: activeChatId || undefined,
        })
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      // SSE Stream verarbeiten
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      if (!reader) {
        throw new Error('Stream nicht verfügbar')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Letzte unvollständige Zeile behalten

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6) // Entferne "data: "
              const step: ChatProcessingStep = JSON.parse(jsonStr)
              
              setProcessingSteps(prev => [...prev, step])

              // Handle complete step
              if (step.type === 'complete') {
                // Check if this is a clarification response
                const clarificationStep = step as ChatProcessingStep & { clarification?: { explanation: string; suggestedQuestions: { chunk?: string; summary?: string } } }
                if (clarificationStep.clarification) {
                  // Handle clarification response
                  // Die clarification hat eine andere Struktur, verwende die vorhandenen Daten aus step
                  const clarificationMessage: ChatMessage = {
                    id: `clarification-${Date.now()}`,
                    type: 'answer',
                    content: step.answer, // Verwende die Antwort aus step
                    suggestedQuestions: step.suggestedQuestions, // Verwende die suggestedQuestions aus step
                    createdAt: new Date().toISOString(),
                  }
                  setMessages(prev => [...prev, clarificationMessage])
                  setProcessingSteps([])
                  setIsSending(false)
                  return
                }

                if (typeof step.chatId === 'string' && !activeChatId) {
                  setActiveChatId(step.chatId)
                }

                const finalQueryId = typeof step.queryId === 'string' ? step.queryId : `temp-${Date.now()}`
                
                // Für TOC-Queries: Antwort nicht als normale Message hinzufügen, nur Cache aktualisieren
                if (isTOC) {
                  // Cache wird automatisch durch checkTOCCache aktualisiert
                  setProcessingSteps([])
                  setIsSending(false)
                  // Nach kurzer Verzögerung Cache prüfen, damit die Query in der DB gespeichert ist
                  setTimeout(() => {
                    checkTOCCache()
                  }, 1000)
                  return
                }
                
                // Erstelle nur die Antwort-Message (die Frage wurde bereits hinzugefügt)
                const refs: ChatResponse['references'] = Array.isArray(step.references) 
                  ? step.references.filter((r): r is ChatResponse['references'][number] => 
                      typeof r === 'object' && r !== null && 'number' in r && 'fileId' in r && 'description' in r
                    )
                  : []
                const suggestedQuestions = Array.isArray(step.suggestedQuestions)
                  ? step.suggestedQuestions.filter((q: unknown): q is string => typeof q === 'string')
                  : []
                
                const answerMessage: ChatMessage = {
                  id: `${finalQueryId}-answer`,
                  type: 'answer',
                  content: step.answer,
                  references: refs,
                  suggestedQuestions,
                  queryId: finalQueryId,
                  createdAt: new Date().toISOString(),
                  answerLength,
                  retriever: effectiveRetriever === 'auto' ? undefined : effectiveRetriever,
                  targetLanguage,
                  character,
                  socialContext,
                }

                if (answerMessage.content) {
                  if (answerMessage.references) {
                    setChatReferences(answerMessage.references)
                  }
                  
                  // Füge nur die Antwort hinzu
                  setMessages(prev => [...prev, answerMessage])
                  
                  // Aktualisiere die vorhandene Frage mit queryId
                  setMessages(prev => prev.map(msg => 
                    msg.id === questionId 
                      ? { ...msg, queryId: finalQueryId }
                      : msg
                  ))
                  
                  // Schließe alle vorherigen Accordions und öffne nur das neue
                  const newConversationId = finalQueryId
                  setOpenConversations(new Set([newConversationId]))
                  
                  // Scroll zum neuen Accordion nach kurzer Verzögerung
                  setTimeout(() => {
                    const element = document.querySelector(`[data-conversation-id="${newConversationId}"]`)
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                    }
                  }, 500)
                }
                setProcessingSteps([]) // Clear steps after completion
                setIsSending(false)
                return
              }

              // Handle error step
              if (step.type === 'error') {
                throw new Error(step.error)
              }
            } catch (parseError) {
              console.error('[ChatPanel] Fehler beim Parsen von SSE-Update:', parseError)
            }
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      // Entferne die Frage nur, wenn es keine TOC-Query war
      if (!isTOC) {
      setMessages(prev => prev.filter(m => m.id !== questionId))
      }
    } finally {
      setIsSending(false)
    }
  }

  async function onSend() {
    if (!cfg) return
    if (!input.trim()) return
    // Verwende die direkte Send-Funktion
    await sendQuestionDirectly(input.trim())
    setInput('')
  }

  if (loading) return <div className={variant === 'compact' ? '' : 'p-6'}>Lade Chat...</div>
  if (error) return <div className={(variant === 'compact' ? '' : 'p-6 ') + 'text-destructive'}>{error}</div>
  if (!cfg) return <div className={variant === 'compact' ? '' : 'p-6'}>Keine Konfiguration gefunden.</div>

  if (variant === 'compact') {
    return (
      <div className="flex flex-col h-full min-h-0 w-full">
        {/* Kontextbar - ohne Rahmen, ähnlich wie Gallery */}
        <div className="flex items-center gap-2 pb-2 flex-shrink-0">
          {/* Zielsprache */}
          <Select value={targetLanguage} onValueChange={(v) => setTargetLanguage(v as TargetLanguage)}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_LANGUAGE_VALUES.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {TARGET_LANGUAGE_LABELS[lang]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Perspektive (Charakter) */}
          <Select value={character} onValueChange={(v) => setCharacter(v as Character)}>
            <SelectTrigger className="h-8 text-xs w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHARACTER_VALUES.map((char) => (
                <SelectItem key={char} value={char}>
                  {CHARACTER_LABELS[char]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Sozialer Kontext */}
          <Select value={socialContext} onValueChange={(v) => setSocialContext(v as SocialContext)}>
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOCIAL_CONTEXT_VALUES.map((ctx) => (
                <SelectItem key={ctx} value={ctx}>
                  {SOCIAL_CONTEXT_LABELS[ctx]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Config-Popover */}
          <Popover open={configPopoverOpen} onOpenChange={setConfigPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="font-medium text-sm mb-3">Erweiterte Einstellungen</div>
                
                {/* Antwortlänge */}
                <div>
                  <div className="text-sm font-medium mb-2">Antwortlänge:</div>
                  <div className="flex gap-1 flex-wrap">
                    {ANSWER_LENGTH_VALUES.map((v) => (
                      <Button 
                        key={v} 
                        type="button" 
                        size="sm" 
                        variant={answerLength===v? 'default':'outline'} 
                        onClick={() => setAnswerLength(v)} 
                        className="h-7 px-2 text-xs"
                      >
                        {ANSWER_LENGTH_LABELS[v]}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Methode */}
                <div>
                  <div className="text-sm font-medium mb-2">Methode:</div>
                  <div className="flex gap-1 flex-wrap">
                    {RETRIEVER_VALUES.filter(v => v !== 'summary').map((v) => {
                      const label = RETRIEVER_LABELS[v]
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
                
                {/* Gendergerechte Formulierung */}
                <div className="flex items-center justify-between rounded-md border p-2.5">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium">Gendergerechte Formulierung</div>
                    <div className="text-xs text-muted-foreground">
                      Verwende geschlechtsneutrale Formulierungen in den Antworten
                    </div>
                  </div>
                  <Switch
                    checked={genderInclusive}
                    onCheckedChange={setGenderInclusive}
                  />
                </div>
                
                {/* Themenübersicht anzeigen */}
                <div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={async () => {
                      await saveUserPreferences({
                        targetLanguage,
                        character,
                        socialContext,
                        genderInclusive,
                      })
                      await handleGenerateTOC()
                      setConfigPopoverOpen(false)
                    }}
                  >
                    Themenübersicht anzeigen
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Chat-Selector rechts */}
          <div className="ml-auto">
            <ChatSelector
              libraryId={libraryId}
              activeChatId={activeChatId}
              onChatChange={(chatId) => {
                setActiveChatId(chatId)
                if (chatId) {
                  // Messages werden durch loadHistory useEffect geladen
                } else {
                  setMessages([])
                }
              }}
              onCreateNewChat={() => {
                // Leere Messages, wenn neuer Chat erstellt wird
                setMessages([])
              }}
            />
          </div>
        </div>
        
        {/* Trennlinie unter der Kontextbar */}
        <div className="border-b mb-4"></div>
        
        {/* Scrollbarer Chat-Verlauf */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 h-full" ref={scrollRef}>
          <div className="p-4">
              {/* Inhaltsverzeichnis-Bereich im Scroll-Bereich */}
              {(isCheckingTOC || cachedTOC || (!isCheckingTOC && !cachedTOC)) && (
                <div className="mb-4">
                  {isCheckingTOC ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Prüfe Inhaltsverzeichnis...</span>
                    </div>
                  ) : cachedTOC ? (
                    <div ref={tocAccordionRef}>
                      <Accordion 
                        type="single" 
                        collapsible 
                        value={tocOpen ? 'toc' : undefined}
                      >
                        <AccordionItem value="toc" className="border-b">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex gap-3 items-center flex-1 min-w-0 mr-2">
                              <div className="flex-shrink-0">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                  <Bot className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <div className="text-sm font-medium">Themenübersicht</div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-4 pt-2">
                              <ChatMessage
                                type="answer"
                                content={cachedTOC.answer}
                                references={cachedTOC.references}
                                suggestedQuestions={cachedTOC.suggestedQuestions}
                                queryId={cachedTOC.queryId}
                                createdAt={cachedTOC.createdAt}
                                libraryId={libraryId}
                                onQuestionClick={(question) => {
                                  setInput(question)
                                  inputRef.current?.focus()
                                }}
                              />
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between py-3">
                      <div className="text-sm text-muted-foreground">
                        Themenübersicht für die aktuellen Einstellungen noch nicht verfügbar
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await saveUserPreferences({
                            targetLanguage,
                            character,
                            socialContext,
                            genderInclusive,
                          })
                          await handleGenerateTOC()
                        }}
                        disabled={isSending}
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generiere...
                          </>
                        ) : (
                          'Themenübersicht anzeigen'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Leerer Zustand / Startnachricht */}
              {!isCheckingTOC && !cachedTOC && messages.length === 0 && !isSending && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="text-4xl mb-4">💡</div>
                  <h3 className="text-lg font-medium mb-2">Willkommen im Story Mode.</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md">
                    Wähle oben Sprache und Perspektive, dann beginne dein Gespräch mit dem Wissen.
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Tipp: Stelle eine Frage oder klicke rechts auf einen Talk, um die Story aus deiner Sicht zu sehen.
                  </p>
                </div>
              )}
              
            {(() => {
              const conversations = groupMessagesToConversations(messages)
              return conversations.map((conv) => {
                const isOpen = openConversations.has(conv.conversationId)
                return (
                  <div key={conv.conversationId} data-conversation-id={conv.conversationId}>
                    <ChatConversationItem
                      pair={{
                        question: {
                          id: conv.question.id,
                          content: conv.question.content,
                          createdAt: conv.question.createdAt,
                          character: conv.question.character,
                          answerLength: conv.question.answerLength,
                          retriever: conv.question.retriever,
                          targetLanguage: conv.question.targetLanguage,
                          socialContext: conv.question.socialContext,
                          queryId: conv.question.queryId,
                        },
                        answer: conv.answer ? {
                          id: conv.answer.id,
                          content: conv.answer.content,
                          references: conv.answer.references,
                          suggestedQuestions: conv.answer.suggestedQuestions,
                          queryId: conv.answer.queryId,
                          createdAt: conv.answer.createdAt,
                          answerLength: conv.answer.answerLength,
                          retriever: conv.answer.retriever,
                          targetLanguage: conv.answer.targetLanguage,
                          character: conv.answer.character,
                          socialContext: conv.answer.socialContext,
                        } : undefined,
                      }}
                      conversationId={conv.conversationId}
                      isOpen={isOpen}
                      onOpenChange={(open) => {
                        setOpenConversations(prev => {
                          const next = new Set(prev)
                          if (open) {
                            next.add(conv.conversationId)
                          } else {
                            next.delete(conv.conversationId)
                          }
                          return next
                        })
                      }}
                      libraryId={libraryId}
                        onQuestionClick={(question) => {
                          setInput(question)
                          inputRef.current?.focus()
                        }}
                        onDelete={handleDeleteQuery}
                        onReload={handleReloadQuestion}
                        innerRef={(id, el) => {
                          if (el) {
                            messageRefs.current.set(id, el)
                          } else {
                            messageRefs.current.delete(id)
                          }
                        }}
                      />
                  </div>
                )
              })
            })()}
            {isSending && (
              <div className="mb-4">
                {/* Warten-Symbol - IMMER anzeigen */}
                <div className="flex gap-3 mb-2">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-muted/30 border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Wird verarbeitet...</div>
                      {/* Konfigurationsparameter während der Berechnung anzeigen */}
                      <div className="mt-2">
                        <ChatConfigDisplay
                          answerLength={answerLength}
                          retriever={retriever}
                          targetLanguage={targetLanguage}
                          character={character}
                          socialContext={socialContext}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {/* Logs dezent darunter */}
                {processingSteps.length > 0 && (
                  <div className="ml-11">
                    <ProcessingStatus steps={processingSteps} isActive={isSending} />
                  </div>
                )}
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
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              className="flex-1 h-9"
              placeholder={cfg.config.placeholder || 'Schreibe deine Frage … (z. B. „Wie erklären die SFSCon-Talks die Rolle von Open Source für die Gesellschaft?")'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) onSend() }}
              disabled={isSending}
            />
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
    </div>
  )
}

  return (
    <div className="w-full h-full flex flex-col min-h-[600px]">
      {/* Kontextbar - ohne Rahmen, ähnlich wie Gallery */}
      <div className="flex items-center gap-2 pb-2 flex-shrink-0">
        {/* Zielsprache */}
        <Select value={targetLanguage} onValueChange={(v) => setTargetLanguage(v as TargetLanguage)}>
          <SelectTrigger className="h-8 text-xs w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TARGET_LANGUAGE_VALUES.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {TARGET_LANGUAGE_LABELS[lang]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Perspektive (Charakter) */}
        <Select value={character} onValueChange={(v) => setCharacter(v as Character)}>
          <SelectTrigger className="h-8 text-xs w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHARACTER_VALUES.map((char) => (
              <SelectItem key={char} value={char}>
                {CHARACTER_LABELS[char]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Sozialer Kontext */}
        <Select value={socialContext} onValueChange={(v) => setSocialContext(v as SocialContext)}>
          <SelectTrigger className="h-8 text-xs w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOCIAL_CONTEXT_VALUES.map((ctx) => (
              <SelectItem key={ctx} value={ctx}>
                {SOCIAL_CONTEXT_LABELS[ctx]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Config-Popover */}
        <Popover open={configPopoverOpen} onOpenChange={setConfigPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="font-medium text-sm mb-3">Erweiterte Einstellungen</div>
              
              {/* Antwortlänge */}
              <div>
                <div className="text-sm font-medium mb-2">Antwortlänge:</div>
                <div className="flex gap-1 flex-wrap">
                  {ANSWER_LENGTH_VALUES.map((v) => (
                    <Button 
                      key={v} 
                      type="button" 
                      size="sm" 
                      variant={answerLength===v? 'default':'outline'} 
                      onClick={() => setAnswerLength(v)} 
                      className="h-7 px-2 text-xs"
                    >
                      {ANSWER_LENGTH_LABELS[v]}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Methode */}
              <div>
                <div className="text-sm font-medium mb-2">Methode:</div>
                <div className="flex gap-1 flex-wrap">
                  {RETRIEVER_VALUES.filter(v => v !== 'summary').map((v) => {
                    const label = RETRIEVER_LABELS[v]
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
              
              {/* Gendergerechte Formulierung */}
              <div className="flex items-center justify-between rounded-md border p-2.5">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium">Gendergerechte Formulierung</div>
                  <div className="text-xs text-muted-foreground">
                    Verwende geschlechtsneutrale Formulierungen in den Antworten
                  </div>
                </div>
                <Switch
                  checked={genderInclusive}
                  onCheckedChange={setGenderInclusive}
                />
              </div>
              
                {/* Themenübersicht anzeigen */}
                <div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={async () => {
                      await saveUserPreferences({
                        targetLanguage,
                        character,
                        socialContext,
                        genderInclusive,
                      })
                      await handleGenerateTOC()
                      setConfigPopoverOpen(false)
                    }}
                  >
                    Themenübersicht anzeigen
                  </Button>
                </div>
            </div>
          </PopoverContent>
        </Popover>
        
        {/* Chat-Selector rechts */}
        <div className="ml-auto">
          <ChatSelector
            libraryId={libraryId}
            activeChatId={activeChatId}
            onChatChange={(chatId) => {
              setActiveChatId(chatId)
              if (chatId) {
                // Messages werden durch loadHistory useEffect geladen
              } else {
                setMessages([])
              }
            }}
            onCreateNewChat={() => {
              // Leere Messages, wenn neuer Chat erstellt wird
              setMessages([])
            }}
          />
        </div>
      </div>
      
      {/* Trennlinie unter der Kontextbar */}
      <div className="border-b mb-4"></div>
      
      {/* Scrollbarer Chat-Verlauf */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 h-full" ref={scrollRef}>
          <div className="p-6">
            {/* Inhaltsverzeichnis-Bereich im Scroll-Bereich */}
            {(isCheckingTOC || cachedTOC || (!isCheckingTOC && !cachedTOC)) && (
              <div className="mb-4 pb-4 border-b">
                {isCheckingTOC ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Prüfe Inhaltsverzeichnis...</span>
                  </div>
                ) : cachedTOC ? (
                  <ChatMessage
                    type="answer"
                    content={cachedTOC.answer}
                    references={cachedTOC.references}
                    suggestedQuestions={cachedTOC.suggestedQuestions}
                    queryId={cachedTOC.queryId}
                    createdAt={cachedTOC.createdAt}
                    libraryId={libraryId}
                    onQuestionClick={(question) => {
                      setInput(question)
                      inputRef.current?.focus()
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Themenübersicht für die aktuellen Einstellungen noch nicht verfügbar
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await saveUserPreferences({
                          targetLanguage,
                          character,
                          socialContext,
                          genderInclusive,
                        })
                        await handleGenerateTOC()
                      }}
                      disabled={isSending}
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generiere...
                        </>
                      ) : (
                        'Themenübersicht anzeigen'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            {/* Leerer Zustand / Startnachricht für compact-Variante */}
            {!isCheckingTOC && !cachedTOC && messages.length === 0 && !isSending && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="text-4xl mb-4">💡</div>
                <h3 className="text-lg font-medium mb-2">Willkommen im Story Mode.</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Wähle oben Sprache und Perspektive, dann beginne dein Gespräch mit dem Wissen.
                </p>
                <p className="text-xs text-muted-foreground max-w-md">
                  Tipp: Stelle eine Frage oder klicke rechts auf einen Talk, um die Story aus deiner Sicht zu sehen.
                </p>
              </div>
            )}
            
            {(() => {
              const conversations = groupMessagesToConversations(messages)
              return conversations.map((conv) => {
                const isOpen = openConversations.has(conv.conversationId)
                return (
                  <div key={conv.conversationId} data-conversation-id={conv.conversationId}>
                    <ChatConversationItem
                      pair={{
                        question: {
                          id: conv.question.id,
                          content: conv.question.content,
                          createdAt: conv.question.createdAt,
                          character: conv.question.character,
                          answerLength: conv.question.answerLength,
                          retriever: conv.question.retriever,
                          targetLanguage: conv.question.targetLanguage,
                          socialContext: conv.question.socialContext,
                          queryId: conv.question.queryId,
                        },
                        answer: conv.answer ? {
                          id: conv.answer.id,
                          content: conv.answer.content,
                          references: conv.answer.references,
                          suggestedQuestions: conv.answer.suggestedQuestions,
                          queryId: conv.answer.queryId,
                          createdAt: conv.answer.createdAt,
                          answerLength: conv.answer.answerLength,
                          retriever: conv.answer.retriever,
                          targetLanguage: conv.answer.targetLanguage,
                          character: conv.answer.character,
                          socialContext: conv.answer.socialContext,
                        } : undefined,
                      }}
                      conversationId={conv.conversationId}
                      isOpen={isOpen}
                      onOpenChange={(open) => {
                        setOpenConversations(prev => {
                          const next = new Set(prev)
                          if (open) {
                            next.add(conv.conversationId)
                          } else {
                            next.delete(conv.conversationId)
                          }
                          return next
                        })
                      }}
                      libraryId={libraryId}
                      onQuestionClick={(question) => {
                        setInput(question)
                        inputRef.current?.focus()
                      }}
                      onDelete={handleDeleteQuery}
                      onReload={handleReloadQuestion}
                      innerRef={(id, el) => {
                        if (el) {
                          messageRefs.current.set(id, el)
                        } else {
                          messageRefs.current.delete(id)
                        }
                      }}
                    />
                  </div>
                )
              })
            })()}
            {isSending && (
              <div className="mb-4">
                {/* Warten-Symbol - IMMER anzeigen */}
                <div className="flex gap-3 mb-2">
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
                {/* Logs dezent darunter */}
                {processingSteps.length > 0 && (
                  <div className="ml-11">
                    <ProcessingStatus steps={processingSteps} isActive={isSending} />
                  </div>
                )}
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
        <div className="border-t p-4 bg-background flex-shrink-0">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              className="flex-1"
              placeholder={cfg.config.placeholder || 'Schreibe deine Frage … (z. B. „Wie erklären die SFSCon-Talks die Rolle von Open Source für die Gesellschaft?")'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) onSend() }}
              disabled={isSending}
            />
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
      </div>
    </div>
  )
}


