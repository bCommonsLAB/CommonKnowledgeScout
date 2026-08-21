/**
 * @fileoverview Request-Kontext der MCP-Bruecke: der handelnde User.
 *
 * @description
 * Mit Account-Keys (Stufe 2) handelt jeder Request als der User seines Keys —
 * die Werkzeuge sind aber EINMAL registriert (createMcpHandler, Modul-Scope)
 * und koennen den User nicht als Parameter bekommen. AsyncLocalStorage
 * traegt ihn vom Auth-Check der Route bis in die Werkzeug-Aufrufe.
 *
 * Kein stiller Fallback: Ausserhalb eines Request-Kontexts wirft
 * `currentMcpUserEmail` — die Route setzt den Kontext IMMER (auch fuer den
 * Legacy-Env-Key, dort mit `MCP_USER_EMAIL`).
 *
 * @module mcp
 */

import { AsyncLocalStorage } from 'node:async_hooks'

const storage = new AsyncLocalStorage<{ userEmail: string }>()

/** Fuehrt `fn` mit dem handelnden User aus (Route, nach erfolgreicher Auth). */
export function runWithMcpUser<T>(userEmail: string, fn: () => T): T {
  const email = userEmail.trim()
  if (email === '') throw new Error('MCP-Kontext: userEmail ist leer')
  return storage.run({ userEmail: email }, fn)
}

/** Der User des laufenden MCP-Requests; wirft ausserhalb des Kontexts. */
export function currentMcpUserEmail(): string {
  const context = storage.getStore()
  if (!context) {
    throw new Error('MCP-Kontext fehlt — Werkzeug ausserhalb eines authentifizierten Requests aufgerufen')
  }
  return context.userEmail
}
