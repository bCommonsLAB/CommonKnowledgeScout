import * as React from "react"
import { cn } from "@/lib/utils"
import { StorageItem } from "@/lib/storage/types"
import { ClientLibrary } from "@/types/library"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"
import { UploadDialog } from "./upload-dialog"
import { StorageProvider } from "@/lib/storage/types"
import { useCallback } from "react"

interface LibraryHeaderProps {
  activeLibrary: ClientLibrary | undefined
  breadcrumbItems: StorageItem[]
  currentFolderId: string
  onFolderSelect: (item: StorageItem) => void
  onRootClick: () => void
  provider: StorageProvider | null
  onUploadComplete?: () => void
}

export function LibraryHeader({
  activeLibrary,
  breadcrumbItems,
  currentFolderId,
  onFolderSelect,
  onRootClick,
  provider,
  onUploadComplete
}: LibraryHeaderProps) {
  const [isUploadOpen, setIsUploadOpen] = React.useState(false)

  // Debug Logging für Header-Zustand
  React.useEffect(() => {
    console.log('LibraryHeader: State updated', {
      isUploadOpen,
      hasProvider: !!provider,
      currentFolderId,
      activeLibrary: activeLibrary?.label
    });
  }, [isUploadOpen, provider, currentFolderId, activeLibrary]);

  const handleUploadComplete = useCallback(() => {
    console.log('LibraryHeader: Upload completed callback triggered');
    onUploadComplete?.();
    console.log('LibraryHeader: Closing upload dialog');
    setIsUploadOpen(false);
  }, [onUploadComplete]);

  const handleUploadClick = useCallback(() => {
    console.log('LibraryHeader: Upload button clicked');
    setIsUploadOpen(true);
  }, []);

  return (
    <div className="border-b bg-background flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4 min-w-0">
          <div className="text-sm flex items-center gap-2 min-w-0 overflow-hidden">
            <span className="text-muted-foreground flex-shrink-0">Pfad:</span>
            <div className="flex items-center gap-1 overflow-hidden">
              <button
                onClick={onRootClick}
                className={cn(
                  "hover:text-foreground flex-shrink-0 font-medium",
                  currentFolderId === 'root' ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {activeLibrary?.label || '/'}
              </button>
              {breadcrumbItems.map((item) => (
                <React.Fragment key={item.id}>
                  <span className="text-muted-foreground flex-shrink-0">/</span>
                  <button
                    onClick={() => onFolderSelect(item)}
                    className={cn(
                      "hover:text-foreground truncate",
                      currentFolderId === item.id ? "text-foreground font-medium" : "text-muted-foreground"
                    )}
                  >
                    {item.metadata.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleUploadClick}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Hochladen
          </Button>
        </div>
      </div>

      <UploadDialog
        open={isUploadOpen}
        onOpenChange={(open) => {
          console.log('LibraryHeader: Upload dialog state change requested', { open });
          setIsUploadOpen(open);
        }}
        provider={provider}
        currentFolderId={currentFolderId}
        onSuccess={handleUploadComplete}
      />
    </div>
  )
} 