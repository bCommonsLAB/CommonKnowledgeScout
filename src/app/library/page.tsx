'use client';

import { Library } from '@/components/library/library';
import { File } from 'lucide-react';
import { ClientLibrary } from '@/types/library';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth, useUser } from '@clerk/nextjs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LoginButton } from '@/components/login-button';

export default function LibraryPage() {
  const [libraries, setLibraries] = useState<ClientLibrary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Clerk-Authentication
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress || 'test@example.com';
  
  // URL-Parameter auslesen (für Tests)
  const searchParams = useSearchParams();
  const testEmail = searchParams.get('email');
  
  // E-Mail-Adresse für die Bibliotheken-Abfrage
  const email = testEmail || userEmail;

  useEffect(() => {
    // Warte, bis die Benutzerinformationen geladen sind
    if (!isAuthLoaded || !isUserLoaded) return;
    
    const loadLibraries = async () => {
      try {
        setIsLoading(true);
        console.log(`Lade Bibliotheken für Benutzer: ${email}`);
        
        // Bibliotheken für den aktuellen Benutzer laden
        const response = await fetch(`/api/libraries?email=${encodeURIComponent(email)}`);
        if (!response.ok) {
          throw new Error('Fehler beim Laden der Bibliotheken');
        }
        
        const data = await response.json();
        console.log(`${data.length} Bibliotheken geladen`);
        
        // Icons client-seitig hinzufügen
        const librariesWithIcons = data.map((lib: ClientLibrary) => ({
          ...lib,
          icon: <File className="h-4 w-4" />
        }));
        
        setLibraries(librariesWithIcons);
      } catch (err) {
        console.error('Fehler beim Laden der Bibliotheken:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Bibliotheken');
      } finally {
        setIsLoading(false);
      }
    };

    loadLibraries();
  }, [email, isAuthLoaded, isUserLoaded, testEmail]);

  // Benutzer-Test Funktion (nur für Testzwecke)
  const handleTestUserChange = (testEmail: string) => {
    // Seitenwechsel mit neuem URL-Parameter
    window.location.href = `/library?email=${encodeURIComponent(testEmail)}`;
  };

  // Warte auf Auth-Laden
  if (!isAuthLoaded || !isUserLoaded) {
    return <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Authentifizierung wird geladen...</h2>
      </div>
    </div>;
  }

  // Überprüfe, ob der Benutzer angemeldet ist
  if (!isSignedIn && !testEmail) {
    return <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold mb-2">Anmeldung erforderlich</h2>
        <p className="mb-4">Bitte melden Sie sich an, um Ihre Bibliotheken anzuzeigen.</p>
        <LoginButton />
      </div>
    </div>;
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Lade Bibliotheken...</h2>
        <p>Die Bibliotheken für Benutzer {email} werden geladen</p>
      </div>
    </div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Fehler</h2>
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Erneut versuchen</Button>
      </div>
    </div>;
  }
  
  if (libraries.length === 0) {
    return <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Keine Bibliotheken gefunden</h2>
        <p className="mb-4">Für Benutzer {email} wurden keine Bibliotheken gefunden.</p>
        <Alert>
          <AlertTitle>Information</AlertTitle>
          <AlertDescription>
            Standardbibliotheken werden automatisch erstellt. Wenn keine angezeigt werden, versuchen Sie die Seite neu zu laden oder prüfen Sie die Serverprotokolle.
          </AlertDescription>
        </Alert>
      </div>
    </div>;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      
      <div className="flex-1">
        <Library 
          libraries={libraries}
          defaultLayout={[20, 40, 40]}
          navCollapsedSize={4}
        />
      </div>
    </div>
  );
} 