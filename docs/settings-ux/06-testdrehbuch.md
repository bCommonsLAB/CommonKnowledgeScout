# Test-Drehbuch: Settings-UX mit Echtdaten (lokal, übers Frontend)

Stand 2026-06-12. Manuelle Abnahme der Wellen 3-IV-UX-0 bis -5 als
durchgehendes Szenario: **„Petra baut eine Bibliothek von Null bis zur
Veröffentlichung."** Jeder Schritt hat ein Soll-Verhalten zum Abhaken.

## Vorbereitung (einmalig)

```bash
pnpm install --frozen-lockfile
pnpm dev          # → http://localhost:3000
```

- `.env` prüfen: MongoDB-URI, Clerk-Keys; optional Azure (Thumbnails),
  Secretary-Service (Verarbeitung), Mailjet (Einladungs-Mails).
- **Drei Sichten bereithalten:** (1) Owner = Ihr Account, (2) zweiter
  Clerk-Test-Account für Leser/Moderator, (3) Inkognito-Fenster für anonym.
- Echtdaten: ein lokaler Ordner mit 3–5 echten PDFs/Interviews.
- Browser: Konsole + Network-Tab offen lassen (keine roten Fehler, keine 4xx
  außer erwarteten 401/403).
- Tipp: `/settings?newUser=true` erzwingt den Willkommens-Flow auch mit
  bestehenden Libraries.

## Akt 1 — meSpace: Von Null zur gefüllten Bibliothek (Owner)

| # | Schritt | Soll-Verhalten |
|---|---|---|
| 1.1 | `/settings?newUser=true` | Willkommens-Screen mit EINER CTA „Erste Bibliothek erstellen" (keine Lokal/Cloud-Scheinwahl) |
| 1.2 | CTA → Name eingeben + Inhaltstyp-Karte „Bücher & Dokumente" → „Bibliothek erstellen" | Nur Name + Typ nötig; danach automatische Weiterleitung ins **Archive** |
| 1.3 | Archive: Quelle-Wizard Schritt 1 „Lokales Dateisystem" → Weiter | Schritt 2 (Anmelden) wird übersprungen, direkt Schritt 3 |
| 1.4 | Pfad zum PDF-Ordner eingeben → „Übernehmen & Verbindung testen" | Schritt 4 startet den Test automatisch; grünes „Verbindung funktioniert"; „Fertig" erst bei Grün aktiv |
| 1.5 | Nach „Fertig" | Quelle als Read-only-Zusammenfassung; Abschnitte 2 (Inhaltstyp) + 3 (Verarbeitung — „Ihr Journalist-Moment") sichtbar |
| 1.6 | Abschnitt 3 „Verarbeitung — Ihr Journalist-Moment" ansehen | Vorlage ist READ-ONLY: „Automatisch: Standard für „Bücher & Dokumente"" (F11 — keine Auswahl mehr im Archiv); Zielsprache/Cover änderbar, „Verarbeitung speichern" nur bei Änderungen aktiv |
| 1.6b | **F11-Check:** Erweitert → „Vorlage (Journalist)": absichtlich `standard-session` wählen → „Verarbeitung speichern" | Live-Hinweis wird rot; Speichern wird mit Toast „Vorlage passt nicht zum Inhaltstyp" BLOCKIERT; zurück auf „Automatisch" → speichert |
| 1.7 | **Echtdaten:** In der App (Archive-Hauptnavigation) ein PDF öffnen und transformieren | Verarbeitung läuft mit der gewählten Vorlage; Ergebnis erscheint als Inhaltstyp |
| 1.8 | Settings → Archive → Inhaltstyp: „Empfohlene Filter übernehmen" → bestätigen → „Inhaltstyp speichern" | Bestätigungs-Dialog; Toast „Bitte speichern…"; danach unter **Explore** sichtbar |
| 1.9 | Explore-Seite (Settings) + Explore in der App | Dichte/Gruppierung/Graph-Schalter (KEINE Facetten-Tabelle, KEIN Encoding); Galerie zeigt die Filter |
| 1.10 | Story (Settings): Texte/Tonfall ändern → „Story-Einstellungen speichern" → Story-Modus in der App | Eingabefeld-Texte und Antwort-Tonfall entsprechen den Einstellungen |
| 1.11 | Erweitert: Sektion „Dateisystem-Optionen" | KEIN „Shadow-Twin-Modus"-Block, KEIN „Primary Store"-Dropdown; Facetten-Tabelle + Graph-Encoding liegen HIER |
| 1.12 | **Regressionscheck:** In Erweitert Chunk-Größe ändern + speichern → Inhaltstyp/Story-Texte prüfen | Unverändert (kein Bereich überschreibt den anderen) |

## Akt 2 — Cloud-Quelle + Re-Auth (Experten-Pfad, Owner)

