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
} = require('../../../electron/env-debug-snapshot.js') as {
  shouldShowFullValue: (key: string) => boolean;
  maskedPlaceholder: (raw: string | undefined) => string;
  formatEnvLine: (key: string, value: string | undefined) => string;
  isRelevantAppKey: (key: string) => boolean;
  buildEnvDebugSnapshotText: (
    env: NodeJS.ProcessEnv,
    meta?: { dev?: boolean; electronVersion?: string; nodeVersion?: string }
  ) => string;
};

describe('env-debug-snapshot', () => {
  it('shouldShowFullValue: NEXT_PUBLIC und explizite Safe-Keys', () => {
    expect(shouldShowFullValue('NEXT_PUBLIC_APP_URL')).toBe(true);
    expect(shouldShowFullValue('NODE_ENV')).toBe(true);
    expect(shouldShowFullValue('CLERK_SECRET_KEY')).toBe(false);
    expect(shouldShowFullValue('MONGODB_URI')).toBe(false);
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

  it('isRelevantAppKey: führender Unterstrich (Pseudo-Kommentar) und PATH ausgeschlossen', () => {
    expect(isRelevantAppKey('_SECRETARY_SERVICE_URL')).toBe(false);
    expect(isRelevantAppKey('_ANYTHING')).toBe(false);
    expect(isRelevantAppKey('PATH')).toBe(false);
    expect(isRelevantAppKey('MONGODB_URI')).toBe(true);
  });

  it('buildEnvDebugSnapshotText: enthält nur relevante Keys', () => {
    const text = buildEnvDebugSnapshotText(
      {
        PATH: 'C:\\Windows',
        _SECRETARY_SERVICE_URL: 'https://ignored',
        MONGODB_URI: 'mongodb://x',
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
        NODE_ENV: 'production',
      },
      { dev: true, electronVersion: '40.0.0', nodeVersion: '22.0.0' }
    );
    expect(text).toContain('NEXT_PUBLIC_APP_URL=http://localhost:3000');
    expect(text).toContain('NODE_ENV=production');
    expect(text).toContain('MONGODB_URI=[maskiert');
    expect(text).not.toContain('PATH=');
    expect(text).not.toContain('_SECRETARY_SERVICE_URL');
    expect(text).toContain('Modus: Development');
  });
});
