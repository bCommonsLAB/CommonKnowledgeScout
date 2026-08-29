---
name: Storage-Abstraktion über MCP (Wellen ST1–ST4)
overview: >-
  Die KnowledgeScout-Storage-Schicht wird über die bestehende MCP-Brücke für
  Agenten zugänglich — ein Zugang für OneDrive, Nextcloud und Filesystem,
  unabhängig davon, ob ein Desktop läuft. Anforderungsquelle ist die
  Cowork-Sitzung vom 27.08.2026 (`docs/concepts/mcp-storage-anforderungen.md`):
  jede Anforderung hat einen Beleg, keine Wunschliste. Der Kern ist NICHT die
  MCP-Schicht (die steht), sondern eine Versionierungs-Fähigkeit im
  Provider-Vertrag — `version` + In-Place-`updateFile` mit `ifVersion` —, die
  heute fehlt und ohne die jeder Schreibvorgang ein delete+upload ist (neue
  itemId, verlorene Referenzen, keine Konflikterkennung). Vier Wellen, je eine
  PR. Der Strang ist bewusst so geschnitten, dass er NEBEN der laufenden
  Modularisierung (M1–M8) läuft, ohne mit ihr zu kollidieren — siehe §2.
todos:
  - id: st1-provider-versionierung
    content: "Welle ST1 — Versionierung im Provider-Vertrag. NEUE Datei packages/contracts/src/storage-versioning.ts mit dem Capability-Interface StorageVersioning (updateFile mit ifVersion, VersionsKonflikt-Fehler mit aktuellem Inhalt + Version). EIN angehängtes optionales Feld version?: string in StorageItemMetadata (storage-provider.ts, append-only). Implementierung in allen drei Providern: OneDrive (eTag — muss in selectFields ergänzt werden, fehlt heute), Nextcloud (eTag aus PROPFIND/FileStat), Filesystem (mtimeMs+size als synthetische Version). Feature-Detection statt Pflicht-Interface (storage-contracts §1). Kein neues Paket, keine Änderung an next.config.js/tsconfig/workspace."
    status: completed
  - id: st1-cache-invalidierung
    content: "Welle ST1, Teil 2 — provider-request-cache.ts kennt eine EXPLIZITE Mutations-Allowlist (createFolder/uploadFile/deleteItem/moveItem/renameItem). Ein neues updateFile würde dort still durchs Raster fallen und veraltete Reads liefern. updateFile in die Allowlist aufnehmen; Unit-Test, der genau das absichert (Read, updateFile, Read → zweiter Read sieht den neuen Stand)."
    status: completed
  - id: st1-beweisziel
    content: "Welle ST1, Beweis-Ziel (Verhaltensneutralität nach G4-Vorbild): die bestehenden delete+upload-Stellen auf updateFile umstellen. KORREKTUR gegenüber der Planannahme: stand-ausfuehren.ts war bereits saniert (ersetzeIndex ruft nur noch uploadMarkdown, Befund 27.08.2026) — der deleteFile-Port dort ist seither totes Interface. Die zwei ECHTEN Stellen waren erschliessung_block_schreiben (src/lib/mcp/tools-aenderungen.ts) und ueberschreiben() in src/lib/agent-view/sichten/regenerate-sichten.ts. Beide laufen jetzt über den gemeinsamen Helfer src/lib/storage/update-text-file.ts."
    status: completed
  - id: st2-tools-stufe1
    content: "Welle ST2 — MCP-Werkzeuge Stufe 1 unter src/lib/mcp/storage/: ordner_listen (limit/cursor Pflicht, Metadaten je Eintrag, Glob, begrenzte Tiefe), datei_lesen (bereich: frontmatter|abschnitt|zeilen; maxBytes/offset, gekuerzt+naechsterOffset), stat, pfad_aufloesen, datei_schreiben (ifVersion Pflicht, Konfliktantwort MIT aktuellem Inhalt nach Q1). Jedes Werkzeug akzeptiert pfad ODER id (A2) und liefert BEIDE zurück (A1). Registrierung: eine Zeile in tools.ts, TOOLSET_VERSION auf 2.7.0. ABWEICHUNG vom ursprünglichen Zuschnitt: loeschen ist nach ST4 verschoben — der Papierkorb ist je Provider verschieden (Filesystem hat keinen), und ein loeschen mit inPapierkorb:true als Default wäre bis zur ST4-Ehrlichkeit ein Versprechen, das ein Provider nicht hält."
    status: completed
  - id: st2-schreibschutz
    content: "Welle ST2, Teil 2 — Schreibschutz auf Pfadmustern, damit die generische Schicht nicht an den Fachwerkzeugen vorbeischreibt (offene Frage §6 der Anforderungen). _INDEX.md ist für datei_schreiben/datei_patchen gesperrt (gehört stand_setzen/themen_setzen), Twin-Ordner (_*) sind gesperrt (gehören twins_synchronisieren). Fehlerbild nicht_unterstuetzt mit Nennung des zuständigen Fachwerkzeugs — kein stiller Skip."
    status: completed
  - id: st3-patchen
    content: "Welle ST3 — datei_patchen, das teuerste fehlende Werkzeug (Beleg: 8 Voll-Rewrites von BERICHT.md/_INDEX.md an einem Tag, ~80 kB für ~400 Bytes echte Änderung). Drei Modi: ersetze {altText,neuText} mit Eindeutigkeits-Zwang (genau ein Treffer, sonst Fehler), abschnitt_ersetzen {ueberschrift,neuerInhalt} bis zur nächsten gleichrangigen Überschrift, frontmatter_setzen (ZWINGEND über den bestehenden Frontmatter-Single-Serializer, Contract frontmatter-single-serializer; flache snake_case-Keys, kein nested YAML). Alle mit ifVersion; bei Konflikt kommt der aktuelle Inhalt MIT zurück, damit der Aufrufer ohne zweiten Read mergen kann (Q1)."
    status: completed
  - id: st4-stufe2-fehler
    content: "Welle ST4 — Stufe 2 + Querschnitt: loeschen (aus ST2 hierher verschoben, siehe dort — untrennbar von der Papierkorb-Ehrlichkeit unten), datei_anlegen (nichtUeberschreiben default true), ordner_anlegen, verschieben (deckt Umbenennen ab; kennt KEINE Twin-Familien — die bleiben in familie_umziehen eine Ebene darüber), speicher_info (provider, grossKleinSchreibungRelevant, pfadLimit, maxDateigroesse, papierkorbVorhanden, unterstuetzt{patch,ifVersion,delta,binaer}, unicodeNormalisierung). Dazu die einheitlichen Fehlerbilder Q5 (nicht_gefunden, konflikt, zu_gross, pfad_zu_lang, kein_zugriff, nur_lesen, gesperrt, nicht_unterstuetzt, zeitueberschreitung) als Mapping-Schicht über die heterogenen Provider-Fehler."
    status: completed
  - id: st4-papierkorb-ehrlich
    content: "Welle ST4, Teil 2 — Papierkorb ehrlich melden statt vortäuschen. FilesystemProvider.deleteItem löscht heute HART (fs.rm/fs.unlink, filesystem-provider.ts:303-315); OneDrive und Nextcloud haben einen Papierkorb. speicher_info meldet papierkorbVorhanden je Provider wahrheitsgemäß, und loeschen verweigert bei papierkorbVorhanden=false den Default inPapierkorb:true, statt still hart zu löschen (no-silent-fallbacks). Archiv-Grundregel 'Gelöscht wird nie' bleibt damit prüfbar."
    status: completed
  - id: st4-doku
    content: "Welle ST4, Teil 3 — docs/contracts/storage-contracts.md um einen §9 'Versionierung & generischer Schreibweg' ergänzen (Capability-Interface, ifVersion-Semantik, Schreibschutz-Pfadmuster); CLAUDE.md Routing-Index um die Zeile src/lib/mcp/storage/** ergänzen; den Skill archiv-aufraeumen um die neuen Werkzeuge erweitern und den Werkzeugsatz in tools-info.ts hochziehen (TOOLSET_VERSION), damit bruecke_info veraltete Client-Toollisten weiter sichtbar macht."
    status: completed
  - id: st5-live-befunde
    content: "Welle ST5 (erledigt) — die drei Befunde aus dem Live-Test vom 28.08.2026: (a) Schreibschutz kennt jetzt die AKTION, nicht nur den Pfad — geschützt ist der Feldkern der _INDEX.md (Frontmatter, Voll-Ersatz, Löschen, Verschiebe-Ziel), Fließtext und Anlegen sind frei; damit bekommt ein neuer Ordner wieder seinen Contract. (b) SICHERHEITSLÜCKE: verschieben prüfte den Schreibschutz gar nicht — mit ueberschreiben:true ließ sich eine fremde _INDEX.md samt Bearbeitungsstand ersetzen, ohne ifVersion und ohne Schutzstufen; jetzt werden Ziel- UND Quellpfad geprüft. (c) Q5-Codes existiert_bereits und nicht_eindeutig statt unbekannt. Dazu: OneDrive meldete zeitstempelGenauigkeit millisekunde, lieferte aber .000Z — steht jetzt auf null. TOOLSET_VERSION 2.10.0."
    status: completed
  - id: st9-stapel-und-ehrliche-jobliste
    content: "Welle ST9 (erledigt, aus der Praxisbilanz 28.08.2026) — (a) familie_umziehen nimmt sourceIds (bis 30, alle in DENSELBEN Ziel-Ordner, Umbenennen bleibt Einzeloperation): 'besprechungen/ zu zerlegen kostete 26 Aufrufe' — der größte Zeitfresser, der einfachste Fix, dasselbe Stapel-Muster wie bei den Jobs (Fehler einer Quelle bricht den Stapel nicht ab). (b) job_liste ohne Filter nennt zusätzlich gescheitertKuerzlich (Fehlschläge der letzten Stunde, mit jobIds für job_status): die Liste meldete Ruhe, während 14 von 15 Jobs gescheitert waren. TOOLSET_VERSION 2.15.0."
    status: completed
  - id: coverage-nachfuehrung-ordner-umzug
    content: "Coverage-Nachführung nach Ordner-Umzug (Praxisbilanz 28.08.2026): `verschieben` auf einen Ordner hinterlässt die Coverage-Sicht am alten Pfad — nur ein voller Scan über die Werkbank räumt das weg, bei 19 Vorhaben also 19-mal Handarbeit für Peter. Gehört NICHT in die Storage-Schicht (Abgrenzung §4), sondern als Nachführung in die Agent-View. Vorab zu entscheiden: Umzug merged den Teilbaum im gespeicherten Report um (analog zum Teilbaum-Scan-Merge aus W8), ODER er markiert ihn nur als veraltet und der nächste Teilbaum-Scan zieht nach. Die Merge-Variante ist die bessere Nutzererfahrung, braucht aber Pfad-Umschreibung im Report-Baum."
    status: pending
  - id: q7-job-modus-scans
    content: "Q7/Job-Modus für lange Storage-Operationen (Praxisbilanz 28.08.2026, zweite Anforderung aus der Praxis): Scans über mehr als ~50 Ordner sind über die Brücke unmöglich (60-Sekunden-Limit) — der Skill fordert Gegenprüfen nach jedem Schritt, das geht nur teilbaumweise. War in den Anforderungen (Q7) benannt und bewusst auf Stufe 3 verschoben; die Praxis hat den Bedarf jetzt bestätigt. Zuschnitt: langlaufende Aufrufe (abdeckung_scannen ohne Scope, twins_pruefen ohne Scope, rekursives ordner_listen über die MAX_LISTINGS-Grenze) antworten sofort mit jobId statt zu blockieren; Ergebnis über job_status. Die External-Jobs-Infrastruktur (Worker, Repository, Trace) existiert — zu klären ist, ob Scan-Jobs dieselbe Collection nutzen oder eine eigene leichte Job-Art werden (ADR 0001 beachten: event-job vs. external-jobs sind getrennte Domänen)."
    status: pending
  - id: verschoben-stufe3
    content: "BEWUSST NICHT in diesem Strang (Stufe 3 der Anforderungen): suchen (kein Provider kann es heute einheitlich — OneDrive per Graph-Search, Nextcloud/Filesystem nur per Scan; braucht zusätzlich indexStand in der Antwort), wiederherstellen aus dem Papierkorb, dateien_lesen (Stapel), binaer_lesen mit range, kopieren, sperren/entsperren, Job-Modus mit jobId für lange Läufe (Q7). aenderungen_seit existiert bereits scanbasiert. Erst aufgreifen, wenn ST1–ST4 stehen und ein konkreter Bedarf da ist (G3, bedarfsgetrieben)."
    status: pending
