"use client"

import { useCallback, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Mic, MicOff, Pause, Play, Square, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useStorage } from '@/contexts/storage-context';
import { useAtomValue } from 'jotai';
import { currentFolderIdAtom, activeLibraryIdAtom } from '@/atoms/library-atom';

// Samsung-Style Audio Visualizer - Minimal Working
function StyleVisualizer({ stream, isPaused }: { stream: MediaStream; isPaused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const barsRef = useRef<number[]>(new Array(50).fill(0));

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    // Setup audio context
    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    
    analyserRef.current.fftSize = 256;
    // Kein Smoothing - sofortige Reaktion auf Lautstärke
    analyserRef.current.smoothingTimeConstant = 0;
    sourceRef.current.connect(analyserRef.current);

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let frameCount = 0;

    const draw = () => {
      frameCount++;

      // Weniger häufige Updates - alle 20 Frames statt alle 10
      if (!isPaused && frameCount % 20 === 0) {
        analyserRef.current!.getByteFrequencyData(dataArray);
        
        // Direkte Lautstärke-Berechnung ohne Einfluss vorheriger Werte
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const currentVolume = (average / 255) * 100;
        
        // Shift array - jeder Balken repräsentiert nur seine eigene Lautstärke
        barsRef.current.pop();
        barsRef.current.unshift(currentVolume);
      }

      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      
      // Background
      ctx.fillStyle = '#ffffff';

      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Center line
      const centerY = canvas.height / 2;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(canvas.width, centerY);
      ctx.stroke();
      


      // Bars - dünner, mehr Abstand, sensitiver
      const barWidth = canvas.width / barsRef.current.length;
      ctx.fillStyle = '#000000';
      
      barsRef.current.forEach((volume, i) => {
        const x = i * barWidth;
        const barHeight = (volume / 50) * 100; 
        
        if (barHeight > 0) {
          // Dünnere Balken mit weniger Abstand zwischen Balken
          const thinBarWidth = barWidth - 5; 
          const offsetX = 1.5; // Weniger Abstand zwischen Balken: von 3 auf 1.5
          
          ctx.fillRect(x + offsetX, centerY - barHeight, thinBarWidth, barHeight);
          ctx.fillRect(x + offsetX, centerY, thinBarWidth, barHeight);
        }
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stream, isPaused]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={120}
      className="w-full h-[120px] rounded"
    />
  );
}

interface AudioRecorderClientProps {
  onRecordingComplete?: (blob: Blob) => void;
  onUploadComplete?: () => void;
}

export function AudioRecorderClient({ onRecordingComplete, onUploadComplete }: AudioRecorderClientProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
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
    setIsMounted(true);
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
  }, [provider, currentFolderId, generateFileName, refreshItems, onUploadComplete]);

  const startRecording = useCallback(async () => {
    console.log('[AudioRecorder] startRecording called:', { isSupported, isStorageReady });
    if (!isSupported || !isStorageReady || !isMounted) {
      console.log('[AudioRecorder] startRecording blocked:', { isSupported, isStorageReady, isMounted });
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
        // Close dialog when recording stops
        setIsDialogOpen(false);
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
    } catch {
      toast.error("Fehler", {
        description: "Aufnahme konnte nicht gestartet werden"
      });
      setIsDialogOpen(false);
    }
  }, [isSupported, isStorageReady, isMounted, onRecordingComplete, uploadAudio]);

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

  const handleDialogTriggerClick = useCallback(() => {
    if (isSupported && isStorageReady && isMounted) {
      setIsDialogOpen(true);
      // Start recording immediately when dialog opens
      setTimeout(() => {
        startRecording();
      }, 100);
    }
  }, [isSupported, isStorageReady, isMounted, startRecording]);

  

  if (!isMounted) {
    return null;
  }

  if (!isSupported) {
    return (
      <Button disabled variant="ghost" size="icon" title="Audio-Aufnahme wird nicht unterstützt" aria-label="Audio nicht verfügbar">
        <MicOff className="h-4 w-4" />
      </Button>
    );
  }

  if (!isStorageReady) {
    return (
      <Button disabled variant="ghost" size="icon" title="Storage-Provider nicht verfügbar" aria-label="Storage nicht verfügbar">
        <MicOff className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          onClick={handleDialogTriggerClick}
          variant="ghost"
          size="icon"
          title="Audio-Aufnahme starten"
          aria-label="Audio aufnehmen"
        >
          <Mic className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Audio-Aufnahme
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Recording Status - Clean und minimal */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className={`w-4 h-4 rounded-full ${isRecording && !isPaused ? 'bg-red-500 animate-pulse' : isPaused ? 'bg-yellow-500' : 'bg-gray-400'}`} />
              <span className="text-xl font-light tracking-wide">
                {isRecording && !isPaused ? 'Aufnahme läuft' : isPaused ? 'Pausiert' : 'Bereit'}
              </span>
            </div>
          </div>

          {/* Audio Visualizer - Clean Container */}
          {isRecording && streamRef.current && (
            <div className="flex justify-center mb-6">
              
                <StyleVisualizer stream={streamRef.current} isPaused={isPaused} />
              
            </div>
          )}

          {/* Control Buttons - Clean Layout */}
          <div className="space-y-3">
            {/* Pause/Resume Button */}
            <Button
              onClick={isPaused ? resumeRecording : pauseRecording}
              variant="outline"
              size="lg"
              className="w-full h-14 text-lg font-light border-gray-300 hover:bg-gray-50"
              disabled={!isRecording}
            >
              {isPaused ? (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Fortsetzen
                </>
              ) : (
                <>
                  <Pause className="h-5 w-5 mr-2" />
                  Pausieren
                </>
              )}
            </Button>
            
            {/* Action Buttons - Clean Grid */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={stopRecording}
                variant="outline"
                size="lg"
                className="h-14 text-lg font-light border-red-200 text-red-600 hover:bg-red-50"
                disabled={!isRecording}
              >
                <Square className="h-5 w-5 mr-2" />
                Abbrechen
              </Button>
              
              <Button
                onClick={sendRecording}
                className="h-14 text-lg font-light bg-black hover:bg-gray-800 text-white"
                disabled={!isRecording}
              >
                <Send className="h-5 w-5 mr-2" />
                Speichern
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 