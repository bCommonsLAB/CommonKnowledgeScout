---
name: speicher-verbindungen-und-library-anlage
overview: "Drei Beobachtungen des Owners vom 13.10.2026, ein Umbau: (A) Speicher-Zugänge (Nextcloud, OneDrive) gehören der Person und werden einmal am Konto gepflegt, die Library zeigt nur noch auf eine Verbindung plus Verzeichnis. (B) Die Seite „Erweitert" wird ein aufklappbarer Menüpunkt mit sieben Unterseiten statt einer endlosen Seite. (C) Eine neue Library wird vollständig angelegt: ein Entscheidungskatalog sagt, welche Antworten eine funktionierende Library braucht; die App fragt sie in einem Wizard ab, die Brücke stellt Rückfragen, statt halb konfigurierte Libraries zu hinterlassen."
vorhaben: []
status: aktiv
todos:
  - id: a1-verbindungen-modell
    content: "Teil A, PR 1 — Speicher-Verbindung als eigene Entität: Collection `storage_connections` (Besitzer-E-Mail, Bezeichnung, Typ, Zugangsdaten verschlüsselt, letzter Test), Repository nach mongodb-repository-pattern, Verschlüsselung AES-256-GCM aus Commit 63a64bb9 übernehmen (`src/lib/security/`), Konto-Seite „Speicher-Verbindungen" unter Mein Konto (anlegen, testen, OneDrive-Login, löschen nur ohne abhängige Library). Noch nutzt keine Library die Verbindung. Beleg 13.10.: Branch `claude/speicher-b1-seitenmenue-erweitert-fq2c0r` (Folge-PR nach B1) — `src/types/storage-connection.ts`, `src/lib/security/credential-cipher.ts`, `src/lib/repositories/storage-connections-repo.ts` (verschlüsselt am Schreibrand), `src/lib/storage-connections/` (Service, Probe, OneDrive-Login/-Callback), Routen `src/app/api/account/storage-connections/**`, Konto-Seite `/settings/account/storage-connections`; `Library.storageConnectionId` als optionales Feld angelegt (A2 setzt es). Tests unter `tests/unit/security/`, `tests/unit/storage-connections/`, `tests/unit/repositories/storage-connections-repo.test.ts`, `tests/unit/api/storage-connections-route.test.ts`."
    status: completed
  - id: a2-library-auf-verbindung
    content: "Teil A, PR 2 — Library zeigt auf Verbindung: Felder `storageConnectionId` + `path` an der Library, Zugangsfelder aus `StorageConfig` entfernen; `getServerProvider`, `StorageFactory.getProvider`, Nextcloud-Proxy-Route und OneDrive-Token-Store lösen Library → Verbindung auf (Cache-Fingerabdruck = Verbindungs-Id + Pfad); Browser-Token-Schlüssel `onedrive_tokens_<libraryId>` wird `<connectionId>`; Archive-Seite 1 · Quelle wird Verbindung wählen + Verzeichnis wählen (Picker existiert); Migrationsskript zieht Verbindungen aus bestehenden Libraries, legt gleiche Zugänge zusammen, leert Altfelder; Token-Route ohne `X-Internal-Request`-Umgehung; Klartext-Logs der Secrets entfernen. Beleg 13.10.: `Library.storageConnectionId`, Altfelder aus `StorageConfig`/`ClientLibrary` entfernt; `toFactoryLibrary` (`src/lib/storage-connections/library-storage.ts`) mischt die Verbindung in die Factory-Sicht, Cache-Fingerabdruck = Verbindungs-Id + Stand + Pfad + Kontext; Token-Store, Token-/Refresh-Route und Nextcloud-Proxy an der Verbindung, Token-/Refresh-Route nur noch mit Clerk und nur fuer den Owner (Middleware-Ausnahme entfernt); Browser-Schluessel `onedrive_tokens_<connectionId>`; Archive · 1 Quelle = Typ, Verbindung, Verzeichnis, Test; `scripts/migrate-storage-connections.ts` (Probelauf/`--apply`, Backup, Zusammenlegen, idempotent; Plan als reine Funktion `migration-plan.ts`); PUT/PATCH weisen Zugangsfelder in der Config ab; Bruecke minimal mitgezogen (2.53.1). Offen fuer A3: eigene Brueckenwerkzeuge fuer Verbindungen."
    status: completed
  - id: a3-bruecke-verbindungen
    content: "Teil A, PR 3 — Brücke: `speicher_verbindungen_auflisten` (nur Bezeichnung, Typ, zuletzt geprüft; nie Geheimnisse), `bibliothek_anlegen` nimmt `speicherVerbindung` + `verzeichnis` statt webdavUrl/benutzer; `speicher_pruefen` meldet Verbindung statt Geheimnis; TOOLSET_VERSION, TOOL_NAMES, NEU_IN_VERSION; Konzept-Doku `docs/concepts/mcp-library-betrieb.md` ergänzen. Beleg 14.10.: Bruecke 2.54.0 — `speicher_verbindungen_auflisten`, `speicher_verbindung_testen`, `speicher_verbindung_zuweisen` (`tools-speicher-verbindungen.ts`, reine Bausteine `speicher-verbindung-wahl.ts`; Verbindung per Id oder Bezeichnung, Typ muss passen, nur Owner); `bibliothek_anlegen` in eigener Datei `tools-bibliothek-anlegen.ts`, nimmt `speicherVerbindung` + `verzeichnis` (Typ folgt aus der Verbindung), webdavUrl/benutzer entfallen; `speicher_pruefen` nennt Verbindungs-Id und letzten Test; Anlegen einer Verbindung bleibt in der Oberflaeche (Geheimnis)."
    status: completed
  - id: a4-mitglieder-eigene-verbindung
    content: "Teil A, PR 4 — ADR 0005 umsetzen: `LibraryMember.storageConnectionId` ersetzt `localPathOverride`; `getServerProvider` löst je handelndem Member auf, nie Rückfall auf die Owner-Verbindung; Einladung annehmen = Verbindung wählen + Test auf das Library-Root; ID-Konsistenz über Konten (offener Punkt des ADR) vorher mit einem Prüffall belegen."
    status: pending
  - id: b1-seitenmenue-erweitert
    content: "Teil B — `SidebarNav` bekommt eine zweite Ebene (aufklappbarer Eintrag, aktiver Pfad klappt auf); Erweitert → sieben Unterrouten `/settings/advanced/{suche-ki,speicher-twins,verarbeitung,extraktion,diva,agentensicht,wartung}`; je Seite genau ein Config-Objekt und ein Speichern-Knopf; Library-Formular in Teil-Formulare je Seite zerlegen; Inhalte erfassen (Wizards) auf die Archive-Seite als Schritt 4; der Konto-Eintrag „Speicher-Verbindungen" kommt erst mit A1. Unabhängig von Teil A, kann zuerst gehen. Start-Prompt in §9. Beleg 13.10.: Branch `claude/speicher-b1-seitenmenue-erweitert` — `SidebarNavItem.children`, sieben Routen unter `src/app/settings/advanced/`, Teil-Formulare unter `src/components/settings/library/advanced/` (PATCH nur eigene Schlüssel), `capture-wizards-form.tsx` auf Archive · 4, Tests `tests/unit/settings/advanced-page-config-keys.test.ts` und `sidebar-nav-children.test.ts`."
    status: completed
  - id: c1-entscheidungskatalog
    content: "Teil C, Schritt 1 — Entscheidungskatalog der Library-Anlage als Code (`src/lib/library-setup/entscheidungen.ts`): je Entscheidung Feld, Gewicht (pflicht | empfohlen | später), Vorgabe ohne Antwort, Bedingung (nur bei Audio, nur bei Inhaltstyp X); dazu `pruefeEinrichtung(library)` → Liste offener Entscheidungen. Eine Quelle für App-Wizard, Brücke und die Einrichtungs-Anzeige in den Settings. Owner entscheidet vorher die Gewichte (§6, E6). Dazu E8: Standard-Facetten je Inhaltstyp. Beleg 14.10.: `src/lib/library-setup/` — `entscheidungen.ts` (+ `entscheidungen-spaeter.ts`) mit den 19 Zeilen als Daten (Gewicht, Schritt, Feldpfade, Bedingung, Vorgabe, Frage, Optionen, generischer Antwortweg mit Zod-Schema), `pruefung.ts` (`pruefeEinrichtung(library, kontext)` → offen/erledigt/gesamt/vollstaendig; `wendeAntwortenAn`), `inhaltstyp-merkmale.ts` (vollstaendige Map je Inhaltstyp: Audio erwartet, Wizards — E6: Zeilen 7/8 nur bei Audio), `standard-facetten.ts` (E8: Basis-Facetten + filtertaugliche Felder der Standard-Vorlage, CI-Test wie F11); Tests unter `tests/unit/library-setup/`. Abweichung von der Tabelle: Zeile 3 gilt immer (local braucht den Pfad)."
    status: completed
  - id: c2-app-wizard
    content: "Teil C, Schritt 2 — Anlege-Wizard in der App: ersetzt den Dialog Name + Klon-Häkchen; Schritte Grundlagen (Name, Inhaltstyp, Vorlage-Library) → Quelle (Verbindung, Verzeichnis, Test) → Verarbeitung (Sprachen der Aufnahmen, bekannte Namen) → Finden (Facetten-Vorschlag aus dem Inhaltstyp, Graph ja/nein) → Story (Antwortsprache, Antwortregeln) → Erfassen (Wizards) → Zusammenfassung; Pflicht-Schritte blockieren, empfohlene überspringbar mit sichtbarem „offen"; Settings-Übersicht zeigt „Einrichtung: n von m" aus `pruefeEinrichtung`."
    status: pending
  - id: c3-bruecke-rueckfragen
    content: "Teil C, Schritt 3 — Brücke: `bibliothek_anlegen` prüft gegen den Katalog; fehlen Pflicht- oder empfohlene Antworten, legt es NICHT an, sondern antwortet mit `offeneEntscheidungen` (Frage, Optionen, Vorgabe) — der Agent fragt den Menschen und ruft mit `entscheidungen` erneut; `vorlageVon` beantwortet, was die Vorlage trägt; `bibliothek_pruefen` (neu, lesend) liefert dieselbe Liste für bestehende Libraries. MCP-Elicitation (SDK 1.26 kann `elicitInput`) erst, wenn der Client sie belegt beherrscht; der Fragenkatalog in der Antwort ist die Basis. Beleg 14.10.: Bruecke 2.55.0 — `bibliothek_anlegen` baut einen Entwurf, wendet `entscheidungen` ueber `wendeAntwortenAn` an, prueft mit `pruefeEinrichtung` (Kontext: andere Libraries gleichen Typs, vorlageGewaehlt, audioErwartet, ueberspringen) und antwortet bei Offenem `angelegt: false` + `offeneEntscheidungen` mit Antwortweg (`bibliothek-rueckfragen.ts`); `bibliothek_pruefen` (lesend) fuer bestehende Libraries. Folge: nextcloud/onedrive ohne Verbindung wird nicht mehr „ausstehend" angelegt (Speicher ist Pflicht)."
    status: completed
