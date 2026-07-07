'use client'

/**
 * Detail-Log der Library-Verifikation (Erweiterung Welle A2).
 *
 * Macht transparent, WAS nicht passt:
 *  1. „Befunde nach Feld" — ungekappte Aggregation je Code+Feld aus
 *     `summary.issuesByField` (fehlt bei Alt-Laeufen vor diesem Feature).
 *  2. „Betroffene Dokumente" — aufklappbare Liste der gespeicherten
 *     Problem-Dokumente mit allen Einzelbefunden (beim Speichern gekappt,
 *     daher Hinweis, wenn nicht alle Dokumente enthalten sind).
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type {
  DocumentVerificationResult,
  VerificationSummary,
} from '@/lib/library-verification/types'

interface LibraryVerificationDetailsProps {
  summary: VerificationSummary
  documents: DocumentVerificationResult[]
}

function docLabel(doc: DocumentVerificationResult): string {
  return doc.fileName || doc.fileId
}

export function LibraryVerificationDetails({ summary, documents }: LibraryVerificationDetailsProps) {
  const [docsOpen, setDocsOpen] = useState(false)
  const byField = summary.issuesByField ?? []
  if (byField.length === 0 && documents.length === 0) return null

  return (
    <div className="space-y-3">
      {byField.length > 0 && (
        <div className="rounded-md border p-3 text-sm space-y-1">
          <div className="font-medium">Befunde nach Feld</div>
          <ul className="space-y-1">
            {byField.map((entry) => (
              <li key={`${entry.code}-${entry.field}`} className="flex flex-wrap items-baseline gap-x-2">
                <Badge variant="outline" className="font-mono text-[11px]">{entry.code}</Badge>
                <span className="font-mono text-xs">{entry.field || '—'}</span>
                <strong>{entry.count}×</strong>
                <span className="text-xs text-muted-foreground">{entry.sampleMessage}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {documents.length > 0 && (
        <div className="rounded-md border p-3 text-sm space-y-1">
          <button
            type="button"
            className="flex items-center gap-1.5 font-medium hover:underline"
            onClick={() => setDocsOpen((v) => !v)}
            aria-expanded={docsOpen}
          >
            {docsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Betroffene Dokumente ({documents.length}
            {summary.withIssues > documents.length ? ` von ${summary.withIssues} gespeichert` : ''})
          </button>
          {summary.withIssues > documents.length && (
            <p className="text-xs text-muted-foreground">
              Der Lauf speichert die ersten {documents.length} Problem-Dokumente — die
              Zaehlung unter Befunde nach Feld umfasst trotzdem alle.
            </p>
          )}
          {docsOpen && (
            <ul className="max-h-80 space-y-2 overflow-y-auto pt-1">
              {documents.map((doc) => (
                <li key={doc.fileId} className="rounded border bg-muted/30 p-2">
                  <div className="font-mono text-xs font-medium break-all">{docLabel(doc)}</div>
                  <ul className="mt-1 space-y-0.5">
                    {doc.issues.map((issue, i) => (
                      <li key={`${doc.fileId}-${i}`} className="text-xs text-muted-foreground">
                        <span className="font-mono">[{issue.code}{issue.field ? `:${issue.field}` : ''}]</span>{' '}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
