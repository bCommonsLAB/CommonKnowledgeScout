/**
 * Tests fuer die zentrale Provider-/Library-Weiche der Job-Pipeline (Welle III):
 * `resolveJobProvider`, `resolveJobLibrary`, `resolveShadowTwinLibrary`.
 *
 * Fixiert die Scope-Semantik (ADR-0004 II):
 * - fehlender Scope = 'archive' (Legacy-Jobs) -> getServerProvider/getLibrary
 * - 'inbox' -> getInboxProvider / getLibraryById / null (Shadow-Twin)
 * - unbekannte Scopes werfen (no-silent-fallbacks)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getServerProvider: vi.fn(),
  getInboxProvider: vi.fn(),
  getLibrary: vi.fn(),
  getLibraryById: vi.fn(),
}));

vi.mock('@/lib/storage/server-provider', () => ({ getServerProvider: h.getServerProvider }));
vi.mock('@/lib/storage/inbox/inbox-provider-entry', () => ({ getInboxProvider: h.getInboxProvider }));
vi.mock('@/lib/services/library-service', () => ({
  LibraryService: {
    getInstance: () => ({ getLibrary: h.getLibrary, getLibraryById: h.getLibraryById }),
  },
}));
// log-buffer wird nur von buildProvider genutzt; hier neutral mocken.
vi.mock('@/lib/external-jobs-log-buffer', () => ({ bufferLog: vi.fn() }));

import {
  resolveJobProvider,
  resolveJobLibrary,
  resolveShadowTwinLibrary,
} from '@/lib/external-jobs/provider';
import type { ExternalJobProviderScope } from '@/types/external-job';

const ARGS = { userEmail: 'u@example.com', libraryId: 'lib-1' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('resolveJobProvider', () => {
  it('fehlender Scope -> archive (getServerProvider, Legacy-Default)', async () => {
    h.getServerProvider.mockResolvedValue({ id: 'archive-provider' });
    const provider = await resolveJobProvider(ARGS);
    expect(provider).toEqual({ id: 'archive-provider' });
    expect(h.getServerProvider).toHaveBeenCalledWith('u@example.com', 'lib-1');
    expect(h.getInboxProvider).not.toHaveBeenCalled();
  });

  it('inbox -> getInboxProvider (beruehrt nie das Archiv)', async () => {
    h.getInboxProvider.mockResolvedValue({ id: 'inbox-provider' });
    const provider = await resolveJobProvider({ ...ARGS, providerScope: 'inbox' });
    expect(provider).toEqual({ id: 'inbox-provider' });
    expect(h.getInboxProvider).toHaveBeenCalledWith('u@example.com', 'lib-1');
    expect(h.getServerProvider).not.toHaveBeenCalled();
  });

  it('unbekannter Scope wirft (kein stiller Archiv-Fallback)', async () => {
    await expect(
      resolveJobProvider({ ...ARGS, providerScope: 'cloud' as ExternalJobProviderScope }),
    ).rejects.toThrow(/providerScope "cloud"/);
    expect(h.getServerProvider).not.toHaveBeenCalled();
    expect(h.getInboxProvider).not.toHaveBeenCalled();
  });
});

describe('resolveJobLibrary', () => {
  it('archive -> getLibrary (owner-/membership-gebunden)', async () => {
    h.getLibrary.mockResolvedValue({ id: 'lib-1' });
    expect(await resolveJobLibrary(ARGS)).toEqual({ id: 'lib-1' });
    expect(h.getLibrary).toHaveBeenCalledWith('u@example.com', 'lib-1');
    expect(h.getLibraryById).not.toHaveBeenCalled();
  });

  it('inbox -> getLibraryById (owner-unabhaengig, Contributor hat kein Archiv)', async () => {
    h.getLibraryById.mockResolvedValue({ id: 'lib-1' });
    expect(await resolveJobLibrary({ ...ARGS, providerScope: 'inbox' })).toEqual({ id: 'lib-1' });
    expect(h.getLibraryById).toHaveBeenCalledWith('lib-1');
    expect(h.getLibrary).not.toHaveBeenCalled();
  });

  it('unbekannter Scope wirft', async () => {
    await expect(
      resolveJobLibrary({ ...ARGS, providerScope: 'x' as ExternalJobProviderScope }),
    ).rejects.toThrow(/providerScope "x"/);
  });
});

describe('resolveShadowTwinLibrary', () => {
  it('archive -> getLibrary (Library-Config entscheidet Persistenz)', async () => {
    h.getLibrary.mockResolvedValue({ id: 'lib-1' });
    expect(await resolveShadowTwinLibrary(ARGS)).toEqual({ id: 'lib-1' });
  });

  it('inbox -> null (immer Blob-Pfad, kein Mongo-Shadow-Twin — ADR-0004 II)', async () => {
    expect(await resolveShadowTwinLibrary({ ...ARGS, providerScope: 'inbox' })).toBeNull();
    expect(h.getLibrary).not.toHaveBeenCalled();
    expect(h.getLibraryById).not.toHaveBeenCalled();
  });

  it('unbekannter Scope wirft', async () => {
    await expect(
      resolveShadowTwinLibrary({ ...ARGS, providerScope: 'y' as ExternalJobProviderScope }),
    ).rejects.toThrow(/providerScope "y"/);
  });
});