---

# Speicher-Verbindungen am Konto, Seitenmenü Erweitert, vollständige Library-Anlage

## 1. Anlass (Owner, 13.10.2026)

Drei Beobachtungen beim Arbeiten über die Brücke, die zusammengehören:

1. **Speicher je Library statt je Person.** Ich verwalte mehrere Libraries mit
   einem Profil und erreiche sie über eine Brücke, aber den Nextcloud- oder
   OneDrive-Zugang (Tenant-ID, App-ID, Secret, App-Passwort) trage ich in jeder
   Library neu ein. Das ist redundante Pflege delikater Daten. Der Zugang
   gehört zu mir; die Library sollte nur wissen, auf welchem Speicher sie liegt
   und in welchem Verzeichnis.
2. **„Erweitert" ist eine endlose Seite.** Die Experten-Einstellungen gehören in
   ein Seitenmenü mit Unterpunkten, die man einzeln öffnet. Unter „Mein Konto"
   gehört dann ein Punkt „Speicher-Verbindungen" neben „Mein Zugang".
3. **Eine über die Brücke angelegte Library ist nicht fertig.** Nach dem Anlegen
   muss ich nachkonfigurieren: Vorlage und Modellwahl, welche Wizards sichtbar
   sind, ob der Graph erscheint, wie der Story-Modus antwortet, welche
   Metafelder indiziert werden. Ich will bewusst entscheiden, welche dieser
   Antworten wichtig sind und welche nicht, und sie beim Anlegen abfragen: in
   der App als Wizard, über die Brücke als Rückfragen.

