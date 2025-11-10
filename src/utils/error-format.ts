/**
 * Formatiert Chat-Fehlermeldungen für bessere Benutzerfreundlichkeit
 * 
 * Entfernt technische Details und maskiert sensible Informationen wie API-Keys.
 * Wandelt technische Fehlermeldungen in benutzerfreundliche Texte um.
 */

/**
 * Formatiert eine Fehlermeldung für die Anzeige im Chat-UI
 * 
 * @param errorMessage - Die rohe Fehlermeldung
 * @returns Formatierte, benutzerfreundliche Fehlermeldung
 */
export function formatChatError(errorMessage: string): string {
  // Prüfe auf API-Key-Fehler
  if (
    errorMessage.includes('invalid_api_key') ||
    errorMessage.includes('Incorrect API key') ||
    errorMessage.includes('Ungültiger OpenAI API-Key')
  ) {
    return 'Ungültiger OpenAI API-Key. Bitte überprüfe die API-Key-Konfiguration in den Einstellungen der Bibliothek.'
  }

  // Prüfe auf andere häufige Fehler
  if (errorMessage.includes('401') && errorMessage.includes('API key')) {
    return 'Ungültiger OpenAI API-Key. Bitte überprüfe die API-Key-Konfiguration in den Einstellungen der Bibliothek.'
  }

  // Entferne technische Details aus der Fehlermeldung für bessere Lesbarkeit
  let formatted = errorMessage

  // Entferne lange API-Key-Maskierungen
  formatted = formatted.replace(/sk-proj-\*{50,}/g, 'sk-proj-***')

  // Wenn die Meldung sehr lang ist, kürze sie
  if (formatted.length > 200) {
    formatted = formatted.substring(0, 197) + '...'
  }

  return formatted
}

