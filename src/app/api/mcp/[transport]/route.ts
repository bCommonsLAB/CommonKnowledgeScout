/**
 * @fileoverview MCP-Bruecke (Welle 5): KnowledgeScout als MCP-Server.
 *
 * @description
 * Streamable-HTTP-Endpunkt unter `/api/mcp/mcp` (mcp-handler, basePath
 * `/api/mcp`). Werkzeuge: `src/lib/mcp/tools.ts` — duenn ueber den
 * bestehenden Services (Coverage-Scan, Sync-Engine-Presets). Szenario und
 * Leitplanken: `docs/concepts/welle-5-mcp-testszenario.md`.
 *
 * Auth VOR dem Handler: Bearer-Key gegen `MCP_API_KEY`, der Key handelt als
 * `MCP_USER_EMAIL` (Pilot: ein Key ↔ ein User). Ohne Konfiguration ist die
 * Bruecke ZU (503), nicht offen. SSE-Transport ist bewusst nicht
 * konfiguriert (kein Redis) — moderne Clients nutzen Streamable HTTP;
 * stdio-Clients gehen ueber `mcp-remote`.
 *
 * @module api/mcp
 */

import { createMcpHandler } from 'mcp-handler'
import { checkMcpRequestAuth, mcpAuthFailureResponse } from '@/lib/mcp/auth'
import { registerKnowledgeScoutTools } from '@/lib/mcp/tools'

/** Grosszuegig: Coverage-Scans und Engine-Laeufe koennen Minuten dauern. */
export const maxDuration = 600

const handler = createMcpHandler(
  (server) => {
    registerKnowledgeScoutTools(server)
  },
  { serverInfo: { name: 'knowledgescout', version: '1.0.0' } },
  {
    basePath: '/api/mcp',
    maxDuration,
  },
)

async function authenticated(request: Request): Promise<Response> {
  const auth = checkMcpRequestAuth(request)
  if (!auth.ok) return mcpAuthFailureResponse(auth.reason)
  return handler(request)
}

export { authenticated as GET, authenticated as POST, authenticated as DELETE }