## 2. Befund: so ist es heute

### 2a. Speicher-Zugänge

- Alle Zugangsdaten liegen in `library.config` (`src/types/library.ts`,
  `StorageConfig`): `clientId`, `clientSecret`, `tenantId`, `nextcloud.appPassword`
  und, untypisiert, die OneDrive-Tokens (`accessToken`, `refreshToken`,
  `tokenExpiry`, dazu `temp*`-Zwischenablage). Daneben weitere Geheimnisse im
  selben Objekt: `secretaryService.apiKey`, `ingestionStorage.connectionString`,
  `publicPublishing.apiKey`.
- Ein Profil-Modell gibt es nicht. Das Dokument je E-Mail in der
  `libraries`-Collection ist faktisch das Profil; neben ihm existieren nur
  `mcp_account_keys`, `user_story_perspektiven` und `source_user_states`.
- Die Azure-App-Registrierung hängt an jeder Library, bewusst ohne
  Umgebungs-Defaults (`src/lib/storage/onedrive/oauth-server.ts`). Jede
  OneDrive-Library hat eigene Tokens, eigene Re-Auth, einen eigenen
  Browser-Schlüssel `onedrive_tokens_<libraryId>`.
- `getServerProvider` (`src/lib/storage/server-provider.ts`) übergibt der
  Factory immer die Owner-Config. Co-Creator arbeiten mit den Zugangsdaten des
  Owners; genau das ist ADR 0005 (zurückgestellt). Das dort vorgesehene Feld
  `localPathOverride` setzt heute niemand.
- Die Factory (`src/lib/storage/storage-factory.ts`) bildet den Cache-Schlüssel
  aus Typ, Pfad und der ganzen Config samt Geheimnissen.
- Nichts ist verschlüsselt, es gibt nur die Maskierung für den Client. Ein
  fertiger, nie gemergter Commit `63a64bb9` (2026-06-22, Branch
  `origin/claude/lucid-planck-b9i6gj`, 12 Dateien) bringt AES-256-GCM,
  `src/lib/security/`, Migrationsskript und 18 Tests.
- Nebenbefunde, die der Umbau mit erledigt: Die Token-Route
  `src/app/api/libraries/[id]/tokens/route.ts` umgeht Clerk, sobald der Header
  `X-Internal-Request` gesetzt ist und eine E-Mail als Parameter mitkommt; die
  Refresh-Route ebenso. Die PATCH-Route loggt `clientSecret` im Klartext, die
  Nextcloud-Proxy-Route einen Präfix des App-Passworts.
- Die Brücke (`src/lib/mcp/bibliothek-anlegen.ts`) nimmt beim Anlegen bewusst
  keine Geheimnisse an und verweist auf Settings → Archive. Mit einer
  Verbindung, die schon existiert, entfällt dieser Umweg.

### 2b. Die Seite „Erweitert"

`src/app/settings/advanced/page.tsx` stapelt drei Formulare mit je eigenem
Speichern-Knopf plus zwei Werkzeug-Panels:

```
Erweitert (eine Seite)
├─ KI, Suche & Bilder        [Chat-Config]       RAG, LLM-Modell, Facetten, Graph-Encoding, Bild-Speicher
├─ Prüfen & Reparieren       [Werkzeuge]         Dokument-Angaben prüfen, Speicher-Abgleich
├─ Daten & Wartung           [Library-Config]    Shadow-Twin-Modus, Dateisystem-Optionen,
│                                                 Medien-Speicher-Strategie, Sprachbereinigung,
│                                                 Inhalte erfassen (Wizards),
│                                                 „Speicher-Abgleich" (Überschrift falsch: Scan-Ausschluss,
│                                                   bekannte Namen, Sprachen der Aufnahmen, Anhänge als Text),
│                                                 DIVA & Auto-Klassifikation, Agentensicht (2 Blöcke),
│                                                 Export / Import
└─ Verarbeitungs-Service     [Secretary-Config]  Vorlage (Journalist), Transkription & Modellwahl,
                                                  Service-Einstellungen, Teams-Aufzeichnung
```