---

# Storage-Abstraktion über MCP — Wellen ST1–ST4

## 1. Warum

Heute läuft der Agenten-Dateizugriff über zwei Wege, die beide nur OneDrive
kennen: Microsoft Graph (kann lesen, ganze Dateien überschreiben, löschen —
kein Patch, keine Sperre) und die Datei-Bridge zum Desktop (kann alles, aber
nur solange der Rechner läuft). Die Nextcloud-Bibliotheken sind von dort aus
unerreichbar, obwohl KnowledgeScout sie längst bedient.

Eine Storage-Schicht über MCP löst beides auf einmal: **ein Zugang, alle
Provider, unabhängig vom Desktop.** Und sie wird genau einmal gebaut, nicht
dreimal — weil sie auf `StorageProvider` sitzt, nicht auf einem Backend.

Anforderungen mit Belegen: `docs/concepts/mcp-storage-anforderungen.md`.

**Voraussetzung außerhalb dieses Plans:** Der MCP-Endpunkt muss erreichbar
deployt sein, nicht auf `localhost:3000`. Das ist Ops, kein Code — aber ohne
das trägt nichts davon.

## 2. Konfliktfreiheit mit der Modularisierung (M1–M8)

Der laufende Strang ist die Modularisierung (`AGENTS.md` §Aktueller Fahrplan).
Dieser Plan ist so geschnitten, dass beide Stränge sich **nicht berühren**.
Fünf Regeln, die das tragen:

