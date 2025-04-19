'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useAuth, useUser } from '@clerk/nextjs';
import { RefreshCw } from 'lucide-react';

interface UserInfo {
  isSignedIn: boolean;
  userId?: string;
  email?: { id: string; email: string; isPrimary: boolean }[];
  fullName?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  timestamp: string;
}

interface LibraryEntry {
  email: string;
  name: string;
  lastUpdated: string;
  librariesCount: number;
  libraries: {
    id: string;
    label: string;
    type: string;
    isEnabled: boolean;
  }[];
}

interface LibrariesData {
  count: number;
  entries: LibraryEntry[];
}

export default function DebugPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [libraries, setLibraries] = useState<LibrariesData | null>(null);
  const [loading, setLoading] = useState({ user: false, libraries: false });
  const [error, setError] = useState<{ user: string | null; libraries: string | null }>({ 
    user: null, 
    libraries: null 
  });
  
  // Clerk Auth
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  // Benutzerinformationen laden
  const loadUserInfo = async () => {
    setLoading(prev => ({ ...prev, user: true }));
    setError(prev => ({ ...prev, user: null }));
    
    try {
      const response = await fetch('/api/user-info');
      const data = await response.json();
      setUserInfo(data);
    } catch (err) {
      setError(prev => ({ 
        ...prev, 
        user: err instanceof Error ? err.message : 'Fehler beim Laden der Benutzerinformationen'
      }));
    } finally {
      setLoading(prev => ({ ...prev, user: false }));
    }
  };

  // Bibliotheken laden
  const loadLibraries = async () => {
    setLoading(prev => ({ ...prev, libraries: true }));
    setError(prev => ({ ...prev, libraries: null }));
    
    try {
      const response = await fetch('/api/debug-libraries');
      const data = await response.json();
      setLibraries(data);
    } catch (err) {
      setError(prev => ({ 
        ...prev, 
        libraries: err instanceof Error ? err.message : 'Fehler beim Laden der Bibliotheken'
      }));
    } finally {
      setLoading(prev => ({ ...prev, libraries: false }));
    }
  };

  // Bei Seitenladung Daten abrufen
  useEffect(() => {
    loadUserInfo();
    loadLibraries();
  }, []);

  // Warten, bis Clerk geladen ist
  if (!isLoaded) {
    return <div className="flex items-center justify-center h-screen">
      <p>Lade Authentifizierung...</p>
    </div>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Debug-Informationen</h1>
      
      <Tabs defaultValue="user">
        <TabsList>
          <TabsTrigger value="user">Benutzer</TabsTrigger>
          <TabsTrigger value="libraries">Bibliotheken</TabsTrigger>
        </TabsList>
        
        {/* Benutzer-Informationen */}
        <TabsContent value="user" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Benutzerinformationen
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadUserInfo}
                  disabled={loading.user}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading.user ? 'animate-spin' : ''}`} />
                  Aktualisieren
                </Button>
              </CardTitle>
              <CardDescription>
                Informationen über den aktuell angemeldeten Benutzer
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {error.user ? (
                <Alert variant="destructive">
                  <AlertTitle>Fehler</AlertTitle>
                  <AlertDescription>{error.user}</AlertDescription>
                </Alert>
              ) : userInfo ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Authentifizierungsstatus</h3>
                    <p>{userInfo.isSignedIn ? 'Angemeldet' : 'Nicht angemeldet'}</p>
                    
                    {userInfo.isSignedIn && (
                      <>
                        <h3 className="text-lg font-medium mt-4">Benutzer-ID</h3>
                        <p className="font-mono text-sm bg-muted p-2 rounded">{userInfo.userId}</p>
                        
                        <h3 className="text-lg font-medium mt-4">Name</h3>
                        <p>{userInfo.fullName}</p>
                        
                        <h3 className="text-lg font-medium mt-4">E-Mail-Adressen</h3>
                        <ul className="list-disc pl-5">
                          {userInfo.email?.map(e => (
                            <li key={e.id} className={e.isPrimary ? 'font-bold' : ''}>
                              {e.email} {e.isPrimary && '(Primär)'}
                            </li>
                          ))}
                        </ul>
                        
                        {userInfo.imageUrl && (
                          <>
                            <h3 className="text-lg font-medium mt-4">Profilbild</h3>
                            <img 
                              src={userInfo.imageUrl} 
                              alt={userInfo.fullName || 'Profilbild'} 
                              className="w-16 h-16 rounded-full" 
                            />
                          </>
                        )}
                      </>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="text-lg font-medium">Rohes API-Ergebnis</h3>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                      {JSON.stringify(userInfo, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <p>Lade Benutzerinformationen...</p>
                </div>
              )}
            </CardContent>
            
            {userInfo && !userInfo.isSignedIn && (
              <CardFooter>
                <Alert>
                  <AlertTitle>Nicht angemeldet</AlertTitle>
                  <AlertDescription>
                    Sie sind derzeit nicht angemeldet. Einige Funktionen stehen möglicherweise nicht zur Verfügung.
                  </AlertDescription>
                </Alert>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
        
        {/* Bibliotheken-Informationen */}
        <TabsContent value="libraries" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Bibliotheken in der Datenbank
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadLibraries}
                  disabled={loading.libraries}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading.libraries ? 'animate-spin' : ''}`} />
                  Aktualisieren
                </Button>
              </CardTitle>
              <CardDescription>
                Alle vorhandenen Bibliothekseinträge in der MongoDB
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {error.libraries ? (
                <Alert variant="destructive">
                  <AlertTitle>Fehler</AlertTitle>
                  <AlertDescription>{error.libraries}</AlertDescription>
                </Alert>
              ) : libraries ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium">Anzahl der Einträge: {libraries.count}</h3>
                  </div>
                  
                  {libraries.entries.length > 0 ? (
                    <div className="space-y-4">
                      {libraries.entries.map((entry, index) => (
                        <Card key={index}>
                          <CardHeader className="py-3">
                            <CardTitle className="text-base">{entry.name} ({entry.email})</CardTitle>
                            <CardDescription>
                              Zuletzt aktualisiert: {new Date(entry.lastUpdated).toLocaleString()}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="py-3">
                            <h4 className="font-medium">Bibliotheken ({entry.librariesCount}):</h4>
                            {entry.libraries.length > 0 ? (
                              <ul className="list-disc pl-5 mt-2">
                                {entry.libraries.map((lib, idx) => (
                                  <li key={idx} className={!lib.isEnabled ? 'text-muted-foreground' : ''}>
                                    {lib.label} ({lib.type})
                                    {!lib.isEnabled && ' - Deaktiviert'}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-muted-foreground mt-2">Keine Bibliotheken</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <AlertTitle>Keine Daten</AlertTitle>
                      <AlertDescription>
                        Es wurden keine Bibliotheken in der Datenbank gefunden.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <p>Lade Bibliotheksdaten...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 