Das Seitenmenü (`src/components/settings/sidebar-nav.tsx`) kennt Gruppe und
Eintrag, keine dritte Ebene. Das Settings-UX-Konzept
(`docs/settings-ux/README.md`, F8, E6) hat „Erweitert" bewusst als sichtbaren,
abgegrenzten Bereich vorgesehen; die Länge ist seitdem gewachsen.

### 2c. Library-Anlage

- **App**: Der Dialog (`src/components/library/create-library-dialog.tsx`) fragt
  Name und ein Häkchen „Konfiguration von … klonen". Inhaltstyp, Speicher und
  alles Weitere folgen in den Settings.
- **Brücke**: `bibliothek_anlegen` fragt Name, Inhaltstyp, Speichertyp,
  Verzeichnis, WebDAV-URL, Benutzer, optional `vorlageVon` (übernimmt Chat,
  Verarbeitung ohne Verbindung, Ingest-Schalter; nie Zugangsdaten,
  Veröffentlichung, Binary-Storage, Agentensicht).
- **Was danach offen bleibt**, und was ohne Antwort passiert:

| Entscheidung | Feld | Ohne Antwort |
|---|---|---|
| Geheimnis des Speichers | `nextcloud.appPassword`, OneDrive-Login | Library ist nicht erreichbar (`verbindung: ausstehend`) |
| Vorlage (Journalist) | `secretaryService.template` | Standard-Vorlage des Inhaltstyps (F11), funktioniert |
| Zielsprache der Transformation | `secretaryService.targetLanguage` | Vorgabe der Pipeline |
| PDF-Extraktionsmethode | `secretaryService.pdfExtractionMethod` | `mistral_ocr` |
| Sprachen der Aufnahmen | `transcriptionLanguages` | Modell entscheidet je Stück, übersetzt gemischte Rede (Prüffall 09.10.) |
| Bekannte Namen | `extractionKnownNames` | Hörfehler bei Namen bleiben |
| Facetten (welche Metafelder filterbar sind) | `chat.gallery.facets` | Galerie ohne Filter, Story ohne Facetten-Platzhalter |
| Graph sichtbar | `chat.gallery.graph.enabled` | Graph aus |
| Wizards „Inhalte erfassen" | `captureWizards` | nur der Standard-Wizard (`curateCreationTypes`) |
| Antwortsprache, Perspektive, Antwortregeln | `chat.targetLanguage`, `character`, `antwortregeln` | generische Vorgaben |
| Cover-Bild generieren | `secretaryService.generateCoverImage` | aus |
| Modelle (Chat, Embeddings) | `chat.models`, `chat.embeddings` | Umgebungs-Vorgabe (`voyage-3-large`); Embedding-Modell ist nach dem Ingest nicht mehr wechselbar ohne Re-Ingest |
| Veröffentlichung (Slug, öffentlich) | `publicPublishing` | privat; eigenes Werkzeug `veroeffentlichung_setzen` |
| Übersetzungen | `translations.targetLocales` | keine |
| Agentensicht | `agentView` | aus |

Was die Brücke heute schon fest setzt und nie fragt: Shadow Twin v2 mit Mongo,
eigener Vektor-Collection-Name, `transcription: shadowTwin`.

## 3. Teil A: Speicher-Verbindungen gehören der Person

### Zielmodell

```
Person (E-Mail)
└─ storage_connections[]           neu, eigene Collection
   ├─ id, ownerEmail, label, type   nextcloud | onedrive
   ├─ nextcloud: webdavUrl, username, appPassword*     * verschlüsselt
   ├─ onedrive: tenantId, clientId, clientSecret*, accessToken*, refreshToken*, tokenExpiry
   └─ lastTestedAt, createdAt, updatedAt

Library
├─ storageConnectionId             neu (fehlt bei type = local)
├─ path                            Verzeichnis auf der Verbindung (wie heute)
└─ config                          OHNE clientId/clientSecret/tenantId/nextcloud/Tokens

LibraryMember (PR 4)
└─ storageConnectionId             eigene Verbindung des Mitglieds, ersetzt localPathOverride
```

Lokale Libraries brauchen keine Verbindung, weil es dort kein Geheimnis gibt
(E1 in §6 fragt, ob sie der Einheitlichkeit wegen trotzdem eine bekommen).

### Auflösung zur Laufzeit

1. `getServerProvider(userEmail, libraryId)` lädt die Library, dann die
   Verbindung des handelnden Nutzers (Owner: die der Library; Member ab PR 4:
   die eigene). Fehlt sie bei `type ≠ local`: Fehler, kein Rückfall
   (no-silent-fallbacks).
2. Die Factory baut den Provider aus Verbindung plus `path`. Cache-Schlüssel:
   Verbindungs-Id, Pfad, Server-Kontext. Die Config mit Geheimnissen verlässt
   das Repository nicht mehr.
3. Der OneDrive-Token-Store (`token-db.ts`) liest und schreibt an der
   Verbindung. Ein Login gilt für alle Libraries auf dieser Verbindung; die
   Re-Auth (F2 im Settings-UX-Konzept) läuft einmal statt je Library.
4. Die Nextcloud-Proxy-Route (`src/app/api/storage/nextcloud/route.ts`) lädt
   die Verbindung über die Library, nicht mehr `config.nextcloud`.
5. Der Browser-Schlüssel für OneDrive-Tokens wird `onedrive_tokens_<connectionId>`.

