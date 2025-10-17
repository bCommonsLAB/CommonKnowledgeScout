// Elastic APM zentrale Konfiguration für Node-Agent (wird per NODE_OPTIONS vor Next geladen)
// Hinweis: Werte kommen primär aus Prozess-Umgebungsvariablen (start.ps1/Deployment/.env)
// .env früh laden, damit ELASTIC_APM_* beim Preload verfügbar sind

console.log('elastic-apm-node: loading .env')

try { require('dotenv').config() } catch {
  console.error('elastic-apm-node: error loading .env', error)
}

function splitList(name) {
  const v = process.env[name]
  if (!v) return undefined
  // Unterstützt '|' getrennte Liste, wie im bestehenden start.ps1
  const parts = v.split('|').map(s => s.trim()).filter(Boolean)
  return parts.length ? parts : undefined
}

module.exports = {
  serverUrl: process.env.ELASTIC_APM_SERVER_URL,
  secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
  serviceName: process.env.ELASTIC_APM_SERVICE_NAME || 'common-knowledge-scout',
  environment: process.env.ELASTIC_APM_ENVIRONMENT || 'development',
  logLevel: process.env.ELASTIC_APM_LOG_LEVEL || 'warn',
  usePathAsTransactionName: String(process.env.ELASTIC_APM_USE_PATH_AS_TRANSACTION_NAME || 'true') === 'true',
  transactionSampleRate: Number(process.env.ELASTIC_APM_TRANSACTION_SAMPLE_RATE || '1.0'),
  disableMetrics: process.env.ELASTIC_APM_DISABLE_METRICS,
  ignoreUrls: splitList('ELASTIC_APM_IGNORE_URLS'),
  transactionIgnoreUrls: splitList('ELASTIC_APM_TRANSACTION_IGNORE_URLS'),
}



