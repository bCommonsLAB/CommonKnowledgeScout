'use client'

export interface DocCardMeta {
  id: string
  fileId?: string
  fileName?: string
  title?: string
  shortTitle?: string
  authors?: string[]
  speakers?: string[]
  speakers_image_url?: string[]
  year?: number | string
  track?: string
  date?: string
  region?: string
  upsertedAt?: string
}

export interface ChapterInfo {
  title: string
  summary?: string
  pageStart?: number
  pageEnd?: number
}

export interface DetailDoc extends DocCardMeta {
  chapters?: ChapterInfo[]
  pdfUrl?: string
}

export interface GalleryTexts {
  headline: string
  subtitle: string
  description: string
  filterDescription: string
}

export interface StatsTotals { docs: number; chunks: number }
export interface StatsResponse { ok?: boolean; indexExists?: boolean; totals?: StatsTotals }




