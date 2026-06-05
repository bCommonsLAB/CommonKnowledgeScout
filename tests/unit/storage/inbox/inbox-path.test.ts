/**
 * Unit-Tests: reine Pfad-/ID-Helfer des Inbox-Blob-Providers (ADR-0004 II).
 *
 * Fixiert das content-adressierte Schema {libraryId}/inbox/{...}, die
 * Ordner-/Datei-ID-Konvention (Ordner enden auf '/') und die Schutz-Wuerfe
 * gegen IDs ausserhalb der Inbox-Wurzel (no-silent-fallbacks).
 */

import { describe, expect, it } from 'vitest';
import * as P from '@/lib/storage/inbox/inbox-path';

const LIB = 'My_Lib';
const ROOT = 'my-lib/inbox/';

describe('inbox-path: Wurzel + ID-Klassifizierung', () => {
  it('buildRootPrefix sanitisiert die libraryId', () => {
    expect(P.buildRootPrefix(LIB)).toBe(ROOT);
  });

  it('isFolderId erkennt root und Prefixe mit Slash', () => {
    expect(P.isFolderId('root')).toBe(true);
    expect(P.isFolderId(`${ROOT}alice/`)).toBe(true);
    expect(P.isFolderId(`${ROOT}alice/page.png`)).toBe(false);
  });
});

describe('inbox-path: toPrefix / toBlobName (Schutzwuerfe)', () => {
  it('toPrefix loest root und Ordner-IDs auf', () => {
    expect(P.toPrefix(ROOT, 'root')).toBe(ROOT);
    expect(P.toPrefix(ROOT, `${ROOT}alice/`)).toBe(`${ROOT}alice/`);
  });

  it('toPrefix wirft bei Datei-ID und bei IDs ausserhalb der Wurzel', () => {
    expect(() => P.toPrefix(ROOT, `${ROOT}alice/page.png`)).toThrow();
    expect(() => P.toPrefix(ROOT, 'other-lib/inbox/x/')).toThrow();
  });

  it('toBlobName liefert nur fuer Datei-IDs einen Namen', () => {
    expect(P.toBlobName(ROOT, `${ROOT}alice/page.png`)).toBe(`${ROOT}alice/page.png`);
    expect(() => P.toBlobName(ROOT, 'root')).toThrow();
    expect(() => P.toBlobName(ROOT, `${ROOT}alice/`)).toThrow();
    expect(() => P.toBlobName(ROOT, 'foreign/page.png')).toThrow();
  });
});

describe('inbox-path: Segmente + Kinder', () => {
  it('validateSegment lehnt leere Namen, Slashes und Dot-Segmente ab', () => {
    expect(P.validateSegment(' alice ')).toBe('alice');
    expect(() => P.validateSegment('')).toThrow();
    expect(() => P.validateSegment('a/b')).toThrow();
    expect(() => P.validateSegment('..')).toThrow();
  });

  it('childFolderId / childBlobName haengen ans Prefix an', () => {
    expect(P.childFolderId(ROOT, 'alice')).toBe(`${ROOT}alice/`);
    expect(P.childBlobName(`${ROOT}alice/`, 'page.png')).toBe(`${ROOT}alice/page.png`);
  });
});

describe('inbox-path: parentIdOf / relativePath', () => {
  it('parentIdOf bildet die Wurzel auf "root" ab', () => {
    expect(P.parentIdOf(ROOT, `${ROOT}alice/page.png`)).toBe(`${ROOT}alice/`);
    expect(P.parentIdOf(ROOT, `${ROOT}alice/`)).toBe('root');
    expect(P.parentIdOf(ROOT, `${ROOT}file.pdf`)).toBe('root');
  });

  it('relativePath ist root-relativ ohne trailing slash', () => {
    expect(P.relativePath(ROOT, 'root')).toBe('/');
    expect(P.relativePath(ROOT, `${ROOT}alice/page.png`)).toBe('/alice/page.png');
    expect(P.relativePath(ROOT, `${ROOT}alice/`)).toBe('/alice');
  });
});

describe('inbox-path: StorageItem-Builder', () => {
  it('rootItem ist ein Ordner ohne Parent', () => {
    const root = P.rootItem();
    expect(root).toMatchObject({ id: 'root', parentId: '', type: 'folder' });
  });

  it('folderItem / fileItem setzen Name, Parent und Metadaten', () => {
    const folder = P.folderItem(ROOT, `${ROOT}alice/`);
    expect(folder).toMatchObject({ id: `${ROOT}alice/`, parentId: 'root', type: 'folder' });
    expect(folder.metadata.name).toBe('alice');

    const file = P.fileItem(ROOT, `${ROOT}alice/page.png`, 123, 'image/png');
    expect(file).toMatchObject({ id: `${ROOT}alice/page.png`, parentId: `${ROOT}alice/`, type: 'file' });
    expect(file.metadata).toMatchObject({ name: 'page.png', size: 123, mimeType: 'image/png' });
  });
});

describe('inbox-path: pathItems', () => {
  it('liefert root + Ordnerkette bis zur Datei (ohne Datei-Segment)', () => {
    const items = P.pathItems(ROOT, `${ROOT}alice/page.png`);
    expect(items.map((i) => i.id)).toEqual(['root', `${ROOT}alice/`]);
  });

  it('schliesst den Ziel-Ordner selbst ein', () => {
    const items = P.pathItems(ROOT, `${ROOT}alice/sub/`);
    expect(items.map((i) => i.id)).toEqual(['root', `${ROOT}alice/`, `${ROOT}alice/sub/`]);
  });
});
