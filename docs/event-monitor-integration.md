# Konzept: Integration des Event-Monitors in Next.js

## Überblick

Dieses Dokument beschreibt die Integration des Python-basierten Event-Monitor-Moduls in unsere Next.js-Anwendung. Der Event-Monitor dient als zentrale Verwaltungsschnittstelle für Medienverarbeitungsaufträge im System.

## 1. Architektur

### Ist-Zustand
- **Frontend:** HTML-Template mit Bootstrap und jQuery
- **Backend:** Python-Flask-API mit MongoDB-Datenbankanbindung
- **Datenmodell:** MongoDB-Sammlungen für Batches und Jobs

### Soll-Zustand
- **Frontend:** Next.js App Router mit Shadcn UI und Tailwind CSS
- **Backend:** 
  - **API-Layer:** Next.js API Routes mit MongoDB-Anbindung
  - **Verarbeitungs-Backend:** Beibehaltung der bestehenden Python-Job-Worker
- **Datenmodell:** Wiederverwendung der bestehenden MongoDB-Sammlungen

### Systemkomponenten und Trennung der Verantwortlichkeiten

Die Verarbeitungsaufträge im Common Secretary Services System basieren auf einer klaren Trennung zwischen Frontend, API-Schicht und Verarbeitungsebene:

1. **Verwaltungsoberfläche (Frontend - Next.js)**
   - Event-Monitor Dashboard: Weboberfläche zur Überwachung und Verwaltung
   - Implementiert mit Next.js, Shadcn UI und Tailwind CSS
   - Kommuniziert mit der API-Schicht über HTTP-Anfragen
   - Zeigt Status, Fortschritt und Ergebnisse der Verarbeitungsjobs an

2. **API-Schicht (Middleware - Next.js API Routes)**
   - Event-Job-Service: Zentraler Dienst zur Auftragsverwaltung
   - Implementiert als Next.js API Routes unter `/api/event-job/...`
   - Nimmt Auftragsanfragen entgegen, speichert Metadaten und Status
   - Organisiert Jobs in Batches und verwaltet deren Lebenszyklus
   - Fungiert als Brücke zwischen Frontend und Verarbeitungs-Backend

3. **Verarbeitungsebene (Backend - Python)**
   - Job-Worker: Ausführende Komponente in Python
   - **Bleibt in der bestehenden Python-Umgebung**
   - Prozessiert Aufträge aus der Warteschlange je nach Status und Priorität
   - Führt spezialisierte Aufgaben wie Transkription, Übersetzung etc. aus
   - Aktualisiert Job-Status und meldet Ergebnisse über API-Schnittstelle zurück

### Interaktion der Komponenten

Der Ablauf eines Verarbeitungsauftrags gestaltet sich wie folgt:

1. **Initiierung:** Benutzer erstellt einen Batch mit Jobs im Next.js Event-Monitor
2. **Übermittlung:** Frontend sendet die Daten an den Event-Job-Service (Next.js API)
3. **Einreihung:** API speichert Aufträge mit Status "pending" in MongoDB
4. **Verarbeitung:** Python Job-Worker nimmt Aufträge mit "pending"-Status auf und ändert sie zu "processing"
5. **Abschluss:** Nach Verarbeitung wechselt der Status zu "completed" oder bei Problemen zu "failed"
6. **Monitoring:** Next.js Dashboard zeigt kontinuierlich den aktuellen Status und Fortschritt an

Die Python Job-Worker operieren unabhängig vom Dashboard und arbeiten asynchron im Hintergrund, während die Next.js-Verwaltungsoberfläche primär der Steuerung und Überwachung dient.

### Architektur-Komponenten

