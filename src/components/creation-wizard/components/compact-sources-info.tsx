/**
 * @fileoverview Kompakte Quellenliste für Ergebnis-Steps
 * 
 * Zeigt dezent unten an, welche Quellen verwendet wurden.
 * Hover zeigt Details (Text-Auszug oder URL), Webseiten-URLs sind klickbar.
 */

"use client"

import { Info, Link, FileText, Mic } from "lucide-react"
import type { WizardSource } from "@/lib/creation/corpus"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CompactSourcesInfoProps {
  sources: WizardSource[]
}

export function CompactSourcesInfo({ sources }: CompactSourcesInfoProps) {
  if (sources.length === 0) {
    return null
  }

  function getSourceIcon(kind: WizardSource['kind']) {
    switch (kind) {
      case 'text':
        return <Mic className="w-3 h-3" />
      case 'url':
        return <Link className="w-3 h-3" />
      case 'file':
        return <FileText className="w-3 h-3" />
      default:
        return <FileText className="w-3 h-3" />
    }
  }

  function getSourceLabel(source: WizardSource): string {
    if (source.kind === 'url' && source.url) {
      // Zeige nur Domain oder ersten Teil der URL (max 40 Zeichen)
      try {
        const urlObj = new URL(source.url)
        return urlObj.hostname || source.url.slice(0, 40)
      } catch {
        return source.url.length > 40 ? `${source.url.slice(0, 40)}...` : source.url
      }
    }
    if (source.kind === 'text' && source.text) {
      // Zeige ersten Teil des Textes (max 40 Zeichen)
      return source.text.length > 40 ? `${source.text.slice(0, 40)}...` : source.text
    }
    if (source.kind === 'file' && source.fileName) {
      return source.fileName
    }
    return source.kind === 'text' ? 'Text' : source.kind === 'url' ? 'Webseite' : 'Datei'
  }

  function getTooltipContent(source: WizardSource): React.ReactNode {
    if (source.kind === 'url' && source.url) {
      return (
        <div className="max-w-xs">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {source.url}
          </a>
        </div>
      )
    }
    if (source.kind === 'text' && source.text) {
      return (
        <div className="max-w-xs text-sm whitespace-pre-wrap break-words">
          {source.text.length > 200 ? `${source.text.slice(0, 200)}...` : source.text}
        </div>
      )
    }
    if (source.kind === 'file' && source.fileName) {
      return <div className="text-sm">{source.fileName}</div>
    }
    return null
  }

  return (
    <TooltipProvider>
      <div className="mt-6 pt-4 border-t text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
        <Info className="w-3 h-3 shrink-0" />
        <span className="shrink-0">Verwendete Quellen:</span>
        <div className="flex items-center gap-2 flex-wrap">
          {sources.map((source, idx) => {
            const tooltipContent = getTooltipContent(source)
            
            if (!tooltipContent) {
              // Kein Tooltip: Zeige nur Label
              return (
                <span key={source.id} className="flex items-center gap-1">
                  {getSourceIcon(source.kind)}
                  <span>{getSourceLabel(source)}</span>
                  {idx < sources.length - 1 && <span className="text-muted-foreground/50">•</span>}
                </span>
              )
            }

            return (
              <span key={source.id} className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground transition-colors cursor-help"
                      onClick={(e) => {
                        // Bei URL: Öffne direkt in neuem Tab
                        if (source.kind === 'url' && source.url) {
                          e.preventDefault()
                          window.open(source.url, '_blank', 'noopener,noreferrer')
                        }
                      }}
                    >
                      {getSourceIcon(source.kind)}
                      <span>{getSourceLabel(source)}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs z-50">
                    {tooltipContent}
                  </TooltipContent>
                </Tooltip>
                {idx < sources.length - 1 && <span className="text-muted-foreground/50 ml-1">•</span>}
              </span>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}

