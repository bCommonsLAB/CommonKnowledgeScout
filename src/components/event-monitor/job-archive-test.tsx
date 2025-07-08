'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Loader2 } from 'lucide-react';

export default function JobArchiveTest() {
  const [jobId, setJobId] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<string>('');

  const testArchiveDownload = async () => {
    if (!jobId.trim()) {
      alert('Bitte Job-ID eingeben');
      return;
    }

    try {
      setDownloading(true);
      setResult('');

      // Test Archive-Download
      const response = await fetch(`/api/event-job/jobs/${jobId}/download-archive`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `test-archive-${jobId}.zip`;
        link.click();
        URL.revokeObjectURL(url);
        
        setResult(`✅ Archive erfolgreich heruntergeladen! Größe: ${Math.round(blob.size / 1024)} KB`);
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        setResult(`❌ Fehler: ${errorData.error || response.statusText}`);
      }
      
    } catch (error) {
      console.error('Test-Fehler:', error);
      setResult(`❌ Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Archive-Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="job-id">Job-ID</Label>
          <Input
            id="job-id"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="z.B. job-abc123"
            disabled={downloading}
          />
        </div>
        
        <Button 
          onClick={testArchiveDownload}
          disabled={downloading || !jobId.trim()}
          className="w-full"
        >
          {downloading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Teste Download...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Archive testen
            </>
          )}
        </Button>

        {result && (
          <div className="p-3 rounded-md bg-gray-50 dark:bg-gray-900 text-sm">
            {result}
          </div>
        )}

        <div className="text-xs text-gray-500">
          <p>Hinweise:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Job muss den Status &quot;completed&quot; haben</li>
            <li>Job muss ein ZIP-Archiv enthalten</li>
            <li>Teste mit einer echten Job-ID aus dem Event-Monitor</li>
          </ul>
          
          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-800 dark:text-blue-200">
            <p className="font-medium">Neue ZIP-Struktur:</p>
            <code className="text-xs">
              sessions/<br/>
              └── Event_Name/<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;├── assets/session_name/<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;└── LANGUAGE/Track_Name/
            </code>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 