import { useState } from 'react'
import { Tree, TreeItem } from './tree'
import { File, Folder, FileAudio, FileVideo, FileIcon as FilePdf } from 'lucide-react'
import { File as FileType } from './types'

const initialFiles: FileType[] = [
  { id: '1', name: 'Dokumente', type: 'folder', children: [
    { id: '2', name: 'Bericht.pdf', type: 'pdf' },
    { id: '3', name: 'Präsentation.pdf', type: 'pdf' },
  ]},
  { id: '4', name: 'Medien', type: 'folder', children: [
    { id: '5', name: 'Interview.mp3', type: 'audio' },
    { id: '6', name: 'Produktvideo.mp4', type: 'video' },
  ]},
  { id: '7', name: 'Notizen.txt', type: 'text' },
]

export function FileExplorer({ onFileSelect }: { onFileSelect: (file: FileType) => void }) {
  const [files, setFiles] = useState(initialFiles)

  const renderIcon = (type: string) => {
    switch (type) {
      case 'folder': return <Folder className="h-4 w-4" />
      case 'audio': return <FileAudio className="h-4 w-4" />
      case 'video': return <FileVideo className="h-4 w-4" />
      case 'pdf': return <FilePdf className="h-4 w-4" />
      default: return <File className="h-4 w-4" />
    }
  }

  const renderTreeItems = (items: FileType[]): TreeItem[] => 
    items.map(item => ({
      id: item.id,
      name: item.name,
      icon: renderIcon(item.type),
      children: item.children ? renderTreeItems(item.children) : undefined,
    }))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2">
        <div className="text-sm font-medium">Dateibrowser</div>
      </div>
      <Tree
        data={renderTreeItems(files)}
        onSelectItem={(item) => {
          const findFile = (files: FileType[], id: string): FileType | undefined => {
            for (const file of files) {
              if (file.id === id) return file
              if (file.children) {
                const found = findFile(file.children, id)
                if (found) return found
              }
            }
          }
          const selectedFile = findFile(files, item.id)
          if (selectedFile && selectedFile.type !== 'folder') {
            onFileSelect(selectedFile)
          }
        }}
      />
    </div>
  )
}