### K1 — Kein neues Paket. Nie.

Jedes neue Paket fasst `pnpm-workspace.yaml`, `next.config.js`
(`transpilePackages`), Root-`tsconfig.json` (`paths`) und Root-`package.json`
an — **exakt die vier Dateien, die jede M-Welle ebenfalls anfasst** (M2
Schritt 5, und M3/M4 genauso). Ein `@ks/storage-mcp` wäre ein garantierter
Vierfach-Konflikt bei jedem Merge.

Also: alles bleibt in `src/lib/storage/**` und `src/lib/mcp/**`. Beide
Verzeichnisse sind bis Phase B in keinem M-Wellen-Zuschnitt.

### K2 — `@ks/contracts` nur append-only, und lieber eine neue Datei

Der einzige geteilte Berührungspunkt ist
`packages/contracts/src/storage-provider.ts` (in M2 per `git mv` entstanden).
Regel dafür:

- Das **Capability-Interface** `StorageVersioning` kommt in eine **NEUE Datei**
  `packages/contracts/src/storage-versioning.ts`. Neue Dateien haben null
  Merge-Fläche. Das ist zugleich vertragskonform: `storage-contracts.md` §1
  sagt ausdrücklich, optionale Zusatzfähigkeiten gehören per Feature-Detection
  dazu, **nicht** ins Pflicht-Interface.
- An `storage-provider.ts` selbst wird **eine einzige Zeile angehängt**:
  `version?: string` in `StorageItemMetadata`. Kein Umsortieren, kein
  Umbenennen, kein Reformatieren — sonst wird aus einem trivialen Anhängsel
  ein Konflikt über die ganze Datei.
- `index.ts` (Barrel) bekommt eine Export-Zeile. Falls eine M-Welle dort
  gleichzeitig anfügt: Ein-Zeilen-Konflikt, in Sekunden gelöst.

### K3 — Null Berührung mit der UI-Schicht

M3 zieht die Provider-Kette, Auth und TopNav in `@ks/shell`; M4 den Explorer.
Offene Frage der Landkarte §6: ob `src/contexts/storage-context.tsx` und
`src/hooks/use-storage-provider` in die Shell oder später in
`@ks/module-archive` gehören.

Dieser Strang fasst **keine** dieser Dateien an. Er ist reiner Server-Pfad:
`getServerProvider(userEmail, libraryId)` → Provider → MCP-Tool. Wohin die
React-Kette wandert, ist ihm gleichgültig.

