/**
 * Unit-Tests fuer den Library-Identity-Marker (`.knowledgescout/library.json`).
 *
 * Hintergrund: Bei geteilten `local`-Libraries auf einem Sync-Verzeichnis
 * (SharePoint/OneDrive Sync) hat jeder User einen anderen Pfad — der Marker
 * stellt sicher, dass beide auf dieselbe Library zeigen. Siehe
 * docs/per-user-storage-path-analyse.md (Variante A, M2).
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as pathLib from 'node:path'
import {
  IDENTITY_DIR_NAME,
  IDENTITY_FILE_NAME,
  IDENTITY_SCHEMA_VERSION,
  describeValidationFailure,
  readIdentityMarker,
  validateIdentityMarker,
  writeIdentityMarker,
} from '@/lib/storage/library-identity'

describe('library-identity', () => {
  let tmpRoot: string

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(pathLib.join(os.tmpdir(), 'cks-identity-'))
  })

  afterEach(async () => {
    // Hilfreich, falls ein Test mittendrin stirbt: aufrufen, aber Fehler
    // tolerieren, damit wir die eigentliche Test-Aussage nicht maskieren.
    try {
      await fs.rm(tmpRoot, { recursive: true, force: true })
    } catch {
      // Bewusster Schluck: tmp-Cleanup ist Best-Effort und blockiert den Test
      // nicht. Wenn es scheitert (z.B. unter Windows mit offener Datei),
      // raeumt das OS spaeter selbst auf.
    }
  })

  describe('readIdentityMarker', () => {
    it('liefert null, wenn die Marker-Datei nicht existiert', async () => {
      const result = await readIdentityMarker(tmpRoot)
      expect(result).toBeNull()
    })

    it('wirft, wenn die Marker-Datei kein gueltiges JSON enthaelt', async () => {
      await fs.mkdir(pathLib.join(tmpRoot, IDENTITY_DIR_NAME), { recursive: true })
      await fs.writeFile(
        pathLib.join(tmpRoot, IDENTITY_DIR_NAME, IDENTITY_FILE_NAME),
        'this is not json',
        'utf8',
      )
      await expect(readIdentityMarker(tmpRoot)).rejects.toThrow(/kein gueltiges JSON/)
    })

    it('wirft, wenn das Schema ungueltig ist (Pflichtfeld fehlt)', async () => {
      await fs.mkdir(pathLib.join(tmpRoot, IDENTITY_DIR_NAME), { recursive: true })
      await fs.writeFile(
        pathLib.join(tmpRoot, IDENTITY_DIR_NAME, IDENTITY_FILE_NAME),
        JSON.stringify({ schemaVersion: 1, libraryId: 'lib_x' }),
        'utf8',
      )
      await expect(readIdentityMarker(tmpRoot)).rejects.toThrow(/ungueltiges Schema/)
    })
  })

  describe('writeIdentityMarker', () => {
    it('legt das `.knowledgescout`-Verzeichnis und die Datei an', async () => {
      const written = await writeIdentityMarker(tmpRoot, {
        libraryId: 'lib_abc',
        label: 'My Library',
        ownerEmail: 'owner@example.com',
      })

      expect(written.libraryId).toBe('lib_abc')
      expect(written.schemaVersion).toBe(IDENTITY_SCHEMA_VERSION)
      // Datei ist tatsaechlich auf der Platte:
      const re = await readIdentityMarker(tmpRoot)
      expect(re).toEqual(written)
    })

    it('ist idempotent: zweiter Aufruf mit gleicher libraryId aendert nichts', async () => {
      const first = await writeIdentityMarker(tmpRoot, {
        libraryId: 'lib_abc',
        label: 'My Library',
        ownerEmail: 'owner@example.com',
      })
      // Bewusst spaeter neu schreiben, damit `createdAt` ohne Idempotenz
      // ueberschrieben werden wuerde — der Test schuetzt vor dieser Drift.
      const second = await writeIdentityMarker(tmpRoot, {
        libraryId: 'lib_abc',
        label: 'Renamed Library',
        ownerEmail: 'someone@else.com',
      })
      expect(second).toEqual(first)
    })

    it('wirft, wenn das Verzeichnis bereits zu einer anderen Library gehoert', async () => {
      await writeIdentityMarker(tmpRoot, {
        libraryId: 'lib_existing',
        label: 'Existing',
        ownerEmail: 'owner@example.com',
      })
      await expect(
        writeIdentityMarker(tmpRoot, {
          libraryId: 'lib_other',
          label: 'Other',
          ownerEmail: 'owner@example.com',
        }),
      ).rejects.toThrow(/anderen Library zugeordnet/)
    })

    it('uebernimmt ein explizit gesetztes createdAt', async () => {
      const fixedDate = '2026-04-28T12:00:00.000Z'
      const written = await writeIdentityMarker(tmpRoot, {
        libraryId: 'lib_abc',
        label: 'My Library',
        ownerEmail: 'owner@example.com',
        createdAt: fixedDate,
      })
      expect(written.createdAt).toBe(fixedDate)
    })
  })

  describe('validateIdentityMarker', () => {
    it('liefert ok=true bei passender libraryId', async () => {
      await writeIdentityMarker(tmpRoot, {
        libraryId: 'lib_abc',
        label: 'My Library',
        ownerEmail: 'owner@example.com',
      })
      const result = await validateIdentityMarker(tmpRoot, 'lib_abc')
      expect(result.ok).toBe(true)
    })

    it('liefert reason="missing", wenn die Datei nicht existiert', async () => {
      const result = await validateIdentityMarker(tmpRoot, 'lib_abc')
      expect(result).toEqual({ ok: false, reason: 'missing', rootPath: tmpRoot })
    })

    it('liefert reason="mismatch", wenn die libraryId abweicht', async () => {
      await writeIdentityMarker(tmpRoot, {
        libraryId: 'lib_actual',
        label: 'Actual',
        ownerEmail: 'owner@example.com',
      })
      const result = await validateIdentityMarker(tmpRoot, 'lib_expected')
      expect(result.ok).toBe(false)
      if (!result.ok && result.reason === 'mismatch') {
        expect(result.actualLibraryId).toBe('lib_actual')
        expect(result.expectedLibraryId).toBe('lib_expected')
      } else {
        throw new Error(`Erwartete reason="mismatch", erhielt: ${JSON.stringify(result)}`)
      }
    })

    it('liefert reason="unreadable" bei unlesbarer/unparsbarer Datei', async () => {
      await fs.mkdir(pathLib.join(tmpRoot, IDENTITY_DIR_NAME), { recursive: true })
      await fs.writeFile(
        pathLib.join(tmpRoot, IDENTITY_DIR_NAME, IDENTITY_FILE_NAME),
        'not-json',
        'utf8',
      )
      const result = await validateIdentityMarker(tmpRoot, 'lib_abc')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('unreadable')
    })
  })

  describe('describeValidationFailure', () => {
    it('liefert leeren String fuer ein erfolgreiches Ergebnis', () => {
      expect(
        describeValidationFailure({
          ok: true,
          marker: {
            schemaVersion: IDENTITY_SCHEMA_VERSION,
            libraryId: 'x',
            label: 'X',
            ownerEmail: 'o@x',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        }),
      ).toBe('')
    })

    it('beschreibt einen Mismatch-Fall menschenlesbar', () => {
      const text = describeValidationFailure({
        ok: false,
        reason: 'mismatch',
        rootPath: '/some/path',
        expectedLibraryId: 'lib_exp',
        actualLibraryId: 'lib_act',
      })
      expect(text).toContain('lib_act')
      expect(text).toContain('lib_exp')
    })

    it('beschreibt einen Missing-Fall mit Hinweis auf den Owner', () => {
      const text = describeValidationFailure({
        ok: false,
        reason: 'missing',
        rootPath: '/some/path',
      })
      expect(text).toContain('Owner')
      expect(text).toContain(IDENTITY_DIR_NAME)
    })
  })
})