```
/app
  /event-monitor
    /page.tsx               # Hauptseite des Event-Monitors
    /create-batch/page.tsx  # Formular zum Erstellen neuer Batches
    /[batchId]/page.tsx     # Detailansicht eines Batches
  /api
    /event-job
      /batches
        /route.ts           # GET/POST Batches
        /fail-all/route.ts  # POST alle Batches auf Failed setzen
        /[batchId]/route.ts # GET/DELETE Batch-Details
        /[batchId]/archive/route.ts          # POST Batch archivieren
        /[batchId]/toggle-active/route.ts    # POST Batch aktivieren/deaktivieren
      /jobs
        /route.ts           # GET/POST Jobs
        /[jobId]/route.ts   # GET/DELETE Job-Details
        /[jobId]/restart/route.ts            # POST Job neu starten
      /files
        /[...filePath]/route.ts             # GET Event-Dateien
/components
  /event-monitor
    /batch-card.tsx         # Karte für Batch-Informationen
    /job-table.tsx          # Tabelle für Jobs
    /status-badge.tsx       # Status-Badge-Komponente
    /create-batch-form.tsx  # Formular-Komponente für neue Batches
    /language-selector.tsx  # Sprachauswahl-Komponente
/lib
  /event-job
    /batch-service.ts       # Business-Logik für Batches
    /job-service.ts         # Business-Logik für Jobs
    /models.ts              # TypeScript-Interfaces für Datenmodelle
/db
  /mongodb.ts               # MongoDB-Verbindungslogik
  /repositories
    /batch-repository.ts    # Repository für Batch-Operationen
    /job-repository.ts      # Repository für Job-Operationen
```

## 2. Datenmodell

Das Datenmodell ist an die in Python definierten Datenstrukturen aus `job_models.py` angelehnt und als TypeScript-Interfaces implementiert. Dies stellt sicher, dass die Datentypen in Frontend und Backend konsistent sind.

### Enumerationen

```typescript
enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

enum AccessVisibility {
  PRIVATE = 'private',
  PUBLIC = 'public'
}
```

### Batch-Interface

```typescript
interface Batch {
  batch_id: string;
  status: JobStatus;
  created_at: Date;
  updated_at: Date;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  pending_jobs?: number;
  processing_jobs?: number;
  archived: boolean;
  batch_name: string;
  user_id: string;
  access_control: AccessControl;
  completed_at?: Date;
  isActive: boolean;
}

interface AccessControl {
  visibility: AccessVisibility;
  read_access: string[];
  write_access: string[];
  admin_access: string[];
}
```

### Job-Interface

```typescript
interface Job {
  job_id: string;
  job_type: string;
  status: JobStatus;
  created_at: Date;
  updated_at: Date;
  parameters: JobParameters;
  archived: boolean;
  user_id: string;
  access_control: AccessControl;
  batch_id: string;
  job_name: string;
  progress?: JobProgress;
  started_at?: Date;
  logs?: LogEntry[];
  completed_at?: Date;
  results?: JobResults;
  error?: JobError;
  processing_started_at?: Date;
  event_type?: string;
}

interface JobParameters {
  event?: string;
  session?: string;
  url?: string;
  filename?: string;
  track?: string;
  day?: string;
  starttime?: string;
  endtime?: string;
  speakers?: string[] | null;
  video_url?: string;
  attachments_url?: string;
  source_language: string;
  target_language: string;
  use_cache?: boolean;
}

interface JobProgress {
  step: string;
  percent: number;
  message?: string;
}

interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  message: string;
}

interface JobResults {
  markdown_file?: string;
  markdown_content?: string;
  assets?: string[];
  web_text?: string;
  video_transcript?: string;
  attachments_text?: string | null;
  context?: Record<string, any> | null;
  attachments_url?: string | null;
}

interface JobError {
  code: string;
  message: string;
  details?: Record<string, any>;
}
```

Die Schnittstellen spiegeln exakt die Datenstrukturen wider, die in der Python-Implementierung verwendet werden, um Konsistenz und Kompatibilität zwischen Frontend und Backend zu gewährleisten.

## 3. Backend-Implementierung

### MongoDB-Anbindung

