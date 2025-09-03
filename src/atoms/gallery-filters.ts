import { atom } from 'jotai'

export interface GalleryFilters {
  author?: string[]
  region?: string[]
  year?: Array<string | number>
  docType?: string[]
  source?: string[]
  tag?: string[]
}

export const galleryFiltersAtom = atom<GalleryFilters>({})


