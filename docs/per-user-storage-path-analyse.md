# Per-User Storage Path: Co-Creator auf SharePoint-Sync-Libraries

**Status:** Diskutiert, Entscheidungen getroffen — bereit für Umsetzungs-Plan
**Datum:** 2026-04-28
**Owner:** peter.aichner

## Getroffene Entscheidungen (am 2026-04-28)

- **Identitäts-Marker:** Variante **M2** — Verzeichnis `.knowledgescout/`
  mit `library.json` darin (Spielraum für weitere Marker-Dateien später)
- **Invite-Flow:** Variante **P1** — Pflichtschritt im Invite vor der
  Annahme. Pfad-Picker ist Teil der Annahme; ohne gültigen Pfad keine
  Annahme.
- **Settings-UI:** **Nicht nötig.** Einladung wird nur akzeptiert, wenn
  Pfad korrekt. Bei späteren Pfad-Änderungen → neue Einladung anfordern.
- **Electron-Pflicht** für Co-Creator auf `local`-Libraries. Web-Modus
  zeigt Hinweis "Bitte Desktop-App verwenden".
- **Mismatch-Verhalten:** **Hard-Fail** mit klarer Fehlermeldung.

## Problem

Eine Library hat heute genau einen `path` — den lokalen Filesystem-Pfad des
Owners (`src/types/library.ts`, `Library.path`, Zeile 374). Wenn der Pfad in
Wirklichkeit ein SharePoint-Sync-Verzeichnis ist (z. B.
`C:\Users\peter.aichner\Crystal Design GmbH\DIVA Catalog-Team`), zeigt der
gleiche logische Inhalt bei jedem Co-Creator auf einen *anderen* lokalen
Pfad. Eingeladene Mitarbeiter können die Library deshalb nicht öffnen — die
MongoDB-Library-Definition trägt den falschen Path.

Der Storage-Provider, die RAG-Indizes, Shadow-Twins und Mitglieder-Tabellen
sind bereits korrekt user-übergreifend modelliert. **Nur** der lokale Pfad
ist als Library-Eigenschaft modelliert, obwohl er semantisch zur Verbindung
*(User × Library)* gehört.

Gewählte Richtung (siehe Vor-Analyse): **Variante A — Per-Member-Pfad-
Override**. Dieses Doc verfeinert sie und legt offene Sub-Entscheidungen
zur Diskussion.

## Geltungsbereich (Scope)

In Scope:
- Co-Creator auf `library.type === 'local'` mit gemeinsamem
  Sync-Verzeichnis (SharePoint, OneDrive Sync Client, Nextcloud Sync,
  Dropbox usw.)
- Persistenz, Eingabe-UI, Pfad-Auflösung im Server-Provider
- "Sicherheits-Anker" gegen Fehlkonfiguration (Library-Identitäts-Marker)

Out of Scope (bewusst nicht jetzt):
- User-spezifischer **Backend-Wechsel** (Owner: local, Co-Creator:
  Nextcloud direkt) — das wäre Variante B aus der Vor-Analyse
- Multi-User-Edit-Konflikte (regelt SharePoint selbst)
- Andere Backend-Typen als `local` — Override greift hier zunächst nicht

## Architektur-Skizze

### Datenmodell

`LibraryMember` (Collection `library_members`) bekommt **ein** neues
optionales Feld:

```ts
export interface LibraryMember {
  // ... bestehende Felder
  /**
   * User-spezifischer lokaler Pfad fuer diese Library.
   * Wird nur fuer library.type === 'local' verwendet.
   * Wenn nicht gesetzt: Fallback auf Owner-Path (lib.path) ist NICHT erlaubt
   * → Storage-Provider verweigert die Erstellung mit deutlicher Fehlermeldung.
   * Damit verhindern wir stille Fehlfunktion (Regel: no-silent-fallbacks).
   */
  localPathOverride?: string;
}
```

Begründung "kein stiller Fallback": Wenn ein Co-Creator zugreift, ohne
seinen Pfad konfiguriert zu haben, soll das Setup *laut* fehlschlagen mit
dem Hinweis "Bitte konfiguriere deinen lokalen Pfad in den Library-
Einstellungen". Sonst landet er still auf dem Owner-Path, der bei ihm
nicht existiert oder (schlimmer) auf ein falsches Verzeichnis zeigen
könnte.

### Pfad-Auflösung im Server

`src/lib/storage/server-provider.ts` ist die **einzige** zentrale Stelle:

