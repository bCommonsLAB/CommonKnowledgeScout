
let apm: any | null = null;

async function getAgent(): Promise<any | null> {
  if (typeof window !== 'undefined') {
    console.log('getAgent: window is undefined')
    return null;
  }
  if (apm) return apm;
  try {
    console.log('getAgent: try to require elastic-apm-node')
    // Robust: ESM- und CJS-kompatibles require herstellen
    let req: NodeRequire;
    try {
      // In ESM-Setups kann require fehlen – dann createRequire verwenden
      // @ts-ignore
      req = typeof require === 'function' ? require : (await import('module')).createRequire(import.meta.url);
    } catch (e) {
      const mod = await import('module' as unknown as string);
      // @ts-ignore
      req = (mod as any).createRequire(import.meta.url);
    }
    const agent = req('elastic-apm-node') as any;

    // Minimal-start mit ENV-Config, vermeidet Konfigurationsdatei
    try {
      if ((process.env as Record<string,string>)['ELASTIC_APM_CONFIG_FILE']) {
        console.warn('getAgent: unsetting ELASTIC_APM_CONFIG_FILE to avoid file-based config')
        delete (process.env as Record<string,string>)['ELASTIC_APM_CONFIG_FILE']
      }
    } catch {}
    const already = typeof agent?.isStarted === 'function' ? agent.isStarted() : false;
    if (!already && typeof agent?.start === 'function') {
      agent.start({
        serviceName: process.env.ELASTIC_APM_SERVICE_NAME ?? 'common-knowledge-scout',
        serverUrl: process.env.ELASTIC_APM_SERVER_URL,
        secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
        environment: process.env.ELASTIC_APM_ENVIRONMENT ?? process.env.NODE_ENV,
        logLevel: process.env.ELASTIC_APM_LOG_LEVEL ?? 'info',
        active: process.env.ELASTIC_APM_ACTIVE !== 'false',
        usePathAsTransactionName: true,
        transactionSampleRate: 1.0,
      });
      console.log('getAgent: agent started')
    }
    apm = agent;
    return apm;
  } catch (error) {
    console.error('getAgent: error starting agent', error)
    return null;
  }
}

export default {
  startTransaction(name: string, type?: string) {
    const p = getAgent();
    if (apm && typeof apm.startTransaction === 'function') return apm.startTransaction(name, type);
    void p.then(() => {}).catch(() => {});
    return null;
  },
  startSpan(name: string) {
    const p = getAgent();
    if (apm && typeof apm.startSpan === 'function') return apm.startSpan(name);
    void p.then(() => {}).catch(() => {});
    return null;
  },
  captureError(err: unknown) {
    try { if (apm?.captureError) apm.captureError(err); else { void getAgent(); } } catch {}
  },
};

