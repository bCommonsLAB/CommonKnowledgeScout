# Einstellungen (Settings)

## Zusammenfassung
Die Knowledge Scout Anwendung bietet ein umfassendes Einstellungssystem mit fünf Hauptbereichen: Bibliothek (grundlegende Einstellungen, Icon-Upload), Storage (flexible Provider-Konfiguration für Filesystem, Cloud-Dienste), Besitzer (Profilverwaltung), Benachrichtigungen und Anzeige. Alle Formulare sind mit Shadcn UI implementiert, nutzen Zod für Validierung, sind vollständig auf Deutsch lokalisiert und folgen einem einheitlichen Design-System. Die Komponenten sind als React Server Components aufgebaut, verwenden TypeScript für Typsicherheit und bieten eine optimierte Benutzerführung mit kontextsensitiven Hilfestellungen und Validierungsmeldungen.

Die Einstellungen des Knowledge Scout sind modular aufgebaut und in verschiedene Bereiche unterteilt. Jeder Bereich wird durch ein spezialisiertes Formular verwaltet.

## Übersicht der Einstellungsbereiche

### 1. Bibliothek (`/settings`)
- **Komponente**: `LibraryForm`
- **Zweck**: Grundlegende Bibliothekseinstellungen
- **Felder**:
  - Name (Text)
  - URL-Kurzname (Text)
  - Beschreibung (Textarea)
  - Sprache (Select: Deutsch, Englisch, Französisch, Spanisch, Italienisch)
  - Bibliotheks-Icon (Bildupload)
- **Besonderheiten**:
  - Bildvorschau für hochgeladene Icons
  - Automatische URL.createObjectURL-Bereinigung
  - Validierung aller Pflichtfelder

### 2. Storage (`/settings/storage`)
- **Komponente**: `StorageForm`
- **Zweck**: Konfiguration des Dateispeicher-Providers
- **Provider-Optionen**:
  1. Lokales Dateisystem
     - Basispfad
  2. OneDrive
     - Client ID
     - Client Secret
     - Redirect URI
  3. Google Drive
     - Client ID
     - Client Secret
     - Redirect URI
  4. NextCloud
     - Server URL
     - Benutzername
     - Passwort
- **Besonderheiten**:
  - Dynamische Formularfelder je nach Provider
  - Sichere Passwortfelder
  - Provider-spezifische Validierung

### 3. Besitzer (`/settings/owner`)
- **Komponente**: `OwnerForm`
- **Zweck**: Verwaltung der Bibliotheksbesitzer
- **Felder**:
  - E-Mail (Read-only, von Auth übernommen)
  - Über mich (Textarea)
  - URLs/Links (dynamisch erweiterbar)
- **Besonderheiten**:
  - @mentions Support
  - Dynamische URL-Liste

### 4. Benachrichtigungen (`/settings/notifications`)
- **Komponente**: `NotificationsForm`
- **Zweck**: E-Mail und Push-Benachrichtigungseinstellungen

### 5. Anzeige (`/settings/display`)
- **Komponente**: `DisplayForm`
- **Zweck**: Anzeigeoptionen und Darstellung

## Technische Details

### Gemeinsame Eigenschaften
- Alle Formulare nutzen Shadcn UI Komponenten
- Vollständig auf Deutsch lokalisiert
- Zod Schema Validierung
- React Server Components wo möglich
- Client-Komponenten nur für interaktive Elemente

### Formularstruktur
```typescript
// Beispiel eines Formularschemas
const formSchema = z.object({
  field: z.string({
    required_error: "Bitte füllen Sie dieses Feld aus.",
  }),
})

// Komponenten-Aufbau
export function SettingsForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })
  // ...
}
```

### Validierung
- Pflichtfelder-Prüfung
- URL-Validierung
- E-Mail-Format-Prüfung
- Dateityp-Validierung bei Uploads
- Spezifische Provider-Validierung

### Sicherheit
- Sichere Behandlung von Anmeldeinformationen
- Verschlüsselte Übertragung sensibler Daten
- OAuth2 für Cloud-Storage-Provider

## Best Practices
1. **Formularvalidierung**
   - Clientseitige Validierung für schnelles Feedback
   - Serverseitige Validierung für Sicherheit

2. **Fehlerbehandlung**
   - Benutzerfreundliche Fehlermeldungen
   - Detaillierte Validierungshinweise

3. **UI/UX**
   - Konsistentes Design
   - Responsive Layout
   - Klare Beschreibungen und Hilfestellungen

4. **Performance**
   - Lazy Loading wo sinnvoll
   - Optimierte Bildverarbeitung
   - Effizientes State Management

## Zukünftige Erweiterungen
- [ ] Weitere Storage-Provider (S3, Azure)
- [ ] Erweiterte Benutzerrechte
- [ ] Backup-Einstellungen
- [ ] API-Zugriffsmanagement

## Fehlerbehebung
Häufige Probleme und deren Lösungen:
1. **Provider-Wechsel**: Bei Änderung des Storage-Providers wird das Formular zurückgesetzt
2. **Bildupload**: Große Dateien werden automatisch komprimiert
3. **Validierung**: Detaillierte Fehlermeldungen helfen bei der Korrektur 