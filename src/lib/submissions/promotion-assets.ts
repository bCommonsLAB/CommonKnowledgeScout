/**
 * @fileoverview Asset-Spiegelung fuer den transcript-only-Pfad (Befund B2d V2).
 *
 * @description
 * Spiegelt die beim Extract erzeugten Bilder/Assets aus dem Inbox-Shadow-Twin
 * der Quell-PDF in das Ziel-Archiv — ueber den `ShadowTwinService` des Ziels,
 * sodass die FS/Mongo-Entscheidung an EINER Stelle bleibt (keine Doppelung).
 *
 * - `enumerateInboxAssets`: listet die Medien-Dateien im Inbox-Shadow-Twin-Ordner
 *   der Quelle (ordner-basiert via `findShadowTwinFolder`), ohne das Transkript-MD.
 * - `mirrorInboxAssetsToTarget`: liest die Bytes aus der Inbox und legt sie je
 *   Asset ueber den Ziel-`ShadowTwinService` als Binary-Fragment ab; idempotent
 *   (bereits im Ziel vorhandene Namen werden uebersprungen).
 *
 * @see docs/analysis/b2d-mikroentscheidungen.md
 * @see docs/wizards/b2d-assets-mirror-handover.md
 * @module lib/submissions
 */

import type { StorageProvider } from '@/lib/storage/types';
import type { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service';
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin';

/** Bild-Extensions als Fallback, falls der Provider keinen Mimetype fuehrt. */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'tiff', 'bmp']);

/** Ein zu spiegelndes Medien-Asset aus dem Inbox-Shadow-Twin. */
export interface InboxAsset {
  /** Inbox-Item-ID (zum Lesen der Bytes). */
  itemId: string;
  /** Dateiname (bleibt im Ziel identisch — Transkript-Links loesen darueber auf). */
  name: string;
  /** Mimetype laut Inbox-Provider (kann leer sein). */
  mimeType: string;
}

/**
 * Leitet die Fragment-Art aus Mimetype bzw. Extension ab. Liefert `null` fuer
 * Nicht-Medien (z.B. das Transkript-Markdown) — diese werden nicht gespiegelt.
 */
export function assetKindFromNameAndMime(
  name: string,
  mimeType: string,
): 'image' | 'audio' | 'video' | null {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext && IMAGE_EXTENSIONS.has(ext)) return 'image';
  return null;
}

/**
 * Listet die Medien-Assets im Inbox-Shadow-Twin-Ordner der Quelle. Findet den
 * Ordner ueber `findShadowTwinFolder` (job-unabhaengig). Fehlt der Ordner (PDF
 * ohne Bilder), ist das ein legitimer Leerzustand → leere Liste (kein Fehler,
 * es wurde schlicht nichts extrahiert).
 */
export async function enumerateInboxAssets(args: {
  inboxProvider: StorageProvider;
  sourceItemId: string;
  sourceName: string;
}): Promise<InboxAsset[]> {
  const { inboxProvider, sourceItemId, sourceName } = args;

  const source = await inboxProvider.getItemById(sourceItemId);
  if (!source) {
    throw new Error(`Asset-Spiegelung: Inbox-Quelle nicht gefunden: ${sourceItemId}`);
  }

  const twinFolder = await findShadowTwinFolder(source.parentId, sourceName, inboxProvider);
  if (!twinFolder) return [];

  const items = await inboxProvider.listItemsById(twinFolder.id);
  const assets: InboxAsset[] = [];
  for (const it of items) {
    if (it.type !== 'file') continue;
    const name = it.metadata.name;
    const mimeType = it.metadata.mimeType ?? '';
    if (assetKindFromNameAndMime(name, mimeType) === null) continue;
    assets.push({ itemId: it.id, name, mimeType });
  }
  return assets;
}

/**
 * Sammelt die im Ziel bereits vorhandenen Asset-Namen (Idempotenz) aus ZWEI
 * Quellen: der zentralen Fragment-Liste (Mongo-Ziel) UND der Datei-Liste des
 * Ziel-Shadow-Twin-Ordners (FS-Ziel, da der Provider-Store keine zentrale Liste
 * fuehrt). So wird auf FS und Mongo nicht erneut hochgeladen.
 */
async function collectExistingTargetAssetNames(args: {
  targetProvider: StorageProvider;
  targetService: ShadowTwinService;
  sourceName: string;
  targetParentId: string;
}): Promise<Set<string>> {
  const { targetProvider, targetService, sourceName, targetParentId } = args;
  const names = new Set<string>();

  const fragments = await targetService.getBinaryFragments();
  for (const fragment of fragments ?? []) names.add(fragment.name);

  const twinFolder = await findShadowTwinFolder(targetParentId, sourceName, targetProvider);
  if (twinFolder) {
    const files = await targetProvider.listItemsById(twinFolder.id);
    for (const it of files) if (it.type === 'file') names.add(it.metadata.name);
  }
  return names;
}

/**
 * Spiegelt alle Inbox-Assets der Quelle ueber den Ziel-`ShadowTwinService` ins
 * Ziel-Archiv. Idempotent: bereits vorhandene Namen werden uebersprungen. Der
 * Service entscheidet FS vs. Mongo — keine Doppelung der Schreiblogik.
 */
export async function mirrorInboxAssetsToTarget(args: {
  inboxProvider: StorageProvider;
  targetProvider: StorageProvider;
  targetService: ShadowTwinService;
  sourceItemId: string;
  sourceName: string;
  targetParentId: string;
}): Promise<{ mirroredNames: string[] }> {
  const { inboxProvider, targetProvider, targetService, sourceItemId, sourceName, targetParentId } = args;

  const assets = await enumerateInboxAssets({ inboxProvider, sourceItemId, sourceName });
  if (assets.length === 0) return { mirroredNames: [] };

  const existingNames = await collectExistingTargetAssetNames({
    targetProvider,
    targetService,
    sourceName,
    targetParentId,
  });

  const mirroredNames: string[] = [];
  for (const asset of assets) {
    if (existingNames.has(asset.name)) continue;
    const kind = assetKindFromNameAndMime(asset.name, asset.mimeType);
    if (!kind) continue;

    const { blob, mimeType } = await inboxProvider.getBinary(asset.itemId);
    const buffer = Buffer.from(await blob.arrayBuffer());
    await targetService.uploadBinaryFragment({
      buffer,
      fileName: asset.name,
      mimeType: asset.mimeType || mimeType,
      kind,
    });
    mirroredNames.push(asset.name);
  }
  return { mirroredNames };
}
