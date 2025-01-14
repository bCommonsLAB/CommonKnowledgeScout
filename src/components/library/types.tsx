export type FileType = 'folder' | 'audio' | 'video' | 'pdf' | 'text' | 'markdown'

export interface File {
  id: string
  name: string
  type: FileType
  children?: File[]
}