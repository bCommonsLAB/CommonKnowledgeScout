/**
 * @fileoverview Shadow-Twin Konvertierungs-Job - Library-Konvertierung
 * 
 * @description
 * Minimaler Konvertierungs-Job pro Library: Mongo-Meta backfill/normalisieren.
 * Keine Storage-Struktur verschieben - nur Metadaten normalisieren.
 * 
 * @module shadow-twin
 * 
 * @exports
 * - convertLibrary: Konvertiert eine Library von legacy zu v2
 */

import { LibraryService } from '@/lib/services/library-service';
import { FileLogger } from '@/lib/debug/logger';
import { getVectorCollectionName, getCollectionOnly } from '@/lib/repositories/vector-repo';
import type { Collection, Document as MongoDocument } from 'mongodb';
import { buildConversionUpdate, type VectorMetaDocForConversion } from '@/lib/shadow-twin/conversion-job-utils';

/**
 * Konvertiert eine Library von legacy zu v2.
 * 
 * Führt minimales Backfill/Normalisierung der Meta-Dokumente durch:
 * - Setzt docMetaJson.sourceFileId = Storage-Item-ID
 * - Setzt docMetaJson.artifactKind, docMetaJson.targetLanguage, docMetaJson.templateName (falls ableitbar)
 * - Optional: docMetaJson.provenance.sources[] (für Events: mehrere Quellen)
 * 
 * WICHTIG: Keine Storage-Struktur wird verschoben. Nur Metadaten werden normalisiert.
 * 
 * @param userEmail User-Email
 * @param libraryId Library-ID
 * @returns Anzahl der konvertierten Dokumente
 */
export async function convertLibrary(
  userEmail: string,
  libraryId: string
): Promise<{ converted: number; errors: number }> {
  FileLogger.info('conversion-job', 'Starte Library-Konvertierung', {
    userEmail,
    libraryId,
  });

  try {
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId);
    if (!library) {
      throw new Error('Bibliothek nicht gefunden');
    }

    const collectionName = getVectorCollectionName(library)
    const col: Collection<MongoDocument> = await getCollectionOnly(collectionName)

    // Phase 5: Nur Meta-Dokumente normalisieren (keine Storage-Änderungen!)
    // Filter: kind='meta' + libraryId + userEmail (Sicherheitsgrenze)
    const cursor = col.find(
      { kind: 'meta', libraryId, user: userEmail },
      { projection: { _id: 1, kind: 1, libraryId: 1, user: 1, fileId: 1, fileName: 1, docMetaJson: 1 } }
    ).batchSize(200)

    let converted = 0
    let errors = 0
    let ops: Array<{ updateOne: { filter: Record<string, unknown>; update: Record<string, unknown> } }> = []

    async function flush(): Promise<void> {
      if (ops.length === 0) return
      const res = await col.bulkWrite(ops, { ordered: false })
      converted += res.modifiedCount
      ops = []
    }

    for await (const raw of cursor) {
      try {
        const doc = raw as unknown as VectorMetaDocForConversion
        if (!doc?._id || doc.kind !== 'meta' || doc.libraryId !== libraryId || doc.user !== userEmail) continue

        const update = buildConversionUpdate(doc)
        if (!update) continue

        ops.push({
          updateOne: {
            filter: { _id: doc._id },
            update: update as unknown as Record<string, unknown>,
          },
        })

        if (ops.length >= 200) await flush()
      } catch (error) {
        errors += 1
        FileLogger.warn('conversion-job', 'Dokument konnte nicht normalisiert werden', {
          libraryId,
          userEmail,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    await flush()

    FileLogger.info('conversion-job', 'Konvertierung abgeschlossen', {
      userEmail,
      libraryId,
      converted,
      errors,
      collectionName,
    })

    return { converted, errors }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    FileLogger.error('conversion-job', 'Fehler bei Konvertierung', {
      userEmail,
      libraryId,
      error: msg,
    });
    throw error;
  }
}

