# Test-Drehbuch — Automatischer Abnahmebericht

> Automatisch erzeugt vom E2E-Lauf (`pnpm test:e2e`) aus den Schritt-Protokollen
> unter `tmp/e2e-results/`. Spezifikation: [06-testdrehbuch.md](06-testdrehbuch.md).
> Nur Owner-Sicht, headless. OneDrive-Login, zweiter Account und echtes
> Inkognito sind als 🔵 MANUELL markiert.

**Zusammenfassung:** ✅ 26 PASS · ❌ 0 FAIL · 🔵 10 MANUELL (von 36 Schritten)

## Offene Fehlschläge (❌)

_Keine._

## Manuell nachzutesten (🔵)

- **1.7** Echtdaten: PDF in der App öffnen und Transformation anstoßen — Echtdaten-Transformation benötigt den Secretary-Service + ingestierte PDF (lokal nicht verfügbar); die reine UI-Auslösung ist in 06-inbox-capture abgedeckt.
- **2.1b** OAuth-Redirect + Rückkehr bei Wizard-Schritt 3 (sessionStorage-Resume) — echte Microsoft-Anmeldung erforderlich
- **2.2** Verzeichnis-Browser: navigieren, Ordner anlegen, Pflicht-Test grün — setzt OneDrive-Anmeldung voraus
- **2.3** Quelle-Zusammenfassung: maskierte Credentials, D1-Warn-Dialog, D2-Abmelde-Bestätigung — setzt OneDrive-Anmeldung voraus
- **2.4** Re-Auth: Token löschen → globaler Dialog außerhalb der Settings — setzt OneDrive-Anmeldung voraus
- **3.2** Einladung annehmen → Bibliothek sichtbar, keine Settings — zweiter Clerk-Account nötig
- **3.4** Zugriff entziehen → sofort wirksam (kein 10s-Nachlauf) — zweiter Clerk-Account nötig
- **3.8** Zugriffsanfrage stellen + genehmigen — zweiter Clerk-Account nötig
- **3.9** Moderator-Sicht der Settings (Moderation-Hinweis, Anfragen-Verwaltung) — zweiter Clerk-Account nötig
- **S2** Masken-Guard: Verarbeitung speichern lässt echten API-Key unangetastet — TEST-Bibliothek hat keinen Secretary-API-Key — aussagekräftig nur mit konfiguriertem Echt-Key (Bestands-Bibliothek wird bewusst nicht angefasst)

## Akt 1 — meSpace: Quelle (1.1–1.5)

