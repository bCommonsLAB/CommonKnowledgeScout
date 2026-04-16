/**
 * @fileoverview Tests für electron/env-debug-snapshot.js (maskierte ENV-Anzeige)
 */
import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  shouldShowFullValue,
  maskedPlaceholder,
  formatEnvLine,
  isRelevantAppKey,
  buildEnvDebugSnapshotText,
  buildEnvDebugRows,
} = require('../../../electron/env-debug-snapshot.js') as {
  shouldShowFullValue: (key: string) => boolean;
  maskedPlaceholder: (raw: string | undefined) => string;
  formatEnvLine: (key: string, value: string | undefined) => string;
  isRelevantAppKey: (key: string) => boolean;
  buildEnvDebugSnapshotText: (
    env: NodeJS.ProcessEnv,
    meta?: { dev?: boolean; electronVersion?: string; nodeVersion?: string }
  ) => string;
  buildEnvDebugRows: (
    env: NodeJS.ProcessEnv,
    opts?: { revealAll?: boolean; revealKeys?: string[] }
  ) => { key: string; displayValue: string; isSecret: boolean; revealed: boolean }[];
};

describe('env-debug-snapshot', () => {
  it('shouldShowFullValue: nur Clerk-Public, URLs, Mongo-Metadaten, Secretary-URL/Pfad, JOBS_WORKER_*', () => {
    expect(shouldShowFullValue('NEXT_PUBLIC_APP_URL')).toBe(true);
    expect(shouldShowFullValue('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')).toBe(true);
    expect(shouldShowFullValue('MONGODB_DATABASE_NAME')).toBe(true);
    expect(shouldShowFullValue('SECRETARY_SERVICE_URL')).toBe(true);
    expect(shouldShowFullValue('JOBS_WORKER_POOL_ID')).toBe(true);
    expect(shouldShowFullValue('NODE_ENV')).toBe(false);
    expect(shouldShowFullValue('NEXT_PUBLIC_AUTH_MODE')).toBe(false);
    expect(shouldShowFullValue('CLERK_SECRET_KEY')).toBe(false);
    expect(shouldShowFullValue('MONGODB_URI')).toBe(false);
    expect(shouldShowFullValue('SECRETARY_SERVICE_API_KEY')).toBe(false);
  });

  it('maskedPlaceholder: leer vs. Länge', () => {
    expect(maskedPlaceholder('')).toBe('(nicht gesetzt)');
    expect(maskedPlaceholder(undefined)).toBe('(nicht gesetzt)');
    expect(maskedPlaceholder('secret')).toBe('[maskiert, 6 Zeichen]');
  });

  it('formatEnvLine: maskiert vs. Klartext', () => {
    expect(formatEnvLine('CLERK_SECRET_KEY', 'sk_live_xyz')).toBe(
      'CLERK_SECRET_KEY=[maskiert, 11 Zeichen]'
    );
    expect(formatEnvLine('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')).toBe(
      'NEXT_PUBLIC_APP_URL=http://localhost:3000'
    );
    expect(formatEnvLine('NODE_ENV', '')).toBe('NODE_ENV=(nicht gesetzt)');
  });

  it('isRelevantAppKey: Allowlist + Unterstrich/PATH', () => {
    expect(isRelevantAppKey('_SECRETARY_SERVICE_URL')).toBe(false);
    expect(isRelevantAppKey('PATH')).toBe(false);
    expect(isRelevantAppKey('MONGODB_URI')).toBe(true);
    expect(isRelevantAppKey('CLERK_SECRET_KEY')).toBe(true);
    expect(isRelevantAppKey('INTERNAL_TEST_TOKEN')).toBe(true);
    expect(isRelevantAppKey('JOBS_WORKER_AUTOSTART')).toBe(true);
    expect(isRelevantAppKey('NODE_ENV')).toBe(false);
    expect(isRelevantAppKey('MAILJET_API_KEY')).toBe(false);
    expect(isRelevantAppKey('NEXT_PUBLIC_AUTH_MODE')).toBe(false);
    expect(isRelevantAppKey('NEXT_PUBLIC_APP_URL')).toBe(true);
  });

  it('buildEnvDebugRows: revealAll / revealKeys; NODE_ENV nicht in Allowlist', () => {
    const env = {
      MONGODB_URI: 'mongodb://secret',
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    };
    const masked = buildEnvDebugRows(env, {});
    expect(masked.some((r) => r.key === 'NODE_ENV')).toBe(false);
    const mongoRow = masked.find((r) => r.key === 'MONGODB_URI');
    expect(mongoRow?.isSecret).toBe(true);
    expect(mongoRow?.displayValue).toContain('maskiert');
    const revealedOne = buildEnvDebugRows(env, { revealKeys: ['MONGODB_URI'] });
    expect(revealedOne.find((r) => r.key === 'MONGODB_URI')?.displayValue).toBe('mongodb://secret');
    const all = buildEnvDebugRows(env, { revealAll: true });
    expect(all.find((r) => r.key === 'MONGODB_URI')?.displayValue).toBe('mongodb://secret');
  });

  it('buildEnvDebugSnapshotText: nur Allowlist-Keys', () => {
    const text = buildEnvDebugSnapshotText(
      {
        PATH: 'C:\\Windows',
        MAILJET_API_KEY: 'x',
        NODE_ENV: 'production',
        _SECRETARY_SERVICE_URL: 'https://ignored',
        MONGODB_URI: 'mongodb://x',
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
        INTERNAL_SELF_BASE_URL: 'http://localhost:3000',
        CLERK_SECRET_KEY: 'sk_test',
      },
      { dev: true, electronVersion: '40.0.0', nodeVersion: '22.0.0' }
    );
    expect(text).toContain('NEXT_PUBLIC_APP_URL=http://localhost:3000');
    expect(text).toContain('INTERNAL_SELF_BASE_URL=http://localhost:3000');
    expect(text).toContain('MONGODB_URI=[maskiert');
    expect(text).toContain('CLERK_SECRET_KEY=[maskiert');
    expect(text).not.toContain('PATH=');
    expect(text).not.toContain('NODE_ENV');
    expect(text).not.toContain('MAILJET');
    expect(text).not.toContain('_SECRETARY_SERVICE_URL');
    expect(text).toContain('Modus: Development');
  });
});
