import * as React from "react"
import { cn } from "@/lib/utils"
import { StorageItem } from "@/lib/storage/types"
import { ClientLibrary } from "@/types/library"
import { Button } from "@/components/ui/button"
import { Upload, AlertTriangle } from "lucide-react"
import { UploadDialog } from "./upload-dialog"
import { StorageProvider } from "@/lib/storage/types"
import { useCallback, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAtom } from "jotai"
import { currentFolderIdAtom, breadcrumbItemsAtom } from "@/atoms/library-atom"

interface LibraryHeaderProps {
  activeLibrary: ClientLibrary | undefined
  onFolderSelect: (item: StorageItem) => void
  onRootClick: () => void
  provider: StorageProvider | null
  onUploadComplete?: () => void
  error?: string | null
}

export function LibraryHeader({
  activeLibrary,
  onFolderSelect,
  onRootClick,
  provider,
  onUploadComplete,
  error
}: LibraryHeaderProps) {
  const [isUploadOpen, setIsUploadOpen] = React.useState(false)
  
  // Globale Atome für aktuelles Verzeichnis und Pfad-Informationen
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const [breadcrumbItems] = useAtom(breadcrumbItemsAtom);

  // Referenz für Breadcrumb-Element zum Scrollen
  const breadcrumbRef = React.useRef<HTMLDivElement>(null);

  // Scrolle zum Ende des Breadcrumbs, wenn sich Items ändern
  useEffect(() => {
    if (breadcrumbRef.current) {
      breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth;
    }
  }, [breadcrumbItems]);

  // Debug Logging für Header-Zustand
  React.useEffect(() => {
    console.log('LibraryHeader: State updated', {
      isUploadOpen,
      hasProvider: !!provider,
      currentFolderId,
      activeLibrary: activeLibrary?.label,
      breadcrumbItems: breadcrumbItems.length,
      breadcrumbNames: breadcrumbItems.map(item => item.metadata.name).join('/')
    });
    
    // Warnung loggen, wenn Breadcrumb leer ist aber ein nicht-root Ordner ausgewählt ist
    if (breadcrumbItems.length === 0 && currentFolderId !== 'root') {
      console.warn('LibraryHeader: Breadcrumb ist leer, obwohl ein Ordner ausgewählt ist:', currentFolderId);
    }
  }, [isUploadOpen, provider, currentFolderId, activeLibrary, breadcrumbItems]);

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
      {error && (
        <Alert variant="destructive" className="m-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4 min-w-0">
          <div className="text-sm flex items-center gap-2 min-w-0 overflow-hidden">
            <span className="text-muted-foreground flex-shrink-0">Pfad:</span>
            <div 
              ref={breadcrumbRef}
              className="flex items-center gap-1 overflow-auto whitespace-nowrap no-scrollbar" 
              style={{ maxWidth: '60vw' }}
            >
              <button
                onClick={onRootClick}
                className={cn(
                  "hover:text-foreground flex-shrink-0 font-medium",
                  currentFolderId === 'root' ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {activeLibrary?.label || '/'}
              </button>
              {breadcrumbItems.length > 0 && (
                <>
                  {breadcrumbItems.map((item) => (
                    <React.Fragment key={item.id}>
                      <span className="text-muted-foreground flex-shrink-0">/</span>
                      <button
                        onClick={() => onFolderSelect(item)}
                        className={cn(
                          "hover:text-foreground truncate max-w-[150px]",
                          currentFolderId === item.id ? "text-foreground font-medium" : "text-muted-foreground"
                        )}
                        title={item.metadata.name}
                      >
                        {item.metadata.name}
                      </button>
                    </React.Fragment>
                  ))}
                </>
              )}
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