/**
 * @fileoverview Migration: source_favorites -> source_user_states
 *
 * @description
 * Migriert die alte, geteilte Favoriten-Collection auf das neue
 * per-User-Schema:
 *
 * - Quelle: `source_favorites` mit `{ libraryId, fileId, createdBy, createdAt }`
 * - Ziel:   `source_user_states` mit
 *           `{ libraryId, fileId, userEmail, state: 'favorite', createdAt, updatedAt }`
 *
 * Pro alten Eintrag wird ein neuer Stern fuer den `createdBy`-User
 * angelegt. Andere Member behalten danach keinen automatischen Stern -
 * sie muessen ihn nach der Migration selbst setzen (das ist Absicht;
 * fruehere Sterne waren oft nur vom Owner gesetzt).
 *
 * @usage
 * ```bash
 * # Dry-Run (nur Logging, keine DB-Aenderungen)
 * pnpm tsx scripts/migrate-source-favorites-to-user-states.ts --dryRun
 *
 * # Echte Migration
 * pnpm tsx scripts/migrate-source-favorites-to-user-states.ts
 *
 * # Migration nur fuer eine bestimmte Library
 * pnpm tsx scripts/migrate-source-favorites-to-user-states.ts --libraryId=abc-123
 *
 * # Nach erfolgreicher Migration alte Collection droppen
 * pnpm tsx scripts/migrate-source-favorites-to-user-states.ts --dropSource
 * ```
 *
 * @dependencies
 * - @/lib/mongodb-service: MongoDB-Zugriff
 * - @/lib/auth/user-email: E-Mail-Normalisierung
 */

import { connectToDatabase, getCollection } from '@/lib/mongodb-service';
import { normalizeEmail } from '@/lib/auth/user-email';

interface OldFavorite {
  libraryId: string;
  fileId: string;
  createdBy: string;
  createdAt: Date;
}

interface NewUserState {
  libraryId: string;
  fileId: string;
  userEmail: string;
  state: 'favorite' | 'not_important';
  createdAt: Date;
  updatedAt: Date;
}

interface MigrationOptions {
  dryRun: boolean;
  libraryId?: string;
  dropSource: boolean;
}

function parseArgs(argv: string[]): MigrationOptions {
  const opts: MigrationOptions = { dryRun: false, dropSource: false };
  for (const arg of argv) {
    if (arg === '--dryRun') opts.dryRun = true;
    else if (arg === '--dropSource') opts.dropSource = true;
    else if (arg.startsWith('--libraryId=')) opts.libraryId = arg.split('=')[1];
  }
  return opts;
}

async function migrate(opts: MigrationOptions): Promise<void> {
  const banner = '='.repeat(80);
  console.log(banner);
  console.log('Source-Favorites -> Source-User-States Migration');
  console.log(banner);
  console.log(`Dry-Run:     ${opts.dryRun ? 'JA' : 'NEIN'}`);
  console.log(`Drop Source: ${opts.dropSource ? 'JA' : 'NEIN'}`);
  if (opts.libraryId) console.log(`Library-ID:  ${opts.libraryId}`);
  console.log(banner);

  const db = await connectToDatabase();
  const sourceExists = (await db.listCollections({ name: 'source_favorites' }).toArray()).length > 0;
  if (!sourceExists) {
    console.log('[Migration] source_favorites existiert nicht - nichts zu tun.');
    return;
  }

  const oldCol = await getCollection<OldFavorite>('source_favorites');
  const newCol = await getCollection<NewUserState>('source_user_states');

  const filter = opts.libraryId ? { libraryId: opts.libraryId } : {};
  const oldEntries = await oldCol.find(filter).toArray();
  console.log(`[Migration] ${oldEntries.length} Eintraege in source_favorites gefunden.`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of oldEntries) {
    const userEmail = normalizeEmail(entry.createdBy ?? '');
    if (!entry.libraryId || !entry.fileId || !userEmail) {
      console.warn(`[Migration] Ueberspringe ungueltigen Eintrag:`, entry);
      skipped++;
      continue;
    }

    const existing = await newCol.findOne({
      libraryId: entry.libraryId,
      fileId: entry.fileId,
      userEmail,
    });
    if (existing) {
      console.log(
        `[Migration] Schon migriert (libraryId=${entry.libraryId}, fileId=${entry.fileId}, user=${userEmail}, state=${existing.state})`,
      );
      skipped++;
      continue;
    }

    if (opts.dryRun) {
      console.log(
        `[Migration] [DRY-RUN] Wuerde anlegen: libraryId=${entry.libraryId}, fileId=${entry.fileId}, user=${userEmail}, state=favorite`,
      );
      migrated++;
      continue;
    }

    try {
      const now = new Date();
      const createdAt = entry.createdAt instanceof Date ? entry.createdAt : new Date(entry.createdAt);
      await newCol.insertOne({
        libraryId: entry.libraryId,
        fileId: entry.fileId,
        userEmail,
        state: 'favorite',
        createdAt: Number.isNaN(createdAt.getTime()) ? now : createdAt,
        updatedAt: now,
      });
      migrated++;
    } catch (err) {
      console.error(`[Migration] Fehler bei Eintrag:`, entry, err);
      errors++;
    }
  }

  console.log(banner);
  console.log(`Migriert: ${migrated}`);
  console.log(`Uebersprungen: ${skipped}`);
  console.log(`Fehler: ${errors}`);
  console.log(banner);

  if (opts.dropSource && !opts.dryRun && errors === 0) {
    console.log('[Migration] Loesche Quell-Collection source_favorites ...');
    await db.collection('source_favorites').drop();
    console.log('[Migration] source_favorites geloescht.');
  } else if (opts.dropSource) {
    console.log(
      '[Migration] --dropSource ignoriert (dryRun aktiv oder Fehler aufgetreten).',
    );
  }
}

const opts = parseArgs(process.argv.slice(2));
migrate(opts)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[Migration] Abgebrochen:', err);
    process.exit(1);
  });
