/**
 * @fileoverview Analyse + Reparatur: V1-Favoriten (`source_favorites`) ins
 * V2-Schema (`source_user_states`) ueberfuehren.
 *
 * @description
 * Hintergrund: Die Galerie liest Sterne ausschliesslich aus
 * `source_user_states` (Aggregation `buildFavoriteLookupStages`). Aeltere,
 * mit dem geteilten V1-Modell gesetzte Favoriten liegen aber noch in
 * `source_favorites` und werden deshalb nicht gezaehlt. Dieses Skript
 * ueberfuehrt sie pro `createdBy`-User als eigenen Stern.
 *
 * Sicherheit:
 * - DEFAULT = ANALYSE (read-only). Schreiben nur mit `--apply`.
 * - `--apply` ist additiv + idempotent (vorhandene Tripel werden
 *   uebersprungen) und benoetigt zwingend `--libraryId` (Sicherheits-Stopp).
 * - `source_favorites` wird NIE veraendert (kein Drop).
 * - Bestehende `not_important`-Marker werden NICHT von `favorite` ueberschrieben.
 *
 * DB-Aufloesung (Reihenfolge): `--db=<name>` > Env `MONGODB_DATABASE_NAME_PROD`.
 * `--locate` findet read-only die DB, deren `source_user_states` die gesuchte
 * `libraryId` enthaelt (zum Ermitteln des Prod-DB-Namens). Die `MONGODB_URI`
 * wird niemals geloggt.
 *
 * @usage
 *   pnpm tsx scripts/rescue-source-favorites.ts --locate --libraryId=<id>          # Prod-DB finden
 *   pnpm tsx scripts/rescue-source-favorites.ts --db=<name> --libraryId=<id>       # Analyse
 *   pnpm tsx scripts/rescue-source-favorites.ts --db=<name> --libraryId=<id> --apply  # Reparatur
 *
 * @dependencies
 * - Env: MONGODB_URI (Instanz, identisch zu .env), optional MONGODB_DATABASE_NAME_PROD
 * - @/lib/auth/user-email: identische E-Mail-Normalisierung wie die App
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { MongoClient, type Document } from 'mongodb';
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

interface MissingFavorite {
  libraryId: string;
  fileId: string;
  userEmail: string;
  createdAt: Date | string;
}

interface Options {
  libraryId?: string;
  db?: string;
  apply: boolean;
  locate: boolean;
  collections: boolean;
  docsCollection?: string;
}

const SYSTEM_DBS = new Set(['admin', 'local', 'config']);

function parseArgs(argv: string[]): Options {
  const opts: Options = { apply: false, locate: false, collections: false };
  for (const arg of argv) {
    if (arg === '--apply') opts.apply = true;
    else if (arg === '--locate') opts.locate = true;
    else if (arg === '--collections') opts.collections = true;
    else if (arg.startsWith('--libraryId=')) opts.libraryId = arg.split('=')[1]?.trim();
    else if (arg.startsWith('--db=')) opts.db = arg.split('=')[1]?.trim();
    else if (arg.startsWith('--docsCollection=')) opts.docsCollection = arg.split('=')[1]?.trim();
  }
  return opts;
}

function sortedDesc(map: Map<string, number>): Array<[string, number]> {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

/**
 * Read-only: durchsucht alle Nicht-System-Datenbanken nach jener, die eine
 * `source_user_states`- bzw. `source_favorites`-Collection mit der gesuchten
 * libraryId enthaelt. Beruehrt pro DB nur diese beiden Collections.
 */
async function locate(client: MongoClient, libraryId: string | undefined): Promise<void> {
  const { databases } = await client.db('admin').admin().listDatabases();
  console.log(`\n[LOCATE] ${databases.length} Datenbanken auf der Instanz. Suche nach den source_*-Collections${libraryId ? ` mit libraryId=${libraryId}` : ''}:`);
  const filter = libraryId ? { libraryId } : {};
  let hits = 0;
  for (const info of databases) {
    if (SYSTEM_DBS.has(info.name)) continue;
    const db = client.db(info.name);
    const cols = await db.listCollections({}, { nameOnly: true }).toArray();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has('source_user_states') && !names.has('source_favorites')) continue;
    const states = names.has('source_user_states')
      ? await db.collection('source_user_states').countDocuments(filter)
      : 0;
    const favs = names.has('source_favorites')
      ? await db.collection('source_favorites').countDocuments(filter)
      : 0;
    if (states === 0 && favs === 0) continue;
    hits++;
    console.log(`   >> DB "${info.name}": source_user_states=${states}, source_favorites=${favs}`);
  }
  if (hits === 0) console.log('   (keine passende DB gefunden)');
  console.log('\nProd-DB ermittelt? Dann: --db=<name> --libraryId=<id> [--apply]');
}

