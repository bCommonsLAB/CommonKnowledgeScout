"use client"

import { useCallback, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Pause, Square, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useStorage } from '@/contexts/storage-context';
import { useAtomValue } from 'jotai';
import { currentFolderIdAtom, activeLibraryIdAtom } from '@/atoms/library-atom';

interface AudioRecorderClientProps {
  onRecordingComplete?: (blob: Blob) => void;
  onUploadComplete?: () => void;
}

export function AudioRecorderClient({ onRecordingComplete, onUploadComplete }: AudioRecorderClientProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  
  const { provider, refreshItems } = useStorage();
  const currentFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  
  // Check if storage provider is available
  const isStorageReady = Boolean(provider);
  
  // Debug logging
  useEffect(() => {
    console.log('[AudioRecorder] Storage state:', {
      provider: provider ? provider.name : 'null',
      isStorageReady,
      activeLibraryId,
      currentFolderId
    });
  }, [provider, isStorageReady, activeLibraryId, currentFolderId]);

  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isCancelledRef = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Check if MediaRecorder is supported
    setIsSupported('MediaRecorder' in window && 'navigator' in window && 'mediaDevices' in navigator);
  }, []);

  const generateFileName = useCallback(() => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
    return `recording-${timestamp}.webm`;
  }, []);

  const uploadAudio = useCallback(async (blob: Blob) => {
    try {
      const fileName = generateFileName();
      const audioFile = new File([blob], fileName, { type: 'audio/webm' });
      
      await provider?.uploadFile(currentFolderId || 'root', audioFile);
      await refreshItems(currentFolderId || 'root');

      if (onUploadComplete) {
        onUploadComplete();
      }

      toast.success("Upload", {
        description: `Audio "${fileName}" gespeichert`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Speichern';
      toast.error("Fehler", {
        description: errorMessage
      });
    }
  }, [provider, currentFolderId, activeLibraryId, generateFileName, refreshItems, onUploadComplete]);

  const startRecording = useCallback(async () => {
    console.log('[AudioRecorder] startRecording called:', { isSupported, isStorageReady });
    if (!isSupported || !isStorageReady) {
      console.log('[AudioRecorder] startRecording blocked:', { isSupported, isStorageReady });
      return;
    }

    try {
      console.log('[AudioRecorder] Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
        } 
      });
      console.log('[AudioRecorder] Microphone permission granted, stream:', stream);
      
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        // Only process if recording was not cancelled
        if (!isCancelledRef.current && chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          
          // Upload the audio file
          uploadAudio(blob);
          
          if (onRecordingComplete) {
            onRecordingComplete(blob);
          }
        }
        
        // Reset cancelled flag for next recording
        isCancelledRef.current = false;
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      
      // Reset cancelled flag when starting new recording
      isCancelledRef.current = false;
      
      toast.info("Aufnahme", {
        description: "Audio-Aufnahme gestartet"
      });
    } catch (error) {
      toast.error("Fehler", {
        description: "Aufnahme konnte nicht gestartet werden"
      });
    }
  }, [isSupported, isStorageReady, onRecordingComplete, uploadAudio]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      
      toast.info("Aufnahme", {
        description: "Audio-Aufnahme pausiert"
      });
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      toast.info("Aufnahme", {
        description: "Audio-Aufnahme fortgesetzt"
      });
    }
  }, [isRecording, isPaused]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      // Mark as cancelled BEFORE stopping
      isCancelledRef.current = true;
      
      // Clear the chunks to prevent processing
      chunksRef.current = [];
      
      // Stop the recording
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      toast.info("Aufnahme", {
        description: "Audio-Aufnahme abgebrochen"
      });
    }
  }, [isRecording]);

  const sendRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      toast.success("Aufnahme", {
        description: "Audio-Aufnahme beendet"
      });
    }
  }, [isRecording]);

  if (!isSupported) {
    return (
      <Button disabled variant="outline" size="sm" title="Audio-Aufnahme wird nicht unterstützt">
        <MicOff className="h-4 w-4" />
      </Button>
    );
  }

  if (!isStorageReady) {
    return (
      <Button disabled variant="outline" size="sm" title="Storage-Provider nicht verfügbar">
        <MicOff className="h-4 w-4" />
      </Button>
    );
  }

  // Show recording interface when recording
  if (isRecording) {
    return (
      <div className="flex items-center gap-1">
        {/* Pause/Resume Button */}
        <Button
          onClick={isPaused ? resumeRecording : pauseRecording}
          variant="outline"
          size="sm"
          className="gap-2"
          title={isPaused ? "Aufnahme fortsetzen" : "Aufnahme pausieren"}
        >
          <Pause className="h-4 w-4" />
        </Button>
        
        {/* Stop Button */}
        <Button
          onClick={stopRecording}
          variant="destructive"
          size="sm"
          className="gap-2"
          title="Aufnahme abbrechen"
        >
          <Square className="h-4 w-4" />
        </Button>
        
        {/* Send Button */}
        <Button
          onClick={sendRecording}
          variant="default"
          size="sm"
          className="gap-2"
          title="Aufnahme beenden und senden"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Show single start button when not recording
  return (
    <Button
      onClick={startRecording}
      variant="outline"
      size="sm"
      className="gap-2"
      title="Audio-Aufnahme starten"
    >
      <Mic className="h-4 w-4" />
      Aufnahme
    </Button>
  );
} 