/**
 * @fileoverview Welche External-Jobs-Routen die Middleware ohne Clerk-Session durchlaesst.
 *
 * @description
 * Befund 18.11.2026: Die Middleware machte JEDEN POST unter `/api/external/jobs/`
 * oeffentlich (ausser `/stream`). Damit war auch `POST /api/external/jobs/worker`
 * anonym erreichbar — jeder konnte den Prod-Worker mit `{"action":"stop"}` anhalten.
 *
 * Seitdem gilt eine Positivliste. Durch kommt nur, wer ohne Browser-Session
 * aufrufen MUSS und dessen Route sich selbst absichert:
 *
 * | Route                                   | Aufrufer                 | Eigene Pruefung in der Route                                          |
 * |-----------------------------------------|--------------------------|-----------------------------------------------------------------------|
 * | `POST /api/external/jobs/<uuid>`        | Secretary-Callback, Self-POST (`offline-callback.ts`) | `authorizeCallback`: `callback_token` gegen `jobSecretHash`, Service-Key oder `X-Internal-Token` |
 * | `POST /api/external/jobs/<uuid>/start`  | Worker (`external-jobs-worker.ts`) | `X-Internal-Token` ODER Clerk-Session + Job gehoert der E-Mail |
 * | `POST /api/external/jobs/internal/create` | Integrationstests, Template-Lauf | nur mit `X-Internal-Token`                                     |
 *
 * Die Job-Kennung muss eine UUID sein (alle Erzeuger nutzen `crypto.randomUUID()`).
 * Das schliesst die statischen Geschwister-Routen (`worker`, `start-batch`,
 * `retry-batch`, `batches`, `counters`, `stream`) aus, ohne sie einzeln
 * aufzuzaehlen: Eine kuenftige Verwaltungsroute unter `/api/external/jobs/`
 * braucht automatisch eine Session, statt still offen zu sein.
 *
 * Bewusst ohne Clerk- und Node-Abhaengigkeit, damit die Edge-Middleware und
 * Unit-Tests die Regel direkt nutzen koennen.
 */

/** Job-Kennung wie von `crypto.randomUUID()` (8-4-4-4-12 Hex). */
const JOB_ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

const CALLBACK_PATH = new RegExp(`^/api/external/jobs/${JOB_ID}$`, 'i')
const START_PATH = new RegExp(`^/api/external/jobs/${JOB_ID}/start$`, 'i')
const INTERNAL_CREATE_PATH = '/api/external/jobs/internal/create'

/**
 * `true`, wenn die Middleware diese External-Jobs-Anfrage ohne Clerk-Session
 * durchlassen darf. Alles andere unter `/api/external/jobs/` braucht eine Session.
 */
export function isAnonymousExternalJobsRoute(method: string, path: string): boolean {
  if (method !== 'POST') return false
  return CALLBACK_PATH.test(path) || START_PATH.test(path) || path === INTERNAL_CREATE_PATH
}