```typescript
// db/mongodb.ts
import { MongoClient, Db } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient, db: Db }> {
  // Wiederverwendung der Verbindung, wenn sie bereits existiert
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = process.env.MONGODB_URI as string;
  const dbName = process.env.MONGODB_DB as string;

  if (!uri) {
    throw new Error('Bitte definieren Sie die MONGODB_URI Umgebungsvariable');
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
```

### Repository-Implementierung

```typescript
// db/repositories/batch-repository.ts
import { Batch, JobStatus } from '@/lib/event-job/models';
import { connectToDatabase } from '../mongodb';
import { ObjectId } from 'mongodb';

export class BatchRepository {
  async createBatch(batchData: Omit<Batch, 'batch_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const { db } = await connectToDatabase();
    const collection = db.collection('event_batches');
    
    const batch_id = `batch-${crypto.randomUUID()}`;
    const now = new Date();
    
    const newBatch: Batch = {
      ...batchData,
      batch_id,
      created_at: now,
      updated_at: now,
      status: JobStatus.PENDING,
      completed_jobs: 0,
      failed_jobs: 0,
      pending_jobs: batchData.total_jobs,
      processing_jobs: 0
    };
    
    await collection.insertOne(newBatch);
    return batch_id;
  }
  
  async getBatch(batchId: string): Promise<Batch | null> {
    const { db } = await connectToDatabase();
    return db.collection('event_batches').findOne({ batch_id: batchId }) as Promise<Batch | null>;
  }
  
  async getBatches(options: { archived?: boolean, limit?: number, skip?: number } = {}): Promise<Batch[]> {
    const { db } = await connectToDatabase();
    const { archived = false, limit = 100, skip = 0 } = options;
    
    const query = { archived };
    
    const batches = await db.collection('event_batches')
      .find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
      
    return batches as Batch[];
  }
  
  async countBatches(options: { archived?: boolean } = {}): Promise<number> {
    const { db } = await connectToDatabase();
    const { archived = false } = options;
    
    const query = { archived };
    
    return db.collection('event_batches').countDocuments(query);
  }
  
  async updateBatchStatus(batchId: string, status: JobStatus): Promise<boolean> {
    const { db } = await connectToDatabase();
    
    const now = new Date();
    const update: any = {
      status,
      updated_at: now
    };
    
    // Bei abgeschlossenen Jobs das Abschlussdatum setzen
    if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
      update.completed_at = now;
    }
    
    const result = await db.collection('event_batches').updateOne(
      { batch_id: batchId },
      { $set: update }
    );
    
    return result.modifiedCount > 0;
  }
  
  async toggleBatchActive(batchId: string): Promise<boolean> {
    const { db } = await connectToDatabase();
    
    // Aktuellen Batch laden
    const batch = await this.getBatch(batchId);
    if (!batch) return false;
    
    // isActive-Status umkehren
    const result = await db.collection('event_batches').updateOne(
      { batch_id: batchId },
      { 
        $set: { 
          isActive: !batch.isActive,
          updated_at: new Date()
        } 
      }
    );
    
    return result.modifiedCount > 0;
  }
  
  async archiveBatch(batchId: string): Promise<boolean> {
    const { db } = await connectToDatabase();
    
    const result = await db.collection('event_batches').updateOne(
      { batch_id: batchId },
      { 
        $set: { 
          archived: true,
          updated_at: new Date()
        } 
      }
    );
    
    return result.modifiedCount > 0;
  }
}
```

### API-Route-Implementierung