### K4 — Neue Werkzeuge in neuen Dateien, ein Registrierungs-Einzeiler

`src/lib/mcp/tools.ts` bekommt genau eine Zeile
(`registerStorageTools(server)`) — dem Muster folgend, das dort bereits
zehnmal steht. Der Inhalt liegt unter `src/lib/mcp/storage/`.

Das zahlt sich später ein zweites Mal aus: **M7 will die MCP-Schicht per
`git mv` nach `@ks/module-agent-view` verschieben.** Ganze Dateien lassen sich
verschieben, ohne dass Git Inhalte mergen muss. Hätten wir die neuen Werkzeuge
in bestehende Dateien geschrieben, würde M7 zum Handarbeitsfall.

### K5 — Kurze Wellen, schnell auf `master`. Kein Dauerbranch.

Das ist die eigentliche Antwort auf „muss ich auf dem Branch bleiben?" —
siehe §3.

### Die Datei-Landkarte

| Dieser Strang fasst an | M-Wellen fassen an |
|---|---|
| `packages/contracts/src/storage-versioning.ts` *(neu)* | `pnpm-workspace.yaml` |
| `packages/contracts/src/storage-provider.ts` *(1 Zeile angehängt)* | `next.config.js`, Root-`tsconfig.json`, Root-`package.json` |
| `src/lib/storage/{onedrive,nextcloud,filesystem}-provider.ts` | `src/app/layout.tsx`, `src/contexts/**`, `src/hooks/**` |
| `src/lib/storage/provider-request-cache.ts` | `src/components/**` |
| `src/lib/mcp/storage/**` *(neu)* | `packages/shell/**`, `packages/module-*/**` |
| `src/lib/mcp/tools.ts` *(1 Zeile)* | `src/types/library.ts`, `src/lib/chat/constants.ts` |
| `src/lib/agent-view/stand-ausfuehren.ts` *(Beweis-Ziel ST1)* | — |
| `docs/contracts/storage-contracts.md`, `CLAUDE.md` (Routing-Zeile) | `docs/architecture/modul-landkarte.md`, `docs/refactor/modularisierung/**` |

Überschneidung: **eine Datei, eine angehängte Zeile.** Das ist so nah an null,
wie zwei parallele Stränge kommen.

### Was ausdrücklich TABU ist

- `src/lib/storage/storage-factory.ts` — wird für diesen Strang nicht
  gebraucht (`getServerProvider` liefert den Provider fertig) und ist ein
  Kandidat für spätere M-Wellen-Arbeit.
- Umbenennen oder Verschieben bestehender API-Routen — `migrations-strategie.md`
  verbietet das für die Dauer von Phase A explizit.
- „Kleine Verbesserungen nebenbei" in Dateien, die eine M-Welle gerade
  anfasst.

## 3. Musst du auf diesem Branch bleiben?

**Nein — und du solltest es nicht.** Ein langlebiger Branch, der neben vier
M-Wellen herläuft, erzeugt genau die Konflikte, die dieser Zuschnitt vermeidet.

Der Plan ist stattdessen: **vier kurze Wellen, jede eine eigene PR, jede von
aktuellem `master` gestartet und zügig zurückgemergt** — dieselbe Mechanik,
die die M-Wellen benutzen. Branch-Schema:
`claude/mcp-storage-welle-st1-<suffix>` usw.

Verzahnung mit den M-Wellen:

- **ST-Wellen und M-Wellen können sich beliebig abwechseln.** Es gibt keine
  Reihenfolge-Abhängigkeit — ST1 braucht von M2 nur, dass
  `packages/contracts/` existiert, und das ist gemergt.
- **ST1 und ST2 sollten NICHT gleichzeitig mit einer M-Welle offen sein**,
  wenn es sich vermeiden lässt — nicht wegen Konflikten (die sind
  ausgeschlossen), sondern weil zwei offene PRs auf `master` die
  Pre-Merge-Prüfung doppelt bezahlen.
- **Ausnahme, bei der zu warten ist:** M7 verschiebt `src/lib/mcp/**` in ein
  Paket. Ist M7 einmal offen, wartet jede ST-Welle darauf — das ist aber
  Phase B, also weit weg, und ST1–ST4 sind bis dahin längst durch.

Dieser Branch (`claude/cowork-archiv-cleanup-skill-zd86oi`) trägt nur den
Plan. Er ist nach dem Merge erledigt.

## 4. Die Wellen im Detail

### ST1 — Versionierung im Provider-Vertrag *(die schwere)*

Das Interface kennt heute **weder Version noch In-Place-Update**. Der einzige
Schreibweg ist `uploadFile(parentId, File)`; der Bestandscode macht deshalb
delete+upload — sichtbar in `tools-aenderungen.ts:121-122` und
`stand-ausfuehren.ts:61-67`. Das ist die Ursache des Vorfalls, bei dem
`stand_setzen` die `_INDEX.md` ersetzt statt geändert hat, und zugleich der
Grund, warum es keine Konflikterkennung gibt (Q1).

Je Provider:

| Provider | Version aus | Aufwand |
|---|---|---|
| OneDrive | `eTag` — **fehlt heute in `selectFields`** (`onedrive-provider.ts:1249,1330`), muss ergänzt werden | klein |
| Nextcloud | `etag` aus `FileStat` (PROPFIND), Schreiben per `If-Match` | mittel |
| Filesystem | synthetisch aus `mtimeMs` + `size` | klein |