/** Read-only: listet Collection-Namen der DB (zum Finden der Galerie-Collection). */
async function listCollections(client: MongoClient, dbName: string): Promise<void> {
  const cols = await client.db(dbName).listCollections({}, { nameOnly: true }).toArray();
  const names = cols.map((c) => c.name).sort();
  console.log(`\n[COLLECTIONS] ${names.length} in "${dbName}":`);
  for (const n of names) console.log(`   ${n}`);
}

async function analyzeAndMaybeApply(client: MongoClient, dbName: string, opts: Options): Promise<void> {
  const scope: Record<string, unknown> = opts.libraryId ? { libraryId: opts.libraryId } : {};
  const db = client.db(dbName);
  const favCol = db.collection<OldFavorite>('source_favorites');
  const stateCol = db.collection<NewUserState>('source_user_states');
  const commentCol = db.collection<Document>('source_comments');

  // --- V1: source_favorites ---
  const oldEntries = await favCol.find(scope).toArray();
  const v1ByUser = new Map<string, number>();
  const v1ByLibrary = new Map<string, number>();
  for (const e of oldEntries) {
    const u = normalizeEmail(e.createdBy ?? '');
    v1ByUser.set(u, (v1ByUser.get(u) ?? 0) + 1);
    v1ByLibrary.set(e.libraryId, (v1ByLibrary.get(e.libraryId) ?? 0) + 1);
  }
  console.log(`\n[V1 source_favorites] ${oldEntries.length} Eintraege`);
  for (const [u, n] of sortedDesc(v1ByUser)) console.log(`   ${u || '(leer)'}: ${n}`);
  if (!opts.libraryId && v1ByLibrary.size > 1) {
    console.log('   -- pro Library --');
    for (const [lib, n] of sortedDesc(v1ByLibrary)) console.log(`   ${lib}: ${n}`);
  }

  // --- V2: source_user_states ---
  const states = await stateCol.find(scope).toArray();
  const v2FavByUser = new Map<string, number>();
  let notImportant = 0;
  for (const s of states) {
    if (s.state === 'favorite') v2FavByUser.set(s.userEmail, (v2FavByUser.get(s.userEmail) ?? 0) + 1);
    else if (s.state === 'not_important') notImportant++;
  }
  console.log(`\n[V2 source_user_states] ${states.length} Eintraege (not_important: ${notImportant})`);
  for (const [u, n] of sortedDesc(v2FavByUser)) console.log(`   favorite ${u}: ${n}`);

  // --- Distinkte Quellen mit Stern (Team-Aggregat = was die Galerie badged) ---
  const votersByFile = new Map<string, Set<string>>();
  for (const s of states) {
    if (s.state !== 'favorite') continue;
    let set = votersByFile.get(s.fileId);
    if (!set) {
      set = new Set();
      votersByFile.set(s.fileId, set);
    }
    set.add(s.userEmail);
  }
  const voteHistogram = new Map<number, number>();
  for (const set of votersByFile.values()) voteHistogram.set(set.size, (voteHistogram.get(set.size) ?? 0) + 1);
  console.log(`\n[STERNE] ${votersByFile.size} distinkte Quellen mit >=1 Favorit`);
  for (const [votes, n] of Array.from(voteHistogram.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`   ${votes} Stimme(n): ${n} Quelle(n)`);
  }

  // --- Abgleich gegen Galerie-Dokumente (nur die werden tatsaechlich gebadged) ---
  if (opts.docsCollection && opts.libraryId) {
    const favFileIds = Array.from(votersByFile.keys());
    const docsCol = db.collection<Document>(opts.docsCollection);
    const metaTotal = await docsCol.countDocuments({ kind: 'meta', libraryId: opts.libraryId });
    const existing = favFileIds.length
      ? await docsCol.countDocuments({ kind: 'meta', libraryId: opts.libraryId, fileId: { $in: favFileIds } })
      : 0;
    console.log(`\n[GALERIE "${opts.docsCollection}"] ${metaTotal} meta-Dokumente fuer diese Library`);
    console.log(`   davon mit Stern (existieren als Quelle): ${existing} von ${favFileIds.length} favorisierten fileIds`);
    if (existing < favFileIds.length) {
      console.log(`   Hinweis: ${favFileIds.length - existing} favorisierte fileIds haben KEIN meta-Dokument (werden nicht gebadged).`);
    }
  }

  // --- GAP: V1-Favoriten, die in V2 (egal welcher State) fehlen ---
  const v2Keys = new Set(states.map((s) => `${s.libraryId}|${s.fileId}|${s.userEmail}`));
  const missing: MissingFavorite[] = [];
  for (const e of oldEntries) {
    const userEmail = normalizeEmail(e.createdBy ?? '');
    if (!e.libraryId || !e.fileId || !userEmail) continue;
    if (v2Keys.has(`${e.libraryId}|${e.fileId}|${userEmail}`)) continue;
    missing.push({ libraryId: e.libraryId, fileId: e.fileId, userEmail, createdAt: e.createdAt });
  }
  const missingByUser = new Map<string, number>();
  for (const m of missing) missingByUser.set(m.userEmail, (missingByUser.get(m.userEmail) ?? 0) + 1);
  console.log(`\n[GAP] ${missing.length} V1-Favoriten fehlen in V2:`);
  for (const [u, n] of sortedDesc(missingByUser)) console.log(`   ${u}: ${n}`);

  // --- Kommentare (nur Info, kein Migrationsbedarf) ---
  const commentsTotal = await commentCol.countDocuments(scope);
  const commentsDeleted = await commentCol.countDocuments({ ...scope, deletedAt: { $exists: true } });
  const commentsByUser = await commentCol
    .aggregate<{ _id: string; n: number }>([
      { $match: scope },
      { $group: { _id: '$authorEmail', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ])
    .toArray();
  console.log(`\n[source_comments] ${commentsTotal} gesamt (soft-deleted: ${commentsDeleted})`);
  for (const r of commentsByUser) console.log(`   ${r._id}: ${r.n}`);

  if (!opts.apply) {
    console.log(`\nANALYSE-Modus: nichts geschrieben. Reparatur via --db=${dbName} --libraryId=<id> --apply.`);
    return;
  }

  // --- APPLY ---
  if (!opts.libraryId) {
    console.log('\n[APPLY] Sicherheits-Stopp: --apply nur zusammen mit --libraryId erlaubt.');
    return;
  }
  let inserted = 0;
  const now = new Date();
  for (const m of missing) {
    const created = m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt);
    const res = await stateCol.updateOne(
      { libraryId: m.libraryId, fileId: m.fileId, userEmail: m.userEmail },
      {
        $setOnInsert: {
          libraryId: m.libraryId,
          fileId: m.fileId,
          userEmail: m.userEmail,
          state: 'favorite',
          createdAt: Number.isNaN(created.getTime()) ? now : created,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
    if (res.upsertedCount > 0) inserted++;
  }
  console.log(`\n[APPLY] ${inserted} neue V2-Favoriten angelegt (idempotent; source_favorites unveraendert).`);
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI fehlt in .env');
  const opts = parseArgs(process.argv.slice(2));

  const line = '='.repeat(70);
  console.log(line);
  console.log(`Modus    : ${opts.locate ? 'LOCATE (read-only)' : opts.apply ? 'APPLY (schreibt)' : 'ANALYSE (read-only)'}`);
  console.log(`Library  : ${opts.libraryId ?? '(alle)'}`);
  console.log(line);

  const client = new MongoClient(uri);
  await client.connect();
  try {
    if (opts.locate) {
      await locate(client, opts.libraryId);
      return;
    }
    const dbName = opts.db ?? process.env.MONGODB_DATABASE_NAME_PROD;
    if (!dbName) {
      throw new Error('DB-Name fehlt: nutze --db=<name> oder setze MONGODB_DATABASE_NAME_PROD. Zum Finden: --locate --libraryId=<id>');
    }
    console.log(`DB       : ${dbName}`); // DB-Name ist kein Secret; URI wird NIE geloggt
    if (opts.collections) {
      await listCollections(client, dbName);
      return;
    }
    await analyzeAndMaybeApply(client, dbName, opts);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[rescue] Abbruch:', err instanceof Error ? err.message : err);
  process.exit(1);
});
