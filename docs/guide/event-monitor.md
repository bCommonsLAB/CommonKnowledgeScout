---
title: Event-Monitor Integration
---

# Event-Monitor Integration

> Status: ✅ Implementiert

Kurzanleitung zur Integration des Python-basierten Event-Monitors in die Next.js App (Dashboard + API-Routes, Python-Worker bleibt bestehen).

## Architektur (Kurz)
- Frontend: Next.js App Router, Shadcn UI, Tailwind
- API: `/api/event-job/*` (Batches, Jobs, Files)
- Backend: Python-Worker verarbeitet asynchron

## Datenmodell (Auszug)
```typescript
enum JobStatus { PENDING='pending', PROCESSING='processing', COMPLETED='completed', FAILED='failed' }
interface Batch { batch_id: string; status: JobStatus; total_jobs: number; archived: boolean; isActive: boolean }
interface Job { job_id: string; status: JobStatus; batch_id: string }
```

## Implementierungsschritte
1. MongoDB-Connector, Repositories (Batch/Job)
2. API-Routes für Batches/Jobs
3. UI: Liste aktueller Batches, Job-Tabelle, Aktionen (toggle, archive, restart)

## Sicherheit
- Authentifizierung für alle Endpunkte
- Typsichere Validierung