| # | Schritt | Soll-Verhalten |
|---|---|---|
| 2.1 | Zweite Library anlegen → Archive → Quelle: „Microsoft OneDrive" → „Bei OneDrive anmelden" | Redirect zu Microsoft; nach Rückkehr steht der Wizard bei **Schritt 3** (sessionStorage-Resume) |
| 2.2 | Verzeichnis-Browser: navigieren, Ordner anlegen, wählen → Test | Breadcrumb + Ordnerliste statt Freitext; Pflicht-Test grün |
| 2.3 | Quelle-Zusammenfassung | Credentials read-only/maskiert; „Quelle ändern…" zeigt Warn-Dialog (D1); „Abmelden" verlangt Bestätigung (D2) |
| 2.4 | **Re-Auth-Test:** DevTools → localStorage → `onedrive_tokens_<libraryId>` löschen → App-Archive öffnen | Globaler Dialog „Anmeldung erforderlich" erscheint AUSSERHALB der Settings; „Bei OneDrive anmelden" → zurück zur Ausgangsseite, Zugriff funktioniert |

## Akt 3 — weSpace + usSpace (Owner + Account 2 + Inkognito)

| # | Schritt | Soll-Verhalten |
|---|---|---|
| 3.1 | weSpace → Personen: „Person einladen" → Rolle **Leser** (+ Nachricht) an Account 2 | EIN Dialog, drei erklärte Rollen (Leser zuerst); Toast; ohne Mailjet: Einladung wird trotzdem angelegt (Annahme-Link dann aus `library_access_requests`) |
| 3.2 | Account 2: Einladungslink annehmen | Account 2 sieht die Bibliothek (Explore/Story), KEINE Settings |
| 3.3 | Owner: Personen-Seite → Tabelle „Leser" | Account 2 erscheint mit „Zugriff seit" |
| 3.4 | „Entziehen" → bestätigen → Account 2 lädt die Bibliothek neu | **Sofort** kein Zugriff mehr (D4-Fix: kein 10s-Nachlauf) |
| 3.5 | usSpace → Öffentlicher Auftritt: Status-Header beobachten, dann „Library veröffentlichen" + Web-Adresse | Header wechselt Privat → „Öffentlich" (+ „ungespeicherte Änderungen" bis zum Speichern) |
| 3.6 | Galerie-Texte (Überschrift/Untertitel/Einleitung/Filter-Erklärung) eintragen → „Veröffentlichung speichern" | Inkognito: `/explore/<slug>` zeigt GENAU diese Texte (E2-Fix) |
| 3.7 | „Zugriff nur für freigegebene Benutzer" aktivieren + speichern | Header „Öffentlich mit Freigabe"; Inkognito sieht die Inhalte nicht mehr direkt, sondern den Anfrage-Weg |
| 3.8 | Account 2 stellt Zugriffsanfrage → Owner: Zugriffsanfragen → Genehmigen | Account 2 hat Zugriff; Anfrage erscheint im „Genehmigt"-Filter UND als Leser auf der Personen-Seite |
| 3.9 | **Moderator-Test:** Account 2 als Moderator einladen → Account 2 öffnet `/settings` | Statt Gast-Redirect: „Moderation"-Hinweis + Sidebar-Gruppe „Moderation" mit Zugriffsanfragen; „Leser einladen" funktioniert dort |

## Sicherheits-Spotchecks (Network-Tab, Owner)

| # | Check | Soll |
|---|---|---|
| S1 | GET `/api/libraries?email=…` → Response inspizieren | `secretaryService.apiKey` maskiert (`abc….................xyz`), `ingestionStorage.connectionString` = `********`, `clientSecret`/`appPassword` = `********` (D5) |
| S2 | Erweitert → „Verarbeitung speichern" OHNE den API-Key anzufassen → danach ein Dokument verarbeiten | Verarbeitung funktioniert weiter (Masken-Guard hat den echten Key behalten) |
| S3 | Nach einem beliebigen Library-Save: MongoDB `shadowTwin` ansehen | `mode: "v2"`, `primaryStore: "mongo"` (Alt-Configs normalisiert) |
| S4 | Alte Bookmarks: `/settings/storage`, `/settings/chat`, `/settings/gallery` | Leiten auf Archive/Story/Explore weiter |

## Bekannte Grenzen (kein Bug beim Testen)

- Ohne Mailjet keine E-Mails — Einladungen existieren trotzdem (DB).
- Ohne Azure zeigt der Thumbnail-Block in „Erweitert" Fehler beim
  „Statistik laden" — erwartbar.
- F7 (Index-Automatisierung) und D7 (Server-Token-Check) sind bewusst
  offen — Index-Anlage weiterhin manuell unter Erweitert.
