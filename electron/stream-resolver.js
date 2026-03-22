/**
 * @fileoverview SharePoint stream.aspx → Microsoft Graph Pfad (me/drive/root:/…)
 *
 * Teams-Aufzeichnungen liefern oft URLs mit stream.aspx?id=/personal/.../Documents/...
 * Der Graph-Endpunkt /me/drive/root erwartet einen Pfad relativ zur persönlichen OneDrive-Wurzel.
 * Keine stillen Fallbacks: unbekannte Pfadformate werden mit klarer Fehlermeldung abgelehnt.
 */

/**
 * @param {string} inputUrl
 * @returns {{ hostname: string, serverRelativePath: string, graphRootPath: string }}
 */
function parseStreamAspxUrl(inputUrl) {
  if (typeof inputUrl !== 'string' || !inputUrl.trim()) {
    throw new Error('stream_relay_invalid_input: URL fehlt oder ist leer');
  }

  let parsed;
  try {
    parsed = new URL(inputUrl.trim());
  } catch {
    throw new Error('stream_relay_invalid_input: URL ist nicht parsebar');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('stream_relay_invalid_input: nur https-URLs werden unterstützt');
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith('sharepoint.com')) {
    throw new Error(
      'stream_relay_unsupported_host: Erwartet SharePoint-Host (*.sharepoint.com), erhalten: ' + host
    );
  }

  const pathLower = parsed.pathname.toLowerCase();
  if (!pathLower.includes('stream.aspx')) {
    throw new Error(
      'stream_relay_not_stream_aspx: Pfad muss stream.aspx enthalten, erhalten: ' + parsed.pathname
    );
  }

  const idParam = parsed.searchParams.get('id');
  if (!idParam) {
    throw new Error('stream_relay_missing_id: Query-Parameter "id" fehlt (SharePoint-Dateipfad)');
  }

  let serverRelativePath;
  try {
    serverRelativePath = decodeURIComponent(idParam);
  } catch {
    throw new Error('stream_relay_id_decode_failed: id-Parameter ist kein gültiges URI-Encoding');
  }

  if (!serverRelativePath.startsWith('/')) {
    serverRelativePath = '/' + serverRelativePath;
  }

  // Typisches Muster persönlicher Sites: /personal/{site}/Documents/{rest}
  const docMatch = serverRelativePath.match(/^\/personal\/[^/]+\/Documents\/(.+)$/);
  if (!docMatch) {
    throw new Error(
      'stream_relay_unknown_path_pattern: Erwartet /personal/.../Documents/... in id=, erhalten: ' +
        serverRelativePath
    );
  }

  const rest = docMatch[1];
  if (!rest || rest.includes('..')) {
    throw new Error('stream_relay_invalid_path: ungültiger Dateipfad in id=');
  }

  const graphRootPath = 'Documents/' + rest;

  return {
    hostname: parsed.hostname,
    serverRelativePath,
    graphRootPath,
  };
}

module.exports = { parseStreamAspxUrl };
