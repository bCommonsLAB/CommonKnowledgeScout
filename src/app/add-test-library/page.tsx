'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AddTestLibraryPage() {
  const [email, setEmail] = useState('');
  const [libraryName, setLibraryName] = useState('');
  const [libraryPath, setLibraryPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/add-library', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          libraryName,
          libraryPath: libraryPath || undefined
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Hinzufügen der Bibliothek');
      }
      
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Bibliothek hinzufügen</h1>
      
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Neue Bibliothek</CardTitle>
          <CardDescription>
            Füge einem Benutzer eine neue Bibliothek hinzu
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="benutzer@example.com" 
                required 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="libraryName">Bibliotheksname</Label>
              <Input 
                id="libraryName" 
                value={libraryName} 
                onChange={(e) => setLibraryName(e.target.value)} 
                placeholder="Meine Bibliothek" 
                required 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="libraryPath">Pfad (optional)</Label>
              <Input 
                id="libraryPath" 
                value={libraryPath} 
                onChange={(e) => setLibraryPath(e.target.value)} 
                placeholder="/pfad/zur/bibliothek" 
              />
              <p className="text-xs text-muted-foreground">
                Leer lassen für Standardpfad
              </p>
            </div>
          </CardContent>
          
          <CardFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Wird hinzugefügt...' : 'Bibliothek hinzufügen'}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      {error && (
        <Alert variant="destructive" className="mt-6 max-w-md mx-auto">
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {result && (
        <Alert className="mt-6 max-w-md mx-auto">
          <AlertTitle>Erfolg</AlertTitle>
          <AlertDescription>
            <p>{result.message}</p>
            <p className="mt-2 font-medium">Details:</p>
            <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
} 