/**
 * @fileoverview Maskierte ENV-Schnappschüsse für Electron-Debugging
 *
 * Zeigt im Desktop-Build, welche Konfigurationsschlüssel gesetzt sind,
 * ohne Geheimnisse im Klartext auszugeben. Explizite Regeln (keine stillen Defaults).
 *
 * @see electron/main.js — Menüeintrag „Konfiguration (maskiert)…“
 *
 * Schlüssel mit führendem Unterstrich (`_VAR=…`) werden ignoriert — in .env
 * oft als „auskommentierte“ Alternative neben der echten Variable.
 */

/** Windows-/Tool-Rauschen, das für App-Konfig irrelevant ist */
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

/**
 * Diese Schlüssel dürfen vollständig angezeigt werden (keine Secrets).
 * Neue sensible Variablen gehören hier nicht hin — sie werden dann maskiert.
 */
const SHOW_FULL_KEYS = new Set([
  'NODE_ENV',
  'PORT',
  'BUILD_TARGET',
  'IS_PACKAGE_BUILD',
  'NEXT_RUNTIME',
  'USE_STORAGE',
  'STORAGE_BASE_PATH',
  'MONGODB_DATABASE_NAME',
  'MONGODB_COLLECTION_NAME',
  'SECRETARY_SERVICE_URL',
  'SECRETARY_IMAGE_ANALYZER_PATH',
  'MS_REDIRECT_URI',
  'NEXT_PUBLIC_APP_URL',
  'INTERNAL_SELF_BASE_URL',
  'ELECTRON_MSAL_CLIENT_ID',
  'ELECTRON_MSAL_TENANT_ID',
  'JOBS_EXECUTION_MODE',
  'JOBS_WORKER_AUTOSTART',
  'JOBS_WORKER_INTERVAL_MS',
  'JOBS_WORKER_CONCURRENCY',
  'JOBS_WORKER_POOL_ID',
  'SUMMARY_MAX_DOCS',
  'SUMMARY_ESTIMATE_CHARS_PER_DOC',
  'CHAT_MAX_INPUT_TOKENS',
  'DOCMETA_COLLECTION_STRATEGY',
  'ENABLE_AUTO_RETRIEVER_ANALYSIS',
  'MEDIA_TAB_RESOLUTION_TRACE',
  'QUESTION_ANALYZER_MODEL',
  'QUESTION_ANALYZER_TEMPERATURE',
  'LLM_SCHEMA_VALIDATION_RETRY_COUNT',
  'LLM_SCHEMA_VALIDATION_RETRY_BACKOFF_MS',
  'MAILJET_FROM_EMAIL',
  'MAILJET_FROM_NAME',
  'NEXT_PUBLIC_AUTH_MODE',
  'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
]);

/**
 * Schlüssel-Prefixe: nur sichtbare (Client-)Konfiguration, absichtlich öffentlich.
 */
const SHOW_FULL_PREFIXES = ['NEXT_PUBLIC_'];

/**
 * @param {string} key
 * @returns {boolean}
 */
function shouldShowFullValue(key) {
  if (SHOW_FULL_PREFIXES.some((p) => key.startsWith(p))) return true;
  return SHOW_FULL_KEYS.has(key);
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
 * Welche ENV-Keys überhaupt listen? Nur „App-typische“ Namen + alle NEXT_PUBLIC_*.
 * @param {string} key
 * @returns {boolean}
 */
function isRelevantAppKey(key) {
  // Auskommentiert-Ersatz in .env: _ANDERE_URL=… — nicht anzeigen
  if (key.startsWith('_')) return false;
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) return false;
  if (IGNORED_KEYS.has(key)) return false;
  if (key.startsWith('NEXT_PUBLIC_')) return true;
  if (key.startsWith('npm_')) return false;

  const prefixes = [
    'CLERK_',
    'MONGODB_',
    'SECRETARY_',
    'INTERNAL_',
    'JOBS_',
    'AZURE_',
    'MAILJET_',
    'VIMEO_',
    'GITHUB_',
    'MS_',
    'ELECTRON_MSAL_',
    'STORAGE_',
    'BUILD_',
    'IS_PACKAGE_',
    'CHAT_',
    'SUMMARY_',
    'DOCMETA_',
    'ENABLE_',
    'MEDIA_',
    'QUESTION_',
    'LLM_',
  ];
  if (prefixes.some((p) => key.startsWith(p))) return true;
  if (SHOW_FULL_KEYS.has(key)) return true;
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

module.exports = {
  IGNORED_KEYS,
  SHOW_FULL_KEYS,
  shouldShowFullValue,
  maskedPlaceholder,
  formatEnvLine,
  isRelevantAppKey,
  buildEnvDebugSnapshotText,
};