1. Library laden (eigenes Dokument oder über `getLibraryById()`).
2. Wenn User Owner ist → `lib.path` verwenden.
3. Wenn User Co-Creator ist und `library.type === 'local'`:
   - Member-Eintrag laden (`getMember(libraryId, userEmail)`)
   - Wenn `localPathOverride` gesetzt → in einer Kopie der Library
     `lib.path = localPathOverride` setzen, bevor die Factory aufgerufen
     wird
   - Wenn nicht gesetzt → `throw new Error('Bitte konfiguriere deinen
     lokalen Library-Pfad in den Einstellungen.')`

Der Storage-Layer selbst bleibt **unverändert**. Die Auflösung passiert
*vor* `factory.setLibraries(...)`. Das hält die Storage-Abstraktion sauber
und folgt der Storage-Architektur-Rule (UI/Service löst Pfad auf, Provider
sieht nur den effektiven Pfad).

### Client-Sicht

Die `ClientLibrary` muss im Co-Creator-Fall den **effektiven** Pfad
liefern (nicht den Owner-Pfad), sonst ist das, was die UI anzeigt, falsch.
Zwei Möglichkeiten:

- **(a)** `LibraryService.toClientLibraries()` bekommt die User-Email als
  Parameter und ersetzt `path` durch den Override.
- **(b)** Eigenes Feld `effectivePath` zusätzlich zu `path`.

Empfehlung: **(a)**. Weniger Felder, weniger UI-Spaghetti. Bestehende
UI-Komponenten zeigen `path` an — die wollen den effektiven Pfad sehen.

## Identitäts-Marker im Library-Verzeichnis

User-Idee (sehr gut): Im Library-Verzeichnis liegt eine Datei, die die
Library eindeutig identifiziert. Beim Verbinden prüft die Anwendung, ob
das Verzeichnis wirklich diese Library ist.

### Variante M1 — Versteckte Datei `.knowledgescout-library.json`

```json
{
  "schemaVersion": 1,
  "libraryId": "lib_abc123",
  "label": "DIVA Catalog (Teams & Externe)",
  "ownerEmail": "peter.aichner@…",
  "createdAt": "2026-04-28T…"
}
```

- **Pro:** Selbsterklärend (lesbar mit jedem Editor), erweiterbar (z. B.
  später Schema-Version, Backend-Hinweis), nur eine Datei
- **Contra:** Sichtbar als hidden file (für SharePoint-Sync irrelevant)

### Variante M2 — Verzeichnis `.knowledgescout/` mit `library.json` darin

- **Pro:** Erweiterbar um weitere Marker-Dateien (z. B. später eine
  `members.json` als zusätzliche Quersicherung)
- **Contra:** Mehr Komplexität jetzt für hypothetische Zukunft

### Variante M3 — Bestehende Konvention "hijacken"

Z. B. `.shadow-twins/` als Existenz-Marker reinterpretieren.

- **Pro:** keine neue Datei
- **Contra:** Bricht die saubere Trennung "Marker" vs. "Inhalt", und das
  Verzeichnis kann legitim leer sein. **Nicht empfohlen.**

**Empfehlung: M1.** Klein, klar, ausreichend für die nächsten 12 Monate.
Wenn wir später mehr Metadaten brauchen, ist die Migration auf M2 trivial.

### Verhalten

- **Owner**, beim Speichern der Storage-Settings (oder beim ersten
  erfolgreichen "Storage testen"):
  - Datei wird angelegt, falls noch nicht vorhanden (idempotent)
  - Wenn vorhanden mit *anderer* Library-ID → Fehler "Verzeichnis ist
    bereits einer anderen Library zugeordnet"
- **Co-Creator**, beim Speichern seines Override-Pfads:
  - Datei wird gelesen
  - Wenn fehlt → Fehler "Verzeichnis enthält keine Library-Kennung. Bitte
    den Owner bitten, das Verzeichnis vorzubereiten."
  - Wenn `libraryId` ≠ erwartete ID → Fehler "Verzeichnis gehört zu
    Library *Foo*, nicht zu *Bar*."
- **Beim normalen Zugriff** (jeder Listenruf wäre zu teuer):
  - Prüfung **einmal pro Session** beim ersten Zugriff cachen
  - Prüfung erfolgt in `validateConfiguration()` (so vorgesehen im
    Storage-Contract)

### Datenbank-Override

Optional: Zusätzlich zur Datei kann der Server beim Co-Creator-Setup auch
gegen die in MongoDB gespeicherte Library-ID prüfen. Doppelte Sicherung,
falls jemand den Marker manuell editiert.

## Invite-Flow Anpassung

Heute (`src/app/invite/[token]/page.tsx`):
1. User klickt Link
2. Bei Anmeldung wird automatisch akzeptiert
3. Weiterleitung zur Library

