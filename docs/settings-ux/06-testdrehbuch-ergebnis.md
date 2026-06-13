# Test-Drehbuch — Automatischer Abnahmebericht

> Automatisch erzeugt vom E2E-Lauf (`pnpm test:e2e`) aus den Schritt-Protokollen
> unter `tmp/e2e-results/`. Spezifikation: [06-testdrehbuch.md](06-testdrehbuch.md).
> Nur Owner-Sicht, headless. OneDrive-Login, zweiter Account und echtes
> Inkognito sind als 🔵 MANUELL markiert.

**Zusammenfassung:** ✅ 8 PASS · ❌ 19 FAIL · 🔵 9 MANUELL (von 36 Schritten)

## Offene Fehlschläge (❌)

- **1.1** Willkommens-Flow per /settings?newUser=true: Willkommens-Screen erscheint NICHT (Owner hat 29 Bibliotheken; landete auf /). Ursache: Cold-Load-Redirect in settings-client + newUser-Param-Stripping — Abweichung zum Drehbuch-Tipp
- **1.3** Wizard: „Lokales Dateisystem" → Weiter überspringt Schritt 2: expect(locator).toBeVisible() failed |  | Locator: getByText('Woher kommen die Dokumente dieser Bibliothek?') | Expected: visible
- **1.4** Pfad übernehmen → Pflicht-Test startet automatisch und wird grün: locator.fill: Timeout 20000ms exceeded. | Call log: |   - waiting for getByLabel('Speicherpfad') | 
- **1.5** Nach „Fertig": Read-only-Zusammenfassung + Abschnitte 2 und 3: locator.click: Timeout 20000ms exceeded. | Call log: |   - waiting for getByRole('button', { name: 'Fertig', exact: true }) | 
- **1.6** Verarbeitung: Vorlage read-only (F11), Speichern erst bei Änderung: expect(locator).toBeVisible() failed |  | Locator:  getByText(/Automatisch: Standard für/).first() | Expected: visible
- **1.6b** F11: falsche Vorlage (Session) wird beim Speichern blockiert: locator.selectOption: Timeout 20000ms exceeded. | Call log: |   - waiting for locator('select[name="pdfTemplate"]') | 
- **1.7** Echtdaten: PDF in der App öffnen und Transformation anstoßen: expect(locator).toBeVisible() failed |  | Locator: getByText(/GADERFORM/i).first() | Expected: visible
- **1.8** Inhaltstyp: empfohlene Filter übernehmen → bestätigen → speichern: expect(locator).toBeVisible() failed |  | Locator:  getByText('Empfohlene Galerie-Filter').first() | Expected: visible
- **1.9** Explore-Settings: Dichte/Gruppierung/Graph — keine Facetten, kein Encoding: expect(locator).toBeVisible() failed |  | Locator:  getByText(/Dichte/).first() | Expected: visible
- **1.10** Story-Settings: Eingabefeld-Text ändern → in der App wirksam: locator.waitFor: Timeout 45000ms exceeded. | Call log: |   - waiting for locator('input[name="placeholder"]').first() to be visible |     92 × locator resolved to hidden <input name="placeholder" id="«rf»-form-item" aria-invalid="false" value="Schreibe deine Frage..." placeholder="Schreibe deine Frage..." aria-describedby="«rf»-form-item-description" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-…/>
- **1.11** Erweitert: Dateisystem-Optionen ohne Shadow-Twin/Primary-Store; Facetten + Encoding hier: expect(locator).toBeVisible() failed |  | Locator:  getByText('Dateisystem-Optionen').first() | Expected: visible
- **1.12** Regressionscheck: Erweitert-Save überschreibt Story-Einstellungen nicht: locator.waitFor: Error: strict mode violation: locator('input[name="embeddings.chunkSize"]') resolved to 2 elements: |     1) <input value="1000" type="number" placeholder="1000" id="«rh»-form-item" aria-invalid="false" name="embeddings.chunkSize" aria-describedby="«rh»-form-item-description" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabl…/> aka locator('[id="«rh»-form-item"]') |     2) <input value="1000" type="number" placeholder="1000" id="«r2k»-form-item" aria-invalid="false" name="embeddings.chunkSize" aria-describedby="«r2k»-form-item-description" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disa…/> aka getByRole('spinbutton', { name: 'Chunk Größe' }) | 
- **2.1a** Zweite Bibliothek anlegen, OneDrive wählen → Anmelde-Schritt erscheint: expect(locator).toBeVisible() failed |  | Locator: getByText('Woher kommen die Dokumente dieser Bibliothek?') | Expected: visible
- **3.1** Person einladen: EIN Dialog, drei erklärte Rollen (Leser zuerst): expect(locator).toBeVisible() failed |  | Locator:  getByText(/Einladung|eingeladen|gesendet/i).first() | Expected: visible
- **3.3** Einladung erscheint auf der Personen-Seite: expect(locator).toBeVisible() failed |  | Locator: getByText('test-drehbuch@example.com').first() | Expected: visible
- **3.5** Veröffentlichen: Status-Header wechselt Privat → Öffentlich: expect(locator).toContainText(expected) failed |  | Locator: locator('[role="alert"]').first() | Expected substring: "Öffentlich"
- **3.6** Galerie-Texte speichern → anonym unter /explore/<slug> sichtbar: expect(locator).toBeVisible() failed |  | Locator:  getByText(/gespeichert|veröffentlicht/i).first() | Expected: visible
- **3.7** Freigabe-Pflicht: anonym kein direkter Zugriff mehr: expect(locator).toBeVisible() failed |  | Locator:  getByText(/gespeichert|veröffentlicht/i).first() | Expected: visible
- **S1** GET /api/libraries: Secrets maskiert (D5): apiRequestContext.get: Timeout 20000ms exceeded. | Call log: |   - → GET http://localhost:3000/api/libraries |     - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.0.0 Safari/537.36

