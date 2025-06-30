import { NextRequest, NextResponse } from 'next/server';
import { EventJobRepository } from '@/lib/event-job-repository';

const repository = new EventJobRepository();

/**
 * GET /api/event-job/jobs/[jobId]/download-archive
 * Lädt das ZIP-Archiv für einen Job herunter
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    // Job laden
    const job = await repository.getJob(jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job nicht gefunden' },
        { status: 404 }
      );
    }
    
    // Prüfen ob Job ein Archiv hat
    if (!job.results?.archive_data || !job.results?.archive_filename) {
      return NextResponse.json(
        { error: 'Job hat kein Archiv' },
        { status: 404 }
      );
    }
    
    // Base64-Daten zu Buffer konvertieren
    const buffer = Buffer.from(job.results.archive_data, 'base64');
    
    // ZIP-Datei als Response zurückgeben
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${job.results.archive_filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
    
  } catch (error) {
    console.error('Fehler beim Herunterladen des Archivs:', error);
    return NextResponse.json(
      { error: 'Fehler beim Herunterladen des Archivs' },
      { status: 500 }
    );
  }
} 