### Verschlüsselung und Migration

- Verschlüsselung im selben Zug (E2): Die Daten werden ohnehin bewegt. Grundlage
  ist Commit `63a64bb9` (`credential-cipher.ts`, `library-credentials.ts`,
  `masked-secret.ts`, Schlüssel aus `CREDENTIALS_ENCRYPTION_KEY`); der
  Verschlüsselungs-Teil wandert ins Verbindungs-Repository statt in
  `library-service.ts`.
- Migrationsskript (`scripts/`): je Library mit Zugangsdaten eine Verbindung
  anlegen, gleiche Zugänge zusammenlegen (Nextcloud: WebDAV-URL plus Benutzer;
  OneDrive: Tenant plus Client-Id), Library auf die Verbindung umhängen,
  Altfelder leeren. Vorher Backup nach `backups/` (Muster vom 07.07.2026). Läuft
  beim Owner im Terminal gegen Dev, dann Prod.
- Nach der Migration lesen Factory und Routen die Altfelder nicht mehr. Kein
  Übergangs-Rückfall; wer eine nicht migrierte Library trifft, sieht den Fehler.

### Was mit umgeräumt wird

- Token-Route und Refresh-Route ohne `X-Internal-Request`-Umgehung; interne
  Aufrufe gehen direkt an das Repository.
- Klartext-Logs der Geheimnisse (PATCH-Route, Refresh-Route, Nextcloud-Proxy)
  entfernen.
- `preserveMaskedSecrets` und die Sonderbehandlung von `clientSecret` und
  `nextcloud` in der PATCH-Route werden kleiner, weil die Felder die Library
  verlassen.
- Die Storage-Felder in `use-storage-form.ts` und `storage-wizard.tsx`
  (Schritte 2 und 3 des Wizards, Design `docs/settings-ux/05-storage-wizard.md`)
  ziehen auf die Konto-Seite um; der Library-Schritt behält Verbindung wählen,
  Verzeichnis wählen, Test.
- Bild-Speicher (`ingestionStorage`, Azure) und Secretary-Verbindung
  (`secretaryService.apiUrl/apiKey`) sind dieselbe Art Geheimnis. Sie bleiben
  in diesem Plan an der Library; ein späterer Schritt kann sie zu
  Konto-Verbindungen vom Typ `azure-blob` und `secretary` machen.

### Contracts, die gelten

`storage-abstraction.md` (UI fragt den Typ nur im Einstellungs-Formular),
`storage-contracts.md` (Provider-Interface, Factory ist der einzige Einstieg),
`no-silent-fallbacks.md`, `mongodb-repository-pattern.md`,
`library-config-field.md` (fünf Stellen je Feld), ADR 0005 (wird mit PR 4
von „zurückgestellt" auf „aktiv" gesetzt und um das Verbindungsmodell ergänzt).

## 4. Teil B: Seitenmenü mit Unterpunkten

```
meSpace · Meine Bibliothek
├─ Library
├─ Archive                   1 Quelle · 2 Inhaltstyp · 3 Verarbeitung · 4 Erfassen (Wizards, neu hier)
├─ Explore
├─ Story
└─ Erweitert  ▾
    ├─ Suche & KI            [Chat-Config]      RAG, LLM-Modell, Graph-Encoding, Facetten, Bild-Speicher
    ├─ Speicher & Twins      [Library-Config]   Shadow-Twin-Modus, Dateisystem-Optionen,
    │                                            Medien-Speicher-Strategie, Scan-Ausschluss
    ├─ Verarbeitung          [Secretary-Config] Vorlage, Transkription & Modellwahl,
    │                                            Service-Einstellungen, Teams-Aufzeichnung
    ├─ Extraktion            [Library-Config]   bekannte Namen, Sprachen der Aufnahmen, Anhänge als Text
    ├─ DIVA                  [Library-Config]   Daten auswerten, Konfidenz-Schwelle, Dateilisten-Vorgaben
    ├─ Agentensicht          [Library-Config]   Konfiguration, Bericht als Zustand
    └─ Wartung               [Werkzeuge]        Dokument-Angaben prüfen, Speicher-Abgleich,
                                                 Sprachbereinigung, Export / Import
weSpace · Gemeinsam arbeiten
└─ Personen
Mein Konto
├─ Mein Zugang               MCP-Brücke (wie heute)
└─ Speicher-Verbindungen     neu (Teil A, PR 1)
usSpace · Veröffentlichen
├─ Öffentlicher Auftritt
└─ Zugriffsanfragen
```

Regeln für die Umsetzung:

- **Eine Seite, ein Config-Objekt, ein Speichern-Knopf.** Bild-Speicher bleibt
  vorerst bei „Suche & KI", weil er im Chat-Config liegt; er zieht um, sobald
  er eine Konto-Verbindung wird (§3).
- **Merge beim Speichern beachten.** Die Formulare speichern über
  `POST /api/libraries` (`src/app/api/libraries/route.ts`, Library-,
  Secretary-Formular) oder `PATCH /api/libraries/[id]`. Beide führen die
  Config nur **auf oberster Ebene** zusammen (PATCH zusätzlich tief für
  `chat`, gesondert für `nextcloud` und `ingestionStorage`): ein
  mitgeschickter Schlüssel wie `secretaryService`, `agentView`,
  `divaArchiveDefaults` oder `shadowTwin` ersetzt das gespeicherte Objekt
  **als Ganzes**; nicht mitgeschickte Schlüssel bleiben unberührt. Regel
  für die Teil-Seiten: jede Seite schickt nur die Schlüssel, die ihr
  gehören, und ein Objekt, das sich zwei Seiten teilen (`secretaryService`
  liegt auf Archive · Verarbeitung UND auf Erweitert · Verarbeitung),
  vollständig: gespeichertes Objekt plus eigene Felder. Ein Test je
  geteiltem Objekt belegt, dass Speichern der einen Seite die Felder der
  anderen nicht löscht. Die Routen bleiben unverändert.
