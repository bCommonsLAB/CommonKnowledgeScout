#!/usr/bin/env node
/**
 * stdio ⟷ Streamable-HTTP-Bruecke zur KnowledgeScout-MCP-Bruecke (Welle 5).
 *
 * Bewusst ABHAENGIGKEITSFREI (natives fetch, Node >= 18): kein npm install,
 * keine OAuth-/Lockfile-Logik, kein env-Trick — die Desktop-App substituiert
 * nur die beiden user_config-Argumente (siehe manifest.json). Der
 * KnowledgeScout-Server ist stateless: jede JSON-RPC-Nachricht geht als
 * eigener POST; SSE-Antworten werden auf ihre data:-Nutzlast reduziert.
 *
 * stderr ist Diagnose und landet im App-Log
 * (%APPDATA%\Claude\logs\mcp-server-KnowledgeScout.log).
 */

const [, , serverUrl, apiKey] = process.argv;
if (!serverUrl || !apiKey) {
  console.error('[knowledgescout-proxy] Aufruf: proxy.js <server_url> <api_key> — user_config unvollstaendig?');
  process.exit(2);
}
console.error(`[knowledgescout-proxy] Start (Node ${process.version}) -> ${serverUrl}`);

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line) void forward(line);
  }
});
process.stdin.on('end', () => process.exit(0));

function writeOut(json) {
  process.stdout.write(json + '\n');
}

async function forward(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    console.error('[knowledgescout-proxy] Unlesbare stdin-Zeile:', error.message);
    return;
  }
  const hasId = message && typeof message === 'object' && 'id' in message && message.id !== null;

  try {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[knowledgescout-proxy] HTTP ${response.status}: ${text.slice(0, 300)}`);
      if (hasId) {
        writeOut(JSON.stringify({
          jsonrpc: '2.0', id: message.id,
          error: {
            code: -32000,
            message: `KnowledgeScout antwortet HTTP ${response.status} — laeuft der Dev-Server (pnpm dev -p 3001)? Stimmt der API-Key?`,
          },
        }));
      }
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      // SSE: jede data:-Zeile ist eine vollstaendige JSON-RPC-Nachricht.
      const text = await response.text();
      for (const raw of text.split('\n')) {
        const trimmed = raw.trim();
        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trim();
          if (payload) writeOut(payload);
        }
      }
      return;
    }
    if (contentType.includes('application/json')) {
      const text = await response.text();
      if (text.trim()) writeOut(text.trim());
      return;
    }
    // 202/204 ohne Body (Notifications) — nichts zurueckzuschreiben.
  } catch (error) {
    console.error('[knowledgescout-proxy] Verbindung fehlgeschlagen:', error.message);
    if (hasId) {
      writeOut(JSON.stringify({
        jsonrpc: '2.0', id: message.id,
        error: {
          code: -32001,
          message: `KnowledgeScout nicht erreichbar (${error.message}) — Dev-Server starten: pnpm dev -p 3001`,
        },
      }));
    }
  }
}
