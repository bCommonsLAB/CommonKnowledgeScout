'use client';

import React, { Suspense } from "react";
import { Library } from "@/components/library/library";
import { useAuth } from "@clerk/nextjs";
import { useAtom } from "jotai";
import { activeLibraryIdAtom } from "@/atoms/library-atom";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useStorage } from "@/contexts/storage-context";

// Separate Client-Komponente für die URL-Parameter-Logik
function LibraryUrlHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, setActiveLibraryId] = useAtom(activeLibraryIdAtom);
  const { refreshAuthStatus } = useStorage();

  useEffect(() => {
    const urlLibraryId = searchParams.get('activeLibraryId');
    
    // Nur die activeLibraryId aus der URL verarbeiten
    if (urlLibraryId) {
      console.log('[LibraryPage] Setze aktive Bibliothek aus URL-Parameter:', urlLibraryId);
      setActiveLibraryId(urlLibraryId);
      // Speichere auch im localStorage für zukünftige Seitenaufrufe
      localStorage.setItem('activeLibraryId', urlLibraryId);
      
      // Auth-Status aktualisieren für die neue Library
      refreshAuthStatus();
      
      // Entferne den Parameter aus der URL
      router.replace('/library');
    }
  }, [searchParams, setActiveLibraryId, router, refreshAuthStatus]);

  return null;
}

export default function LibraryPage() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoading, error } = useStorage();

  // Nutze den StorageContext statt eigenes Loading
  if (!isAuthLoaded || isLoading) {
    return <div className="p-8">
      <Skeleton className="h-[500px] w-full" />
    </div>;
  }

  if (!isSignedIn) {
    return <div className="p-8">
      <Alert variant="destructive">
        <ExclamationTriangleIcon className="h-4 w-4" />
        <AlertTitle>Fehler</AlertTitle>
        <AlertDescription>
          Sie müssen angemeldet sein, um auf die Bibliothek zugreifen zu können.
        </AlertDescription>
      </Alert>
    </div>;
  }

  if (error) {
    return <div className="p-8">
      <div className="mb-8">
        <Alert variant="destructive">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </div>
    </div>;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <Suspense fallback={null}>
        <LibraryUrlHandler />
      </Suspense>
      <div className="flex-1">
        <Library />
      </div>
    </div>
  );
} 