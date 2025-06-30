import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';
import { JobStatus } from '@/types/event-job';

const repository = new EventJobRepository();

/**
 * GET /api/event-job/batches/[batchId]/archive-status
 * Gibt Archive-Informationen für einen Batch zurück
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    
    // Batch überprüfen
    const batch = await repository.getBatch(batchId);
    
    if (!batch) {
      return NextResponse.json(
        { status: 'error', message: 'Batch nicht gefunden' },
        { status: 404 }
      );
    }
    
    // Alle Jobs des Batches laden
    const jobs = await repository.getJobsForBatch(batchId, { limit: 1000 });
    
    // Archive-Status analysieren
    const completedJobs = jobs.filter(job => job.status === JobStatus.COMPLETED);
    const jobsWithArchives = completedJobs.filter(job => 
      job.results?.archive_data && job.results?.archive_filename
    );
    
    // Geschätzte Archive-Größe berechnen
    const totalArchiveSize = jobsWithArchives.reduce((size, job) => {
      const archiveSize = job.results?.archive_data 
        ? Math.ceil(job.results.archive_data.length * 0.75) // Base64 zu Bytes
        : 0;
      return size + archiveSize;
    }, 0);
    
    // Detaillierte Job-Informationen
    const archivableJobs = jobsWithArchives.map(job => ({
      jobId: job.job_id,
      sessionName: job.parameters?.session || job.job_name || `Job-${job.job_id}`,
      archiveFilename: job.results?.archive_filename,
      estimatedSize: job.results?.archive_data 
        ? Math.ceil(job.results.archive_data.length * 0.75)
        : 0,
      createdAt: job.created_at,
      completedAt: job.completed_at
    }));
    
    return NextResponse.json({
      status: 'success',
      data: {
        batchId,
        batchName: batch.batch_name,
        totalJobs: jobs.length,
        completedJobs: completedJobs.length,
        jobsWithArchives: jobsWithArchives.length,
        estimatedTotalSize: totalArchiveSize,
        estimatedTotalSizeMB: Math.round(totalArchiveSize / (1024 * 1024) * 100) / 100,
        archivableJobs,
        // Event- und Track-Informationen extrahieren
        eventName: extractEventName(batch.batch_name || ''),
        trackName: extractTrackName(batch.batch_name || '')
      }
    });
    
  } catch (error) {
    console.error('Fehler beim Abrufen des Archive-Status:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: `Fehler beim Abrufen des Archive-Status: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      },
      { status: 500 }
    );
  }
}

// Hilfsfunktionen für Event- und Track-Extraktion
function extractEventName(batchName: string): string {
  const dashIndex = batchName.indexOf(' - ');
  if (dashIndex > 0) {
    return batchName.substring(0, dashIndex);
  }
  return batchName;
}

function extractTrackName(batchName: string): string {
  const dashIndex = batchName.indexOf(' - ');
  if (dashIndex > 0) {
    const parenthesisIndex = batchName.lastIndexOf(' (');
    if (parenthesisIndex > dashIndex) {
      return batchName.substring(dashIndex + 3, parenthesisIndex);
    } else {
      return batchName.substring(dashIndex + 3);
    }
  }
  return '';
} 