Vorschlag:
1. User klickt Link
2. Bei Anmeldung **wenn Library type === 'local'**: Zwischenschritt
   "Lokalen Pfad konfigurieren" mit Pfad-Picker
3. Beim Klick auf "Übernehmen": Identitäts-Marker prüfen
4. Bei Erfolg: Annahme inkl. `localPathOverride` an den Server
5. Weiterleitung zur Library

Wenn `library.type !== 'local'`: aktueller Flow bleibt unverändert.

### Nachträgliche Änderung in Settings

Eingeladene Co-Creator brauchen Zugang zu **genau einem** Settings-
Bereich: ihrem eigenen Pfad. Drei Optionen für die UI:

- **S1**: Im "Storage"-Tab der bestehenden Settings-Seite, der für
  Co-Creator nur das Override-Feld zeigt (kein Speichertyp-Dropdown, keine
  Owner-Konfig). Semantisch passend.
- **S2**: Neuer Tab "Mein lokaler Pfad" speziell für Co-Creator.
  Semantisch klarer ("das gehört dir, nicht der Library"), aber ein
  weiterer Tab.
- **S3**: Banner *außerhalb* der Settings (z. B. oben in der Explore-
  Ansicht), mit Inline-Editor.

**Empfehlung: S1**, weil sie die geringste UI-Veränderung ist und
Co-Creator das Settings-Menü ohnehin verstehen werden, sobald sie ein
einziges Feld dort vorfinden.

## Migration / Backwards-Compatibility

- Bestehende Co-Creator-Mitgliedschaften haben kein
  `localPathOverride` → erster Zugriff scheitert kontrolliert mit
  Konfigurations-Aufforderung.
- Bestehende Owner-Libraries haben keinen Identitäts-Marker → wird beim
  nächsten "Storage testen" oder beim ersten Speichern automatisch
  angelegt.
- Keine Schema-Migration nötig: das Feld ist optional, der Marker
  selbst-erstellend.

## Risiken & offene Fragen

1. **Pfad-Picker im Browser**: Echte Verzeichnisauswahl über `<input
   type="file" webkitdirectory>` liefert nur einen relativen Pfad, **nicht**
   den absoluten lokalen Pfad. In Electron haben wir Vollzugriff (`dialog
   .showOpenDialog`). Im Web-Modus müsste der User den Pfad manuell
   eintippen oder per Drag & Drop einen Ordner darauf ziehen.
   → **Frage an Owner: Setzen wir Electron als Voraussetzung für
   Co-Creator auf `local`-Libraries voraus?** (Plausibel, weil ohne
   Filesystem-API ohnehin nichts funktioniert.)
2. **Sync-Verzögerung**: Der Co-Creator schreibt eine Datei → SharePoint
   synchronisiert mit Latenz → Owner sieht es Sekunden bis Minuten später.
   Akzeptiert? (Vermutlich ja, ist Charakter von Sync-Lösungen.)
3. **Marker im Sync**: Wird `.knowledgescout-library.json` von SharePoint
   mit-synchronisiert? Erwartet ja, aber zu prüfen — manche Sync-Clients
   ignorieren versteckte Dateien nicht, andere doch.
4. **Pfad-Picker-Validierung**: Soll der Co-Creator nicht nur den Pfad
   auswählen, sondern auch sofort "Pfad testen" können (Identitäts-Marker
   lesen, Listing probieren)? **Empfehlung: ja**, wie heute schon im
   Owner-Storage-Form.

## Konkrete Code-Stellen für die Umsetzung

Reihenfolge: untere Schichten zuerst (Datenmodell + Marker), dann
Server-Auflösung, dann API, am Ende UI. Jeder Punkt ein eigener Commit
(Repo-Konvention `[plan <id>] <bereich>: <beschreibung>`).

1. **Datenmodell**: `src/types/library-members.ts` — Feld
   `localPathOverride?: string` ergänzen
2. **Repo**: `src/lib/repositories/library-members-repo.ts` —
   `acceptMemberInvite()` nimmt optional `localPathOverride` entgegen
   und persistiert es
3. **Identity-Marker** (neu): `src/lib/storage/library-identity.ts` —
   Konstanten (Pfad-Schema `.knowledgescout/library.json`, Schema-Version
   1), Funktionen `writeIdentityMarker`, `readIdentityMarker`,
   `validateIdentityMarker(libraryId)`
4. **Marker-Lifecycle im Filesystem-Provider**:
   `src/app/api/storage/filesystem/route.ts` — beim ersten Owner-Zugriff
   Marker schreiben, falls fehlt; bei jedem Connect die ID validieren
   (gecached pro Session)
