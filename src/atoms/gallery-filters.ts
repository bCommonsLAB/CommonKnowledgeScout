import { atom } from 'jotai'

export type GalleryFilters = Record<string, string[]>

export const galleryFiltersAtom = atom<GalleryFilters>({})