## Manuell nachzutesten (🔵)

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
| 0 | ✅ PASS | Vorbereitung: Login prüfen + alte TEST-Drehbuch-Bibliotheken löschen | keine Altlasten |
| 1.1 | ❌ FAIL | Willkommens-Flow per /settings?newUser=true | Willkommens-Screen erscheint NICHT (Owner hat 29 Bibliotheken; landete auf /). Ursache: Cold-Load-Redirect in settings-client + newUser-Param-Stripping — Abweichung zum Drehbuch-Tipp |
| 1.2 | ✅ PASS | Bibliothek anlegen (Name) → über Switcher-Dialog | angelegt (04df911e-8da1-4431-bade-e9196f7efa3d) über Switcher-Dialog. Hinweis: Inhaltstyp-KARTE nicht wählbar, da /settings-Übersicht wegen Cold-Load-Redirect in Automation nicht erreichbar — Default-Inhaltstyp |
| 1.2w | ✅ PASS | TEST-Drehbuch Bücher als aktive Bibliothek setzen (Guard) | aktiv: 04df911e-8da1-4431-bade-e9196f7efa3d |
| 1.3 | ❌ FAIL | Wizard: „Lokales Dateisystem" → Weiter überspringt Schritt 2 | expect(locator).toBeVisible() failed \|  \| Locator: getByText('Woher kommen die Dokumente dieser Bibliothek?') \| Expected: visible |
| 1.4 | ❌ FAIL | Pfad übernehmen → Pflicht-Test startet automatisch und wird grün | locator.fill: Timeout 20000ms exceeded. \| Call log: \|   - waiting for getByLabel('Speicherpfad') \|  |
| 1.5 | ❌ FAIL | Nach „Fertig": Read-only-Zusammenfassung + Abschnitte 2 und 3 | locator.click: Timeout 20000ms exceeded. \| Call log: \|   - waiting for getByRole('button', { name: 'Fertig', exact: true }) \|  |

## Akt 1 — meSpace: Verarbeitung & Darstellung (1.6–1.12)

| # | Status | Soll-Verhalten | Beobachtung |
|---|---|---|---|
| setup | ✅ PASS | TEST-Drehbuch Bücher aktivieren (Guard) | aktiv: 04df911e-8da1-4431-bade-e9196f7efa3d |
| 1.6 | ❌ FAIL | Verarbeitung: Vorlage read-only (F11), Speichern erst bei Änderung | expect(locator).toBeVisible() failed \|  \| Locator:  getByText(/Automatisch: Standard für/).first() \| Expected: visible |
| 1.6b | ❌ FAIL | F11: falsche Vorlage (Session) wird beim Speichern blockiert | locator.selectOption: Timeout 20000ms exceeded. \| Call log: \|   - waiting for locator('select[name="pdfTemplate"]') \|  |
| 1.7 | ❌ FAIL | Echtdaten: PDF in der App öffnen und Transformation anstoßen | expect(locator).toBeVisible() failed \|  \| Locator: getByText(/GADERFORM/i).first() \| Expected: visible |
| 1.8 | ❌ FAIL | Inhaltstyp: empfohlene Filter übernehmen → bestätigen → speichern | expect(locator).toBeVisible() failed \|  \| Locator:  getByText('Empfohlene Galerie-Filter').first() \| Expected: visible |
| 1.9 | ❌ FAIL | Explore-Settings: Dichte/Gruppierung/Graph — keine Facetten, kein Encoding | expect(locator).toBeVisible() failed \|  \| Locator:  getByText(/Dichte/).first() \| Expected: visible |
| 1.10 | ❌ FAIL | Story-Settings: Eingabefeld-Text ändern → in der App wirksam | locator.waitFor: Timeout 45000ms exceeded. \| Call log: \|   - waiting for locator('input[name="placeholder"]').first() to be visible \|     92 × locator resolved to hidden <input name="placeholder" id="«rf»-form-item" aria-invalid="false" value="Schreibe deine Frage..." placeholder="Schreibe deine Frage..." aria-describedby="«rf»-form-item-description" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-…/> |
| 1.11 | ❌ FAIL | Erweitert: Dateisystem-Optionen ohne Shadow-Twin/Primary-Store; Facetten + Encoding hier | expect(locator).toBeVisible() failed \|  \| Locator:  getByText('Dateisystem-Optionen').first() \| Expected: visible |
| 1.12 | ❌ FAIL | Regressionscheck: Erweitert-Save überschreibt Story-Einstellungen nicht | locator.waitFor: Error: strict mode violation: locator('input[name="embeddings.chunkSize"]') resolved to 2 elements: \|     1) <input value="1000" type="number" placeholder="1000" id="«rh»-form-item" aria-invalid="false" name="embeddings.chunkSize" aria-describedby="«rh»-form-item-description" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabl…/> aka locator('[id="«rh»-form-item"]') \|     2) <input value="1000" type="number" placeholder="1000" id="«r2k»-form-item" aria-invalid="false" name="embeddings.chunkSize" aria-describedby="«r2k»-form-item-description" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disa…/> aka getByRole('spinbutton', { name: 'Chunk Größe' }) \|  |