5. **Pfad-Auflösung serverseitig**: `src/lib/storage/server-provider.ts`
   — wenn User != Owner und `library.type === 'local'`: Member laden,
   `localPathOverride` lesen, `lib.path` ersetzen, sonst werfen
6. **Client-Sicht**: `src/lib/services/library-service.ts` —
   `toClientLibraries()` bekommt Email-Parameter, ersetzt `path` für
   Co-Creator
7. **Preview-API** (neu): `src/app/api/member-invites/[token]/route.ts`
   GET — gibt vor der Annahme `library.type`, `library.id`,
   `library.label` zurück (damit das Frontend weiß, ob es Pfad
   abfragen muss und welche ID erwartet wird)
8. **Validate-API** (neu): `src/app/api/member-invites/[token]/validate-path/route.ts`
   POST — bekommt `localPathOverride`, prüft Marker, antwortet
   ok/Fehler. Nur Prüfung, keine Persistierung.
9. **Accept-API erweitern**:
   `src/app/api/member-invites/[token]/accept/route.ts` — bei
   `library.type === 'local'` ist `localPathOverride` im Body Pflicht;
   wird vor der Annahme nochmal validiert
10. **Invite-UI**: `src/app/invite/[token]/page.tsx` — Zwischenschritt
    "Lokalen Pfad konfigurieren" für `local`-Libraries; Web-Hinweis
    "Bitte Desktop-App nutzen"; Electron-Pfad-Picker via
    `dialog.showOpenDialog`

Tests:
- Unit: `library-identity` — Marker schreiben/lesen/Mismatch-Erkennung
- Unit: `getServerProvider` — Owner vs. Co-Creator + Override + Fehler
  ohne Override
- Unit: `toClientLibraries(email)` — Owner sieht Owner-Path, Co-Creator
  sieht Override
- Integration: Invite-Flow mit Pfad-Validierung end-to-end

## Manueller Test der Welle 1 (vor UI/Invite-Flow)

Welle 1 ist der Backend-Kern: Datenmodell + Marker + Server-Pfad-
Auflösung + Co-Creator-Sicht in der `/api/libraries`-Liste. UI/Invite-
Flow folgt erst danach.

Es gibt **zwei Test-Szenarien**, die wir beide abdecken wollen:

- **Szenario A — SharePoint-Sync**: Owner und Co-Creator sehen dasselbe
  logische Verzeichnis, aber unter unterschiedlichen lokalen Pfaden
  (jeder Sync-Client legt es unter seinem User-Profil ab). Der Marker
  muss per Sync vom Owner zum Co-Creator wandern.
- **Szenario B — Netzwerk-Share / NAS**: Owner und Co-Creator greifen
  über denselben Pfad zu (z. B. `\\nas01\share\bibliothek` oder
  Drive-Letter `Z:\bibliothek`, beide identisch gemountet). Der Marker
  liegt einmal physisch da; kein Sync nötig.

Code-seitig sind beide Fälle identisch: das Override speichert für
Szenario B einfach denselben Pfad wie der Owner. Der Marker-Check ist
lokal.

### Gemeinsame Voraussetzungen

- Zwei Test-User in Clerk (Hauptaccount = Owner, zweiter Account =
  Co-Creator).
- Eine bestehende `local`-Library im Owner-Account.
- Der zweite User ist als `co-creator` in `library_members` eingetragen
  (Status egal — Schritt 2 setzt ihn aktiv).

### Schritt 1: Marker für die Owner-Library erzeugen

Als Owner einmal die Library im Frontend öffnen (irgendeine Aktion,
die `getServerProvider` triggert — z. B. Archiv-Ansicht aufrufen). Im
Library-Verzeichnis muss anschließend
`<library-root>/.knowledgescout/library.json` existieren:

```json
{
  "schemaVersion": 1,
  "libraryId": "<deine-lib-id>",
  "label": "DIVA Catalog (Teams & Externe)",
  "ownerEmail": "owner@example.com",
  "createdAt": "2026-04-…"
}
```

**Szenario-spezifisch:**

- **A (SharePoint):** Warten, bis die Datei per Sync beim Co-Creator
  ankommt (wenige Sekunden bis Minuten — beobachte das Sync-Icon).
  Wenn die Datei beim Co-Creator nicht erscheint, ist M2 für
  SharePoint nicht tragfähig — dann müssen wir auf einen sichtbaren
  Marker-Namen ausweichen.
- **B (NAS):** Marker ist sofort beim Co-Creator sichtbar
  (derselbe physische Pfad).

