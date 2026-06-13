/**
 * @fileoverview External Jobs Provider Builder — zentrale Provider-/Library-Weiche
 *
 * @description
 * Einziger Ort, an dem die Job-Pipeline ihren StorageProvider aufloest.
 * Seit Welle III (ADR-0004 II) traegt jeder Job einen `providerScope`:
 * - 'archive' (Default, auch bei fehlendem Feld — Legacy): Owner-Archiv via
 *   `getServerProvider` (owner-/membership-gebunden inkl. Token-Handling).
 * - 'inbox': Quarantaene via `getInboxProvider` — beruehrt NIE das Owner-Archiv.
 * Unbekannte Scopes werfen (no-silent-fallbacks).
 *
 * `buildProvider` ergaenzt Fehler-Handling (Job auf failed setzen) und bleibt
 * die Fassade fuer Preprocessors/Callbacks.
 *
 * @module external-jobs
 *
 * @exports
 * - resolveJobProvider: Scope-Weiche ohne Job-Status-Seiteneffekte
 * - resolveJobLibrary: Library-Ladung passend zum Scope
 * - buildProvider: Weiche + Job-Fehler-Handling (failed bei Init-Fehler)
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getInboxProvider } from '@/lib/storage/inbox/inbox-provider-entry'
import { LibraryService } from '@/lib/services/library-service'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import type { StorageProvider } from '@/lib/storage/types'
import type { ExternalJobProviderScope } from '@/types/external-job'
import type { Library } from '@/types/library'

export interface ResolveJobProviderArgs {
  userEmail: string
  libraryId: string
  /** Fehlt der Wert, gilt 'archive' (Legacy-Jobs vor Welle III). */
  providerScope?: ExternalJobProviderScope
}

/**
 * Zentrale Provider-Weiche der Job-Pipeline (ADR-0004 II).
 * Wirft bei unbekanntem Scope, statt still aufs Archiv zu defaulten.
 */
export async function resolveJobProvider(args: ResolveJobProviderArgs): Promise<StorageProvider> {
  const scope = args.providerScope ?? 'archive'
  if (scope === 'inbox') return getInboxProvider(args.userEmail, args.libraryId)
  if (scope === 'archive') return getServerProvider(args.userEmail, args.libraryId)
  throw new Error(`resolveJobProvider: unbekannter providerScope "${String(scope)}"`)
}

/**
 * Library-Ladung passend zum Job-Scope:
 * - 'archive': `getLibrary(userEmail, …)` — owner-/membership-gebunden (wie bisher).
 * - 'inbox': `getLibraryById` — owner-unabhaengig. Contributoren haben bewusst
 *   KEINEN Archiv-Zugriff (ADR-0004); die Erfass-Berechtigung wurde beim Anlegen
 *   des Jobs geprueft (Analyze-Route). Die Library dient hier nur der Konfiguration
 *   (Template-Verhalten), nicht der Autorisierung.
 */
export async function resolveJobLibrary(args: ResolveJobProviderArgs): Promise<Library | null> {
  const scope = args.providerScope ?? 'archive'
  const service = LibraryService.getInstance()
  if (scope === 'inbox') return service.getLibraryById(args.libraryId)
  if (scope === 'archive') return service.getLibrary(args.userEmail, args.libraryId)
  throw new Error(`resolveJobLibrary: unbekannter providerScope "${String(scope)}"`)
}

/**
 * Library fuer Shadow-Twin-/Bild-Persistenz-Entscheidungen:
 * Inbox-Jobs erhalten bewusst `null` — in der Quarantaene gilt IMMER der
 * Blob-Schreibpfad ueber den Inbox-Provider (getShadowTwinConfig(null) =>
 * persistToFilesystem=true, primaryStore='filesystem'), unabhaengig von der
 * Library-Config. Es gibt KEINEN Mongo-Shadow-Twin fuer Inbox-Quellen; die
 * Submission ist die Mongo-Repraesentanz (ADR-0004 II).
 */
export async function resolveShadowTwinLibrary(args: ResolveJobProviderArgs): Promise<Library | null> {
  const scope = args.providerScope ?? 'archive'
  if (scope === 'inbox') return null
  if (scope === 'archive') return LibraryService.getInstance().getLibrary(args.userEmail, args.libraryId)
  throw new Error(`resolveShadowTwinLibrary: unbekannter providerScope "${String(scope)}"`)
}

interface BuildProviderArgs {
  userEmail: string
  libraryId: string
  jobId: string
  repo: ExternalJobsRepository
  /** Fehlt der Wert, gilt 'archive' (Legacy-Jobs vor Welle III). */
  providerScope?: ExternalJobProviderScope
}

export async function buildProvider(args: BuildProviderArgs) {
  const { userEmail, libraryId, jobId, repo, providerScope } = args
  try {
    const provider = await resolveJobProvider({ userEmail, libraryId, providerScope })
    return provider
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'Provider-Initialisierung fehlgeschlagen'
    bufferLog(jobId, { phase: 'provider_init_failed', message: reason })
    await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: reason } })
    await repo.setStatus(jobId, 'failed', { error: { code: 'CONFIG_ERROR', message: reason } })
    throw e
  }
}
