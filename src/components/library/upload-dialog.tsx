"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UploadArea } from "@/components/library/upload-area"
import { StorageProvider } from "@/lib/storage/types"
import { Folder } from "lucide-react"
import { useState, useCallback } from "react"
import { FileLogger } from "@/lib/debug/logger"

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
  const [isOpen, setIsOpen] = useState<boolean>(open)

  if (open !== isOpen) {
    FileLogger.debug('UploadDialog', 'Dialog state changed', { open, isOpen });
    setIsOpen(open);
  }

  // Pfad laden, wenn Dialog geöffnet ist und Provider verfügbar
  React.useEffect(() => {
    if (open && provider && currentFolderId) {
      if (!open || !provider) {
        FileLogger.debug('UploadDialog', 'Skipping path load - Dialog closed or no provider');
        return;
      }

      FileLogger.debug('UploadDialog', 'Loading path for folder ID', { currentFolderId });
      
      provider.getPathById(currentFolderId)
        .then(path => {
          FileLogger.info('UploadDialog', 'Path loaded successfully', { path });
          setCurrentPath(path);
        })
        .catch(error => {
          FileLogger.error('UploadDialog', 'Failed to load path', { error, currentFolderId });
        });
    }
  }, [open, isOpen, provider, currentFolderId]);

  const handleUploadComplete = useCallback(() => {
    FileLogger.info('UploadDialog', 'Upload completed, calling callbacks', {
      hasOnSuccess: !!onSuccess,
      currentFolderId
    });
    onSuccess?.();
    FileLogger.debug('UploadDialog', 'Closing dialog');
    onOpenChange(false);
  }, [onSuccess, onOpenChange, currentFolderId]);

  const handleOpenChange = (newOpen: boolean) => {
    FileLogger.debug('UploadDialog', 'Dialog onOpenChange triggered', { newOpen });
    onOpenChange?.(newOpen);
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={handleOpenChange}
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