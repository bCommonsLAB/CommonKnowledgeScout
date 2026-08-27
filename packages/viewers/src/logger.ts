/**
 * @ks/viewers/logger.ts
 *
 * Schmale Logger-Schnittstelle des Pakets (Welle M2b, Reparatur R1).
 *
 * WARUM: Bis M2 importierte `markdown-helpers.ts` den `FileLogger` der App
 * (`@/lib/debug/logger`). Ein Paket, das zurueck in die App greift, ist nicht
 * eigenstaendig — es liesse sich weder als npm-Komponente in eine
 * Fremdanwendung einbetten (M5) noch nach Electron laden, ohne die App
 * mitzuschleppen. Genau das ist der Zweck der Modularisierung
 * (Modul-Landkarte §4: Pakete importieren NIE in die App zurueck).
 *
 * WIE: Das Paket definiert nur, WAS es vom Logger braucht. Die App reicht
 * ihre Implementierung beim Start herein. Ohne Injection wird nichts geloggt
 * (No-op) — das Paket bleibt lauffaehig, aber still.
 *
 * ABGRENZUNG: Der `FileLogger` der App laesst sich nicht hierher verschieben —
 * er haengt an einem Jotai-Atom (`@/atoms/debug-atom`) und speist das
 * Debug-Panel. Ein eigenes `@ks/util`-Paket waere fuer eine Methode
 * ueberdimensioniert.
 */

/** Was `@ks/viewers` vom Logger der Anwendung braucht — nicht mehr. */
export interface ViewerLogger {
  debug(component: string, message: string, details?: Record<string, unknown>): void
}

/** Default: still. Ein Paket ohne Injection darf nicht ins Leere greifen. */
const noopLogger: ViewerLogger = {
  debug: () => {},
}

let aktiverLogger: ViewerLogger = noopLogger

/**
 * Reicht die Logger-Implementierung der Anwendung herein. Einmal beim Start
 * aufrufen. `null` setzt auf den stillen Default zurueck (fuer Tests).
 */
export function setViewerLogger(logger: ViewerLogger | null): void {
  aktiverLogger = logger ?? noopLogger
}

/** Paket-interner Zugriff — bewusst NICHT aus `index.ts` exportiert. */
export function viewerLogger(): ViewerLogger {
  return aktiverLogger
}
