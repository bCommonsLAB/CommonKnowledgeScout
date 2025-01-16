'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { StorageItem } from '@/lib/storage/types';

interface AudioPlayerProps {
  item: StorageItem;
}

// Formatiert Sekunden in MM:SS Format
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export const AudioPlayer = memo(function AudioPlayer({ item }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Event Handler für Metadaten und Zeitaktualisierung
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  return (
    <div className="my-4">
      <div className="text-xs text-muted-foreground mb-2">
        {item.metadata.name}
        {duration && (
          <span className="ml-2">
            ({formatTime(currentTime)} / {formatTime(duration)})
          </span>
        )}
      </div>
      <audio 
        ref={audioRef}
        controls 
        className="w-full" 
        key={item.id}
        preload="metadata"
      >
        <source 
          src={`/api/storage/filesystem?action=binary&fileId=${item.id}`} 
          type={item.metadata.mimeType || 'audio/mpeg'} 
        />
        Ihr Browser unterstützt das Audio-Element nicht.
      </audio>
    </div>
  );
}, (prevProps, nextProps) => prevProps.item.id === nextProps.item.id); 