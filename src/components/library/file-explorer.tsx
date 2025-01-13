import { FileTree } from './file-tree'
import { StorageItem, StorageProvider } from '@/lib/storage/types'

interface FileExplorerProps {
  onFileSelect: (item: StorageItem) => void;
  provider: StorageProvider;
}

export function FileExplorer({ onFileSelect, provider }: FileExplorerProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <FileTree onSelect={onFileSelect} provider={provider} />
      </div>
    </div>
  )
}

