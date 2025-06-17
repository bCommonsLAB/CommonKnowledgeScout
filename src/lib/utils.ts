import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(size?: number): string {
  if (!size) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDateTime(date: Date | string): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Gibt eine benutzerfreundliche Fehlermeldung für bekannte Fehlerfälle bei Audio-Transformationen zurück.
 * @param error - Das Fehlerobjekt (meist Error oder unknown)
 * @returns Eine für den Nutzer verständliche Fehlermeldung (deutsch)
 */
export function getUserFriendlyAudioErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("ECONNREFUSED"))
      return "Der Audio-Service ist nicht erreichbar. Bitte prüfen Sie die Verbindung oder starten Sie den Service neu.";
    if (error.message.includes("fetch failed"))
      return "Die Verbindung zum Audio-Service ist fehlgeschlagen. Bitte prüfen Sie Ihre Netzwerkverbindung.";
    if (error.message.includes("Failed to fetch"))
      return "Die Verbindung zum Server konnte nicht hergestellt werden. Bitte versuchen Sie es später erneut.";
    if (error.message.includes("Datei konnte nicht geladen werden"))
      return "Die Audiodatei konnte nicht geladen werden. Bitte prüfen Sie die Datei und versuchen Sie es erneut.";
    return error.message;
  }
  return "Unbekannter Fehler bei der Transkription. Bitte versuchen Sie es später erneut.";
}

// Navigation Logger für besseres Debugging
export class NavigationLogger {
  private static sequence = 0;

  static log(component: string, event: string, details?: any) {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString().split('T')[1];
      console.log(`[${timestamp}][Nav:${++this.sequence}][${component}] ${event}`, details || '');
    }
  }

  static warn(component: string, event: string, details?: any) {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString().split('T')[1];
      console.warn(`[${timestamp}][Nav:${++this.sequence}][${component}] ⚠️ ${event}`, details || '');
    }
  }

  static error(component: string, event: string, error?: any) {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString().split('T')[1];
      console.error(`[${timestamp}][Nav:${++this.sequence}][${component}] 🔴 ${event}`, error || '');
    }
  }
}
