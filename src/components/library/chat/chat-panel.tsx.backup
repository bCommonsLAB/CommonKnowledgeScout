"use client"

import { useEffect, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StoryTopics } from '../story/story-topics'
import type { ChatResponse } from '@/types/chat-response'
import type { ChatProcessingStep } from '@/types/chat-processing'
import type { StoryTopicsData } from '@/types/story-topics'
import { useSetAtom } from 'jotai'
import { chatReferencesAtom } from '@/atoms/chat-references-atom'
import {
  type Character,
  type AnswerLength,
  type Retriever,
  type TargetLanguage,
  type SocialContext,
  ANSWER_LENGTH_DEFAULT,
  RETRIEVER_DEFAULT,
  TARGET_LANGUAGE_DEFAULT,
  CHARACTER_DEFAULT,
  SOCIAL_CONTEXT_DEFAULT,
} from '@/lib/chat/constants'
import { useStoryContext } from '@/hooks/use-story-context'
import { storyPerspectiveOpenAtom } from '@/atoms/story-context-atom'
import { useUser } from '@clerk/nextjs'
import { ChatInput } from './chat-input'
import { ChatConfigBar } from './chat-config-bar'
import { ChatConfigPopover } from './chat-config-popover'
import { ChatMessagesList } from './chat-messages-list'
import { useChatScroll } from './hooks/use-chat-scroll'
import type { ChatMessage } from './utils/chat-utils'
import { createMessagesFromQueryLog } from './utils/chat-utils'
import { getInitialTargetLanguage, getInitialCharacter, getInitialSocialContext, getInitialGenderInclusive } from './utils/chat-storage'

interface ChatPanelProps {
  libraryId: string
  variant?: 'default' | 'compact' | 'embedded'
}

interface ChatConfigResponse {
  library: { id: string; label: string }
  config: {
    placeholder?: string
    maxChars: number
    maxCharsWarningMessage?: string
    footerText?: string
    companyLink?: string
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

export function ChatPanel({ libraryId, variant = 'default' }: ChatPanelProps) {
  const isEmbedded = variant === 'embedded'
  const storyContext = useStoryContext()
  // Prüfe, ob Benutzer anonym ist (für localStorage-Persistenz)
  const { isSignedIn } = useUser()
  const isAnonymous = !isSignedIn
  // State für Config-Popover (muss vor perspectiveOpen deklariert werden)
  const [configPopoverOpen, setConfigPopoverOpen] = useState(false)
  // Im embedded-Modus: Verfolge ob Perspektive-Popover geöffnet ist
  // WICHTIG: Hooks müssen immer in der gleichen Reihenfolge aufgerufen werden
  const storyPerspectiveOpen = useAtomValue(storyPerspectiveOpenAtom)
  const perspectiveOpen = isEmbedded ? storyPerspectiveOpen : configPopoverOpen
  
  const [cfg, setCfg] = useState<ChatConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [answerLength, setAnswerLength] = useState<AnswerLength>(ANSWER_LENGTH_DEFAULT)
  const setChatReferences = useSetAtom(chatReferencesAtom)
  const [retriever, setRetriever] = useState<Retriever>(RETRIEVER_DEFAULT)
  // State für Chat-Input-Panel (nur im embedded Modus)
  const [isChatInputOpen, setIsChatInputOpen] = useState(false)
  // Im embedded-Modus: Werte aus StoryContext, sonst lokaler State
  // WICHTIG: Initial-Werte aus localStorage laden (falls vorhanden)
  const [targetLanguageState, setTargetLanguageState] = useState<TargetLanguage>(getInitialTargetLanguage())
  const [characterState, setCharacterState] = useState<Character>(getInitialCharacter())
  const [socialContextState, setSocialContextState] = useState<SocialContext>(getInitialSocialContext())
  
  // Ref für verfolgen, ob localStorage-Werte bereits geladen wurden
  const localStorageLoadedRef = useRef(false)
  
  // Prüfe beim initialen State, ob localStorage-Werte vorhanden sind
  // (durch Vergleich der initialen Werte mit Default-Werten)
  useEffect(() => {
    if (isEmbedded || !isAnonymous) return
    if (typeof window === 'undefined') return
    
    try {
      // Prüfe, ob die initialen Werte von den Default-Werten abweichen
      // (das bedeutet, sie wurden aus localStorage geladen)
      const initialTargetLanguage = getInitialTargetLanguage()
      const initialCharacter = getInitialCharacter()
      const initialSocialContext = getInitialSocialContext()
      
      if (
        initialTargetLanguage !== TARGET_LANGUAGE_DEFAULT ||
        initialCharacter !== CHARACTER_DEFAULT ||
        initialSocialContext !== SOCIAL_CONTEXT_DEFAULT
      ) {
        localStorageLoadedRef.current = true
        console.log('[ChatPanel] localStorage-Werte erkannt beim initialen State:', {
          targetLanguage: initialTargetLanguage,
          character: initialCharacter,
          socialContext: initialSocialContext,
        })
      }
      
      // Prüfe auch direkt localStorage (für den Fall, dass die Helper-Funktionen nicht funktionieren)
      const hasLocalStorage = 
        localStorage.getItem('story-context-targetLanguage') ||
        localStorage.getItem('story-context-character') ||
        localStorage.getItem('story-context-socialContext')
      
      if (hasLocalStorage && !localStorageLoadedRef.current) {
        localStorageLoadedRef.current = true
        console.log('[ChatPanel] localStorage-Werte erkannt durch direkte Prüfung')
      }
    } catch {
      // Ignoriere Fehler
    }
  }, [isAnonymous, isEmbedded])
  
  const targetLanguage = isEmbedded ? storyContext.targetLanguage : targetLanguageState
  const character = isEmbedded ? storyContext.character : characterState
  const socialContext = isEmbedded ? storyContext.socialContext : socialContextState
  const setTargetLanguage = isEmbedded ? storyContext.setTargetLanguage : setTargetLanguageState
  const setCharacter = isEmbedded ? storyContext.setCharacter : setCharacterState
  const setSocialContext = isEmbedded ? storyContext.setSocialContext : setSocialContextState
  const [genderInclusive, setGenderInclusive] = useState<boolean>(getInitialGenderInclusive())
  
  // Handler für Config-Popover: Speichere Werte beim Schließen
  function handleConfigPopoverChange(open: boolean) {
    setConfigPopoverOpen(open)
    
    // Wenn Popover geschlossen wird: Speichere Werte (nur im anonymen Modus, non-embedded)
    if (!open && !isEmbedded && isAnonymous) {
      try {
        localStorage.setItem('story-context-targetLanguage', JSON.stringify(targetLanguageState))
        localStorage.setItem('story-context-character', JSON.stringify(characterState))
        localStorage.setItem('story-context-socialContext', JSON.stringify(socialContextState))
        localStorage.setItem('story-context-genderInclusive', JSON.stringify(genderInclusive))
        console.log('[ChatPanel] Speichere Kontextfilter in localStorage beim Schließen des Popovers:', {
          targetLanguage: targetLanguageState,
          character: characterState,
          socialContext: socialContextState,
          genderInclusive,
        })
      } catch (error) {
        console.error('[ChatPanel] Fehler beim Speichern in localStorage:', error)
      }
    }
  }
  
  const [isSending, setIsSending] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<ChatProcessingStep[]>([])
  // State für geöffnete Accordions (conversationId -> boolean)
  const [openConversations, setOpenConversations] = useState<Set<string>>(new Set())
  // State für gecachtes Inhaltsverzeichnis
  const [cachedTOC, setCachedTOC] = useState<{
    answer: string
    references?: ChatResponse['references']
    suggestedQuestions?: string[]
    queryId: string
    createdAt: string
  } | null>(null)
  // State für strukturierte Themenübersicht (StoryTopicsData)
  const [cachedStoryTopicsData, setCachedStoryTopicsData] = useState<StoryTopicsData | null>(null)
  const [isCheckingTOC, setIsCheckingTOC] = useState(false)
  const [tocOpen, setTocOpen] = useState(true) // TOC standardmäßig geöffnet
  const tocAccordionRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const galleryFilters = useAtomValue(galleryFiltersAtom)
  const prevMessagesLengthRef = useRef(0)
  // Ref für synchrones Tracking, ob Cache-Check läuft (verhindert Race Conditions)
  const isCheckingTOCRef = useRef(false)
  // Ref für verfolgen, ob Popover vorher geöffnet war (um Schließen zu erkennen)
  const prevPerspectiveOpenRef = useRef<boolean | undefined>(undefined)
  // Ref für verfolgen, ob ein Cache-Check gerade abgeschlossen wurde und Generierung nötig ist
  const shouldGenerateAfterCacheCheckRef = useRef(false)

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
          })
          // Setze Default-Werte aus Config, falls vorhanden
          // Priorität: localStorage (anonym) > userPreferences > Config-Defaults
          const prefs = data.config.userPreferences
          
