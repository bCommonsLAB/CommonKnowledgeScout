"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UploadArea } from "@/components/library/upload-area"
import { StorageProvider } from "@/lib/storage/types"
import { Folder } from "lucide-react"
import { useState, useCallback } from "react"

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: StorageProvider | null
  currentFolderId: string
  onSuccess?: () => void
}

export function UploadDialog({ 
  open, 
  onOpenChange,
  provider,
  currentFolderId,
  onSuccess
}: UploadDialogProps) {
  const [currentPath, setCurrentPath] = useState<string>("")

  // Debug Logging für Dialog-Lebenszyklus
  React.useEffect(() => {
    console.log('UploadDialog: Dialog state changed', { 
      open,
      hasProvider: !!provider,
      currentFolderId
    });
  }, [open, provider, currentFolderId]);

  // Lade den Pfad nur wenn der Dialog geöffnet wird
  React.useEffect(() => {
    if (!open || !provider) {
      console.log('UploadDialog: Skipping path load - Dialog closed or no provider');
      return;
    }

    const loadPath = async () => {
      console.log('UploadDialog: Loading path for folder ID:', currentFolderId);
      
      try {
        console.time('UploadDialog: getPathById');
        const path = await provider.getPathById(currentFolderId);
        console.timeEnd('UploadDialog: getPathById');
        
        console.log('UploadDialog: Path loaded successfully:', path);
        setCurrentPath(path);
      } catch (error) {
        console.error('UploadDialog: Failed to load path:', {
          error,
          folderId: currentFolderId,
          provider: provider.id
        });
        setCurrentPath('/');
      }
    };

    loadPath();
  }, [open, provider, currentFolderId]);

  const handleUploadComplete = useCallback(() => {
    console.log('UploadDialog: Upload completed, calling callbacks', {
      hasOnSuccess: !!onSuccess,
      currentFolderId
    });
    onSuccess?.();
    console.log('UploadDialog: Closing dialog');
    onOpenChange(false);
  }, [onSuccess, onOpenChange, currentFolderId]);

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        console.log('UploadDialog: Dialog onOpenChange triggered', { newOpen });
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dateien hochladen</DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Folder className="h-4 w-4 flex-shrink-0" />
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-medium flex-shrink-0">Zielverzeichnis:</span>
              <span className="truncate" title={currentPath}>{currentPath}</span>
            </div>
          </div>
        </DialogHeader>
        <UploadArea 
          provider={provider}
          currentFolderId={currentFolderId}
          onUploadComplete={handleUploadComplete}
        />
      </DialogContent>
    </Dialog>
  )
} 