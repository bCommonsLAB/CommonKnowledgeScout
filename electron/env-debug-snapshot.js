/**
 * @fileoverview Maskierte ENV-Schnappschüsse für Electron-Debugging
 *
 * Es werden nur ausgewählte Umgebungsvariablen gelistet (Allowlist):
 * Clerk (Publishable + Secret + NEXT_PUBLIC_CLERK_* URLs), MongoDB, SECRETARY_*,
 * INTERNAL_TEST_TOKEN, JOBS_WORKER_*, NEXT_PUBLIC_APP_URL, INTERNAL_SELF_BASE_URL.
 *
 * Schlüssel mit führendem Unterstrich (`_VAR=…`) werden ignoriert.
 *
 * @see electron/main.js — Hilfe → Konfiguration…
 */

/** Windows-/Tool-Rauschen, das für diese Ansicht irrelevant ist */
const IGNORED_KEYS = new Set([
  'PATH',
  'PATHEXT',
  'PWD',
  'WINDIR',
  'SYSTEMROOT',
  'TMP',
  'TEMP',
  'USERPROFILE',
  'USERNAME',
  'HOMEDRIVE',
  'HOMEPATH',
  'APPDATA',
  'LOCALAPPDATA',
  'PROGRAMFILES',
  'PROGRAMFILES(X86)',
  'COMMONPROGRAMFILES',
  'NUMBER_OF_PROCESSORS',
  'PROCESSOR_ARCHITECTURE',
  'PROCESSOR_IDENTIFIER',
  'PROCESSOR_LEVEL',
  'PROCESSOR_REVISION',
  'OS',
  'COMSPEC',
  'PSMODULEPATH',
  'TERM_PROGRAM',
  'TERM_PROGRAM_VERSION',
  'CURSOR_TRACE_ID',
]);

/** Nicht-geheime Secretary-Felder (Klartext); alle anderen SECRETARY_* maskiert */
const SECRETARY_SHOW_FULL_KEYS = new Set([
  'SECRETARY_SERVICE_URL',
  'SECRETARY_IMAGE_ANALYZER_PATH',
]);

/**
 * Ob der Wert standardmäßig unmaskiert angezeigt wird (nur für Nicht-Secrets).
 * Explizite Aufzählung — neue Keys in der Allowlist default zu „maskiert“, bis hier ergänzt.
 * @param {string} key
 * @returns {boolean}
 */
function shouldShowFullValue(key) {
  if (key.startsWith('NEXT_PUBLIC_CLERK_')) return true;
  if (key === 'NEXT_PUBLIC_APP_URL' || key === 'INTERNAL_SELF_BASE_URL') return true;
  if (key === 'MONGODB_DATABASE_NAME' || key === 'MONGODB_COLLECTION_NAME') return true;
  if (SECRETARY_SHOW_FULL_KEYS.has(key)) return true;
  if (key.startsWith('JOBS_WORKER_')) return true;
  return false;
}

/**
 * Kurze Maskierung: nur Länge + ob gesetzt (kein Teilstring des Secrets).
 * @param {string | undefined} raw
 * @returns {string}
 */
function maskedPlaceholder(raw) {
  if (raw === undefined || raw === '') return '(nicht gesetzt)';
  const n = raw.length;
  return `[maskiert, ${n} Zeichen]`;
}

/**
 * @param {string} key
 * @param {string | undefined} value
 * @returns {string}
 */
function formatEnvLine(key, value) {
  const v = value === undefined ? '' : String(value);
  if (shouldShowFullValue(key)) {
    const display = v.length > 0 ? v : '(nicht gesetzt)';
    return `${key}=${display}`;
  }
  return `${key}=${maskedPlaceholder(v)}`;
}

/**
 * Nur die für Desktop-Konfiguration vorgesehenen Keys (Allowlist).
 * @param {string} key
 * @returns {boolean}
 */
function isRelevantAppKey(key) {
  if (key.startsWith('_')) return false;
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) return false;
  if (IGNORED_KEYS.has(key)) return false;
  if (key.startsWith('npm_')) return false;

  if (key === 'CLERK_SECRET_KEY') return true;
  if (key.startsWith('NEXT_PUBLIC_CLERK_')) return true;
  if (key.startsWith('MONGODB_')) return true;
  if (key.startsWith('SECRETARY_')) return true;
  if (key === 'INTERNAL_TEST_TOKEN') return true;
  if (key.startsWith('JOBS_WORKER_')) return true;
  if (key === 'NEXT_PUBLIC_APP_URL') return true;
  if (key === 'INTERNAL_SELF_BASE_URL') return true;

  return false;
}

/**
 * Sortierte Zeilen für Dialog / Logs.
 * @param {NodeJS.ProcessEnv} env
 * @param {{ dev?: boolean, electronVersion?: string, nodeVersion?: string }} [meta]
 * @returns {string}
 */
function buildEnvDebugSnapshotText(env, meta = {}) {
  const keys = Object.keys(env)
    .filter(isRelevantAppKey)
    .sort((a, b) => a.localeCompare(b));
  const lines = keys.map((k) => formatEnvLine(k, env[k]));
  const header = [
    'Knowledge Scout — Konfiguration (sensible Werte maskiert)',
    '',
    meta.dev !== undefined ? `Modus: ${meta.dev ? 'Development (unpackaged)' : 'Production'}` : null,
    meta.electronVersion ? `Electron: ${meta.electronVersion}` : null,
    meta.nodeVersion ? `Node: ${meta.nodeVersion}` : null,
    '',
    '— Umgebungsvariablen —',
  ].filter(Boolean);
  return [...header, ...lines].join('\n');
}

/**
 * Zeilen für das Konfigurations-Fenster (optional Klartext pro Secret-Zeile).
 * @param {NodeJS.ProcessEnv} env
 * @param {{ revealAll?: boolean, revealKeys?: string[] }} [opts]
 * @returns {{ key: string, displayValue: string, isSecret: boolean, revealed: boolean }[]}
 */
function buildEnvDebugRows(env, opts = {}) {
  const revealAll = !!opts.revealAll;
  const revealKeys = new Set(
    Array.isArray(opts.revealKeys) ? opts.revealKeys.filter((k) => typeof k === 'string') : []
  );
  const keys = Object.keys(env)
    .filter(isRelevantAppKey)
    .sort((a, b) => a.localeCompare(b));
  return keys.map((key) => {
    const raw = env[key];
    const v = raw === undefined ? '' : String(raw);
    const isSecret = !shouldShowFullValue(key);
    const revealed = !isSecret || revealAll || revealKeys.has(key);
    let displayValue;
    if (!isSecret) {
      displayValue = v.length > 0 ? v : '(nicht gesetzt)';
    } else if (revealed) {
      displayValue = v.length > 0 ? v : '(nicht gesetzt)';
    } else {
      displayValue = maskedPlaceholder(v);
    }
    return { key, displayValue, isSecret, revealed };
  });
}

module.exports = {
  IGNORED_KEYS,
  SECRETARY_SHOW_FULL_KEYS,
  shouldShowFullValue,
  maskedPlaceholder,
  formatEnvLine,
  isRelevantAppKey,
  buildEnvDebugSnapshotText,
  buildEnvDebugRows,
};
