"use client"

import * as React from "react"
import { BookDetail, type BookDetailData } from "@/components/library/book-detail"
import { SessionDetail, type SessionDetailData } from "@/components/library/session-detail"
import { useIngestionDataContext } from "./ingestion-data-context"
import { mapToBookDetail, mapToSessionDetail } from "@/lib/mappers/doc-meta-mappers"

interface StoryViewProps {
  /**
   * Library ID (wird für SessionDetail benötigt)
   */
  libraryId?: string
  /**
   * Bestimmt, ob Book- oder Session-Detail angezeigt wird.
   * Wenn nicht gesetzt, wird basierend auf docMetaJson.docType entschieden.
   */
  viewType?: "book" | "session"
}

/**
 * Story View Komponente: Zeigt die Story wie im Explorer Mode.
 * Verwendet MongoDB-Daten aus dem IngestionDataContext (keine eigenen API-Calls).
 */
export function StoryView({ libraryId, viewType }: StoryViewProps) {
  const { data, loading, error } = useIngestionDataContext()

  // Bestimme viewType aus Daten, falls nicht explizit gesetzt
  const actualViewType = React.useMemo(() => {
    if (viewType) return viewType
    if (!data?.doc?.docType) return "book" // Default: book
    // Session-Dokumente haben typischerweise docType wie "session", "event", etc.
    const docType = String(data.doc.docType).toLowerCase()
    return docType.includes("session") || docType.includes("event") ? "session" : "book"
  }, [viewType, data?.doc?.docType])

  // Mappe die Daten aus ingestion-status Format auf BookDetailData/SessionDetailData
  const bookData = React.useMemo<BookDetailData | null>(() => {
    if (!data || actualViewType !== "book") return null
    // Konvertiere ingestion-status Format zu doc-meta Format für Mapper
    // Die ingestion-status API liefert chapters bereits im richtigen Format
    const docMetaFormat = {
      docMetaJson: {
        title: data.doc.title,
        authors: data.doc.authors,
        year: data.doc.year,
        pages: data.doc.pages,
        region: data.doc.region,
        summary: data.doc.summary,
        source: data.doc.source,
        issue: data.doc.issue,
        language: data.doc.language,
        docType: data.doc.docType,
        topics: data.doc.topics,
      },
      chapters: data.chapters.map((ch) => ({
        order: ch.order ?? 0,
        level: ch.level ?? 1,
        title: ch.title,
        startPage: ch.startPage,
        endPage: ch.endPage,
        summary: ch.summary,
        keywords: ch.keywords,
      })),
      fileId: undefined, // Wird nicht benötigt für BookDetail
      fileName: data.doc.fileName,
      chunkCount: data.doc.chunkCount,
      chaptersCount: data.doc.chaptersCount,
      upsertedAt: data.doc.upsertedAt,
    }
    return mapToBookDetail(docMetaFormat)
  }, [data, actualViewType])

  const sessionData = React.useMemo<SessionDetailData | null>(() => {
    if (!data || actualViewType !== "session") return null
    // Konvertiere ingestion-status Format zu doc-meta Format für Mapper
    const docMetaFormat = {
      docMetaJson: {
        title: data.doc.title,
        summary: data.doc.summary,
        topics: data.doc.topics,
        language: data.doc.language,
        year: data.doc.year,
      },
      fileId: undefined, // Wird nicht benötigt für SessionDetail
      fileName: data.doc.fileName,
      chunkCount: data.doc.chunkCount,
      upsertedAt: data.doc.upsertedAt,
    }
    return mapToSessionDetail(docMetaFormat)
  }, [data, actualViewType])

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Story wird geladen…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!data || !data.doc.exists) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Keine Story-Daten gefunden. Bitte zuerst transformieren und veröffentlichen.
      </div>
    )
  }

  if (actualViewType === "session" && sessionData) {
    return <SessionDetail data={sessionData} showBackLink={false} libraryId={libraryId} />
  }

  if (bookData) {
    return <BookDetail data={bookData} showBackLink={false} />
  }

  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      Daten konnten nicht gemappt werden.
    </div>
  )
}

