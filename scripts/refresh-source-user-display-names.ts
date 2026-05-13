/**
 * @fileoverview Aktualisiert `userDisplayName` in `source_user_states` per Clerk (Wartung).
 *
 * Liest alle Distinct-`userEmail` einer Library, holt den aktuellen Anzeigenamen
 * ueber das Clerk Backend-SDK und fuehrt `updateMany` pro erkanntem User aus.
 * Kein Online-Read-Pfad der Galerie; nur fuer gelegentliche Reconciliation.
 *
 * @usage
 * ```bash
 * pnpm tsx scripts/refresh-source-user-display-names.ts --libraryId=<mongo-library-id> [--dryRun]
 * ```
 *
 * @dependencies
 * - Env: `MONGODB_URI`, Clerk Secret (wie Next-App, z. B. `CLERK_SECRET_KEY`)
 */

import { connectToDatabase, getCollection } from '@/lib/mongodb-service';
import { clerkClient } from '@clerk/nextjs/server';
import { normalizeEmail } from '@/lib/auth/user-email';
import { getPreferredUserDisplayName, type ClerkUserWithName } from '@/lib/auth/user-display-name';
import type { SourceUserState } from '@/types/source-user-state';

const COLLECTION = 'source_user_states';
const CHUNK = 100;

interface Opts {
  libraryId: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Opts {
  let libraryId = '';
  let dryRun = false;
  for (const a of argv) {
    if (a === '--dryRun') dryRun = true;
    else if (a.startsWith('--libraryId=')) libraryId = a.split('=')[1]?.trim() ?? '';
  }
  if (!libraryId) {
    throw new Error('--libraryId=... ist erforderlich');
  }
  return { libraryId, dryRun };
}

function clerkUserToStub(u: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
  primaryEmailAddressId: string | null;
}): ClerkUserWithName {
  const primary =
    u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0];
  return {
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    primaryEmailAddress: primary ? { emailAddress: primary.emailAddress } : null,
    emailAddresses: u.emailAddresses.map((e) => ({ emailAddress: e.emailAddress })),
  };
}

async function run(opts: Opts): Promise<void> {
  console.log(`Library: ${opts.libraryId}, Dry-Run: ${opts.dryRun ? 'ja' : 'nein'}`);
  await connectToDatabase();
  const col = await getCollection<SourceUserState>(COLLECTION);
  const rawEmails = await col.distinct('userEmail', { libraryId: opts.libraryId });
  const emails = Array.from(
    new Set(
      rawEmails
        .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
        .map((e) => normalizeEmail(e)),
    ),
  );
  if (emails.length === 0) {
    console.log('Keine userEmail-Eintraege fuer diese Library.');
    return;
  }

  const client = await clerkClient();
  let modifiedTotal = 0;

  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK);
    const list = await client.users.getUserList({ emailAddress: chunk });
    const data = Array.isArray(list?.data) ? list.data : [];

    const displayByEmail = new Map<string, string>();
    for (const u of data) {
      const stub = clerkUserToStub(u);
      const label = getPreferredUserDisplayName(stub);
      if (!label) continue;
      for (const addr of u.emailAddresses ?? []) {
        const ne = normalizeEmail(addr.emailAddress ?? '');
        if (ne && chunk.includes(ne)) displayByEmail.set(ne, label);
      }
    }

    for (const email of chunk) {
      const displayName = displayByEmail.get(email);
      if (!displayName) {
        console.warn(`[refresh-display-names] Kein Clerk-User fuer ${email}, ueberspringe.`);
        continue;
      }
      if (opts.dryRun) {
        console.log(`[dryRun] ${email} -> "${displayName}"`);
        continue;
      }
      const res = await col.updateMany(
        { libraryId: opts.libraryId, userEmail: email },
        { $set: { userDisplayName: displayName } },
      );
      modifiedTotal += res.modifiedCount;
    }
  }

  console.log(`Fertig. Geaenderte Dokumente (Summe modifiedCount): ${modifiedTotal}`);
}

const opts = parseArgs(process.argv.slice(2));
run(opts).catch((err) => {
  console.error('[refresh-display-names]', err instanceof Error ? err.message : err);
  process.exit(1);
});
