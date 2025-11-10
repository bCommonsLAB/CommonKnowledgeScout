'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Feather, Search } from 'lucide-react'

export interface GalleryStickyHeaderProps {
  headline: string
  subtitle?: string
  description?: string
  searchPlaceholder: string
  queryValue: string
  onChangeQuery: (v: string) => void
  ctaLabel: string
  onCta: () => void
  tooltip: string
}

/**
 * Sticky-Header der Gallery-Ansicht:
 * - Blendet beim Scrollen Titel/Untertitel/Erklärung aus
 * - Lässt die Suchleiste sichtbar
 * - Keine Änderungen an anderer Scroll-Logik
 */
export function GalleryStickyHeader(props: GalleryStickyHeaderProps) {
  const {
    headline,
    subtitle,
    description,
    searchPlaceholder,
    queryValue,
    onChangeQuery,
    ctaLabel,
    onCta,
    tooltip,
  } = props

  const [isCondensed, setIsCondensed] = useState(false)

  useEffect(() => {
    const section = document.querySelector<HTMLElement>('[data-gallery-section]')
    if (!section) return
    const onScroll = () => setIsCondensed(section.scrollTop > 12)
    onScroll()
    section.addEventListener('scroll', onScroll, { passive: true })
    return () => section.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="sticky top-0 z-20 bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur border-b">
      <div className={`transition-all duration-300 overflow-hidden ${isCondensed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'}`}>
        <div className="py-4 space-y-2">
          <h2 className="text-3xl font-bold">{headline}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground font-medium">{subtitle}</p> : null}
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="py-2 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={queryValue}
            onChange={(e) => onChangeQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="lg"
                onClick={onCta}
                className="flex items-center gap-2 font-semibold shadow-md hover:shadow-lg transition-all flex-shrink-0"
              >
                <Feather className="h-5 w-5" />
                {ctaLabel}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}