- **`SidebarNav`**: `SidebarNavItem` bekommt optional `children`; ein Eintrag
  mit Kindern rendert aufgeklappt, wenn `pathname` mit seinem `href` beginnt.
  Mobil (horizontale Leiste) zeigen die Kinder als eigene Chips neben dem
  Elternteil. Die alte Route `/settings/advanced` leitet auf „Suche & KI" weiter.
- **Library-Formular zerlegen.** `library-advanced-form.tsx` (423 Zeilen) hält
  alle Felder in einem React-Hook-Form. Je Seite entsteht ein eigenes Formular
  mit eigenem Zod-Schema und eigenem `onSubmit`; die bestehenden
  Section-Komponenten (`shadow-twin-config-section`, `agent-view-config-section`,
  …) bleiben und bekommen das jeweilige `form`. Die fünf Stellen aus
  `library-config-field.md` gelten je Teil-Formular.
- **Überschrift „Speicher-Abgleich"** über Scan-Ausschluss, bekannte Namen,
  Sprachen und Anhängen ist falsch; die Felder verteilen sich auf
  „Speicher & Twins" (Scan-Ausschluss) und „Extraktion" (Rest).
- Contract `welle-3-iv-settings-contracts.md` (Client-Direktive, erlaubte
  API-Pfade, Sub-Modul-Struktur) gilt für alle neuen Seiten.

Teil B hängt nicht an Teil A und kann als erster PR gehen. Den Eintrag
„Speicher-Verbindungen" unter Mein Konto legt erst A1 an, zusammen mit der
Seite; B1 baut nur die zweite Menü-Ebene, die er braucht.

## 5. Teil C: Vollständige Library-Anlage

### Entscheidungskatalog (Vorschlag zur Abnahme, E6)

Gewichte: **Pflicht** = ohne Antwort läuft nichts; **Empfohlen** = läuft mit
Vorgabe, aber spürbar schlechter, der Wizard fragt, man darf überspringen und
sieht „offen"; **Später** = Vorgabe reicht, nur in den Settings.

| # | Entscheidung | Gewicht | Gilt wenn | Vorgabe ohne Antwort |
|---|---|---|---|---|
| 1 | Name | Pflicht | immer | — |
| 2 | Inhaltstyp (`detailViewType`) | Pflicht | immer | — (bestimmt Standard-Vorlage, Pflichtfelder, Detailansicht) |
| 3 | Speicher: Verbindung + Verzeichnis, Verbindungstest | Pflicht | `type ≠ local` | — (bis Teil A: Typ + Geheimnis in der UI) |
| 4 | Vorlage-Library (`vorlageVon`) | Empfohlen | andere Library gleichen Typs vorhanden | nichts übernommen |
| 5 | Facetten: welche Metafelder filterbar sind | Empfohlen | immer | keine; **Vorschlag**: Standard-Facetten je Inhaltstyp aus den Feldern der Standard-Vorlage ableiten (E8), wie F11 für Vorlagen |
| 6 | Graph sichtbar | Empfohlen | immer | aus |
| 7 | Sprachen der Aufnahmen | Empfohlen | Audio/Video erwartet | Modell entscheidet je Stück |
| 8 | Bekannte Namen / Organisationen | Empfohlen | Audio/Video erwartet | keine |
| 9 | Antwortsprache des Story-Modus | Empfohlen | immer | Vorgabe |
| 10 | Antwortregeln | Empfohlen | immer | keine |
| 11 | Wizards „Inhalte erfassen" | Empfohlen | Inhaltstyp mit Wizards (`session`, …) | nur Standard-Wizard |
| 12 | Zielsprache der Transformation | Später | — | Pipeline-Vorgabe |
| 13 | Vorlage (Journalist) statt Standard | Später | — | Standard-Vorlage des Inhaltstyps |
| 14 | PDF-Extraktionsmethode | Später | — | `mistral_ocr` |
| 15 | Cover-Bild generieren + Prompt | Später | — | aus |
| 16 | Perspektive (Charakter, sozialer Kontext) | Später | — | Vorgabe |
| 17 | Modelle Chat/Embeddings | Später, Experte | — | Umgebung; Hinweis im Wizard, dass das Embedding-Modell nach dem ersten Ingest fest ist |
| 18 | Veröffentlichung, Übersetzungen | Später | — | privat, keine |
| 19 | Agentensicht, DIVA | Später | Archiv-Libraries, DIVA-Libraries | aus |

Fest, keine Frage: Shadow Twin v2/Mongo, Vektor-Collection-Name, Secretary-
Verbindung aus der Umgebung.

### Eine Quelle für App, Brücke und Settings

`src/lib/library-setup/entscheidungen.ts` beschreibt jede Zeile der Tabelle
(Schlüssel, Feldpfad, Gewicht, Bedingung, Vorgabe, Frage-Text, Optionen) und
liefert `pruefeEinrichtung(library)` → offene Entscheidungen. Davon leben:

- der **App-Wizard** (C2), der die Fragen in dieser Reihenfolge stellt:
  Grundlagen → Quelle → Verarbeitung → Finden → Story → Erfassen →
  Zusammenfassung; Pflicht blockiert, Empfohlen ist überspringbar;
