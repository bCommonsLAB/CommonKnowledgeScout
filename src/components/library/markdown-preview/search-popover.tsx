'use client'

/**
 * markdown-preview/search-popover.tsx
 *
 * Schnellsuche-Popover ueber dem Markdown-Preview-Container.
 *
 * Aus `markdown-preview.tsx` ausgegliedert (Welle 3-II-b, Schritt 4/8).
 *
 * Eigenstaendige Komponente mit eigenem State (isOpen, query). Memoisiert,
 * damit Aenderungen am Query-State nicht die Hauptkomponente
 * MarkdownPreview neu rendern. Dies ist ein bewusster Performance-
 * Trick — Re-Renders der grossen Markdown-Komponente waeren extrem teuer.
 */

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface SearchPopoverProps {
  onSearchFirst: (query: string) => void
  onSearchNext: (query: string) => void
  onSearchPrev: (query: string) => void
}

export const SearchPopover = React.memo(function SearchPopover({
  onSearchFirst,
  onSearchNext,
  onSearchPrev,
}: SearchPopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const handleSearch = React.useCallback(() => {
    if (query.trim()) {
      onSearchFirst(query)
    }
  }, [query, onSearchFirst])

  const handleNext = React.useCallback(() => {
    if (query.trim()) onSearchNext(query)
  }, [query, onSearchNext])

  const handlePrev = React.useCallback(() => {
    if (query.trim()) onSearchPrev(query)
  }, [query, onSearchPrev])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSearch()
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    },
    [handleSearch],
  )

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Schnellsuche"
          title="Schnellsuche"
          onMouseEnter={() => setIsOpen(true)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 hover:bg-muted text-muted-foreground"
        >
          <Search className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-3"
        side="left"
        align="start"
        onMouseLeave={() => setIsOpen(false)}
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Verhindert Fokus-Return auf den Trigger, der sonst den
        // Scroll-Container nach oben ziehen kann.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Schnellsuche… (Enter)"
            className="h-8 text-xs"
            autoFocus
          />
          <Button variant="outline" size="sm" className="h-8" onClick={handleSearch}>
            Suchen
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Vorheriges Suchergebnis"
            onClick={handlePrev}
            disabled={!query.trim()}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Naechstes Suchergebnis"
            onClick={handleNext}
            disabled={!query.trim()}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
})
