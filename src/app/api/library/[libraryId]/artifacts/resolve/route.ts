/**
 * @fileoverview API-Route für Artefakt-Auflösung
 * 
 * @description
 * Serverseitige Route zum Auflösen von Shadow-Twin-Artefakten.
 * Nutzt den zentralen artifact-resolver.
 * 
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import { getServerProvider } from '@/lib/storage/server-provider';
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver';
import { LibraryService } from '@/lib/services/library-service';
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service';
import { isMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id';

/**
 * GET /api/library/[libraryId]/artifacts/resolve
 * 
 * Auflösen eines Shadow-Twin-Artefakts.
 * 
 * Query-Parameter:
 * - sourceId: ID der Quelle (Storage-Item-ID)
 * - sourceName: Vollständiger Dateiname der Quelle
 * - parentId: ID des Parent-Verzeichnisses
 * - targetLanguage: Zielsprache (z.B. 'de', 'en')
 * - templateName: Optional: Template-Name (für Transformation)
 * - preferredKind: Optional: 'transcript' oder 'transformation'
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) {
      return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 });
    }

    const { libraryId } = await params;
    const { searchParams } = new URL(request.url);

    const sourceId = searchParams.get('sourceId');
    const sourceName = searchParams.get('sourceName');
    const parentId = searchParams.get('parentId');
    const targetLanguage = searchParams.get('targetLanguage') || 'de';
    const templateName = searchParams.get('templateName') || undefined;
    const preferredKind = searchParams.get('preferredKind') as 'transcript' | 'transformation' | null;

    if (!sourceId || !sourceName || !parentId) {
      return NextResponse.json(
        { error: 'sourceId, sourceName und parentId sind erforderlich' },
        { status: 400 }
      );
    }

    // Lade Library für Mode-Detection
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId);
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 });
    }

    // Verwende ShadowTwinService für zentrale Artefakt-Auflösung
    // WICHTIG: ShadowTwinService.create() erstellt den Provider nur bei Bedarf
    // (nicht bei Mongo-Modus ohne Fallback), um unnötige Auth-Fehler zu vermeiden
    const resolvedKind = preferredKind || (templateName ? 'transformation' : 'transcript');
    
    try {
      const service = await ShadowTwinService.create({
        library,
        userEmail,
        sourceId,
        sourceName,
        parentId,
      });

      // Versuche zuerst über Service zu lösen
      const serviceResult = await service.getMarkdown({
        kind: resolvedKind,
        targetLanguage,
        templateName,
      });

      if (serviceResult) {
        // Konvertiere Service-Ergebnis zu ResolvedArtifact-Format
        const location = isMongoShadowTwinId(serviceResult.id) ? 'dotFolder' : 'sibling';
        
        return NextResponse.json(
          {
            artifact: {
              kind: resolvedKind,
              fileId: serviceResult.id,
              fileName: serviceResult.name,
              location,
            },
          },
          { status: 200 }
        );
      }
      // Kein Artefakt im Service gefunden
      return NextResponse.json({ artifact: null }, { status: 200 });
    } catch (error) {
      // Service-Fehler → Fallback zu Provider-basierter Auflösung (nur wenn Provider verfügbar)
      const serviceError = error instanceof Error ? error.message : String(error);
      FileLogger.warn('artifacts/resolve', 'ShadowTwinService-Fehler, versuche Provider-Fallback', {
        error: serviceError,
      });

      // Provider-Fallback: Nur versuchen, wenn der Fehler nicht auth-bezogen ist
      // Bei Mongo-only Libraries ohne Provider würde getServerProvider fehlschlagen
      try {
        const provider = await getServerProvider(userEmail, libraryId);
        const resolved = await resolveArtifact(provider, {
          sourceItemId: sourceId,
          sourceName,
          parentId,
          targetLanguage,
          templateName,
          preferredKind: preferredKind || undefined,
        });

        if (resolved) {
          return NextResponse.json({ artifact: resolved }, { status: 200 });
        }
      } catch (providerError) {
        // Provider-Fallback fehlgeschlagen - ursprünglichen Service-Fehler melden
        FileLogger.warn('artifacts/resolve', 'Provider-Fallback auch fehlgeschlagen', {
          serviceError,
          providerError: providerError instanceof Error ? providerError.message : String(providerError),
        });
      }

      // Kein Artefakt gefunden
      return NextResponse.json({ artifact: null }, { status: 200 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    FileLogger.error('artifacts/resolve', 'Fehler bei Artefakt-Auflösung', { error: msg });
    // DB/Netzwerk ist temporär weg → 503 statt generischem 500, damit UI das korrekt einordnen kann.
    if (/Topology is closed|Datenbankverbindung fehlgeschlagen|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENOTFOUND/i.test(msg)) {
      return NextResponse.json({ error: msg, code: 'mongo_unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