```typescript
// app/api/event-job/batches/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { BatchRepository } from '@/db/repositories/batch-repository';
import { JobRepository } from '@/db/repositories/job-repository';
import { Batch } from '@/lib/event-job/models';

const batchRepository = new BatchRepository();
const jobRepository = new JobRepository();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const archived = searchParams.get('archived') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');
    
    const batches = await batchRepository.getBatches({ archived, limit, skip });
    const count = await batchRepository.countBatches({ archived });
    
    return NextResponse.json({
      status: 'success',
      data: {
        batches,
        total: count,
        limit,
        skip
      }
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Batches:', error);
    return NextResponse.json(
      { status: 'error', message: 'Fehler beim Abrufen der Batches' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = request.headers.get('X-User-ID') || 'system';
    
    // Validierung der Eingabedaten
    if (!body.jobs || !Array.isArray(body.jobs) || body.jobs.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Keine gültigen Jobs angegeben' },
        { status: 400 }
      );
    }
    
    // Batch erstellen
    const batchData: Partial<Batch> = {
      batch_name: body.batch_name || `Batch ${new Date().toISOString()}`,
      user_id: userId,
      total_jobs: body.jobs.length,
      archived: false,
      isActive: true,
      access_control: {
        visibility: AccessVisibility.PRIVATE,
        read_access: [userId],
        write_access: [userId],
        admin_access: [userId]
      }
    };
    
    const batchId = await batchRepository.createBatch(batchData as Omit<Batch, 'batch_id' | 'created_at' | 'updated_at'>);
    
    // Jobs erstellen
    const jobPromises = body.jobs.map((job: any) => 
      jobRepository.createJob({
        ...job,
        batch_id: batchId,
        user_id: userId
      })
    );
    
    await Promise.all(jobPromises);
    
    return NextResponse.json(
      { 
        status: 'success', 
        message: 'Batch erfolgreich erstellt',
        data: { batch_id: batchId }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Fehler beim Erstellen des Batches:', error);
    return NextResponse.json(
      { status: 'error', message: 'Fehler beim Erstellen des Batches' },
      { status: 500 }
    );
  }
}
```

## 4. Frontend-Implementierung

### Hauptseite

```tsx
// app/event-monitor/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import BatchCard from '@/components/event-monitor/batch-card';
import { Batch } from '@/lib/event-job/models';
import { Loader2, RefreshCw, Plus, AlertTriangle, Clock } from 'lucide-react';

export default function EventMonitorPage() {
  const [currentBatches, setCurrentBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    loadCurrentBatches();
    
    // Auto-Refresh-Timer
    let intervalId: NodeJS.Timeout;
    if (autoRefresh) {
      intervalId = setInterval(loadCurrentBatches, 10000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh]);
  
  async function loadCurrentBatches() {
    try {
      setLoading(true);
      const response = await fetch('/api/event-job/batches?archived=false');
      const data = await response.json();
      
      if (data.status === 'success') {
        setCurrentBatches(data.data.batches);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Batches:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleFailAllBatches() {
    if (!confirm('Sind Sie sicher, dass Sie alle aktuellen Batches auf "failed" setzen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }
    
    try {
      const response = await fetch('/api/event-job/batches/fail-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        alert(data.message);
        loadCurrentBatches();
      } else {
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler:', error);
      alert('Ein Fehler ist aufgetreten.');
    }
  }
  
  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Event-Verarbeitungs-Monitor</h1>
        
        <div className="flex items-center gap-3">
          <Button onClick={() => router.push('/event-monitor/create-batch')} variant="default">
            <Plus className="w-4 h-4 mr-2" /> Batch erstellen
          </Button>
          
          <Button onClick={handleFailAllBatches} variant="destructive" size="sm">
            <AlertTriangle className="w-4 h-4 mr-2" /> Alle auf Failed
          </Button>
          
          <Button variant="warning" size="sm">
            <Clock className="w-4 h-4 mr-2" /> Alle auf Pending
          </Button>
          
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="checkbox"
              />
              <span>Auto-Refresh (10s)</span>
            </label>
            
            <Button onClick={loadCurrentBatches} variant="outline" size="sm" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
      
      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">
            Aktuelle Batches <span className="ml-2 badge bg-primary">{currentBatches.length}</span>
          </TabsTrigger>
          <TabsTrigger value="archive">Archiv</TabsTrigger>
        </TabsList>
        
        <TabsContent value="current" className="space-y-4 mt-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : currentBatches.length > 0 ? (
            currentBatches.map((batch) => (
              <BatchCard key={batch.batch_id} batch={batch} onRefresh={loadCurrentBatches} />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Keine aktuellen Batches gefunden.
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="archive" className="py-4">
          {/* Archiv-Inhalt wird dynamisch geladen, wenn dieser Tab aktiviert wird */}
          <div id="archive-content"></div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Batch-Karte Komponente

```tsx
// components/event-monitor/batch-card.tsx
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StatusBadge from './status-badge';
import JobTable from './job-table';
import { Batch, Job } from '@/lib/event-job/models';
import { ToggleLeft, ToggleRight, Eye, RefreshCw, Archive } from 'lucide-react';