- die **Brücke** (C3): `bibliothek_anlegen` legt nur an, wenn alle Pflicht- und
  Empfohlen-Entscheidungen beantwortet oder bewusst übersprungen sind
  (`ueberspringen: ['graph', …]`). Sonst antwortet es ohne Anlage mit
  `offeneEntscheidungen` (je Eintrag Frage, Optionen, Vorgabe, Gewicht). Der
  Agent fragt den Menschen und ruft erneut auf. `vorlageVon` beantwortet, was
  die Vorlage trägt. Neues lesendes Werkzeug `bibliothek_pruefen` liefert
  dieselbe Liste für bestehende Libraries, damit man Nachzügler findet.
- die **Settings-Übersicht**, die „Einrichtung: n von m" zeigt und auf die
  offene Seite verlinkt.

Echte MCP-Rückfragen (Elicitation, `server.elicitInput`, im SDK 1.26 vorhanden)
sind eine spätere Verschönerung, sobald belegt ist, dass der eingesetzte
Client sie beherrscht. Der Fragenkatalog in der Antwort funktioniert mit jedem
Client und bleibt die Grundlage.

## 6. Owner-Entscheide vor dem Bau

**Alle acht am 13.10.2026 vom Owner wie empfohlen bestätigt.** Die Tabelle
bleibt als Begründung stehen.

| # | Frage | Entscheidung (= Empfehlung) |
|---|---|---|
| E1 | Lokale Libraries ebenfalls als Verbindung (Wurzelpfad am Konto) modellieren? | Nein; lokal hat kein Geheimnis, `path` bleibt absolut |
| E2 | Verschlüsselung im selben Zug (PR 1) oder davor als eigener PR? | Im selben Zug, Grundlage Commit 63a64bb9 |
| E3 | DIVA als Unterpunkt immer sichtbar oder nur bei eingeschaltetem Schalter? | Immer sichtbar (E6 des Settings-UX-Konzepts: kein versteckter Modus) |
| E4 | Extraktion eigener Unterpunkt oder in „Verarbeitung" (zwei Formulare)? | Eigener Unterpunkt |
| E5 | „Inhalte erfassen" (Wizards) auf die Archive-Seite als Schritt 4? | Ja |
| E6 | Gewichte der Tabelle in §5 | wie vorgeschlagen; Zeilen 7 und 8 nur fragen, wenn Audio erwartet wird |
| E7 | Rückfragen über die Brücke: Fragenkatalog in der Antwort oder MCP-Elicitation? | Fragenkatalog als Basis, Elicitation später |
| E8 | Standard-Facetten je Inhaltstyp (analog F11) einführen? | Ja, als eigener kleiner Schritt in C1 |

## 7. Reihenfolge und Schätzung

| Schritt | Hängt an | Diff | Modell |
|---|---|---|---|
| B1 Seitenmenü | — | mittel (Routen, Nav, Formular-Zerlegung) | Sonnet |
| A1 Verbindungen-Modell + Konto-Seite | B1 (Route) | mittel | Opus (Verschlüsselung, Repository) |
| A2 Library auf Verbindung + Migration | A1 | groß; Prod-Migration beim Owner | Opus |
| A3 Brücke Verbindungen | A2 | klein | Sonnet |
| C1 Entscheidungskatalog + E8 Standard-Facetten | — | klein | Sonnet |
| C2 App-Wizard | C1, A2 (Quelle-Schritt) | mittel | Sonnet |
| C3 Brücke Rückfragen + `bibliothek_pruefen` | C1 | klein | Sonnet |
| A4 Mitglieder eigene Verbindung (ADR 0005) | A2; Prüffall ID-Konsistenz | mittel | Opus |

Jeder Schritt ein PR nach `refactor-batch-strategy.md`; `pnpm build` lokal grün
vor dem Merge; A2 zusätzlich Migrations-Probelauf gegen Dev mit Backup.

## 8. Verweise

- `docs/adr/0005-co-creator-eigene-storage-auth.md` (wird mit A4 aktiv)
- `docs/settings-ux/README.md` (F1 bis F11, E6), `05-storage-wizard.md`
- `docs/per-user-storage-path-analyse.md` (Variante A, wird durch A4 abgelöst)
- `docs/contracts/library-config-field.md`, `welle-3-iv-settings-contracts.md`,
  `storage-contracts.md`, `storage-abstraction.md`
- `docs/concepts/mcp-library-betrieb.md` (Brücken-Werkzeuge)
- `docs/plans/geplant/bruecke-library-betrieb.plan.md` (Use Case 1 Konfigurieren)
- Commit `63a64bb9` auf `origin/claude/lucid-planck-b9i6gj` (Verschlüsselung)

## 9. Start-Prompts