### Schritt 2: Co-Creator-Mitgliedschaft mit Override per Mongo setzen

Welle 1 hat noch keine UI für die Pfad-Eingabe. Wir setzen das Override
direkt in MongoDB (mongo shell, MongoDB Compass o. ä.).

**Szenario A (SharePoint, unterschiedliche Pfade):**

```js
db.library_members.updateOne(
  { libraryId: "<deine-lib-id>", userEmail: "co-creator@example.com" },
  { $set: {
      status: "active",
      localPathOverride: "C:\\Users\\co-creator\\Crystal Design GmbH\\DIVA Catalog-Team",
      acceptedAt: new Date()
    },
    $unset: { inviteToken: "" }
  }
)
```

**Szenario B (NAS, gleicher Pfad):**

```js
db.library_members.updateOne(
  { libraryId: "<deine-lib-id>", userEmail: "co-creator@example.com" },
  { $set: {
      status: "active",
      localPathOverride: "Z:\\shared\\bibliothek",
      acceptedAt: new Date()
    },
    $unset: { inviteToken: "" }
  }
)
```

In beiden Fällen ist `localPathOverride` der **eigene lokale Sicht**
auf das Library-Verzeichnis. In B trägt der Co-Creator denselben Pfad
ein, den der Owner sieht.

### Schritt 3: Co-Creator öffnet die Library

Mit dem zweiten User einloggen, die Library aus der Liste der „geteilten
Libraries" öffnen. Erwartet (in beiden Szenarien):

- `/api/libraries` liefert die Library mit `path` = Co-Creator-Pfad.
- Archiv-/Explore-Ansichten listen denselben Inhalt wie beim Owner.

### Schritt 4: Negativ-Test – Override fehlt

Override per Mongo entfernen:

```js
db.library_members.updateOne(
  { libraryId: "<deine-lib-id>", userEmail: "co-creator@example.com" },
  { $unset: { localPathOverride: "" } }
)
```

Erwartet: API-Calls scheitern mit Fehlertext „Für diese geteilte Library
ist kein lokaler Pfad konfiguriert." (gilt für A und B identisch)

### Schritt 5: Negativ-Test – falscher Pfad

Override auf ein leeres Verzeichnis ohne Marker setzen, oder auf ein
Verzeichnis mit Marker einer anderen Library. Erwartet: klare
Fehlermeldung („gehört zu einer anderen Library" / „keine Library-
Kennung gefunden").

### Was du am Ende wissen wirst

| Test | Was er bestätigt |
| --- | --- |
| Szenario A erfolgreich | SharePoint-Sync transportiert versteckte Verzeichnisse zuverlässig; SharePoint-Setups sind tragfähig |
| Szenario B erfolgreich | NAS-Setups funktionieren ohne Sync-Verzögerung; Override-Pflicht ist im NAS-Fall nur „Pfad einmal eintippen" |
| Schritt 4 | Hard-Fail-Verhalten greift bei fehlender Konfiguration (kein silent fallback) |
| Schritt 5 | Marker-Validierung schützt vor falschem Verzeichnis |

**Wenn alle 5 Schritte in beiden Szenarien funktionieren:** Welle 2
(UI + Invite-Flow) kann gestartet werden.

**Wenn Szenario A bei Schritt 1 scheitert** (Marker erscheint nicht
beim Co-Creator): Stop, melden — wir müssen entweder den Marker-Namen
ändern (sichtbares Verzeichnis) oder das SharePoint-spezifische
Verhalten genauer untersuchen.

## Akzeptanzkriterien (für die Umsetzung)

1. Owner kann eine Library wie heute anlegen; beim ersten Storage-Test
   wird `.knowledgescout/library.json` automatisch erstellt
2. Owner lädt Co-Creator ein (wie heute)
3. Co-Creator klickt Invite-Link → sieht Pfad-Picker (Electron) bzw.
   Hinweis (Web)
4. Pfad-Picker validiert per API-Call: Marker existiert, ID stimmt
   überein
5. Bei Erfolg wird die Einladung mit `localPathOverride` angenommen
6. Co-Creator öffnet die Library → sieht denselben Inhalt wie Owner
7. Wenn Pfad ungültig (Marker fehlt/falsche ID): klare Fehlermeldung,
   Annahme schlägt fehl, Token bleibt gültig für erneuten Versuch
8. Wenn Co-Creator-Pfad nachträglich ungültig wird (z. B. Sync-Pfad
   geändert): nächster Library-Zugriff scheitert mit klarer Meldung
   "Bitte den Owner um eine neue Einladung bitten"