interface BatchCardProps {
  batch: Batch;
  onRefresh: () => void;
}

export default function BatchCard({ batch, onRefresh }: BatchCardProps) {
  const [showJobs, setShowJobs] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  async function loadJobsForBatch() {
    if (showJobs) {
      setShowJobs(false);
      return;
    }

    try {
      setLoadingJobs(true);
      const response = await fetch(`/api/event-job/jobs?batch_id=${batch.batch_id}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setJobs(data.data.jobs);
        setShowJobs(true);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Jobs:', error);
    } finally {
      setLoadingJobs(false);
    }
  }

  async function toggleBatchActive() {
    try {
      const response = await fetch(`/api/event-job/batches/${batch.batch_id}/toggle-active`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        onRefresh();
      }
    } catch (error) {
      console.error('Fehler beim Umschalten des Batch-Status:', error);
    }
  }

  async function restartBatch() {
    if (!confirm(`Möchten Sie den Batch "${batch.batch_name}" wirklich neu starten?`)) {
      return;
    }
    
    try {
      // Implementierung hier
      onRefresh();
    } catch (error) {
      console.error('Fehler beim Neustart des Batches:', error);
    }
  }

  async function archiveBatch() {
    if (!confirm(`Möchten Sie den Batch "${batch.batch_name}" wirklich archivieren?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/event-job/batches/${batch.batch_id}/archive`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        onRefresh();
      }
    } catch (error) {
      console.error('Fehler beim Archivieren des Batches:', error);
    }
  }

  return (
    <Card className={`
      ${batch.isActive ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-gray-300 opacity-80'}
      ${batch.status === 'completed' ? 'border-l-indigo-400' : ''}
    `}>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-semibold">{batch.batch_name || batch.batch_id}</div>
            <div className="text-sm text-muted-foreground">{new Date(batch.created_at).toLocaleString()}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={batch.status} />
          
          <Badge variant={batch.isActive ? "default" : "outline"}>
            {batch.isActive ? 'Aktiv' : 'Inaktiv'}
          </Badge>
          
          <div className="text-sm">
            {batch.total_jobs} Jobs 
            ({batch.completed_jobs} abgeschlossen, {batch.failed_jobs} fehlgeschlagen
            {batch.processing_jobs && batch.processing_jobs > 0 ? `, ${batch.processing_jobs} in Bearbeitung` : ''})
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleBatchActive}
            title={batch.isActive ? 'Batch deaktivieren' : 'Batch aktivieren'}
          >
            {batch.isActive ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={loadJobsForBatch}
            disabled={loadingJobs}
          >
            <Eye className="w-4 h-4 mr-1" /> 
            {showJobs ? 'Jobs ausblenden' : 'Jobs anzeigen'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={restartBatch}
            title="Batch neu starten"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={archiveBatch}
            title="Batch archivieren"
          >
            <Archive className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {showJobs && (
          <div className="mt-4">
            <JobTable jobs={jobs} onRefresh={() => loadJobsForBatch()} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## 5. Implementierungsschritte

### Phase 1: Vorbereitung
1. **MongoDB-Schnittstelle einrichten**
   - MongoDB-Verbindungsmodul erstellen
   - TypeScript-Interfaces für Datenmodelle definieren (basierend auf Python-Modellen)
   - Repository-Klassen für Datenbankzugriffe implementieren

2. **API-Endpunkte strukturieren**
   - API-Routes für alle Event-Job-Endpunkte anlegen
   - Request/Response-Handler für jeden Endpunkt definieren
   - Schnittstelle für die bestehenden Python-Job-Worker definieren

### Phase 2: Backend-Implementierung
1. **Batch-Verwaltung implementieren**
   - CRUD-Operationen für Batches
   - Spezielle Funktionen (archivieren, aktivieren/deaktivieren, etc.)

2. **Job-Verwaltung implementieren**
   - CRUD-Operationen für Jobs
   - Statusübergänge und Fehlerbehandlung
   - Schnittstelle zur Kommunikation mit den Python-Job-Workern

3. **Datei-Verwaltung implementieren**
   - Endpunkte für Dateizugriff

### Phase 3: Frontend-Implementierung
1. **Hauptansicht erstellen**
   - Tabs für aktuelle und archivierte Batches
   - Batch-Karten-Komponente mit Statusinformationen

2. **Job-Anzeige implementieren**
   - Tabellen-Komponente für Jobs
   - Detailansicht für einzelne Jobs

3. **Formular-Komponenten entwickeln**
   - Batch-Erstellungsformular
   - Sprachänderungsformular
   - Job-Neustart-Dialog

### Phase 4: Integration und Tests
1. **Integration mit Python-Backend**
   - Sicherstellen der korrekten Kommunikation zwischen Next.js API und Python-Job-Worker
   - Definition klarer Schnittstellen und Verantwortlichkeiten

2. **End-to-End-Tests**
   - Test aller Hauptfunktionen
   - Überprüfung der Datenintegrität und korrekten Statusübergänge

3. **Performance-Optimierung**
   - Lazy Loading für Job-Listen
   - Caching-Strategien für häufig abgefragte Daten

4. **UI/UX-Verbesserungen**
   - Verbessertes Feedback bei Aktionen
   - Optimierte mobile Ansicht

## 6. Sicherheitsaspekte

1. **Authentifizierung und Autorisierung**
   - Alle API-Endpunkte mit Authentifizierung absichern
   - Zugriffsrechte basierend auf `access_control` in den Dokumenten prüfen

2. **Validierung**
   - Strenge Validierung aller Eingabedaten
   - Typsichere Implementierung mit TypeScript

3. **Fehlerbehandlung**
   - Konsistente Fehlerbehandlung über alle API-Endpunkte
   - Detaillierte Logging-Funktionalität

## 7. Zusammenfassung

Der Event-Monitor wird als vollständig integrierte Komponente in die Next.js-Anwendung implementiert, während die eigentliche Verarbeitungslogik in der bestehenden Python-Umgebung verbleibt. Diese Trennung ermöglicht:

1. **Effiziente Wiederverwendung:** Die komplexe Job-Verarbeitungslogik in Python muss nicht neu implementiert werden
2. **Klare Trennung der Zuständigkeiten:** Frontend für Benutzerinteraktion, Python-Backend für Datenverarbeitung
3. **Unabhängige Skalierbarkeit:** Frontend und Verarbeitungs-Backend können unabhängig voneinander skaliert werden

Durch die Nutzung von TypeScript, Shadcn UI und der bestehenden MongoDB-Datenbank wird eine moderne, wartbare und typsichere Implementierung der Verwaltungsoberfläche erreicht, während die bewährte Python-Verarbeitungslogik beibehalten wird.

Das Frontend-Modul kommuniziert über definierte API-Schnittstellen mit dem Python-Backend und ermöglicht so eine nahtlose Integration beider Systeme. 