**Bekannte Grenze, die ehrlich zu benennen ist (A3):** Der
Nextcloud-Provider kodiert den **Pfad als Id** (`idToPath`/`pathToId`,
`nextcloud-provider.ts:54,105`). Ids sind dort über Umzüge nicht stabil. Der
Umbau auf `fileid` aus dem PROPFIND wäre ein eigener, größerer Schnitt.
Empfehlung für ST1: nicht umbauen, sondern **melden** —
`idGeaendert: { alt, neu }` in der Antwort, wie es die Anforderung A3 als
Fallback selbst vorsieht. `speicher_info` sagt dann wahrheitsgemäß, wie
belastbar die Id bei diesem Provider ist.

### ST2 — Werkzeuge Stufe 1

Dünne Wrapper über den Provider, nach dem Muster der bestehenden Tools. Die
Arbeit steckt nicht im Provider-Aufruf, sondern in drei Querschnittsthemen:

- **Q2 (Antwortgrößen)** — jede Leseoperation `maxBytes`/`offset` +
  `gekuerzt`, jede Liste `limit`/`cursor` + `weitereVorhanden`. Der Fehler,
  den `abdeckung_scannen` gemacht hat (180.000 Zeichen für sieben relevante
  Zeilen), darf sich hier nicht wiederholen.
- **A1/A2 (Adressierung)** — jedes Werkzeug nimmt `pfad` ODER `id` und
  liefert **beides** zurück. `resolveFolderIdByPath`
  (`src/lib/mcp/resolve-folder.ts`) gibt es bereits; `pfad_aufloesen` macht
  es nur als eigenes, billiges Werkzeug sichtbar (A4).
- **Schreibschutz** — siehe Todo `st2-schreibschutz`.

**Geschenkt, weil es die Brücke schon hat:** `begruendung` als Pflichtfeld und
das Aktions-Protokoll (Q6) über `mitProtokoll` aus `src/lib/mcp/protokoll.ts`.
Kein zweiter, unprotokollierter Schreibweg — genau das, was Q6 fordert.

### ST3 — `datei_patchen`

Reiner Tool-Layer auf `datei_lesen` + `updateFile`. Gut testbar, kein
Provider-Anfassen. Der wirtschaftliche Kern des ganzen Vorhabens.

### ST4 — Stufe 2 + Querschnitt

Siehe Todos. Der interessanteste Punkt ist der Papierkorb: er ist nicht
überall da, und das gehört gemeldet statt kaschiert.

## 4b. Befunde aus ST1 (umgesetzt 2026-08-27)

Drei Dinge, die der Plan anders angenommen hatte:

- **`stand-ausfuehren.ts` machte kein delete+upload mehr.** Das war am
  27.08.2026 bereits saniert; `ersetzeIndex` ruft nur noch `uploadMarkdown`.
  Der `deleteFile`-Port in `StandSchreibenPorts` ist seitdem **totes
  Interface** — definiert, nie gerufen. Er bleibt vorerst stehen (Entfernen
  zieht `themen-schreiben.ts` und Tests nach) und gehört in eine
  Aufräum-Welle; solange er dasteht, lädt er zum Rückfall ein.
- **Die zweite echte Stelle war `regenerate-sichten.ts`**, nicht die
  `_INDEX.md`: `ueberschreiben()` löschte `AKTUELL.md`/`PROJEKTE.md` und lud
  sie neu hoch. Jetzt In-Place; nur der erste Lauf legt noch an.
- **Nicht nur Nextcloud hat ein Id-Problem.** Der Filesystem-Provider
  erzeugt Datei-Ids als **Hash aus Name, Größe, mtime und Fingerprint**
  (`generateFileId`) — die Id hängt also am Inhalt. Stabil bleibt sie nur,
  weil `idCache` sie pro Pfad festhält, also innerhalb einer Prozess-
  Lebensdauer. Nextcloud ist hier besser als gedacht: Ids sind base64-kodierte
  **Pfade** und überleben ein In-Place-Schreiben unverändert. `updateFile`
  meldet einen Wechsel über `idChanged` (A3), statt ihn zu verschweigen.

Dazu ein Fund außerhalb des Zuschnitts: `tests/unit/mcp/tools-stand.test.ts`
war auf `master` rot (3 Tests, je 15 s Timeout). Ursache ist nicht ST1,
sondern der Protokoll-Commit — `stand_setzen` läuft seither durch
`mitProtokoll` in eine echte MongoDB-Verbindung, die der Test nicht mockt.
Drei Zeilen Mock, wie in `protokoll.test.ts`. Mitgenommen, weil die DoD
grüne Tests verlangt.

## 4c. Befunde aus ST2 (umgesetzt 2026-08-27)

- **Der Drift-Riegel war blind für Unterverzeichnisse.**
  `tests/unit/mcp/toolliste-drift.test.ts` scannte nur die oberste Ebene von
  `src/lib/mcp` — die Werkzeuge unter `storage/` wären für ihn unsichtbar
  gewesen, und `bruecke_info` hätte wieder eine unvollständige Soll-Liste
  gemeldet: genau der Befund vom 27.08.2026, der den Riegel ausgelöst hat,
  nur eine Ebene tiefer. Der Riegel steigt jetzt ab; gegengeprüft, dass er
  ein fehlendes Werkzeug im Unterverzeichnis auch wirklich meldet.
- **`loeschen` nach ST4 verschoben.** Siehe Todo — Papierkorb-Ehrlichkeit und
  Löschwerkzeug sind nicht trennbar.
- **`stat` behandelt „existiert nicht" als Antwort, nicht als Fehler.** Genau
  dafür fragt der Aufrufer (`bericht_veraltet`, `verweis_tot`). Andere Fehler
  bleiben Fehler.
