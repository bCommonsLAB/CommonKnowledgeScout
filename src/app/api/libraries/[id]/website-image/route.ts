import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { BlobServiceClient } from '@azure/storage-blob';
import { LibraryService } from '@/lib/services/library-service';

/**
 * POST /api/libraries/[id]/website-image
 * Lädt ein Website-Bild (Logo/Hintergrund) in den ÖFFENTLICH lesbaren
 * Azure-Blob-Container und liefert die anonym ladbare URL zurück.
 *
 * Blob-Konvention (wie scripts/mirror-website-images-to-blob.ts):
 * `<container>/<libraryId>/website/images/<dateiname>` — gleicher Dateiname
 * überschreibt bewusst (idempotent, wie das Spiegel-Skript).
 *
 * Nur Owner; multipart/form-data mit Feld `file`.
 */

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — Startseiten-Bilder sollen klein bleiben

// Erlaubte Bildtypen -> verbindliche Dateiendung im Blob
const CONTENT_TYPE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

/** Dateiname für den Blob-Pfad säubern: nur Basename, sichere Zeichen, feste Endung. */
function sanitizeFileName(original: string, ext: string): string {
  const base = original.split(/[\\/]/).pop() || 'bild';
  const stem = base.replace(/\.[^.]*$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!stem) {
    throw new Error('Dateiname enthält keine verwendbaren Zeichen');
  }
  return `${stem}.${ext}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: libraryId } = await params;

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress;
    if (!userEmail) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 });
    }

    // Nur Owner dürfen öffentliche Website-Bilder hochladen
    const libraryService = LibraryService.getInstance();
    const isOwner = await libraryService.isOwner(userEmail, libraryId);
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Keine Berechtigung. Nur Owner können Website-Bilder hochladen.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Keine Datei übermittelt (Feld "file")' }, { status: 400 });
    }

    const ext = CONTENT_TYPE_EXT[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: `Nicht unterstützter Bildtyp "${file.type}". Erlaubt: JPEG, PNG, WebP, GIF, SVG.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Datei zu groß (${Math.round(file.size / 1024 / 1024)} MB). Maximal 5 MB — bitte Bild verkleinern.` },
        { status: 400 }
      );
    }

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!conn) {
      // Kein stiller Fallback: ohne Blob-Config ist das Feature nicht nutzbar.
      return NextResponse.json(
        { error: 'AZURE_STORAGE_CONNECTION_STRING ist nicht konfiguriert' },
        { status: 500 }
      );
    }
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'knowledgescout';

    const fileName = sanitizeFileName(file.name, ext);
    const blobPath = `${libraryId}/website/images/${fileName}`;

    const svc = BlobServiceClient.fromConnectionString(conn);
    const container = svc.getContainerClient(containerName);
    const blockBlob = container.getBlockBlobClient(blobPath);
    const buffer = Buffer.from(await file.arrayBuffer());
    await blockBlob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: file.type },
    });

    const url = `https://${svc.accountName}.blob.core.windows.net/${containerName}/${blobPath}`;
    return NextResponse.json({ url, fileName });
  } catch (error) {
    console.error('[website-image] Upload-Fehler:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler beim Upload' },
      { status: 500 }
    );
  }
}
