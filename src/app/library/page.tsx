import React, { useCallback, useState } from 'react';
import { UploadDialog } from '@/components/library/upload-dialog';
import { StorageProvider } from '@/lib/storage/types';

interface LibraryPageProps {
  refreshFiles: () => void;
  storageProvider: StorageProvider | null;
  currentFolderId: string;
}

export default function LibraryPage({ refreshFiles, storageProvider, currentFolderId }: LibraryPageProps) {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  
  const handleUploadSuccess = useCallback(() => {
    console.log('Refreshing file list after upload');
    refreshFiles();
  }, [refreshFiles]);

  return (
    <>
      <UploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        provider={storageProvider}
        currentFolderId={currentFolderId}
        onSuccess={handleUploadSuccess}
      />
      {/* Rest of the component */}
    </>
  );
} 