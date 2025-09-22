import { atom } from 'jotai'

export interface TemplateContextDoc {
  id: string
  name: string
  parentId?: string
}

export const templateContextDocsAtom = atom<TemplateContextDoc[]>([])
templateContextDocsAtom.debugLabel = 'templateContextDocsAtom'
















