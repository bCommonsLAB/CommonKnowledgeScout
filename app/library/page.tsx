'use client';

import { Library } from '@/components/library/library';
import { File } from 'lucide-react';
import { ClientLibrary } from '@/types/library';
import { useEffect, useState } from 'react';

export default function LibraryPage() {
  const [libraries, setLibraries] = useState<ClientLibrary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLibraries = async () => {
      try {
        const response = await fetch('/api/libraries');
        if (!response.ok) {
          throw new Error('Failed to load libraries');
        }
        const data = await response.json();
        // Icons client-seitig hinzufügen
        const librariesWithIcons = data.map((lib: ClientLibrary) => ({
          ...lib,
          icon: <File className="h-4 w-4" />
        }));
        setLibraries(librariesWithIcons);
      } catch (err) {
        console.error('Error loading libraries:', err);
        setError(err instanceof Error ? err.message : 'Failed to load libraries');
      } finally {
        setIsLoading(false);
      }
    };

    loadLibraries();
  }, []);

  if (isLoading) {
    return <div>Lade Bibliotheken...</div>;
  }

  if (error) {
    return <div>Fehler: {error}</div>;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <Library 
        libraries={libraries}
        defaultLayout={[20, 40, 40]}
        navCollapsedSize={4}
      />
    </div>
  );
} 