          // WICHTIG: Prüfe direkt localStorage, ob Werte vorhanden sind
          // (nicht nur State-Werte, da diese möglicherweise noch nicht geladen wurden)
          let hasLocalStorageTargetLanguage = false
          let hasLocalStorageCharacter = false
          let hasLocalStorageSocialContext = false
          let hasLocalStorageGenderInclusive = false
          
          if (isAnonymous && typeof window !== 'undefined') {
            try {
              hasLocalStorageTargetLanguage = !!localStorage.getItem('story-context-targetLanguage')
              hasLocalStorageCharacter = !!localStorage.getItem('story-context-character')
              hasLocalStorageSocialContext = !!localStorage.getItem('story-context-socialContext')
              hasLocalStorageGenderInclusive = !!localStorage.getItem('story-context-genderInclusive')
            } catch {
              // Ignoriere Fehler
            }
          }
          
          const hasAnyLocalStorageValues = hasLocalStorageTargetLanguage || hasLocalStorageCharacter || hasLocalStorageSocialContext || hasLocalStorageGenderInclusive
          
          if (hasAnyLocalStorageValues) {
            localStorageLoadedRef.current = true
            console.log('[ChatPanel] Config-Logik übersprungen: localStorage-Werte vorhanden und haben Priorität', {
              hasLocalStorageTargetLanguage,
              hasLocalStorageCharacter,
              hasLocalStorageSocialContext,
              hasLocalStorageGenderInclusive,
              currentTargetLanguage: isEmbedded ? storyContext.targetLanguage : targetLanguageState,
              currentCharacter: isEmbedded ? storyContext.character : characterState,
              currentSocialContext: isEmbedded ? storyContext.socialContext : socialContextState,
            })
            // KEINE Config-Werte setzen - localStorage-Werte haben Priorität
          } else {
            // Keine localStorage-Werte vorhanden: Setze Config-Werte
            console.log('[ChatPanel] Config-Logik: Setze Config-Werte (keine localStorage-Werte vorhanden)')
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
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [libraryId, isAnonymous, isEmbedded, setTargetLanguage, setCharacter, setSocialContext, targetLanguageState, characterState, socialContextState, storyContext.targetLanguage, storyContext.character, storyContext.socialContext])


