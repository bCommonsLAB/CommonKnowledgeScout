/**
 * @fileoverview Quellenliste-Komponente für Multi-Source Wizard
 * 
 * Zeigt alle bisher hinzugefügten Quellen an und ermöglicht das Entfernen einzelner Quellen.
 */

"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, FileText, Link, Mic } from "lucide-react"
import type { WizardSource } from "@/lib/creation/corpus"
import { buildSourceSummary } from "@/lib/creation/corpus"

interface SourcesListProps {
  sources: WizardSource[]
  onRemove: (sourceId: string) => void
  isExtracting?: boolean
}

export function SourcesList({ sources, onRemove, isExtracting }: SourcesListProps) {
  if (sources.length === 0) {
    return null
  }

  function getSourceIcon(kind: WizardSource['kind']) {
    switch (kind) {
      case 'text':
        return <Mic className="w-4 h-4" />
      case 'url':
        return <Link className="w-4 h-4" />
      case 'file':
        return <FileText className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  function getSourceLabel(kind: WizardSource['kind']) {
    switch (kind) {
      case 'text':
        return 'Text'
      case 'url':
        return 'Webseite'
      case 'file':
        return 'Datei'
      default:
        return 'Unbekannt'
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Hinzugefügte Quellen</CardTitle>
        <CardDescription className="text-xs">
          {sources.length} {sources.length === 1 ? 'Quelle' : 'Quellen'} vorhanden
          {isExtracting && ' • Wird ausgewertet...'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {sources.map((source) => {
          const summary = buildSourceSummary(source)
          const dateStr = source.createdAt.toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })

          return (
            <div
              key={source.id}
              className="flex items-start justify-between gap-4 p-3 border rounded-md bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getSourceIcon(source.kind)}
                  <span className="text-sm font-medium">{getSourceLabel(source.kind)}</span>
                  <span className="text-xs text-muted-foreground">• {dateStr}</span>
                </div>
                {source.kind === 'url' && source.url && (
                  <div className="text-xs text-muted-foreground mb-1 truncate">
                    {source.url}
                  </div>
                )}
                {source.kind === 'file' && source.fileName && (
                  <div className="text-xs text-muted-foreground mb-1 truncate">
                    {source.fileName}
                  </div>
                )}
                <div className="text-sm text-muted-foreground line-clamp-2">
                  {summary}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(source.id)}
                disabled={isExtracting}
                className="shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}





