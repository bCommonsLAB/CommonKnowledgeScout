/**
 * @fileoverview Teams stream.aspx → Graph Range-Download → Chunk-Upload zu /api/stream-ingest
 *
 * Verwendet parseStreamAspxUrl, MSAL-Token und fetch mit Session-Cookies für localhost (Clerk).
 */

const { parseStreamAspxUrl } = require('./stream-resolver');

const GRAPH_CHUNK_SIZE = 10 * 1024 * 1024; // 10 MiB
const GRAPH_FETCH_RETRIES = 4;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Encodiert jedes Pfadsegment für Graph drive root:/path:/content
 * @param {string} graphRootPath z. B. Documents/Recordings/x.mp4
 */
function encodeGraphDrivePath(graphRootPath) {
  return graphRootPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function buildGraphContentUrl(graphRootPath) {
  const enc = encodeGraphDrivePath(graphRootPath);
  return `https://graph.microsoft.com/v1.0/me/drive/root:/${enc}:/content`;
}

/**
 * @param {string} accessToken
 * @param {string} graphRootPath
 * @param {AbortSignal} [signal]
 * @returns {Promise<number>}
 */
async function getGraphContentLength(accessToken, graphRootPath, signal) {
  const url = buildGraphContentUrl(graphRootPath);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Range: 'bytes=0-0',
    },
    signal,
  });

  if (res.status !== 200 && res.status !== 206) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `graph_head_failed: HTTP ${res.status} ${body.slice(0, 300)}`
    );
  }

  const cr = res.headers.get('content-range');
  if (cr) {
    const m = cr.match(/\/(\d+)\s*$/);
    if (m) return parseInt(m[1], 10);
  }

  const cl = res.headers.get('content-length');
  if (cl) return parseInt(cl, 10);

  throw new Error(
    'graph_no_content_length: Microsoft Graph lieferte weder Content-Range noch Content-Length'
  );
}

/**
 * @param {string} accessToken
 * @param {string} graphRootPath
 * @param {number} start inclusive
 * @param {number} end inclusive
 * @param {AbortSignal} [signal]
 * @returns {Promise<Buffer>}
 */
async function fetchGraphRange(accessToken, graphRootPath, start, end, signal) {
  const url = buildGraphContentUrl(graphRootPath);
  let lastErr;
  for (let attempt = 0; attempt < GRAPH_FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Range: `bytes=${start}-${end}`,
        },
        signal,
      });

      if (res.status === 200 || res.status === 206) {
        return Buffer.from(await res.arrayBuffer());
      }

      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        lastErr = new Error(`graph_range_retry: ${res.status}`);
        await sleep(2 ** attempt * 500);
        continue;
      }

      const body = await res.text().catch(() => '');
      throw new Error(
        `graph_range_failed: HTTP ${res.status} ${body.slice(0, 200)}`
      );
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
      if (attempt < GRAPH_FETCH_RETRIES - 1) {
        await sleep(2 ** attempt * 500);
      }
    }
  }
  throw lastErr || new Error('graph_range_failed: unbekannter Fehler');
}

/**
 * fetch mit gleichen Optionen; nutzt cookieFetch falls gesetzt (Electron net.fetch + Cookie-Header)
 * @param {string} url
 * @param {RequestInit} init
 * @param {(url: string, init?: RequestInit) => Promise<Response>} cookieFetch
 */
async function ingestFetch(url, init, cookieFetch) {
  if (cookieFetch) return cookieFetch(url, init);
  return fetch(url, init);
}

/**
 * @param {object} args
 * @param {string} args.streamUrl stream.aspx URL
 * @param {() => Promise<string>} args.acquireToken
 * @param {string} args.baseUrl z. B. http://localhost:3000
 * @param {(url: string, init?: RequestInit) => Promise<Response>} [args.cookieFetch]
 * @param {(p: { phase: string, percent?: number, message?: string }) => void} [args.onProgress]
 * @param {AbortSignal} [args.signal]
 * @param {string} [args.fileName] Zielname für Secretary
 * @param {string} [args.targetLanguage]
 * @param {string} [args.sourceLanguage]
 */
