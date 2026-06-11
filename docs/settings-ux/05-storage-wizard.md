# Speicherort-Wizard (Festlegungen F1–F4, User-Review 2026-06-11)

Der Speicherort wird vom frei editierbaren Formular zum **geführten Wizard**.
Motivation: Die häufigsten Fehler heute entstehen (a) beim Anmelden am Storage
(OneDrive-Token läuft ab, User steht nach Tagen ohne Zugriff da) und (b) beim
Freitext-Pfad (Tippfehler, unklares Format je Provider).

## Wizard-Schritte

```
1 Provider wählen ──► 2 Anmelden ──► 3 Verzeichnis wählen ──► 4 Abschluss-Test
   (Lokal /             (provider-       (Browser aus            (automatisch,
    OneDrive /           spezifisch)      Storage-Listing,         Pflicht — erst
    Nextcloud)                            KEIN Freitext)           grün = fertig)
```

**Schritt 1 — Provider wählen.** Lokal / OneDrive / Nextcloud. Google Drive
wird entfernt (F4: Attrappe ohne Backend — User-Entscheid 2026-06-11).

**Schritt 2 — Anmelden (provider-spezifisch).**
- *Lokal:* entfällt, weiter zu Schritt 3.
- *OneDrive:* OAuth-Flow. App-Zugangsdaten (Tenant/Client/Secret) kommen aus
  den System-Defaults (`GET /api/settings/oauth-defaults`) und sind im Wizard
  unsichtbar; nur ein „Erweitert"-Aufklapper erlaubt eigene App-Registrierung.
- *Nextcloud:* WebDAV-URL, Benutzername, App-Passwort — mit Inline-Anleitung
  (wo erzeuge ich ein App-Passwort) und URL-Format-Validierung mit Feedback.

**Schritt 3 — Wurzelverzeichnis wählen.** Verzeichnis-Browser über das
Provider-Listing (die Provider-API kann das bereits — der Storage-Test macht
heute schon Root-Listings). Kein Freitext-Pfad mehr. Anlegen eines neuen
Ordners direkt im Browser erlauben.

**Schritt 4 — Abschluss-Test.** Der bisherige „Storage testen"-Button entfällt
als separater Schritt: Der Wizard schließt IMMER mit dem Verbindungstest ab
(Listing, Testordner anlegen, Datei schreiben/lesen/löschen). Ergebnis
laienverständlich („Verbindung funktioniert") statt roher Step-Logs; Details
nur im Aufklapper. Erst nach grünem Test gilt der Speicherort als eingerichtet.

## Re-Auth-Flow (F2) — extrahiert und app-weit

Der Anmelde-Schritt (2) wird als eigenständiger, wiederverwendbarer Flow
extrahiert:

- **Trigger Settings:** Button „Neu anmelden" auf der Speicherort-Seite.
- **Trigger app-weit:** Beliebiger Storage-Zugriff scheitert an
  abgelaufenem/ungültigem Token (z.B. Einstieg nach 2 Tagen Inaktivität)
  → Dialog „Anmeldung bei OneDrive erforderlich" startet NUR Schritt 2,
  danach kehrt der User zur Ausgangsaktion zurück. Kein Settings-Besuch nötig.
- Voraussetzung: Token-Gültigkeit wird server-seitig geprüft (heute nur
  `localStorage`-Expiry, siehe [04-veraltet-defekte.md](04-veraltet-defekte.md) D7).

## Nach der Einrichtung: Read-only-Zusammenfassung (F3)

Die Speicherort-Seite zeigt nach Wizard-Abschluss nur noch:

| Element | Verhalten |
|---|---|
| Provider, gewähltes Verzeichnis, Verbindungsstatus | Anzeige |
| Tenant/Client/Secret bzw. WebDAV-User/App-Passwort | read-only, maskiert |
| Aktion „Neu anmelden" | startet Re-Auth-Flow (nur Schritt 2) |
| Aktion „Speicherort ändern" | startet Wizard komplett neu — mit Warnung bei bestehenden Daten (löst Risiko D1: heute Typ-Wechsel ohne Warnung) |

Credentials sind also nur noch über einen vollständigen Wizard-Durchlauf
änderbar — nie mehr einzeln im Formular.

## Abdeckung der Ist-Risiken

| Risiko (04 / D) | Lösung im Wizard |
|---|---|
| D1 Storage-Wechsel ohne Warnung | „Speicherort ändern" = bewusster Wizard-Neustart mit Warn-Schritt |
| D2 Abmelden ohne Bestätigung | Abmelden nur in Read-only-Ansicht, mit Bestätigung + Hinweis auf Folgen |
| D7 Token-Status nur localStorage | Server-Check + app-weiter Re-Auth-Trigger |
| B4 Google-Drive-Attrappe | entfällt aus Provider-Auswahl (F4) |
