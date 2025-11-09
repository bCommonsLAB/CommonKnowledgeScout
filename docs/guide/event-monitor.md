---
title: Event Monitor Integration
---

# Event Monitor: Job Management and Event Conversion

> Status: ✅ Implemented

The Event Monitor enables management and monitoring of transformation and import jobs. It displays the status of all running, completed, and failed jobs and allows their management.

## Overview

The Event Monitor is the central dashboard for:
- **Job Monitoring**: Status of all transformation and import jobs
- **Batch Management**: Management of job batches
- **Error Handling**: Identification and retry of failed jobs
- **Event Conversion**: Conversion of event data to structured Markdown files

## Architecture

- **Frontend**: Next.js App Router, Shadcn UI, Tailwind CSS
- **API**: `/api/event-job/*` (Batches, Jobs, Files)
- **Backend**: Python worker processes jobs asynchronously
- **Database**: MongoDB for job persistence

## Data Model

```typescript
enum JobStatus { 
  PENDING='pending', 
  PROCESSING='processing', 
  COMPLETED='completed', 
  FAILED='failed' 
}

interface Batch { 
  batch_id: string; 
  status: JobStatus; 
  total_jobs: number; 
  archived: boolean; 
  isActive: boolean 
}

interface Job { 
  job_id: string; 
  status: JobStatus; 
  batch_id: string;
  job_name?: string;
  job_type?: string;
  parameters?: Record<string, unknown>;
}
```

## Event Conversion Workflow

### 1. Import Event Data

Event data can be imported in various ways:

- **Session Manager**: Web scraping from event websites
- **Manual Import**: Direct import of event data
- **Batch Import**: Bulk import of multiple events

### 2. Event Processing

After import, event data is processed:

1. **Metadata Extraction**: Event information is extracted
2. **Session Processing**: Individual sessions are processed
3. **Speaker Information**: Speaker data is extracted and linked
4. **Media Processing**: Video URLs, presentations, and attachments are processed
5. **Transcript Extraction**: Video transcripts are extracted (if available)

### 3. Markdown Generation

Event data is converted to structured Markdown files:

- **Event Metadata**: YAML frontmatter with event information
- **Session Structure**: Organized sections for each session
- **Speaker Information**: Linked speaker data
- **Media Links**: Links to videos, presentations, attachments
- **Transcripts**: Complete video transcripts

### 4. Storage and Publishing

Generated Markdown files are:

- Saved in the library
- Organized as "Shadow Twins"
- Made available for search, RAG, and gallery publishing

## Job Management

### Job Status

Jobs can have the following status:

- **Pending**: Job is waiting for processing
- **Processing**: Job is currently being processed
- **Completed**: Job was successfully completed
- **Failed**: Job has failed

### Batch Management

Batches group multiple jobs:

- **Active Batches**: Running or pending batches
- **Archived Batches**: Completed or archived batches
- **Batch Actions**: Toggle, archive, restart

### Job Actions

The following actions can be performed for each job:

- **Show Details**: Display detailed job information
- **Restart**: Restart failed jobs
- **Delete**: Delete jobs (only for completed jobs)

## UI Features

### Batch List

- Overview of all batches
- Filter by status (active, archived)
- Sort by date, status
- Batch actions (toggle, archive)

### Job Table

- Detailed job list
- Filter by batch, status, type
- Sort by various criteria
- Job details and actions

### Progress Display

- Real-time status updates
- Progress bars for running jobs
- Error messages for failed jobs

## API Endpoints

### Batches

- `GET /api/event-job/batches`: List all batches
- `POST /api/event-job/batches`: Create new batch
- `PUT /api/event-job/batches/[batchId]`: Update batch
- `DELETE /api/event-job/batches/[batchId]`: Delete batch

### Jobs

- `GET /api/event-job/jobs`: List all jobs
- `GET /api/event-job/jobs/[jobId]`: Job details
- `POST /api/event-job/jobs/[jobId]/restart`: Restart job
- `DELETE /api/event-job/jobs/[jobId]`: Delete job

## Security

- **Authentication**: All endpoints require authentication
- **Type-Safe Validation**: Zod schemas for all inputs
- **Permissions**: Only authorized users can manage jobs

## Best Practices

1. **Regular Review**: Regularly check Event Monitor for failed jobs
2. **Batch Organization**: Group related jobs in batches
3. **Error Analysis**: Analyze error messages to identify problems
4. **Archiving**: Regularly archive completed batches
5. **Monitoring**: Monitor running jobs for timely error handling