- **Der Muster-Filter begrenzt die Ausgabe, nicht den Abstieg.** `*.md` mit
  `tiefe: 2` findet Dateien in Unterordnern — ein Filter, der schon am
  Ordnernamen abbräche, fände nie etwas.

## 4d. Befunde aus ST3 (umgesetzt 2026-08-27)

**`frontmatter_setzen` geht NICHT über `patchFrontmatter`.** Der Plan schrieb
„zwingend über den bestehenden Frontmatter-Single-Serializer" — das wäre hier
der falsche der zwei vorhandenen Wege gewesen. Es gibt bereits eine bewusste
Trennung:

- `patchFrontmatter` (`src/lib/markdown/frontmatter-patch.ts`) schreibt das
  GESAMTE Frontmatter neu und quotet jeden String (`type: index` →
  `type: "index"`). Richtig für maschinen-eigene Dateien.
- `stand-zeilen-patch.ts` ist zeilen-chirurgisch, weil genau diese
  Requotierung im W7-Live-Test (24.08.2026) als sichtbare Änderung an Zeilen
  auffiel, die niemand angefasst hatte — bei den von Hand gepflegten,
  Obsidian-kompatiblen Archiv-Dateien.

`frontmatter_setzen` zielt auf ebensolche Dateien und nutzt deshalb die
Chirurgie. Das ist kein zweiter Serializer (Contract §2): dieselbe Funktion,
dieselbe Rückles-Disziplin. Was `stand-zeilen-patch.ts` für den Stand-Patch
über ein geschlossenes Vokabular garantiert, steht hier als **Prüfung**:
flache `snake_case`-Keys, nur Skalare, symmetrische Wert-Formatierung, und
danach eine Rückprobe mit dem echten Parser — weicht ein Feld ab, wird nichts
geschrieben.

Weitere Punkte:

- **Listen und Objekte sind abgelehnt, nicht stillschweigend verbogen.**
  `parseSecretaryMarkdownStrict` liest `tags: ["a"]` als Rohstring zurück,
  nicht als Array — geschrieben und gelesen wären verschieden. Solche Felder
  brauchen `datei_schreiben` oder ein Fachwerkzeug. (Kandidat für später:
  Symmetrie im Parser herstellen, dann hier freigeben.)
- **Ein Patch, der nichts ändert, wird nicht geschrieben.** Sonst altert die
  Datei (`bericht_veraltet`) für eine Änderung, die es nicht gab — dieselbe
  Tretmühle, die Q4 beschreibt.
- **Lesen und Ersetzen teilen sich die Abschnittsgrenze** (`findeAbschnitt`).
  Zwei Implementierungen hätten bedeutet, dass ein Agent über etwas anderes
  schreibt, als er gelesen hat.
- `stand-zeilen-patch.ts` heißt weiterhin stand-spezifisch, obwohl es jetzt
  generisch genutzt wird. Umbenennen zieht `stand-schreiben.ts` und Tests
  nach — Kandidat für die Aufräum-Welle, zusammen mit dem toten
  `deleteFile`-Port.

## 4e. Befunde aus ST4 (umgesetzt 2026-08-27)

**`speicher_info` brauchte eine Provider-Selbstauskunft, keinen Typ-Switch.**
Der Storage-Contract verbietet Feature-Entscheidungen über `library.type`.
Also eine zweite optionale Fähigkeit, `StorageCapabilities`
(`packages/contracts/src/storage-capabilities.ts`, wieder eine neue Datei —
null Konfliktfläche): Jeder Provider beschreibt sich selbst, die Schicht
verzweigt nicht.

Die tragende Regel darin: **`null` heißt „weiß ich nicht", und das ist eine
erlaubte Antwort.** Beispiele, wo ich bewusst `null` gesetzt habe statt zu
raten:

- Unicode-Normalisierung bei allen drei Providern. Graph sichert keine
  Normalform zu; geraten wäre schlimmer als nicht gewusst, weil der Agent
  darauf baut und Dateien nicht findet, die da sind — genau der Beleg aus den
  Anforderungen.
- Groß-/Kleinschreibung bei Nextcloud und Filesystem: hängt am Dateisystem des
  Servers, von außen nicht feststellbar.

Getrennt gehalten: Was der **Provider** kann, sagt der Provider; was **diese
Schicht** daraus macht (`unterstuetzt.patch/delta/binaer`), sagt die Schicht.
Sonst behauptete jeder Provider Werkzeuge, die es gar nicht gibt — `delta` ist
`false`, weil `aenderungen_seit` scannt, und `binaer` ist `false`, weil
bereichsweises Binärlesen Stufe 3 bleibt.

**`loeschen` verweigert den Dienst ohne Papierkorb.** Der Filesystem-Provider
hat keinen (`fs.rm`/`fs.unlink`). Ein `loeschen`, das dort „im Papierkorb"
meldet, wäre die gefährlichste Antwort der ganzen Schicht — die Grundregel
„Gelöscht wird nie" hängt daran. Ohne Papierkorb braucht es ein ausdrückliches
`endgueltig: true`; die Meldung verweist auf `quelle_verwerfen`.

**Q5: Unbekanntes wird nicht wohlwollend einsortiert.** Was sich nicht sicher
zuordnen lässt, bekommt `unbekannt` + `wiederholbar: false` und die
Originalmeldung — ein falsch einsortierter Fehler schickt den Agenten in genau
die Schleife, die die Zuordnung verhindern soll. Ein generischer
`StorageError` gilt ausdrücklich nicht als Konflikt.