Jeder Schritt startet als **neue** Session, ab `master`, ein PR je Schritt.
Pflicht in jeder Session: `pnpm test`, `pnpm lint` und die volle
tsc-Prüfung mit Vorher/Nachher-Vergleich aus `AGENTS.md` (Abschnitt
„Test- und Lint-Commands"); kein `pnpm build` in der Cloud, den fährt der
Owner lokal mit `bash scripts/welle-pre-merge-check.sh` vor dem Merge.
Grenzen: 200 Zeilen je Datei, 1.000 Zeilen Diff je Commit, 5.000 je PR,
15 Commits je PR. Owner-Regel: Knopf- und Menüzeilen brechen nie um (kein
`flex-wrap`; bei Platzmangel nur Symbol, Text im Tooltip). Hand-off nach
`docs/agents-handbuch.md` §5 im PR-Body.

### B1 Seitenmenü „Erweitert" (Sonnet, Thinking mittel)

> Lies `CLAUDE.md`, `AGENTS.md`, `docs/STAND.md` (Zwischenschnitt
> „Speicher-Verbindungen und Library-Anlage") und
> `docs/plans/speicher-verbindungen-und-library-anlage.plan.md`, vor allem
> §2b und §4. Lade den Skill `contracts-ui` und lies
> `docs/contracts/welle-3-iv-settings-contracts.md` und
> `docs/contracts/library-config-field.md`.
>
> Baue Schritt B1 auf dem Branch `claude/speicher-b1-seitenmenue-erweitert`:
>
> 1. `src/components/settings/sidebar-nav.tsx`: `SidebarNavItem` bekommt
>    optional `children`. Ein Eintrag mit Kindern zeigt sie aufgeklappt,
>    sobald `pathname` mit seinem `href` beginnt; aktiv markiert ist das
>    Kind. Mobil (horizontale Leiste unter `lg`) erscheinen die Kinder als
>    eigene Einträge neben dem Elternteil, ohne Umbruch.
> 2. In `src/app/settings/layout.tsx` bekommt „Erweitert" sieben Kinder:
>    `/settings/advanced/suche-ki`, `/speicher-twins`, `/verarbeitung`,
>    `/extraktion`, `/diva`, `/agentensicht`, `/wartung`. Die Zuordnung der
>    heutigen Abschnitte steht im Baum in §4. `/settings/advanced` leitet auf
>    `/settings/advanced/suche-ki` weiter; suche vorher mit grep alle Links
>    auf `/settings/advanced` (App, Brücke, Doku) und prüfe, ob sie auf eine
>    Unterseite zeigen sollten.
> 3. Zerlege `src/components/settings/library/library-advanced-form.tsx`
>    (heute ein React-Hook-Form für alles) in Teil-Formulare je Seite:
>    Speicher & Twins, Extraktion, DIVA, Agentensicht. Die vorhandenen
>    Section-Komponenten bleiben und bekommen ihr `form`. Sprachbereinigung
>    und Export/Import ziehen auf die Seite Wartung, zusammen mit den
>    Panels Dokument-Angaben prüfen und Speicher-Abgleich. Die falsche
>    Überschrift „Speicher-Abgleich" über Scan-Ausschluss, bekannten Namen,
>    Sprachen und Anhängen verschwindet dabei (§4).
> 4. „Inhalte erfassen" (`captureWizards`) zieht auf die Archive-Seite als
>    Schritt „4 · Erfassen".
> 5. Speichern: Regel „Merge beim Speichern beachten" in §4. Jede Seite
>    schickt nur ihre Config-Schlüssel; `secretaryService` teilen sich
>    Archive · Verarbeitung und Erweitert · Verarbeitung, also wird es
>    vollständig geschickt (gespeichertes Objekt plus eigene Felder). Ein
>    Unit-Test belegt für jedes geteilte Objekt, dass Speichern der einen
>    Seite die Felder der anderen nicht löscht. Die API-Routen bleiben
>    unverändert.
> 6. Der Konto-Eintrag „Speicher-Verbindungen" gehört NICHT in diesen
>    Schritt, er kommt mit A1.
>
> Kein Verhalten ändert sich außer der Navigation: jedes Feld ist danach
> auf genau einer Seite und speichert dasselbe wie vorher. Melde im PR,
> welche Felder wohin gewandert sind (Tabelle alt → neu). Setze im Plan den
> Marker von `b1-seitenmenue-erweitert` auf `completed` mit Kurzbeleg und
> trage den Stand im Zwischenschnitt von `docs/STAND.md` nach.
> Live-Prüfung im Browser macht der Owner lokal; nenne im PR die Klickwege
> dafür.

### C1 Entscheidungskatalog (Sonnet, Thinking mittel; parallel zu B1 möglich)

> Lies `CLAUDE.md`, `AGENTS.md`, `docs/STAND.md` und
> `docs/plans/speicher-verbindungen-und-library-anlage.plan.md` §2c und §5.
> Lade den Skill `checklisten-erweiterung`.
>
> Baue Schritt C1 auf dem Branch `claude/speicher-c1-entscheidungskatalog`:
> `src/lib/library-setup/entscheidungen.ts` beschreibt die 19 Zeilen der
> Tabelle in §5 als Daten (Schlüssel, Feldpfad in der Library-Config,
> Gewicht `pflicht | empfohlen | spaeter`, Bedingung, Vorgabe ohne Antwort,
> Frage-Text, Optionen) und liefert `pruefeEinrichtung(library)` mit der
> Liste offener Entscheidungen; Bedingungen (Audio erwartet, Inhaltstyp mit
> Wizards) als reine Funktionen. Dazu E8: Standard-Facetten je Inhaltstyp,
> abgeleitet aus den Feldern der Standard-Vorlage (`standard-<typ>`,
> `src/lib/templates/default-templates.ts`), analog zu F11 im
> Settings-UX-Konzept, mit CI-Test wie dort. Reine Funktionen, keine UI,
> keine Route; Tests unter `tests/unit/library-setup/`. Keine stillen
> Vorgaben: was ohne Antwort gilt, steht als `vorgabe` im Katalog und nicht
> verstreut im Code. Marker `c1-entscheidungskatalog` im Plan auf
> `completed` setzen, Stand in `docs/STAND.md` nachtragen.

Die Prompts für A1 bis A4, C2 und C3 schreibt die Session, die den
vorangehenden Schritt abschließt, in ihren Hand-off.
