'use client';

import React, { Suspense } from "react";
import { Library } from "@/components/library/library";
import { useAuth } from "@clerk/nextjs";
import { useAtom, useAtomValue } from "jotai";
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useStorage } from "@/contexts/storage-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, BookOpen } from "lucide-react";

// Separate Client-Komponente für die URL-Parameter-Logik
function LibraryUrlHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, setActiveLibraryId] = useAtom(activeLibraryIdAtom);
  const { refreshAuthStatus } = useStorage();

  useEffect(() => {
    const urlLibraryId = searchParams?.get('activeLibraryId');
    const urlFolderId = searchParams?.get('folderId');
    
    // activeLibraryId aus der URL verarbeiten
    if (urlLibraryId) {
      setActiveLibraryId(urlLibraryId);
      // Speichere auch im localStorage für zukünftige Seitenaufrufe
      localStorage.setItem('activeLibraryId', urlLibraryId);
      
      // Auth-Status aktualisieren für die neue Library
      refreshAuthStatus();
      // Entferne nur activeLibraryId aus der URL, folderId beibehalten
      try {
        const params = new URLSearchParams(searchParams ?? undefined);
        params.delete('activeLibraryId');
        router.replace(params.size ? `/library?${params.toString()}` : '/library');
      } catch {}
    }

    // Optional: Wenn nur folderId vorhanden ist, nichts tun – die Synchronisation erfolgt über navigateToFolder
  }, [searchParams, setActiveLibraryId, router, refreshAuthStatus]);

  return null;
}

export default function LibraryPage() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoading, error } = useStorage();
  const libraries = useAtomValue(librariesAtom);
  const router = useRouter();

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

  // Zeige eine freundliche Meldung, wenn keine Bibliotheken vorhanden sind
  if (libraries.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle>Keine Bibliotheken vorhanden</CardTitle>
            <CardDescription>
              Erstellen Sie Ihre erste Bibliothek, um mit der Organisation Ihrer Dokumente zu beginnen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full" 
              onClick={() => router.push('/settings?newUser=true')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Erste Bibliothek erstellen
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Sie können lokale Ordner oder Cloud-Speicher wie OneDrive verbinden.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <Suspense fallback={null}>
        <LibraryUrlHandler />
      </Suspense>
      <div className="flex-1 min-h-0">
        <Library />
      </div>
    </div>
  );
} 