## Akt 2 — Cloud-Quelle / Re-Auth (2.1–2.4)

| # | Status | Soll-Verhalten | Beobachtung |
|---|---|---|---|
| 2.1a | ❌ FAIL | Zweite Bibliothek anlegen, OneDrive wählen → Anmelde-Schritt erscheint | expect(locator).toBeVisible() failed \|  \| Locator: getByText('Woher kommen die Dokumente dieser Bibliothek?') \| Expected: visible |
| 2.1b | 🔵 MANUELL | OAuth-Redirect + Rückkehr bei Wizard-Schritt 3 (sessionStorage-Resume) | echte Microsoft-Anmeldung erforderlich |
| 2.2 | 🔵 MANUELL | Verzeichnis-Browser: navigieren, Ordner anlegen, Pflicht-Test grün | setzt OneDrive-Anmeldung voraus |
| 2.3 | 🔵 MANUELL | Quelle-Zusammenfassung: maskierte Credentials, D1-Warn-Dialog, D2-Abmelde-Bestätigung | setzt OneDrive-Anmeldung voraus |
| 2.4 | 🔵 MANUELL | Re-Auth: Token löschen → globaler Dialog außerhalb der Settings | setzt OneDrive-Anmeldung voraus |

## Akt 3 — weSpace / usSpace (3.1–3.9)

| # | Status | Soll-Verhalten | Beobachtung |
|---|---|---|---|
| setup | ✅ PASS | TEST-Drehbuch Bücher aktivieren (Guard) | aktiv: 04df911e-8da1-4431-bade-e9196f7efa3d |
| 3.1 | ❌ FAIL | Person einladen: EIN Dialog, drei erklärte Rollen (Leser zuerst) | expect(locator).toBeVisible() failed \|  \| Locator:  getByText(/Einladung\|eingeladen\|gesendet/i).first() \| Expected: visible |
| 3.3 | ❌ FAIL | Einladung erscheint auf der Personen-Seite | expect(locator).toBeVisible() failed \|  \| Locator: getByText('test-drehbuch@example.com').first() \| Expected: visible |
| 3.2 | 🔵 MANUELL | Einladung annehmen → Bibliothek sichtbar, keine Settings | zweiter Clerk-Account nötig |
| 3.4 | 🔵 MANUELL | Zugriff entziehen → sofort wirksam (kein 10s-Nachlauf) | zweiter Clerk-Account nötig |
| 3.5 | ❌ FAIL | Veröffentlichen: Status-Header wechselt Privat → Öffentlich | expect(locator).toContainText(expected) failed \|  \| Locator: locator('[role="alert"]').first() \| Expected substring: "Öffentlich" |
| 3.6 | ❌ FAIL | Galerie-Texte speichern → anonym unter /explore/<slug> sichtbar | expect(locator).toBeVisible() failed \|  \| Locator:  getByText(/gespeichert\|veröffentlicht/i).first() \| Expected: visible |
| 3.7 | ❌ FAIL | Freigabe-Pflicht: anonym kein direkter Zugriff mehr | expect(locator).toBeVisible() failed \|  \| Locator:  getByText(/gespeichert\|veröffentlicht/i).first() \| Expected: visible |
| 3.8 | 🔵 MANUELL | Zugriffsanfrage stellen + genehmigen | zweiter Clerk-Account nötig |
| 3.9 | 🔵 MANUELL | Moderator-Sicht der Settings (Moderation-Hinweis, Anfragen-Verwaltung) | zweiter Clerk-Account nötig |

## Sicherheits-Spotchecks (S1–S4)

| # | Status | Soll-Verhalten | Beobachtung |
|---|---|---|---|
| S1 | ❌ FAIL | GET /api/libraries: Secrets maskiert (D5) | apiRequestContext.get: Timeout 20000ms exceeded. \| Call log: \|   - → GET http://localhost:3000/api/libraries \|     - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.0.0 Safari/537.36 |
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
