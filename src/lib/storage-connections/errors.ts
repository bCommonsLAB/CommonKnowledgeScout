/**
 * Fehlerklassen der Speicher-Verbindungen; die Routen bilden sie auf
 * Status-Codes ab (400 Eingabe, 404 nicht gefunden, 409 in Benutzung).
 */

export class StorageConnectionInputError extends Error {
  readonly status = 400
  constructor(message: string) {
    super(message)
    this.name = 'StorageConnectionInputError'
  }
}

export class StorageConnectionNotFoundError extends Error {
  readonly status = 404
  constructor(id: string) {
    super(`Speicher-Verbindung nicht gefunden: ${id}`)
    this.name = 'StorageConnectionNotFoundError'
  }
}

export class StorageConnectionInUseError extends Error {
  readonly status = 409
  constructor(labels: string[]) {
    super(`Verbindung wird noch benutzt von: ${labels.join(', ')}. Erst die Libraries umhaengen, dann loeschen.`)
    this.name = 'StorageConnectionInUseError'
  }
}

/** Status aus einem Fehler der Verbindungs-Schicht; 500 fuer alles andere. */
export function storageConnectionErrorStatus(error: unknown): number {
  if (
    error instanceof StorageConnectionInputError ||
    error instanceof StorageConnectionNotFoundError ||
    error instanceof StorageConnectionInUseError
  ) {
    return error.status
  }
  return 500
}
