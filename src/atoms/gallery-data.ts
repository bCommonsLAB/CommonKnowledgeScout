import { atom } from 'jotai'
import type { DocCardMeta } from '@/lib/gallery/types'

export interface GalleryData {
  docs: DocCardMeta[]
  totalCount: number
  loading: boolean
  isLoadingMore: boolean
  error: string | null
  hasMore: boolean
}

export const galleryDataAtom = atom<GalleryData>({
  docs: [],
  totalCount: 0,
  loading: false,
  isLoadingMore: false,
  error: null,
  hasMore: true,
})



