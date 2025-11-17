'use client'

import React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAtom } from 'jotai'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MessageCircle, ArrowRight } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/hooks'
import type { DocCardMeta } from '@/lib/gallery/types'

export interface SwitchToStoryModeButtonProps {
  /** Das Dokument, für das der Filter gesetzt werden soll */
  doc: DocCardMeta
  /** Aktueller Mode ('gallery' oder 'story') */
  currentMode: 'gallery' | 'story'
  /** Callback, der aufgerufen wird, wenn das Detail-Overlay geschlossen werden soll */
  onClose?: () => void
  /** Optional: Ref für Flag, um zu verhindern, dass selectedDoc während des Wechsels verwendet wird */
  isSwitchingRef?: React.MutableRefObject<boolean>
}

/**
 * Button-Komponente für den Wechsel zum Story-Mode
 * 
 * Diese Komponente kapselt die gesamte Logik für:
 * - Navigation zum Story-Mode
 * - Setzen des shortTitle-Filters
 * - Triggern der TOC-Neuberechnung (wenn bereits im Story-Mode)
 * - Schließen des Detail-Overlays
 */
export function SwitchToStoryModeButton({
  doc,
  currentMode,
  onClose,
  isSwitchingRef,
}: SwitchToStoryModeButtonProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, setFilters] = useAtom(galleryFiltersAtom)

  const handleClick = React.useCallback(async () => {
    // WICHTIG: Extrahiere docShortTitle BEVOR wir das Flag setzen!
    // Wenn isSwitchingRef.current = true ist, wird selectedDoc möglicherweise zu null
    // und wir können docShortTitle nicht mehr extrahieren
    const docShortTitle = doc.shortTitle || doc.title
    
    // Setze Flag, um zu verhindern, dass selectedDoc während des Wechsels verwendet wird
    if (isSwitchingRef) {
      isSwitchingRef.current = true
    }
    
    // Prüfe, ob wir bereits im Story-Mode sind
    const isAlreadyInStoryMode = currentMode === 'story'
    
    // Schließe Detail-Overlay, falls Callback vorhanden
    if (onClose) {
      onClose()
    }
    
    // Entferne doc Parameter explizit und navigiere direkt zur Story-Mode URL
    // Verwende bereinigte searchParams, um Race Condition zu vermeiden
    try {
      const params = new URLSearchParams(searchParams?.toString() || '')
      
      // Entferne doc Parameter explizit (MUSS zuerst passieren!)
      params.delete('doc')
      
      // Setze mode Parameter auf story (auch wenn bereits gesetzt)
      params.set('mode', 'story')
      
      // Navigiere basierend auf aktueller Route
      if (pathname?.startsWith('/explore/')) {
        const librarySlugMatch = pathname.match(/\/explore\/([^/]+)/)
        if (librarySlugMatch && librarySlugMatch[1]) {
          const librarySlug = librarySlugMatch[1]
          router.replace(`/explore/${librarySlug}?${params.toString()}`, { scroll: false })
        }
      } else {
        // Library-Route
        router.replace(`/library/gallery?${params.toString()}`, { scroll: false })
      }
      
      // WICHTIG: Prüfe, ob docShortTitle vorhanden ist, bevor wir Filter setzen
      if (!docShortTitle) {
        if (isSwitchingRef) {
          isSwitchingRef.current = false
        }
        return
      }
      
      // Setze Filter NACH der Navigation, um Race Condition zu vermeiden
      // Verwende requestAnimationFrame für bessere Kompatibilität mit Mobile-Browsern
      // und dann setTimeout für zusätzliche Sicherheit
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            setFilters(f => {
              // Erstelle neues Filter-Objekt mit korrektem Typ (Record<string, string[]>)
              const current = f as Record<string, string[]>
              const next: Record<string, string[]> = { ...current }
              
              // Setze shortTitle-Filter (immer als Array)
              next.shortTitle = [docShortTitle]
              
              return next
            })
            
            // Triggere TOC-Neuberechnung explizit, wenn wir im Story-Mode sind
            // Das ChatPanel reagiert normalerweise auf Filter-Änderungen, aber wenn wir bereits
            // im Story-Mode sind, müssen wir explizit ein Event auslösen, um sicherzustellen,
            // dass die TOC-Neuberechnung getriggert wird
            // WICHTIG: Event NACH dem Setzen der Filter auslösen, damit die Filter bereits gesetzt sind
            // Verwende längeres setTimeout, um sicherzustellen, dass die Filter-Setzung und Navigation abgeschlossen sind
            if (isAlreadyInStoryMode) {
              setTimeout(() => {
                // Event auslösen, um TOC-Neuberechnung zu triggern
                // WICHTIG: Event wird IMMER ausgelöst, wenn wir bereits im Story-Mode sind
                window.dispatchEvent(new CustomEvent('gallery-filters-changed', { 
                  detail: { mode: 'story' } 
                }))
              }, 300)
            }
            
            // Reset Flag nach kurzer Verzögerung, damit useSearchParams aktualisiert werden kann
            if (isSwitchingRef) {
              setTimeout(() => {
                isSwitchingRef.current = false
              }, 200)
            }
          }, 50)
        })
      })
    } catch {
      // Reset Flag auch bei Fehler
      if (isSwitchingRef) {
        isSwitchingRef.current = false
      }
      // Fallback: Setze Filter direkt (ohne Navigation)
      if (docShortTitle) {
        setTimeout(() => {
          setFilters(f => {
            // Erstelle neues Filter-Objekt mit korrektem Typ (Record<string, string[]>)
            const current = f as Record<string, string[]>
            const next: Record<string, string[]> = { ...current }
            
            // Setze shortTitle-Filter (immer als Array)
            next.shortTitle = [docShortTitle]
            
            return next
          })
          // Triggere TOC-Neuberechnung auch im Fallback, wenn bereits im Story-Mode
          if (currentMode === 'story') {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('gallery-filters-changed', { 
                detail: { mode: 'story' } 
              }))
            }, 300)
          }
        }, 0)
      }
    }
  }, [doc, currentMode, onClose, isSwitchingRef, router, pathname, searchParams, setFilters])

  return (
    <div className="shrink-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              onClick={handleClick}
              className="flex items-center gap-2 font-semibold shadow-md hover:shadow-lg transition-all"
            >
              <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{t('gallery.detailViewStoryModeCta')}</span>
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('gallery.storyModeTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

