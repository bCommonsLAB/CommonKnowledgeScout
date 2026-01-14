/**
 * @fileoverview Client Helper: Shadow-Twin Modus pro Library laden
 *
 * @description
 * Im Frontend wollen wir keine MongoDB-Abhängigkeiten. Der Modus (legacy/v2) wird daher
 * über eine kleine API (GET /api/library/[libraryId]/shadow-twin-mode) abgefragt.
 *
 * @module shadow-twin
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getShadowTwinModeClient(_libraryId: string): Promise<'v2'> {
  try {
    // WICHTIG (v2-only Runtime):
    // Der Client soll KEINE Legacy-Pfade kennen. Der zentrale Resolver/Writer ist v2-only.
    // Wenn die UI das gespeicherte Config-Flag anzeigen will, soll sie direkt die
    // Route /api/library/[libraryId]/shadow-twin-mode nutzen und "legacy" als "nicht unterstützt" darstellen.
    return 'v2'
  } catch {
    return 'v2'
  }
}