**`verschieben` zieht erst um, dann benennt es um.** Andersherum könnte der
neue Name im ALTEN Ordner kollidieren.

## 4f. Live-Test 28.08.2026 und Welle ST5

Der erste echte Lauf gegen das Deployment. Bericht:
[`mcp-storage-testbericht-2026-08-28.md`](../concepts/mcp-storage-testbericht-2026-08-28.md),
Gesamtstand: [`mcp-storage-stand.md`](../concepts/mcp-storage-stand.md).

**Was der Test bestätigt hat:** `datei_patchen` ersetzte `datei_schreiben`
jedes Mal; `bereich: frontmatter` lieferte 518 statt 10.672 Bytes; der
Konflikt kam mit vollem aktuellen Inhalt zurück; Nextcloud läuft lesend ohne
Sonderbehandlung.

**Was er gefunden hat — und was ich daraus gelernt habe:**

- **Ein Riegel, der breiter ist als sein Zweck, blockiert die Arbeit.** Die
  `_INDEX.md`-Sperre sollte den Bearbeitungsstand schützen, sperrte aber auch
  Fließtext und Anlegen. Ergebnis: Ein neuer Ordner konnte seinen Contract nie
  bekommen. Ich hatte die Sperre am Pfad festgemacht; richtig ist, sie am
  **Feldkern** festzumachen — also die Aktion mitzuentscheiden.
- **Ein Riegel, der nur an einer Tür hängt, ist keiner.** `verschieben` prüfte
  den Schreibschutz nicht — die Lücke wurde in der Sitzung zweimal benutzt, um
  die erste zu umgehen. Schlimmer: mit `ueberschreiben: true` wäre eine fremde
  `_INDEX.md` samt Bearbeitungsstand zu ersetzen gewesen. Das war die einzige
  sicherheitsrelevante Lücke der Schicht.
- **Eine Selbstauskunft, die mehr verspricht als sie hält, ist schlimmer als
  keine.** OneDrive meldete `zeitstempelGenauigkeit: "millisekunde"`, lieferte
  aber durchweg `.000Z`. Genau die Regel `bericht_veraltet` hätte sich darauf
  verlassen. Steht jetzt auf `null` — dieselbe Regel, die ich in ST4 für
  Unicode und Groß-/Kleinschreibung schon angewandt hatte, nur an einer Stelle
  nicht konsequent.

**Eine Korrektur am Testbericht:** Er sagt, `idGeaendert` gebe es nicht. Es
gibt es in allen drei Schreibwerkzeugen — nur erscheint es ausschließlich bei
einem tatsächlichen Wechsel, und bei OneDrive wechselte nichts.

## 4g. Praxisbilanz 28.08.2026 — Konzept gegen Realität

Nach dem ersten vollen Arbeitstag über die Brücke (Naturmuseum abgeschlossen,
Bestandsaufnahme über 1.655 Befunde, NatureScout strukturiert) hat die
Cowork-Sitzung Bilanz gezogen. Kernsatz:

> „Das Konzept unterstellt implizit, dass Schritt 2 (Erschließen) der teure
> ist und Schritt 1 (Strukturieren) schnell geht. Es ist umgekehrt."

Das ist richtig — und kein Konzeptbruch, sondern der normale Gang: Die
Anforderungsliste vom 27.08. hat die Ökonomie von Schritt 2/3 optimiert
(Patchen, Q2-Grenzen, Job-Stapel), weil dort an jenem Tag das Geld
verbrannte. Strukturieren kam in der Kostenrechnung nicht vor; der behobene
Engpass hat den nächsten freigelegt.

Die vier Befunde, verifiziert gegen den Code:

| Befund | Einordnung | Stand |
|---|---|---|
| Kein Stapel-Umzug | echter blinder Fleck des Konzepts | **ST9** ✓ |
| `job_liste` meldet Ruhe trotz 14 Fehlschlägen | Default war dokumentiert, aber die falsche Vorgabe | **ST9** ✓ |
| Ordner-Umzug ohne Coverage-Nachführung | Folge der bewussten §4-Abgrenzung, nicht durchdacht | Todo `coverage-nachfuehrung-ordner-umzug` |
| 60-Sekunden-Limit für große Scans | in Q7 benannt, bewusst verschoben — Praxis bestätigt den Bedarf | Todo `q7-job-modus-scans` |

Nicht als Mangel gewertet: die Denkarbeit der Zuordnung (vier
Korrekturrunden). Das ist das Werkbank-Modell, wie es gemeint ist — die
Entscheidungen, die falsch zu raten wären, liegen beim Menschen.

Offen aus der Bilanz, noch ohne Reproduktion: „completed mit drei grünen
Schritten, obwohl nichts geschrieben wurde". Braucht erst einen Fall mit
`fehlerDetails`, bevor sich sagen lässt, ob Worker oder Meldung lügt.
→ **Aufgeklärt in 4h**: weder Worker noch Meldung lügen — das Extract-Gate
überspringt, und die Brücke verschwieg die Skips.

## 4h. Befund 29.08.2026 („24.09 KnowledgeScout") und Welle ST11

Cowork meldete: Zehn `quelle_erschliessen`-Jobs auf frisch migrierte
Alt-Familien (Transformation vorhanden, Transkript fehlt) wurden `completed`
und schrieben nichts; Diagnose „der Contract-Check prüft die falsche Sache",
Hochrechnung „236 Familien über die Brücke nicht mehr zu vervollständigen".

Verifiziert gegen den Code — die Beobachtung stimmte, die Diagnose nicht:

- **Täter ist das Extract-Gate**, nicht der Contract-Check:
  `gateExtractPdf` wertet mit `includeSupersets` eine vorhandene
  Transformation als Beweis fürs Transkript („Transformation impliziert
  Extract"). Für Pipeline-Familien immer wahr; die Alt-Format-Migration hat
  erstmals Familien erzeugt, die die Annahme verletzen. Gate überspringt →
  `completed (all phases skipped)` → Contract löst `savedItemId` auf das
  VORHANDENE Artefakt auf. Alles ehrlich — in MongoDB.
- **Die Brücke verschwieg es**: `job_status` warf `steps[].details`
  (`skipped`/`reason`) beim Mappen weg; übersprungen und gearbeitet sahen
  identisch aus.
- **Der Gate-Fallback zementierte den Fehl-Skip**: `previous_job_saved` las
  jeden completed-Job mit `savedItemId` als früheren Erfolg — auch einen, der
  selbst nur übersprungen hatte. Damit war nach dem ersten Fehl-Skip auch
  `nur_transkript` verriegelt.
- **Nicht übernommen**: „Contract-Check aufs Transkript ausweiten" — bräche
  `transformation_starten` (Text aus MongoDB) und `nur_transkript`-Jobs.
- **G7 (10-Minuten-Timeout)**: Zahl real, liegt aber KS-seitig (Watchdog
  600 s hart, SSE-Stream-Timeout 10 min, `EXTERNAL_REQUEST_TIMEOUT_MS`
  Default 600000) — nicht nachweislich beim Video-Worker.

**Welle ST11 (2.16.0):** (a) `erzwingen: true` an `quelle_erschliessen` →
`policies.extract: 'force'` in beiden Enqueue-Pfaden (transcribe + document);
(b) `job_status` markiert übersprungene Schritte (`uebersprungen`/`grund`)
und nennt bei Komplett-Skip `nichtsGeschrieben` im Klartext
(`job-schritte.ts`); (c) der `previous_job_saved`-Fallback ignoriert Jobs mit
übersprungenem Extract-Schritt (`wurdeExtractUebersprungen` in `gates.ts`).
Handover an Cowork: `docs/concepts/handover-cowork-2026-08-29.md`.

## 5. Offene Entscheidungen — mit Empfehlung

Die vier offenen Fragen aus §6 der Anforderungen, damit sie nicht jede Welle
neu aufmachen:

| Frage | Empfehlung | Warum |
|---|---|---|
| Ein Endpunkt oder zwei? | **Einer** — dieselbe MCP-Brücke | Auth, Protokoll, Deployment und Rate-Limit nur einmal. Getrennt wäre „sauberer" und kostet doppelte Infrastruktur für null Gewinn |
| Wer darf schreiben? | **Schreibschutz auf Pfadmustern** im Tool-Layer, keine getrennten Rechte | `_INDEX.md` und `_`-Twin-Ordner sperren; das Fehlerbild nennt das zuständige Fachwerkzeug. Getrennte Rechte bräuchten ein zweites Rechtemodell neben Clerk |
| Bibliothek oder eigene Wurzel? | **`libraryId`** | Alles Bestehende adressiert so (`LIBRARY_ID` in `tool-shared.ts`). Eine zweite Wurzel-Kennung wäre eine Übersetzungsschicht ohne Nutzen |
| Nextcloud-Identität | **Pfad-Id behalten + `idGeaendert` melden** | Umbau auf `fileid` ist ein eigener Schnitt; die Anforderung sieht das Melden selbst als tragfähigen Fallback vor |

## 6. Prüfsteine (aus §5 der Anforderungen)

Der Strang ist fertig, wenn:

1. Eine Zeile in `BERICHT.md` ändern, ohne die Datei zu übertragen. → ST3 ✓
2. Zwei Sitzungen schreiben dieselbe Datei — die zweite bekommt einen
   Konflikt, keine stille Überschreibung. → ST1 ✓ (Konfliktantwort ST2)
3. Derselbe Ablauf gegen Nextcloud wie gegen OneDrive, ohne eine Zeile
   Sonderbehandlung. → ST1/ST2 ✓ (im Code; live noch nicht verifiziert)
4. Ordner mit 1.100 Unterordnern listen, ohne Zeitlimit und ohne 180.000
   Zeichen. → ST2 ✓ (`limit`/`cursor` + Listing-Obergrenze; eine erreichte
   Grenze wird gemeldet, nicht still gekappt)
5. Datei löschen und wiederherstellen. → ST4 löschen ✓ (mit Papierkorb-
   Auskunft); **wiederherstellen bleibt offen** (Stufe 3) — halb erfüllt
6. Nach jedem Schreibvorgang die Datei über **dieselbe Id** wiederfinden. →
   ST1 ✓ (Wechsel wird als `idGeaendert` gemeldet)
7. Vom Handy arbeiten, während der Desktop aus ist. → sobald der Endpunkt
   erreichbar deployt ist (Ops, nicht Code)

## 7. Definition of Done je Welle

- `pnpm test` + `pnpm lint` grün. Kein `pnpm build` im Cloud-Agent.
- Lokal vor Merge: `bash scripts/welle-pre-merge-check.sh`.
- Diff-Limits nach `AGENTS.md`: max. 1.000 Zeilen/Commit, 5.000 brutto/PR.
- Verhaltensneutralität, wo bestehende Pfade angefasst werden (ST1
  Beweis-Ziel): `stand_setzen` und `erschliessung_block_schreiben` verhalten
  sich nach außen identisch — nur ohne itemId-Wechsel.
- Hand-off-Block am PR-Ende nach `AGENTS.md`.
