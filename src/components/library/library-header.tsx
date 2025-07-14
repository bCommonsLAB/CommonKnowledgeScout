import * as React from "react"
import { UILogger } from "@/lib/debug/logger"
import { Button } from "@/components/ui/button"
import { Upload, AlertTriangle, ArrowLeft, Eye } from "lucide-react"
import { UploadDialog } from "./upload-dialog"
import { StorageProvider } from "@/lib/storage/types"
import { useCallback } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAtom } from "jotai"
import { currentFolderIdAtom, reviewModeAtom } from "@/atoms/library-atom"
import { Breadcrumb } from "./breadcrumb"

interface LibraryHeaderProps {
  provider: StorageProvider | null
  onUploadComplete?: () => void
  error?: string | null
  children?: React.ReactNode
  onClearCache?: () => void // Cache-Invalidierung
}

export function LibraryHeader({
  provider,
  onUploadComplete,
  error,
  children,
  onClearCache
}: LibraryHeaderProps) {
  const [isUploadOpen, setIsUploadOpen] = React.useState(false)
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const [isReviewMode, setIsReviewMode] = useAtom(reviewModeAtom);

  const handleUploadComplete = useCallback(() => {
    UILogger.info('LibraryHeader', 'Upload completed');
    onUploadComplete?.();
    setIsUploadOpen(false);
  }, [onUploadComplete]);

  const handleUploadClick = useCallback(() => {
    UILogger.info('LibraryHeader', 'Upload button clicked');
    setIsUploadOpen(true);
  }, []);

  const handleReviewModeToggle = useCallback(() => {
    UILogger.info('LibraryHeader', 'Review mode toggled', { newMode: !isReviewMode });
    
    // Wenn Review-Modus aktiviert wird, Cache leeren
    if (!isReviewMode && onClearCache) {
      UILogger.info('LibraryHeader', 'Clearing cache before entering review mode');
      onClearCache();
    }
    
    setIsReviewMode(!isReviewMode);
  }, [isReviewMode, setIsReviewMode, onClearCache]);

  return (
    <div className="border-b bg-background flex-shrink-0">
      {error && (
        <Alert variant="destructive" className="m-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          {children || <Breadcrumb />}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReviewModeToggle}
              className="gap-2"
            >
              {isReviewMode ? (
                <>
                  <ArrowLeft className="h-4 w-4" />
                  Zurück
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Vergleichen
                </>
              )}
            </Button>
            <Button
              onClick={handleUploadClick}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Hochladen
            </Button>
          </div>
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