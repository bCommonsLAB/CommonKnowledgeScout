import { atom } from 'jotai';
import { Library } from '@/types/library';

export const activeLibraryIdAtom = atom<string | null>(null);
export const librariesAtom = atom<Library[]>([]); 