/**
 * @fileoverview MCP-Bruecke (Welle 5): KnowledgeScout als MCP-Server.
 *
 * @description
 * Streamable-HTTP-Endpunkt unter `/api/mcp/mcp` (mcp-handler, basePath
 * `/api/mcp`). Werkzeuge: `src/lib/mcp/tools.ts` — duenn ueber den
 * bestehenden Services (Coverage-Scan, Sync-Engine-Presets). Szenario und
 * Leitplanken: `docs/concepts/welle-5-mcp-testszenario.md`.
 *
 * Auth VOR dem Handler (Stufe 2): Legacy-Env-Key ODER signierter
 * Account-Key aus der Datenbank (`auth.ts`); der Request handelt als der
 * aufgeloeste User (AsyncLocalStorage, `request-context.ts`). Ohne
 * Konfiguration ist die Bruecke ZU (503), nicht offen. SSE-Transport ist bewusst nicht
 * konfiguriert (kein Redis) — moderne Clients nutzen Streamable HTTP;
 * stdio-Clients gehen ueber `mcp-remote`.
 *
 * @module api/mcp
 */

import { createMcpHandler } from 'mcp-handler'
import { checkMcpRequestAuthWithAccountKeys, mcpAuthFailureResponse } from '@/lib/mcp/auth'
import { runWithMcpUser } from '@/lib/mcp/request-context'
import { registerKnowledgeScoutTools } from '@/lib/mcp/tools'
import { TOOLSET_VERSION } from '@/lib/mcp/tools-info'

/** Grosszuegig: Coverage-Scans und Engine-Laeufe koennen Minuten dauern. */
export const maxDuration = 600

const handler = createMcpHandler(
  (server) => {
    registerKnowledgeScoutTools(server)
  },
  // A2: Version = Werkzeugsatz-Version — macht veraltete Client-Toollisten im Handshake sichtbar.
  { serverInfo: { name: 'knowledgescout', version: TOOLSET_VERSION } },
  {
    basePath: '/api/mcp',
    maxDuration,
  },
)

async function authenticated(request: Request): Promise<Response> {
  const auth = await checkMcpRequestAuthWithAccountKeys(request)
  if (!auth.ok) return mcpAuthFailureResponse(auth.reason)
  return runWithMcpUser(auth.userEmail, () => handler(request))
}

export { authenticated as GET, authenticated as POST, authenticated as DELETE }
