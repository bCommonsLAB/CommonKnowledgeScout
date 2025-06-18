import * as React from "react"
import { cn } from "@/lib/utils"
import { UILogger } from "@/lib/debug/logger"
import { StorageItem } from "@/lib/storage/types"
import { ClientLibrary } from "@/types/library"
import { Button } from "@/components/ui/button"
import { Upload, AlertTriangle } from "lucide-react"
import { UploadDialog } from "./upload-dialog"
import { StorageProvider } from "@/lib/storage/types"
import { useCallback } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAtom } from "jotai"
import { currentFolderIdAtom } from "@/atoms/library-atom"
import { Breadcrumb } from "./breadcrumb"

interface LibraryHeaderProps {
  activeLibrary: ClientLibrary | undefined
  provider: StorageProvider | null
  onUploadComplete?: () => void
  error?: string | null
  children?: React.ReactNode
}

export function LibraryHeader({
  activeLibrary,
  provider,
  onUploadComplete,
  error,
  children
}: LibraryHeaderProps) {
  const [isUploadOpen, setIsUploadOpen] = React.useState(false)
  const [currentFolderId] = useAtom(currentFolderIdAtom);

  const handleUploadComplete = useCallback(() => {
    UILogger.info('LibraryHeader', 'Upload completed');
    onUploadComplete?.();
    setIsUploadOpen(false);
  }, [onUploadComplete]);

  const handleUploadClick = useCallback(() => {
    UILogger.info('LibraryHeader', 'Upload button clicked');
    setIsUploadOpen(true);
  }, []);

  return (
    <div className="border-b bg-background flex-shrink-0">
      {error && (
        <Alert variant="destructive" className="m-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between px-4 py-2">
        {children || <Breadcrumb />}
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
          UILogger.info('LibraryHeader', 'Upload dialog state change', { open });
          setIsUploadOpen(open);
        }}
        provider={provider}
        currentFolderId={currentFolderId}
        onSuccess={handleUploadComplete}
      />
    </div>
  )
} 