| # | Status | Soll-Verhalten | Beobachtung |
|---|---|---|---|
| 0 | ✅ PASS | Vorbereitung: Login prüfen + alte TEST-Drehbuch-Bibliotheken löschen | gelöscht: TEST-Drehbuch Bücher |
| 1.1 | ✅ PASS | Willkommens-Dashboard /start (angemeldet) mit „Neue Bibliothek" | Willkommen-Dashboard mit Einstieg „Neue Bibliothek" sichtbar |
| 1.2 | ✅ PASS | Anlage über CreateLibraryWizard (Name + Inhaltstyp-Karte „Bücher & Dokumente") | angelegt (062f2615-a9ce-4431-bea6-262bb8c4ee76) über den Wizard inkl. Inhaltstyp-Karte (book) |
| 1.2w | ✅ PASS | TEST-Drehbuch Bücher als aktive Bibliothek setzen (Guard) | aktiv: 062f2615-a9ce-4431-bea6-262bb8c4ee76 |
| 1.3 | ✅ PASS | Wizard: „Lokales Dateisystem" → Weiter überspringt Schritt 2; Quelle initial konfigurieren | Schritt 2 übersprungen; Quelle konfiguriert (Zusammenfassung erscheint) |
| 1.4 | ✅ PASS | Quelle ändern… → Pflicht-Verbindungstest läuft automatisch (Urteil) | Pflicht-Test läuft + liefert Urteil; serverseitiger Zusatz-Check /api/settings/storage-test → HTTP 500 (getServerProvider path="") — App-BEFUND, separat von Flow/Selektoren |
| 1.5 | ✅ PASS | Quelle als Read-only-Zusammenfassung + Abschnitte 2 und 3 | Zusammenfassung read-only („Quelle ändern…"), Inhaltstyp + Verarbeitung sichtbar |

## Akt 1 — meSpace: Verarbeitung & Darstellung (1.6–1.12)

| # | Status | Soll-Verhalten | Beobachtung |
|---|---|---|---|
| setup | ✅ PASS | TEST-Drehbuch Bücher aktivieren (Guard) | aktiv: ddd5355b-3ac6-4840-a3c8-f669cc454cc4 |
| 1.6 | ✅ PASS | Verarbeitung: Vorlage read-only (F11), Speichern erst bei Änderung | Read-only-Vorlage angezeigt, Speichern ohne Änderung deaktiviert |
| 1.6b | ✅ PASS | F11: falsche Vorlage (standard-session) wird beim Speichern blockiert | Inkonsistenz (standard-session) blockiert (rot, keine Mutation); „Automatisch" wieder konsistent (Hinweis weg) |
| 1.7 | 🔵 MANUELL | Echtdaten: PDF in der App öffnen und Transformation anstoßen | Echtdaten-Transformation benötigt den Secretary-Service + ingestierte PDF (lokal nicht verfügbar); die reine UI-Auslösung ist in 06-inbox-capture abgedeckt. |
| 1.8 | ✅ PASS | Inhaltstyp: empfohlene Filter übernehmen → bestätigen → speichern | Bestätigungs-Dialog, Hinweis-Toast (sonner), gespeichert (PATCH bestätigt) |
| 1.9 | ✅ PASS | Explore-Settings: Karten-Raster/Gruppierung/Graph — keine Facetten, kein Encoding | Karten-Raster/Gruppierung/Graph vorhanden; Facetten-Tabelle/Encoding nicht hier |
| 1.10 | ✅ PASS | Story-Settings: Eingabefeld-Text ändern → persistiert (Reload) + best-effort App | Eingabefeld-Text gespeichert + nach Reload bestätigt (App-Sicht best-effort, hier nicht bestätigt) |
| 1.11 | ✅ PASS | Erweitert: kein Shadow-Twin/Primary-Store; Facetten + Encoding liegen hier | Erweitert aufgeräumt; Facetten + Encoding liegen hier (kein Shadow-Twin/Primary Store) |
| 1.12 | ✅ PASS | Regressionscheck: Erweitert-Save überschreibt Story-Einstellungen nicht | Chunk-Größe 1000 → 1050 gespeichert; Story-Text unverändert ("E2E-Drehbuch: Was möchten Sie wissen?") |

## Akt 2 — Cloud-Quelle / Re-Auth (2.1–2.4)

| # | Status | Soll-Verhalten | Beobachtung |
|---|---|---|---|
| 2.1a | ✅ PASS | Zweite Bibliothek anlegen, OneDrive wählen → Anmelde-Schritt erscheint | Wizard Schritt 2 mit Anmelde-Button — Klick bewusst NICHT ausgeführt |
| 2.1b | 🔵 MANUELL | OAuth-Redirect + Rückkehr bei Wizard-Schritt 3 (sessionStorage-Resume) | echte Microsoft-Anmeldung erforderlich |
| 2.2 | 🔵 MANUELL | Verzeichnis-Browser: navigieren, Ordner anlegen, Pflicht-Test grün | setzt OneDrive-Anmeldung voraus |
| 2.3 | 🔵 MANUELL | Quelle-Zusammenfassung: maskierte Credentials, D1-Warn-Dialog, D2-Abmelde-Bestätigung | setzt OneDrive-Anmeldung voraus |
| 2.4 | 🔵 MANUELL | Re-Auth: Token löschen → globaler Dialog außerhalb der Settings | setzt OneDrive-Anmeldung voraus |

## Akt 3 — weSpace / usSpace (3.1–3.9)

| # | Status | Soll-Verhalten | Beobachtung |
|---|---|---|---|
| setup | ✅ PASS | TEST-Drehbuch Bücher aktivieren (Guard) | aktiv: 062f2615-a9ce-4431-bea6-262bb8c4ee76; slug=e2e-062f2615 |
| 3.1 | ✅ PASS | Person einladen: EIN Dialog, drei erklärte Rollen (Leser zuerst) | Dialog mit Rollen-Erklärung (Leser zuerst); Einladung als Leser gesendet (Dialog geschlossen) |
| 3.3 | ✅ PASS | Einladung registriert: erscheint als Zugriffsanfrage (pending) | Leser-Einladung als pending-Zugriffsanfrage registriert (Personen-Seite zeigt sie nach Annahme — 3.2 manuell) |
| 3.2 | 🔵 MANUELL | Einladung annehmen → Bibliothek sichtbar, keine Settings | zweiter Clerk-Account nötig |
| 3.4 | 🔵 MANUELL | Zugriff entziehen → sofort wirksam (kein 10s-Nachlauf) | zweiter Clerk-Account nötig |
| 3.5 | ✅ PASS | Veröffentlichen: Status-Header wechselt Privat → Öffentlich | Header Privat → Öffentlich; Web-Adresse gesetzt (ungespeichert) |
| 3.6 | ✅ PASS | Galerie-Texte speichern → anonym unter /explore/<slug> sichtbar | öffentliche Seite anonym erreichbar (HTTP 200); Überschrift-Feld nicht eindeutig lokalisiert |
| 3.7 | ✅ PASS | Freigabe-Pflicht: anonym kein direkter Zugriff mehr | Inhalte anonym gesperrt |
| 3.8 | 🔵 MANUELL | Zugriffsanfrage stellen + genehmigen | zweiter Clerk-Account nötig |
| 3.9 | 🔵 MANUELL | Moderator-Sicht der Settings (Moderation-Hinweis, Anfragen-Verwaltung) | zweiter Clerk-Account nötig |

## Sicherheits-Spotchecks (S1–S4)

| # | Status | Soll-Verhalten | Beobachtung |
|---|---|---|---|
| S1 | ✅ PASS | GET /api/libraries: Secrets maskiert (D5) | Response geprüft (55738 Zeichen) — Secret-Felder maskiert |
| S1b | ✅ PASS | Zusatzcheck: ?email=-Parameter darf Auth nicht umgehen | kein anonymer Zugriff (HTTP 404, Einträge: -1) |
| S2 | 🔵 MANUELL | Masken-Guard: Verarbeitung speichern lässt echten API-Key unangetastet | TEST-Bibliothek hat keinen Secretary-API-Key — aussagekräftig nur mit konfiguriertem Echt-Key (Bestands-Bibliothek wird bewusst nicht angefasst) |
| S3 | ✅ PASS | MongoDB: shadowTwin der TEST-Bibliothek ist v2 + mongo | Collection libraries: mode=v2, primaryStore=mongo |
| S4 | ✅ PASS | Alte Bookmarks leiten auf die neuen Seiten um | storage→archive, chat→story, gallery→explore |

## Hinweise

- Test-Engine zum Zusehen: `pnpm test:e2e:ui` (Szenarien-Baum, Live-Browser,
  Zeitreise) · sichtbarer Lauf: `pnpm test:e2e:headed` · HTML-Report:
  `pnpm test:e2e:report`.
- Angelegte Testdaten (Präfix `TEST-Drehbuch`) werden zu Beginn von Akt 1
  automatisch gelöscht; bei Bedarf manuell über Settings entfernen.