  // Zeige Welcome-Assistent nicht mehr benötigt - Konfiguration ist jetzt in der Kontextbar

  // Lade historische Fragen als Messages
  useEffect(() => {
    let cancelled = false
    async function loadHistory() {
      if (!activeChatId) {
        // Wenn kein aktiver Chat, behalte vorhandene Messages (z.B. neu hinzugefügte TOC-Queries)
        // setze Messages nur leer, wenn keine vorhanden sind
        if (!cancelled) {
          setMessages(prev => prev.length > 0 ? prev : [])
        }
        return
      }
      
      try {
        // Session-ID für anonyme Nutzer
        const { getOrCreateSessionId } = await import('@/lib/session/session-utils')
        const sessionId = getOrCreateSessionId()
        const headers: Record<string, string> = {}
        if (!sessionId.startsWith('temp-')) {
          headers['X-Session-ID'] = sessionId
        }
        
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries?limit=20&chatId=${encodeURIComponent(activeChatId)}`, { 
          cache: 'no-store',
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        })
        const data = await res.json() as { items?: Array<{ queryId: string; createdAt: string; question: string; mode: string; status: string }>; error?: unknown }
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Laden der Historie')
        
        if (!cancelled && Array.isArray(data.items)) {
          // Lade für jede historische Frage die vollständige Antwort
          // Filtere TOC-Queries heraus - diese werden separat unter der Kontextbar angezeigt
          const historyMessages: ChatMessage[] = []
          console.log('[ChatPanel] Lade Historie für Chat:', activeChatId, 'Anzahl Items:', data.items.length)
          for (const item of data.items) {
            try {
              // Session-ID für anonyme Nutzer
              const { getOrCreateSessionId } = await import('@/lib/session/session-utils')
              const sessionId = getOrCreateSessionId()
              const headers: Record<string, string> = {}
              if (!sessionId.startsWith('temp-')) {
                headers['X-Session-ID'] = sessionId
              }
              
              const queryRes = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(item.queryId)}`, { 
                cache: 'no-store',
                headers: Object.keys(headers).length > 0 ? headers : undefined,
              })
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
            // Merge mit vorhandenen Messages: Behalte neu hinzugefügte Messages (z.B. TOC-Queries)
            // die noch nicht in der Historie sind
            setMessages(prev => {
              // Sammle alle queryIds aus der Historie
              const historyQueryIds = new Set(historyMessages.map(m => m.queryId).filter((id): id is string => !!id))
              
              // Behalte Messages, die nicht in der Historie sind (neu hinzugefügte)
              const newMessages = prev.filter(m => !m.queryId || !historyQueryIds.has(m.queryId))
              
              // Kombiniere neue Messages mit Historie und sortiere
              const merged = [...newMessages, ...historyMessages]
              merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              
              return merged
            })
            // Setze prevMessagesLengthRef, damit beim ersten Laden nicht gescrollt wird
            prevMessagesLengthRef.current = historyMessages.length
          }
        }
      } catch {
        // Bei Fehlern behalte vorhandene Messages, setze nur leer wenn keine vorhanden sind
        if (!cancelled) {
          setMessages(prev => prev.length > 0 ? prev : [])
        }
      }
    }
    loadHistory()
    return () => { cancelled = true }
  }, [libraryId, activeChatId])

  // Auto-Scroll-Logik über Custom Hook
  useChatScroll({
    scrollRef,
    messages,
    openConversations,
    setOpenConversations,
    isSending,
    processingSteps,
    prevMessagesLengthRef,
  })

  // Handler für das Löschen einer Query
  async function handleDeleteQuery(queryId: string): Promise<void> {
    try {
      // Session-ID für anonyme Nutzer
      const { getOrCreateSessionId } = await import('@/lib/session/session-utils')
      const sessionId = getOrCreateSessionId()
      const headers: Record<string, string> = {}
      if (!sessionId.startsWith('temp-')) {
        headers['X-Session-ID'] = sessionId
      }
      
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/queries/${encodeURIComponent(queryId)}`, {
        method: 'DELETE',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
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
    // Hinweis: Diese Variablen werden für zukünftige Verwendung bereitgehalten
    void (config.character || character)
    void (config.answerLength || answerLength)
    void (config.retriever || retriever)
    void (config.targetLanguage || targetLanguage)
    void (config.socialContext || socialContext)
    
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
      }).catch(() => undefined)

      // Wenn Request blockiert wurde (z.B. durch Middleware) oder nicht OK:
      // Bei öffentlichen/anonymen Aufrufen: Lokal aktualisieren und früh zurückkehren (silent no-op)
      if (!response || !response.ok) {
        // Lokale Aktualisierung immer durchführen, damit UI reagiert
        setTargetLanguage(settings.targetLanguage)
        setCharacter(settings.character)
        setSocialContext(settings.socialContext)
        setGenderInclusive(settings.genderInclusive)
        // Wenn kein Response oder ein Auth-Problem, kein Fehler werfen
        if (!response || response.status === 401 || response.status === 403) return
        // Sonst echter Fehler
        throw new Error('Fehler beim Speichern der Präferenzen')
      }

      // Optional: Content-Type prüfen, falls Login-HTML zurückgegeben wurde
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        // Anscheinend Redirect zur Login-Seite – behandle wie anonym
        setTargetLanguage(settings.targetLanguage)
        setCharacter(settings.character)
        setSocialContext(settings.socialContext)
        setGenderInclusive(settings.genderInclusive)
        return
      }

      // Erfolgreich: Lokale States setzen
      setTargetLanguage(settings.targetLanguage)
      setCharacter(settings.character)
      setSocialContext(settings.socialContext)
      setGenderInclusive(settings.genderInclusive)
    } catch (error) {
      console.error('[ChatPanel] Fehler beim Speichern der Präferenzen:', error)
      // Bei Fehlern trotzdem lokale Präferenzen setzen, damit UI konsistent bleibt
      setTargetLanguage(settings.targetLanguage)
      setCharacter(settings.character)
      setSocialContext(settings.socialContext)
      setGenderInclusive(settings.genderInclusive)
      // Fehler nicht weiterwerfen, um UX auf öffentlichen Seiten nicht zu stören
    }
  }

  // Handler für Inhaltsverzeichnis-Generierung
  async function handleGenerateTOC() {
    console.log('[ChatPanel] 🔵 handleGenerateTOC() aufgerufen', {
      isSending,
      isCheckingTOC,
      isCheckingTOCRef: isCheckingTOCRef.current,
      hasCachedStoryTopicsData: !!cachedStoryTopicsData,
      hasCachedTOC: !!cachedTOC,
    })
    if (isSending) {
      console.log('[ChatPanel] ⏸️ handleGenerateTOC() abgebrochen: isSending=true')
      return // Verhindere doppelte Ausführung
    }
    // WICHTIG: Wenn Cache-Check noch läuft, abbrechen (Race Condition vermeiden)
    // Prüfe sowohl State als auch Ref (Ref ist synchron verfügbar)
    if (isCheckingTOC || isCheckingTOCRef.current) {
      console.log('[ChatPanel] ⏸️ handleGenerateTOC() abgebrochen: Cache-Check läuft noch', {
        isCheckingTOC,
        isCheckingTOCRef: isCheckingTOCRef.current,
      })
      return
    }
    // Prüfe zuerst, ob bereits ein Cache vorhanden ist
    // Wenn ja, keine Neuberechnung nötig
    // WICHTIG: Verwende aktuellen State, nicht Closure-Werte
    // Da State-Updates asynchron sind, prüfen wir direkt die aktuellen Werte
    const hasCachedData = cachedStoryTopicsData || cachedTOC
    if (hasCachedData) {
      console.log('[ChatPanel] ✅ handleGenerateTOC() übersprungen: TOC bereits im Cache vorhanden', {
        hasCachedStoryTopicsData: !!cachedStoryTopicsData,
        hasCachedTOC: !!cachedTOC,
      })
      return
    }
    console.log('[ChatPanel] 🚀 handleGenerateTOC() startet TOC-Generierung (kein Cache vorhanden)')
    const tocQuestion = 'Welche Themen werden hier behandelt, können wir die übersichtlich als Inhaltsverzeichnis ausgeben.'
    // Starte die Anfrage direkt, OHNE sie als normale Message hinzuzufügen
    // Die Antwort wird über den TOC-Cache-Mechanismus unter der Kontextbar angezeigt
    await sendQuestionDirectly(tocQuestion, 'summary', true) // true = isTOCQuery
    // Nach erfolgreicher Generierung Cache prüfen
    checkTOCCache()
  }

  // Prüfe, ob Inhaltsverzeichnis bereits gecacht ist
  async function checkTOCCache() {
    if (!cfg) {
      console.log('[ChatPanel] ⏸️ checkTOCCache() abgebrochen: cfg nicht vorhanden')
      return
    }
    
    console.log('[ChatPanel] 🔍 checkTOCCache() gestartet', {
      libraryId,
      targetLanguage,
      character,
      socialContext,
      genderInclusive,
      hasGalleryFilters: !!galleryFilters,
      galleryFiltersCount: galleryFilters ? Object.keys(galleryFilters).length : 0,
    })
    
    // WICHTIG: Setze Ref synchron, bevor State-Update (verhindert Race Condition)
    isCheckingTOCRef.current = true
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
      
      // Session-ID für anonyme Nutzer
      const { getOrCreateSessionId } = await import('@/lib/session/session-utils')
      const sessionId = getOrCreateSessionId()
      const headers: Record<string, string> = {}
      if (!sessionId.startsWith('temp-')) {
        headers['X-Session-ID'] = sessionId
      }
      
      const cacheUrl = `/api/chat/${encodeURIComponent(libraryId)}/toc-cache?${params.toString()}`
      console.log('[ChatPanel] 📡 checkTOCCache() sendet Anfrage:', cacheUrl)
      
      const res = await fetch(cacheUrl, {
        cache: 'no-store',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      })
      
      if (res.ok) {
        const data = await res.json() as { found: boolean; answer?: string; references?: ChatResponse['references']; suggestedQuestions?: string[]; queryId?: string; createdAt?: string; storyTopicsData?: StoryTopicsData }
        console.log('[ChatPanel] 📦 checkTOCCache() Antwort empfangen:', {
          found: data.found,
          hasQueryId: !!data.queryId,
          hasStoryTopicsData: !!data.storyTopicsData,
          hasAnswer: !!data.answer,
        })
        
        if (data.found && data.queryId) {
          // Priorisiere storyTopicsData über answer
          if (data.storyTopicsData) {
            console.log('[ChatPanel] ✅ checkTOCCache() Cache GEFUNDEN mit storyTopicsData:', {
              title: data.storyTopicsData.title,
              topicsCount: data.storyTopicsData.topics.length,
              queryId: data.queryId,
            })
            setCachedStoryTopicsData(data.storyTopicsData)
            // Setze auch cachedTOC für Rückwärtskompatibilität (falls benötigt)
            setCachedTOC({
              answer: data.answer || '',
              references: data.references,
              suggestedQuestions: data.suggestedQuestions,
              queryId: data.queryId,
              createdAt: data.createdAt || new Date().toISOString(),
            })
          } else if (data.answer) {
            // Fallback: Normale Antwort (für alte Caches)
            console.log('[ChatPanel] ✅ checkTOCCache() Cache GEFUNDEN mit answer (altes Format):', {
              answerLength: data.answer.length,
              queryId: data.queryId,
            })
          setCachedTOC({
            answer: data.answer,
            references: data.references,
            suggestedQuestions: data.suggestedQuestions,
            queryId: data.queryId,
            createdAt: data.createdAt || new Date().toISOString(),
          })
            setCachedStoryTopicsData(null)
        } else {
            console.log('[ChatPanel] ⚠️ checkTOCCache() Cache gefunden, aber keine Daten:', { queryId: data.queryId })
          setCachedTOC(null)
            setCachedStoryTopicsData(null)
        }
      } else {
          console.log('[ChatPanel] ❌ checkTOCCache() KEIN Cache gefunden (found=false oder kein queryId)')
        setCachedTOC(null)
          setCachedStoryTopicsData(null)
          // KEIN Cache gefunden: Setze Flag, dass Generierung nötig ist
          // Der useEffect wird dann reagieren, wenn der State aktualisiert wurde
          if (isEmbedded && !isSending) {
            console.log('[ChatPanel] 🚩 checkTOCCache() setzt Flag für Generierung nach Cache-Check')
            shouldGenerateAfterCacheCheckRef.current = true
          }
        }
      } else {
        console.log('[ChatPanel] ❌ checkTOCCache() Anfrage fehlgeschlagen:', { status: res.status, statusText: res.statusText })
        setCachedTOC(null)
        setCachedStoryTopicsData(null)
        // Bei Fehler: Setze Flag für Generierung
        if (isEmbedded && !isSending) {
          shouldGenerateAfterCacheCheckRef.current = true
        }
      }
    } catch (error) {
      console.error('[ChatPanel] ❌ checkTOCCache() Fehler:', error)
      setCachedTOC(null)
      setCachedStoryTopicsData(null)
      // Bei Exception: Setze Flag für Generierung
      if (isEmbedded && !isSending) {
        shouldGenerateAfterCacheCheckRef.current = true
      }
    } finally {
      console.log('[ChatPanel] ✅ checkTOCCache() abgeschlossen, setIsCheckingTOC(false)')
      isCheckingTOCRef.current = false
      setIsCheckingTOC(false)
    }
  }
  
  // useEffect: Reagiere darauf, wenn Cache geleert wurde UND Generierung nötig ist
  useEffect(() => {
    // Nur wenn: kein Cache vorhanden, Cache-Check abgeschlossen, Flag gesetzt, embedded-Modus, nicht gerade sendend
    if (
      !cachedStoryTopicsData && 
      !cachedTOC && 
      !isCheckingTOC && 
      shouldGenerateAfterCacheCheckRef.current &&
      isEmbedded && 
      !isSending
    ) {
      console.log('[ChatPanel] 🔄 useEffect [after-cache-cleared] Cache geleert und Flag gesetzt, rufe handleGenerateTOC() auf')
      shouldGenerateAfterCacheCheckRef.current = false // Reset Flag
      handleGenerateTOC()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedStoryTopicsData, cachedTOC, isCheckingTOC, isEmbedded, isSending])

  // Prüfe Cache bei Änderungen der Kontext-Parameter oder Filter
  // UND beim ersten Laden (wenn cfg verfügbar ist)
  // Im embedded-Modus: Nur wenn Perspektive-Popover geschlossen wird
  useEffect(() => {
    console.log('[ChatPanel] 🔄 useEffect [cache-check] ausgelöst', {
      hasCfg: !!cfg,
      targetLanguage,
      character,
      socialContext,
      genderInclusive,
      libraryId,
      galleryFiltersCount: galleryFilters ? Object.keys(galleryFilters).length : 0,
      isEmbedded,
      perspectiveOpen,
    })
    if (!cfg) {
      console.log('[ChatPanel] ⏸️ useEffect [cache-check] abgebrochen: cfg nicht vorhanden')
      return
    }
    // Im embedded-Modus: Nur reagieren, wenn Popover geschlossen ist
    // (verhindert mehrfache Generierungen während Filter-Änderungen)
    if (isEmbedded && perspectiveOpen) {
      console.log('[ChatPanel] ⏸️ useEffect [cache-check] abgebrochen: Popover ist noch geöffnet (embedded-Modus)')
      return
    }
    // Prüfe Cache, wenn sich Kontext-Parameter oder Filter ändern
    // checkTOCCache() ruft automatisch handleGenerateTOC() auf, wenn kein Cache gefunden wird
    console.log('[ChatPanel] 🔍 useEffect [cache-check] ruft checkTOCCache() auf')
    checkTOCCache()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, targetLanguage, character, socialContext, genderInclusive, libraryId, galleryFilters, perspectiveOpen])
  
  // Zusätzlicher useEffect für embedded-Modus: Reagiere auf Schließen des Popovers
  useEffect(() => {
    if (!isEmbedded || !cfg) {
      prevPerspectiveOpenRef.current = perspectiveOpen
      return
    }
    // Wenn Popover gerade geschlossen wurde (von true zu false), Cache prüfen
    const wasOpen = prevPerspectiveOpenRef.current === true
    const isNowClosed = perspectiveOpen === false
    if (wasOpen && isNowClosed) {
      console.log('[ChatPanel] 🔄 useEffect [popover-closed] Popover wurde geschlossen, prüfe Cache')
      checkTOCCache()
    }
    prevPerspectiveOpenRef.current = perspectiveOpen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perspectiveOpen, isEmbedded, cfg])
  
  // Automatische Generierung beim ersten Laden: wird direkt aus checkTOCCache() aufgerufen
  // Kein separater useEffect mehr nötig - alles passiert synchron nach dem Cache-Check
  
  // Prüfe auch nach erfolgreicher Generierung
  useEffect(() => {
    // Prüfe Cache nachdem eine neue Antwort hinzugefügt wurde
    // (wenn die letzte Nachricht eine Antwort ist und die Frage eine TOC-Frage war)
    // ABER: TOC-Queries werden nicht mehr als normale Messages hinzugefügt,
    // daher müssen wir den Cache anders prüfen
    // Cache wird nach erfolgreicher Generierung direkt geprüft (in handleGenerateTOC)
  }, [messages.length])

  // Hilfsfunktion: Formatiert Fehlermeldungen für bessere Benutzerfreundlichkeit
  function formatErrorMessage(errorMessage: string): string {
    // Prüfe auf API-Key-Fehler
    if (errorMessage.includes('invalid_api_key') || 
        errorMessage.includes('Incorrect API key') ||
        errorMessage.includes('Ungültiger OpenAI API-Key')) {
      return 'Ungültiger OpenAI API-Key. Bitte überprüfe die API-Key-Konfiguration in den Einstellungen der Bibliothek.'
    }
    
    // Prüfe auf andere häufige Fehler
    if (errorMessage.includes('401') && errorMessage.includes('API key')) {
      return 'Ungültiger OpenAI API-Key. Bitte überprüfe die API-Key-Konfiguration in den Einstellungen der Bibliothek.'
    }
    
    // Entferne technische Details aus der Fehlermeldung für bessere Lesbarkeit
    let formatted = errorMessage
    
    // Entferne lange API-Key-Maskierungen
    formatted = formatted.replace(/sk-proj-\*{50,}/g, 'sk-proj-***')
    
    // Wenn die Meldung sehr lang ist, kürze sie
    if (formatted.length > 200) {
      formatted = formatted.substring(0, 197) + '...'
    }
    
    return formatted
  }

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
    
    // Für TOC-Queries: NICHT als normale Message hinzufügen
    // Die Antwort wird nur über den Cache-Mechanismus in StoryTopics angezeigt
    if (!isTOC) {
      // Füge Frage als Message hinzu (nur für normale Fragen)
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
      
      // Session-ID aus Utils holen (für anonyme Nutzer)
      const { getOrCreateSessionId } = await import('@/lib/session/session-utils')
      const sessionId = getOrCreateSessionId()
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      // Füge Session-ID hinzu, wenn kein User authentifiziert ist
      if (!sessionId.startsWith('temp-')) {
        headers['X-Session-ID'] = sessionId
      }
      
      const res = await fetch(streamUrl, {
        method: 'POST',
        headers,
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
              
              // Console-Log für Debugging: Zeige alle Processing-Steps mit Details
              const logPrefix = '[Chat-Processing]'
              switch (step.type) {
                case 'question_analysis_start':
                  console.log(`${logPrefix} 🔍 Frage-Analyse gestartet:`, step.question)
                  break
                case 'question_analysis_result':
                  console.log(`${logPrefix} ✅ Frage-Analyse Ergebnis:`, {
                    recommendation: step.recommendation,
                    confidence: step.confidence,
                    chatTitle: step.chatTitle,
                  })
                  break
                case 'retriever_selected':
                  console.log(`${logPrefix} 🎯 Retriever ausgewählt:`, {
                    retriever: step.retriever,
                    reason: step.reason,
                  })
                  break
                case 'retrieval_start':
                  console.log(`${logPrefix} 🔎 Retrieval gestartet:`, step.retriever)
                  break
                case 'retrieval_progress':
                  console.log(`${logPrefix} 📊 Retrieval Fortschritt:`, {
                    sourcesFound: step.sourcesFound,
                    message: step.message,
                  })
                  break
                case 'retrieval_complete':
                  console.log(`${logPrefix} ✅ Retrieval abgeschlossen:`, {
                    sourcesCount: step.sourcesCount,
                    timingMs: step.timingMs,
                  })
                  break
                case 'prompt_building':
                  console.log(`${logPrefix} 📝 Prompt wird erstellt:`, step.message)
                  break
                case 'prompt_complete':
                  console.log(`${logPrefix} ✅ Prompt erstellt:`, {
                    promptLength: step.promptLength,
                    documentsUsed: step.documentsUsed,
                    tokenCount: step.tokenCount,
                  })
                  break
                case 'llm_start':
                  console.log(`${logPrefix} 🤖 LLM-Aufruf gestartet:`, step.model)
                  break
                case 'llm_progress':
                  console.log(`${logPrefix} ⚙️ LLM arbeitet:`, step.message)
                  break
                case 'llm_complete':
                  console.log(`${logPrefix} ✅ LLM abgeschlossen:`, {
                    timingMs: step.timingMs,
                    promptTokens: step.promptTokens,
                    completionTokens: step.completionTokens,
                    totalTokens: step.totalTokens,
                  })
                  break
                case 'parsing_response':
                  console.log(`${logPrefix} 🔧 Antwort wird verarbeitet:`, step.message)
                  break
                case 'complete':
                  console.log(`${logPrefix} ✅✅✅ Antwort vollständig:`, {
                    answerLength: step.answer?.length,
                    referencesCount: step.references?.length,
                    suggestedQuestionsCount: step.suggestedQuestions?.length,
                    queryId: step.queryId,
                    chatId: step.chatId,
                  })
                  break
                case 'error':
                  const formattedError = formatErrorMessage(step.error || 'Unbekannter Fehler')
                  console.error(`${logPrefix} ❌ Fehler:`, step.error)
                  // Setze die formatierte Fehlermeldung bereits hier, damit sie schneller angezeigt wird
                  setError(formattedError)
                  break
                default:
                  // Fallback für unbekannte Step-Types
                  console.log(`${logPrefix} 📦 Unbekannter Step:`, step)
              }
              
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
                
                // Type Guard für complete-Step mit storyTopicsData
                const completeStep = step as ChatProcessingStep & { storyTopicsData?: StoryTopicsData }
                
                // Extrahiere Referenzen und suggestedQuestions
                const refs: ChatResponse['references'] = Array.isArray(step.references) 
                  ? step.references.filter((r): r is ChatResponse['references'][number] => 
                      typeof r === 'object' && r !== null && 'number' in r && 'fileId' in r && 'description' in r
                    )
                  : []
                const suggestedQuestions = Array.isArray(step.suggestedQuestions)
                  ? step.suggestedQuestions.filter((q: unknown): q is string => typeof q === 'string')
                  : []
                
                // Für TOC-Queries: Extrahiere storyTopicsData und setze Cache
                if (isTOC) {
                  console.log('[ChatPanel] TOC complete-Step erhalten:', { 
                    hasStoryTopicsData: !!completeStep.storyTopicsData,
                    storyTopicsData: completeStep.storyTopicsData,
                    queryId: finalQueryId 
                  })
                  if (completeStep.storyTopicsData) {
                    setCachedStoryTopicsData(completeStep.storyTopicsData)
                    // Setze auch cachedTOC für Rückwärtskompatibilität (falls benötigt)
                    setCachedTOC({
                      answer: step.answer,
                      references: refs,
                      suggestedQuestions,
                      queryId: finalQueryId,
                      createdAt: new Date().toISOString(),
                    })
                  } else {
                    console.log('[ChatPanel] Kein storyTopicsData im complete-Step, prüfe Cache nach 1s')
                    // Nach kurzer Verzögerung Cache prüfen, damit die Query in der DB gespeichert ist
                    setTimeout(() => {
                      checkTOCCache()
                    }, 1000)
                  }
                  setProcessingSteps([])
                  setIsSending(false)
                  return
                }

                // Für normale Fragen: Erstelle Antwort-Message
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
                const formattedError = formatErrorMessage(step.error || 'Unbekannter Fehler')
                throw new Error(formattedError)
              }
            } catch (parseError) {
              console.error('[ChatPanel] Fehler beim Parsen von SSE-Update:', parseError)
            }
          }
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unbekannter Fehler'
      const formattedError = formatErrorMessage(errorMessage)
      setError(formattedError)
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
    // Chat-Input-Panel wird automatisch durch ChatInput-Komponente geschlossen
  }

  if (loading) return <div className={variant === 'compact' ? '' : 'p-6'}>Lade Chat...</div>
  if (error) return <div className={(variant === 'compact' ? '' : 'p-6 ') + 'text-destructive'}>{error}</div>
  if (!cfg) return <div className={variant === 'compact' ? '' : 'p-6'}>Keine Konfiguration gefunden.</div>

  if (variant === 'compact') {
    return (
      <div className="flex flex-col h-full min-h-0 w-full">
        {/* Kontextbar - nur im non-embedded Modus anzeigen */}
        {!isEmbedded && (
          <ChatConfigBar
            targetLanguage={targetLanguage}
            setTargetLanguage={setTargetLanguage}
            character={character}
            setCharacter={setCharacter}
            socialContext={socialContext}
            setSocialContext={setSocialContext}
            libraryId={libraryId}
            activeChatId={activeChatId}
            setActiveChatId={setActiveChatId}
            setMessages={setMessages}
            isEmbedded={isEmbedded}
          >
            <ChatConfigPopover
              open={configPopoverOpen}
              onOpenChange={handleConfigPopoverChange}
              answerLength={answerLength}
              setAnswerLength={setAnswerLength}
              retriever={retriever}
              setRetriever={setRetriever}
              genderInclusive={genderInclusive}
              setGenderInclusive={setGenderInclusive}
              targetLanguage={targetLanguage}
              character={character}
              socialContext={socialContext}
              onGenerateTOC={handleGenerateTOC}
              onSavePreferences={saveUserPreferences}
            />
          </ChatConfigBar>
        )}
        
        {/* Scrollbarer Chat-Verlauf */}
        <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${isEmbedded ? 'relative' : ''}`}>
          <ScrollArea className="flex-1 min-h-0 h-full" ref={scrollRef}>
            <div className={`p-4 ${isEmbedded ? '' : ''}`}>
              {/* StoryTopics im embedded Modus - oben im Scroll-Bereich */}
              {isEmbedded && (
                <div className="mb-6 pb-6 border-b">
                  <StoryTopics 
                                libraryId={libraryId}
                    data={cachedStoryTopicsData}
                    isLoading={isCheckingTOC}
                    onSelectQuestion={(question) => {
                      // Frage an Chat übergeben
                      setInput(question.text)
                      setIsChatInputOpen(true)
                      setTimeout(() => {
                        inputRef.current?.focus()
                      }, 100)
                    }}
                              />
                </div>
              )}
              
              {/* Alte TOC-Anzeige entfernt - wird jetzt durch StoryTopics-Komponente ersetzt */}
              
              <ChatMessagesList
                messages={messages}
                openConversations={openConversations}
                setOpenConversations={setOpenConversations}
                libraryId={libraryId}
                isSending={isSending}
                processingSteps={processingSteps}
                error={error}
                answerLength={answerLength}
                retriever={retriever}
                targetLanguage={targetLanguage}
                character={character}
                socialContext={socialContext}
                onQuestionClick={(question) => {
                  setInput(question)
                  inputRef.current?.focus()
                }}
                onDelete={handleDeleteQuery}
                onReload={handleReloadQuestion}
                messageRefs={messageRefs}
                isEmbedded={isEmbedded}
                isCheckingTOC={isCheckingTOC}
                cachedTOC={cachedTOC}
              />
          </div>
        </ScrollArea>

        {/* Input-Bereich - nur im non-embedded Modus */}
        {!isEmbedded && (
          <ChatInput
            input={input}
            setInput={setInput}
            onSend={onSend}
            isSending={isSending}
            answerLength={answerLength}
            setAnswerLength={setAnswerLength}
            placeholder={cfg.config.placeholder}
            variant="default"
            inputRef={inputRef}
          />
        )}
        
        {/* Chat-Input für embedded Modus - fixed positioniert */}
        {isEmbedded && (
          <ChatInput
            input={input}
            setInput={setInput}
            onSend={onSend}
            isSending={isSending}
            answerLength={answerLength}
            setAnswerLength={setAnswerLength}
            placeholder={cfg.config.placeholder}
            variant="embedded"
            inputRef={inputRef}
            isOpen={isChatInputOpen}
            onOpenChange={setIsChatInputOpen}
          />
        )}
      </div>
    </div>
  )
}

  return (
    <div className="w-full h-full flex flex-col min-h-[600px] overflow-hidden">
      {/* Kontextbar - nur im default/compact Modus anzeigen */}
      {!isEmbedded && (
        <ChatConfigBar
          targetLanguage={targetLanguage}
          setTargetLanguage={setTargetLanguage}
          character={character}
          setCharacter={setCharacter}
          socialContext={socialContext}
          setSocialContext={setSocialContext}
          libraryId={libraryId}
          activeChatId={activeChatId}
          setActiveChatId={setActiveChatId}
          setMessages={setMessages}
          isEmbedded={isEmbedded}
        >
          <ChatConfigPopover
            open={configPopoverOpen}
            onOpenChange={handleConfigPopoverChange}
            answerLength={answerLength}
            setAnswerLength={setAnswerLength}
            retriever={retriever}
            setRetriever={setRetriever}
            genderInclusive={genderInclusive}
            setGenderInclusive={setGenderInclusive}
            targetLanguage={targetLanguage}
            character={character}
            socialContext={socialContext}
            onGenerateTOC={handleGenerateTOC}
            onSavePreferences={saveUserPreferences}
          />
        </ChatConfigBar>
      )}
      
      {/* Scrollbarer Chat-Verlauf */}
      <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${isEmbedded ? 'relative' : ''}`}>
        <ScrollArea className="flex-1 h-full" ref={scrollRef}>
          <div className={`p-6 ${isEmbedded ? '' : ''}`}>
            {/* StoryTopics im embedded Modus - oben im Scroll-Bereich */}
            {isEmbedded && (
              <div className="mb-6 pb-6 border-b">
                <StoryTopics 
                    libraryId={libraryId}
                  data={cachedStoryTopicsData}
                  isLoading={isCheckingTOC}
                  onSelectQuestion={(question) => {
                    // Frage an Chat übergeben
                    setInput(question.text)
                    // Öffne Panel explizit
                    setIsChatInputOpen(true)
                    setTimeout(() => {
                      inputRef.current?.focus()
                    }, 200)
                  }}
                  />
              </div>
            )}
            
            {/* Alte TOC-Anzeige entfernt - wird jetzt durch StoryTopics-Komponente ersetzt */}
            
            <ChatMessagesList
              messages={messages}
              openConversations={openConversations}
              setOpenConversations={setOpenConversations}
              libraryId={libraryId}
              isSending={isSending}
              processingSteps={processingSteps}
              error={error}
              answerLength={answerLength}
              retriever={retriever}
              targetLanguage={targetLanguage}
              character={character}
              socialContext={socialContext}
              onQuestionClick={(question) => {
                setInput(question)
                setIsChatInputOpen(true)
                setTimeout(() => {
                  inputRef.current?.focus()
                }, 100)
              }}
              onDelete={handleDeleteQuery}
              onReload={handleReloadQuestion}
              messageRefs={messageRefs}
              isEmbedded={isEmbedded}
              isCheckingTOC={isCheckingTOC}
              cachedTOC={cachedTOC}
            />
          </div>
        </ScrollArea>

        {/* Input-Bereich - nur im non-embedded Modus */}
        {!isEmbedded && (
          <ChatInput
            input={input}
            setInput={setInput}
            onSend={onSend}
            isSending={isSending}
            answerLength={answerLength}
            setAnswerLength={setAnswerLength}
            placeholder={cfg.config.placeholder}
            variant="default"
            inputRef={inputRef}
          />
        )}
        
        {/* Chat-Input für embedded Modus - fixed positioniert */}
        {isEmbedded && (
          <ChatInput
            input={input}
            setInput={setInput}
            onSend={onSend}
            isSending={isSending}
            answerLength={answerLength}
            setAnswerLength={setAnswerLength}
            placeholder={cfg.config.placeholder}
            variant="embedded"
            inputRef={inputRef}
            isOpen={isChatInputOpen}
            onOpenChange={setIsChatInputOpen}
          />
        )}
        {cfg.config.footerText && !isEmbedded && (
          <div className="mt-4 text-xs text-muted-foreground px-4">
            {cfg.config.footerText} {cfg.config.companyLink ? (<a className="underline" href={cfg.config.companyLink} target="_blank" rel="noreferrer">mehr</a>) : null}
          </div>
        )}
      </div>
    </div>
  )
}



