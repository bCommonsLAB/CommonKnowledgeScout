"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Upload, File, X, Loader2 } from "lucide-react"
import { StorageProvider } from "@/lib/storage/types"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { formatFileSize } from "@/lib/utils"
import { UploadAreaProps, UploadingFile } from "./types"

export function UploadArea({ provider, currentFolderId, onUploadComplete }: UploadAreaProps) {
  const [files, setFiles] = useState<UploadingFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => {
      const uploadingFile: UploadingFile = Object.assign(file, {
        id: Math.random().toString(36).substring(7),
        progress: 0,
        status: 'pending' as const
      });
      return uploadingFile;
    });
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    multiple: true
  })

  const removeFile = (fileId: string) => {
    setFiles(files => files.filter(f => f.id !== fileId))
  }

  const uploadFiles = async () => {
    if (!provider) {
      console.error('UploadArea: No provider available');
      toast.error("Kein Storage Provider verfügbar")
      return
    }

    if (!files.length) {
      console.warn('UploadArea: No files selected');
      toast.error("Keine Dateien zum Hochladen ausgewählt")
      return
    }

    console.log('UploadArea: Starting upload process', {
      filesCount: files.length,
      currentFolderId,
      provider: provider.name
    });

    setIsUploading(true)

    try {
      console.log('UploadArea: Processing files:', files.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        id: f.id
      })));

      const results = await Promise.all(
        files.map(async (file) => {
          if (!file || !file.name) {
            console.error('UploadArea: Invalid file object:', file);
            return { success: false, file };
          }

          try {
            console.log(`UploadArea: Starting upload for ${file.name} (${file.size} bytes)`);
            setFiles(prev => 
              prev.map(f => 
                f.id === file.id 
                  ? { ...f, status: 'uploading', progress: 0 } 
                  : f
              )
            )

            console.log(`UploadArea: Calling provider.uploadFile for ${file.name}`);
            const result = await provider.uploadFile(currentFolderId, file);
            console.log(`UploadArea: Upload success for ${file.name}:`, result);

            setFiles(prev => 
              prev.map(f => 
                f.id === file.id 
                  ? { ...f, status: 'complete', progress: 100 } 
                  : f
              )
            )
            return { success: true, file };
          } catch (error) {
            console.error(`UploadArea: Upload failed for ${file.name}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Upload fehlgeschlagen';
            toast.error(`Fehler beim Hochladen von ${file.name}: ${errorMessage}`);
            
            setFiles(prev => 
              prev.map(f => 
                f.id === file.id 
                  ? { ...f, status: 'error', error: errorMessage } 
                  : f
              )
            )
            return { success: false, file };
          }
        })
      )

      const completedFiles = results.filter(r => r.success);
      console.log('UploadArea: Upload process completed', {
        total: results.length,
        successful: completedFiles.length,
        failed: results.length - completedFiles.length
      });

      if (completedFiles.length > 0) {
        console.log('UploadArea: Calling onUploadComplete callback');
        toast.success(
          completedFiles.length === 1
            ? `"${completedFiles[0].file.name}" wurde erfolgreich hochgeladen`
            : `${completedFiles.length} Dateien wurden erfolgreich hochgeladen`, 
          {
            description: 'Die Dateiliste wurde aktualisiert'
          }
        );
        onUploadComplete?.();
        setFiles([]);
      }
    } catch (error) {
      console.error('UploadArea: General upload error:', error);
      toast.error("Fehler beim Hochladen der Dateien");
    } finally {
      console.log('UploadArea: Upload process finished');
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive 
            ? "border-primary bg-primary/10" 
            : "border-muted hover:border-muted-foreground/50",
          isUploading && "pointer-events-none opacity-50"
        )}
      >
        <input {...getInputProps()} disabled={isUploading} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
        <div className="mt-2 text-sm text-muted-foreground">
          Dateien hierher ziehen oder klicken zum Auswählen
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {files.map((file) => (
            <div 
              key={file.id} 
              className={cn(
                "flex items-center justify-between bg-muted p-2 rounded",
                file.status === 'error' && "bg-destructive/10"
              )}
            >
              <div className="flex-1 min-w-0 mr-2">
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate max-w-[500px]" title={file.name}>
                      {file.name}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="flex-shrink-0">{formatFileSize(file.size)}</span>
                      {file.status === 'pending' && <span className="text-muted-foreground">Bereit zum Upload</span>}
                      {file.status === 'uploading' && <span className="text-primary">Wird hochgeladen...</span>}
                      {file.status === 'complete' && <span className="text-success">Hochgeladen</span>}
                    </div>
                  </div>
                </div>
                {file.status === 'uploading' && (
                  <Progress value={file.progress} className="h-1 mt-1" />
                )}
                {file.status === 'error' && (
                  <p className="text-xs text-destructive mt-1">{file.error}</p>
                )}
              </div>
              {!isUploading && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => removeFile(file.id)}
                  className="flex-shrink-0 ml-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Button 
        onClick={uploadFiles} 
        disabled={files.length === 0 || isUploading} 
        className="w-full"
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Wird hochgeladen...
          </>
        ) : (
          'Dateien hochladen'
        )}
      </Button>
    </div>
  )
} 