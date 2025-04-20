'use client';

import React, { useEffect, useState } from "react";
import { Library } from "@/components/library/library";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useToast } from "@/components/ui/use-toast";
import { ClientLibrary, StorageProviderType } from "@/types/library";
import { AlertCircle } from "lucide-react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useAtom } from "jotai";
import { librariesAtom } from "@/atoms/library-atom";

export default function LibraryPage() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [libraries, setLibraries] = useAtom(librariesAtom);
  const { toast } = useToast();

  useEffect(() => {
    if (!isAuthLoaded || !isUserLoaded) return;
    
    if (!isSignedIn) {
      setError("Sie müssen angemeldet sein, um auf die Bibliothek zugreifen zu können.");
      setLoading(false);
      return;
    }

    loadLibraries();
  }, [isAuthLoaded, isUserLoaded, isSignedIn]);

  const loadLibraries = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userEmail = user?.primaryEmailAddress?.emailAddress;
      if (!userEmail) {
        throw new Error("Keine Benutzer-Email verfügbar");
      }
      
      console.log('Loading libraries for user:', userEmail);
      
      const response = await fetch(`/api/libraries?email=${encodeURIComponent(userEmail)}`);
      if (!response.ok) {
        throw new Error(`API-Fehler: ${response.status}`);
      }
      const userLibraries = await response.json();
      
      if (!userLibraries || userLibraries.length === 0) {
        console.log('No libraries found for user');
        setError("Keine Bibliotheken gefunden. Bitte erstellen Sie eine Bibliothek in den Einstellungen.");
        setLoading(false);
        return;
      }
      
      const clientLibraries: ClientLibrary[] = userLibraries.map((lib: any) => ({
        id: lib.id,
        label: lib.label || "Unbenannt",
        path: lib.path,
        icon: <AlertCircle className="h-4 w-4" />,
        type: lib.type || 'local' as StorageProviderType,
        isEnabled: lib.isEnabled !== false,
        config: {
          transcription: lib.transcription || 'disabled',
          ...lib.config
        }
      }));
      
      console.log('Loaded libraries:', clientLibraries);
      
      setLibraries(clientLibraries);
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading libraries:', err);
      setError(`Fehler beim Laden der Bibliotheken: ${err.message}`);
      setLoading(false);
      
      toast({
        title: "Fehler",
        description: `Bibliotheken konnten nicht geladen werden: ${err.message}`,
        variant: "destructive"
      });
    }
  };

  const handleTestUserChange = (testEmail: string) => {
    if (testEmail) {
      console.log('Test user changed to:', testEmail);
    }
  };

  if (loading) {
    return <div className="p-8">
      <Skeleton className="h-[500px] w-full" />
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
      <div className="flex-1">
        <Library 
          defaultLayout={[20, 40, 40]}
          navCollapsedSize={4}
        />
      </div>
    </div>
  );
} 