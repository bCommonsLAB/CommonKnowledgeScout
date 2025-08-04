'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RepairTestPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleRepair = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/repair-nextcloud-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      setResult(data);
      console.log('Reparatur-Ergebnis:', data);
    } catch (error) {
      console.error('Fehler bei der Reparatur:', error);
      setResult({ error: 'Fehler bei der Anfrage' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>🔧 Nextcloud Passwort Reparatur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Diese Seite repariert das falsche Passwort in der Nextcloud Library.
          </p>
          
          <Button 
            onClick={handleRepair}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Repariere...' : 'Nextcloud Passwort reparieren'}
          </Button>
          
          {result && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Ergebnis:</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}