async function relayStreamToIngest(args) {
  const {
    streamUrl,
    acquireToken,
    baseUrl,
    cookieFetch,
    onProgress,
    signal,
    fileName: fileNameOpt,
    targetLanguage = 'de',
    sourceLanguage = 'auto',
  } = args;

  const { graphRootPath } = parseStreamAspxUrl(streamUrl);
  const fileName =
    fileNameOpt ||
    graphRootPath.split('/').pop() ||
    'teams-recording.mp4';

  onProgress?.({ phase: 'auth', percent: 0, message: 'Microsoft-Anmeldung' });
  const accessToken = await acquireToken();

  onProgress?.({ phase: 'size', percent: 5, message: 'Dateigröße ermitteln' });
  const total = await getGraphContentLength(accessToken, graphRootPath, signal);

  const initUrl = `${baseUrl.replace(/\/$/, '')}/api/stream-ingest/init`;
  const initRes = await ingestFetch(
    initUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName,
        contentLength: total,
      }),
      signal,
    },
    cookieFetch
  );

  if (!initRes.ok) {
    const t = await initRes.text().catch(() => '');
    throw new Error(
      `stream_ingest_init_failed: ${initRes.status} ${t.slice(0, 400)}`
    );
  }

  const initJson = await initRes.json();
  const uploadId = initJson.uploadId;
  if (!uploadId || typeof uploadId !== 'string') {
    throw new Error('stream_ingest_init_invalid: uploadId fehlt in Antwort');
  }

  let offset = 0;
  let chunkIndex = 0;

  while (offset < total) {
    if (signal?.aborted) {
      throw new Error('stream_relay_aborted');
    }

    const end = Math.min(offset + GRAPH_CHUNK_SIZE - 1, total - 1);
    const chunk = await fetchGraphRange(
      accessToken,
      graphRootPath,
      offset,
      end,
      signal
    );

    const chunkUrl = `${baseUrl.replace(/\/$/, '')}/api/stream-ingest/chunk`;
    const chunkRes = await ingestFetch(
      chunkUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Upload-Id': uploadId,
          'X-Chunk-Index': String(chunkIndex),
        },
        body: chunk,
        signal,
      },
      cookieFetch
    );

    if (!chunkRes.ok) {
      const t = await chunkRes.text().catch(() => '');
      throw new Error(
        `stream_ingest_chunk_failed: ${chunkRes.status} ${t.slice(0, 400)}`
      );
    }

    offset = end + 1;
    chunkIndex += 1;

    const pct = 5 + Math.round((90 * offset) / total);
    onProgress?.({
      phase: 'download_upload',
      percent: Math.min(pct, 95),
      message: `Übertragung ${offset} / ${total} Bytes`,
    });
  }

  onProgress?.({ phase: 'complete', percent: 96, message: 'Secretary-Service' });
  const completeUrl = `${baseUrl.replace(/\/$/, '')}/api/stream-ingest/complete`;
  const completeRes = await ingestFetch(
    completeUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        targetLanguage,
        sourceLanguage,
      }),
      signal,
    },
    cookieFetch
  );

  const completeText = await completeRes.text();
  let completeJson;
  try {
    completeJson = JSON.parse(completeText);
  } catch {
    completeJson = { raw: completeText };
  }

  if (!completeRes.ok) {
    throw new Error(
      `stream_ingest_complete_failed: ${completeRes.status} ${completeText.slice(0, 500)}`
    );
  }

  onProgress?.({ phase: 'done', percent: 100, message: 'Fertig' });
  return completeJson;
}

module.exports = {
  relayStreamToIngest,
  getGraphContentLength,
  fetchGraphRange,
  buildGraphContentUrl,
  GRAPH_CHUNK_SIZE,
};
