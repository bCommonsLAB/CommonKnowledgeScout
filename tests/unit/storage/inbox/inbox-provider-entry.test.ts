/**
 * Tests fuer den Inbox-Provider-Server-Einstieg (ADR-0004 II, Welle II-A):
 * - `inboxUsernameFromEmail` (reine, deterministische Ableitung des {username}-Segments)
 * - `getInboxProvider` (Factory im Server-Kontext, Provider-Typ 'inbox', Validierung)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getLibraryById: vi.fn(),
  setServerContext: vi.fn(),
  setUserEmail: vi.fn(),
  setLibraries: vi.fn(),
  clearProvider: vi.fn(),
  getProvider: vi.fn(),
}));

vi.mock('@/lib/services/library-service', () => ({
  LibraryService: { getInstance: () => ({ getLibraryById: h.getLibraryById }) },
}));
vi.mock('@/lib/storage/storage-factory', () => ({
  StorageFactory: {
    getInstance: () => ({
      setServerContext: h.setServerContext,
      setUserEmail: h.setUserEmail,
      setLibraries: h.setLibraries,
      clearProvider: h.clearProvider,
      getProvider: h.getProvider,
    }),
  },
}));

import { getInboxProvider, inboxUsernameFromEmail } from '@/lib/storage/inbox/inbox-provider-entry';

describe('inboxUsernameFromEmail', () => {
  it('mappt eine E-Mail auf ein Blob-sicheres, deterministisches Segment', () => {
    expect(inboxUsernameFromEmail('peter.aichner@crystal-design.com')).toBe(
      'peter.aichner-crystal-design.com',
    );
    expect(inboxUsernameFromEmail('Anna@Example.COM')).toBe('anna-example.com');
  });

  it('ist deterministisch (gleiche Eingabe -> gleiches Segment)', () => {
    expect(inboxUsernameFromEmail('a@b.de')).toBe(inboxUsernameFromEmail(' A@B.DE '));
  });

  it('wirft bei leerer Eingabe oder ohne gueltiges Segment (kein stiller Fallback)', () => {
    expect(() => inboxUsernameFromEmail('')).toThrow(/userEmail/);
    expect(() => inboxUsernameFromEmail('   ')).toThrow(/userEmail/);
    expect(() => inboxUsernameFromEmail('@@@')).toThrow(/gueltiger Username/);
  });
});

describe('getInboxProvider', () => {
  const lib = { id: 'lib-1', label: 'Lib', type: 'local', path: '/p', isEnabled: true, config: { x: 1 } };
  const provider = { validateConfiguration: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    h.getLibraryById.mockResolvedValue(lib);
    h.getProvider.mockResolvedValue(provider);
    provider.validateConfiguration.mockResolvedValue({ isValid: true });
  });

  it('registriert den Provider als Typ "inbox" im Server-Kontext', async () => {
    const result = await getInboxProvider('u@example.com', 'lib-1');
    expect(result).toBe(provider);
    expect(h.setServerContext).toHaveBeenCalledWith(true);
    expect(h.clearProvider).toHaveBeenCalledWith('lib-1');
    const registered = h.setLibraries.mock.calls[0][0];
    expect(registered[0]).toMatchObject({ id: 'lib-1', type: 'inbox', config: { x: 1 } });
  });

  it('wirft bei fehlender userEmail/libraryId (kein stiller Fallback)', async () => {
    await expect(getInboxProvider('', 'lib-1')).rejects.toThrow(/userEmail/);
    await expect(getInboxProvider('u@example.com', '')).rejects.toThrow(/libraryId/);
  });

  it('wirft, wenn die Library nicht existiert', async () => {
    h.getLibraryById.mockResolvedValue(null);
    await expect(getInboxProvider('u@example.com', 'missing')).rejects.toThrow(/nicht gefunden/);
  });

  it('wirft bei ungueltiger Provider-Konfiguration', async () => {
    provider.validateConfiguration.mockResolvedValue({ isValid: false, error: 'Inbox kaputt' });
    await expect(getInboxProvider('u@example.com', 'lib-1')).rejects.toThrow(/Inbox kaputt/);
  });
});
