import * as React from "react"
import { UILogger } from "@/lib/debug/logger"
import { Button } from "@/components/ui/button"
import { Upload, AlertTriangle, ArrowLeft, Eye, FileStack, Sidebar, LayoutList } from "lucide-react"
import { UploadDialog } from "./upload-dialog"
import { StorageProvider } from "@/lib/storage/types"
import { useCallback } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAtom, useAtomValue } from "jotai"
import { currentFolderIdAtom, reviewModeAtom, libraryAtom } from "@/atoms/library-atom"
import { Breadcrumb } from "./breadcrumb"
import { AudioRecorderClient } from "./audio-recorder-client"
import PdfBulkImportDialog from "./pdf-bulk-import-dialog"
import { useFolderNavigation } from "@/hooks/use-folder-navigation"

interface LibraryHeaderProps {
  provider: StorageProvider | null
  onUploadComplete?: () => void
  error?: string | null
  children?: React.ReactNode
  onClearCache?: () => void // Cache-Invalidierung
  isTreeVisible?: boolean
  onToggleTree?: () => void
  isCompactList?: boolean
  onToggleCompactList?: () => void
}

export function LibraryHeader({
  provider,
  onUploadComplete,
  error,
  children,
  onClearCache,
  isTreeVisible,
  onToggleTree,
  isCompactList,
  onToggleCompactList
}: LibraryHeaderProps) {
  const [isUploadOpen, setIsUploadOpen] = React.useState(false)
  const [isPdfBulkOpen, setIsPdfBulkOpen] = React.useState(false)
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const [isReviewMode, setIsReviewMode] = useAtom(reviewModeAtom);
  const libraryState = useAtomValue(libraryAtom);
  const navigateToFolder = useFolderNavigation();

  // Aktueller Library-Name (für Root-Ebene)
  const currentLibraryName = React.useMemo(() => {
    const libId = libraryState.activeLibraryId;
    return libraryState.libraries.find(l => l.id === libId)?.label || 'Library';
  }, [libraryState.activeLibraryId, libraryState.libraries]);

  // Kompakter Pfadname (nur aktueller/übergeordneter Ordner), mobil mit Ellipsis
  const compactPathName = React.useMemo(() => {
    if (currentFolderId === 'root') return currentLibraryName;
    const folder = libraryState.folderCache?.[currentFolderId];
    return folder?.metadata?.name ?? '';
  }, [libraryState.folderCache, currentFolderId, currentLibraryName]);

  const parentId = React.useMemo(() => {
    if (currentFolderId === 'root') return null;
    const folder = libraryState.folderCache?.[currentFolderId];
    const pid = folder?.parentId;
    if (pid && pid.length > 0) return pid;
    return 'root';
  }, [libraryState.folderCache, currentFolderId]);

  const handleUploadComplete = useCallback(() => {
    UILogger.info('LibraryHeader', 'Upload completed');
    onUploadComplete?.();
    setIsUploadOpen(false);
  }, [onUploadComplete]);

  const handleUploadClick = useCallback(() => {
    UILogger.info('LibraryHeader', 'Upload button clicked');
    setIsUploadOpen(true);
  }, []);

  const handlePdfBulkClick = useCallback(() => {
    UILogger.info('LibraryHeader', 'PDF bulk button clicked');
    setIsPdfBulkOpen(true);
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
      <div className="flex items-center px-4 py-2 gap-3">
        {/* Pfad / Breadcrumb: Desktop voll, mobil kompakt */}
        <div className="min-w-0 flex-1">
          <div className="hidden sm:block">
            {children || <Breadcrumb />}
          </div>
          <div className="block sm:hidden text-xs text-muted-foreground truncate" title={compactPathName}>
            <div className="flex items-center gap-2">
              {parentId && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Zurück"
                  title="Zurück"
                  onClick={() => navigateToFolder(parentId)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <span className="truncate">{compactPathName}</span>
            </div>
          </div>
        </div>

        {/* Actions rechtsbündig, Icons only */}
        <div className="ml-auto flex items-center gap-1">
          {typeof isTreeVisible === 'boolean' && onToggleTree && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTree}
              title={isTreeVisible ? 'Tree ausblenden' : 'Tree einblenden'}
              aria-label={isTreeVisible ? 'Tree ausblenden' : 'Tree einblenden'}
              aria-pressed={isTreeVisible}
              className={isTreeVisible ? 'bg-muted' : ''}
            >
              <Sidebar className="h-4 w-4" />
            </Button>
          )}

          {typeof isCompactList === 'boolean' && onToggleCompactList && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCompactList}
              title={isCompactList ? 'Listenansicht' : 'Kompaktansicht'}
              aria-label={isCompactList ? 'Listenansicht' : 'Kompaktansicht'}
              aria-pressed={isCompactList}
              className={isCompactList ? 'bg-muted' : ''}
            >
              {/* Gleiches Icon; Tooltip unterscheidet */}
              <LayoutList className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={handleReviewModeToggle}
            title={isReviewMode ? 'Zur Liste' : 'Vergleichen'}
            aria-label={isReviewMode ? 'Zur Liste' : 'Vergleichen'}
          >
            {isReviewMode ? (
              <ArrowLeft className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleUploadClick}
            title="Datei hochladen"
            aria-label="Datei hochladen"
          >
            <Upload className="h-4 w-4" />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            onClick={handlePdfBulkClick}
            title="PDF-Verzeichnis verarbeiten"
            aria-label="PDF-Verzeichnis verarbeiten"
          >
            <FileStack className="h-4 w-4" />
          </Button>

          {/* Aufnahme als Icon-Button (mobil/desktop sichtbar) */}
          <AudioRecorderClient 
            onUploadComplete={handleUploadComplete}
          />
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

      <PdfBulkImportDialog
        open={isPdfBulkOpen}
        onOpenChange={(open) => {
          UILogger.info('LibraryHeader', 'PDF bulk dialog state change', { open });
          setIsPdfBulkOpen(open);
        }}
      />
    </div>
  )
}