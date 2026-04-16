/**
 * Renderer-Logik für env-config-window.html (kein Node — nur envViewer aus Preload).
 */
(function () {
  const metaEl = document.getElementById('meta');
  const tbody = document.getElementById('tbody');
  const revealAllCb = document.getElementById('reveal-all');
  const copyBtn = document.getElementById('copy');

  /** @type {Set<string>} */
  const revealKeys = new Set();

  /** Letzter Stand für Zwischenablage (entspricht der Tabelle) */
  let lastPayload = { meta: {}, rows: [] };

  function getApi() {
    return window.envViewer;
  }

  async function fetchRows() {
    const api = getApi();
    if (!api || typeof api.getRows !== 'function') {
      throw new Error('envViewer API fehlt');
    }
    return api.getRows({
      revealAll: revealAllCb.checked,
      revealKeys: Array.from(revealKeys),
    });
  }

  function buildClipboardText(meta, rows) {
    const head = [
      'Knowledge Scout — Konfiguration',
      '',
      typeof meta.dev === 'boolean'
        ? `Modus: ${meta.dev ? 'Development (unpackaged)' : 'Production'}`
        : '',
      meta.electronVersion ? `Electron: ${meta.electronVersion}` : '',
      meta.nodeVersion ? `Node: ${meta.nodeVersion}` : '',
      '',
      '— Umgebungsvariablen —',
    ].filter(Boolean);
    const lines = rows.map((r) => `${r.key}=${r.displayValue}`);
    return [...head, ...lines].join('\n');
  }

  async function render() {
    const { meta, rows } = await fetchRows();
    lastPayload = { meta, rows };

    metaEl.textContent = [
      typeof meta.dev === 'boolean'
        ? `Modus: ${meta.dev ? 'Development (unpackaged)' : 'Production'}`
        : '',
      meta.electronVersion ? `Electron: ${meta.electronVersion}` : '',
      meta.nodeVersion ? `Node: ${meta.nodeVersion}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    tbody.replaceChildren();
    for (const row of rows) {
      const tr = document.createElement('tr');
      const tdKey = document.createElement('td');
      tdKey.className = 'key';
      tdKey.textContent = row.key;
      const tdVal = document.createElement('td');
      tdVal.className = 'val';
      tdVal.textContent = row.displayValue;
      const tdEye = document.createElement('td');
      tdEye.className = 'eye';

      if (row.isSecret) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'eye-btn';
        btn.setAttribute('aria-label', row.revealed ? 'Wert verbergen' : 'Wert einblenden');
        btn.textContent = row.revealed ? '🙈' : '👁';
        btn.title = row.revealed ? 'Maskieren' : 'Klartext (lokal)';
        btn.addEventListener('click', () => {
          if (revealAllCb.checked) return;
          if (revealKeys.has(row.key)) revealKeys.delete(row.key);
          else revealKeys.add(row.key);
          render().catch((e) => console.error(e));
        });
        if (revealAllCb.checked) {
          btn.disabled = true;
          btn.title = 'Deaktiviert solange „Alle einblenden“ aktiv ist';
        }
        tdEye.appendChild(btn);
      } else {
        tdEye.appendChild(document.createTextNode(''));
      }

      tr.appendChild(tdKey);
      tr.appendChild(tdVal);
      tr.appendChild(tdEye);
      tbody.appendChild(tr);
    }
  }

  copyBtn.addEventListener('click', async () => {
    const api = getApi();
    const text = buildClipboardText(lastPayload.meta, lastPayload.rows);
    if (api && typeof api.copyText === 'function') {
      await api.copyText(text);
    }
  });

  revealAllCb.addEventListener('change', () => {
    if (revealAllCb.checked) {
      revealKeys.clear();
    }
    render().catch((e) => console.error(e));
  });

  render().catch((e) => {
    metaEl.textContent = String(e.message || e);
  });
})();
