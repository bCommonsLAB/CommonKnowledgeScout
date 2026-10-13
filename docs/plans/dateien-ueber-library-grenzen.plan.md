---
name: dateien-ueber-library-grenzen
overview: "Dieselbe Datei liegt in zwei Libraries, und nichts verbindet die beiden Kopien: Die Brücke kann über Library-Grenzen nichts, der Befund quelle_verschwunden ist eine Sackgasse, und kein Vorhaben weiß, welche Libraries zu ihm gehören. Wunschliste 8 (Cowork, 2026-10-13) nennt vier Wünsche. Dieser Plan prüft sie gegen den Code, sagt, was davon wie gebaut wird, wo die Umsetzung von der Wunschliste abweicht, und was der Owner vorher entscheiden muss."
vorhaben: [24.09 KnowledgeScout]
status: geplant
todos:
  - id: w8-4-libraries
    content: "PR 1 (W8-4): Frontmatter-Feld libraries: im BERICHT.md lesen (Ids oder Namen); Befund library_ohne_vorhaben (scope library, Akteur Cowork, info) nur im Voll-Scan einer Archivpflege-Library; Port listeLibraries am Scan; VorhabenCard.libraries; abdeckung_lesen reicht es durch. Werkzeugsatz 2.49.0. PR #382."
    status: completed
  - id: w8-1-kennung
    content: "PR 2 (W8-1): Quellkennung am Twin-Dokument (sourceContentHash sha256, sourceSize, sourceHashedAt); gerechnet in der Start-Route aus dem ohnehin gelesenen Blob, am Job gemerkt und beim Abschluss (finalize-completion) per setzeQuellkennung geschrieben; Index; Contract §9; artefakt_lesen zeigt sie. Werkzeugsatz 2.49.1."
    status: completed
  - id: w8-2-suchen
    content: "PR 3 (W8-2): quelle_suchen über alle eigenen Libraries (Kennung, sonst Name + Größe, sonst Name); quelle_verschwunden bekommt moeglicherweiseIn aus einer Mongo-Suche (kein Storage-Zugriff im Scan); nachrechnen: true rechnet die Kennung für höchstens fünf Namenstreffer nach. Dazu die Grundlage aus Abschnitt 6: G1 Slug je Library, G2 library-adresse.ts ([[@slug/pfad]]), G3 Verweis-Parser erkennt die Adresse. Werkzeugsatz 2.50.0."
    status: pending
  - id: w8-adressen-spaeter
    content: "Reserviert, nicht in diesem Plan: Auflöser-Route /@<slug>/<pfad> (App und Website), Klick im Markdown-Renderer und im Embed, Verzeichnis fremder Libraries mit Instanz-Adresse, inhaltliche Suche über Libraries (ADR 0009/0010)."
    status: pending
  - id: w8-3-uebergeben
    content: "PR 4 (W8-3): familie_uebergeben von Library A nach B (Quelle, Twin-Dokument, Segmente, Export in B, Verweis-Datei type: verweis in A, Herkunft behalten oder verwerfen); Vektoren nie kopiert, index_aktualisieren in B ist der bewusste Schritt. Erst nach den Owner-Entscheiden unten. Werkzeugsatz 2.51.0."
    status: pending
  - id: w8-skills
    content: "Nicht im Repo: Skill-Patches chat-abschliessen, veranstaltung-aufbereiten, archiv-aufraeumen liegen in Organisation/Skills/ des Archivs (Cowork). Das Repo liefert nur die Werkzeuge, auf die sie verweisen."
    status: pending
---

# Dateien über Library-Grenzen nachvollziehen (Wunschliste 8)

Die Wunschliste liegt im Archiv:
`24.09 KnowledgeScout/2026-10-13 Wunschliste 8 - Dateien ueber Library-Grenzen nachvollziehen.md`.
Anlass: acht Dateien eines Ereignisordners meldete der Scan als
`quelle_verschwunden`; sie lagen erschlossen in einer zweiten Library, gefunden
von Hand. Dieser Plan ist die Programmiersicht darauf.

## 1. Was der Code heute kann, und was nicht

| Befund | Wo im Code | Folge für den Plan |
|---|---|---|
| Ein Twin-Dokument hängt an `(libraryId, sourceId)`; je Library eine eigene Collection `shadow_twins__<id>`. Es gibt kein Inhaltsmerkmal der Quelle. | `shadow-twin-repo.ts` (`ShadowTwinDocument`, `getShadowTwinCollectionName`) | Suche über Libraries heißt: über N Collections suchen; sie braucht ein Feld, das in allen gleich ist. |
| `sourceHash` gibt es schon, aber auf `binaryFragments[]`: der Hash des Originalbilds, zu dem ein Thumbnail gehört. | `mongo-shadow-twin-store.ts`, `thumbnail-repair-service.ts` | Das neue Feld darf nicht `sourceHash` heißen. Vorschlag: `sourceContentHash`. |
| Das Fingerabdruck-Tor hasht nur Listing-Merkmale (Name, Größe, `modifiedAt`, Version), nie den Inhalt. Beim Kopieren ändert sich `modifiedAt`. | `sync-engine/check-stand.ts` | Untauglich als Wiedererkennung; bleibt, was es ist (Plan-Cache). |
| Die Quelldatei wird beim Erschließen genau einmal ganz gelesen und als `File` an den Secretary geschickt. | `api/external/jobs/[jobId]/start/route.ts` (`provider.getBinary(src.itemId)`) | Der Hash ist hier fast gratis: der Blob liegt schon im Speicher. |
| Transformationen lesen die Quelle nicht (Transkript aus MongoDB). | `transformation-start.ts`, Text-Feed | „Nachtragen beim nächsten Anfassen“ heißt: nur eine neue Erschließung füllt die Kennung. Alte Bestände bleiben ohne, wenn niemand nachrechnet. |
| `quelle_verschwunden` entsteht pur aus Familien + Scan-Mengen; alle Außenzugriffe des Scans laufen über `CoverageScanPorts`. | `inventory-gaps.ts`, `coverage-service.ts`, `run-coverage-scan.ts` | Ein Blick in andere Libraries wird ein weiterer Port, nicht ein Import im puren Code. |
| `CoverageGap` kennt `detail?: string` und `anzahl?`; `compactGap` entscheidet, was `abdeckung_lesen` zeigt. | `types.ts`, `coverage-view-compact.ts` | Ein strukturiertes Feld `moeglicherweiseIn` ist möglich; gespeicherte Reports ohne das Feld bleiben lesbar. |
| `moveFamily` sind sieben Schritte in EINER Library mit EINEM Provider: Import, Siblings, Quelle bewegen, Mongo umschlüsseln, alter Spiegel weg, Schaufenster und Segmente rekeyen, Export. | `move-family.ts`, `move-family-identity.ts`, `vector-rekey.ts`, `transcript-segments-repo.ts` | Übergeben ist kein Umzug mit zweitem Parameter: Collections, Vektoren und Embedding-Konfiguration sind je Library. |
| `kopieren` liest und lädt über das Provider-Interface, mit Wächter 300 Dateien / 250 MB wegen der 60-s-Grenze der Brücke. | `storage/tools-kopieren.ts` | Eine einzelne Audio-Datei kann die Grenze allein reißen; `familie_uebergeben` braucht denselben Wächter und einen Hinweis auf Teilschritte. |
| Bericht-Regeln lesen `bericht.meta.*` über `asList`/`asString`; library-weite Regeln bekommen `folders` (Muster `checkEntwicklungUnberichtet`). Libraries des Users: `LibraryService.getUserLibraries`. | `repo-regel.ts`, `verlauf-regel.ts`, `library-service.ts` | `libraries:` ist eine Zeile Lesen; der Abgleich gegen die Library-Liste ist ein Port. |
| Markdown zählt nicht als Quelle (`source_without_twin` nur PDF/DOC/Audio/Video). | `source-gaps.ts` | Eine Verweis-Datei `.md` im Herkunftsordner löst keinen neuen Befund aus. |
| Bruchstellen-Katalog §2: Identität INNERHALB einer Library bleibt die Provider-Id, kein `uid`, kein `source_hash` als Schlüssel. | `docs/concepts/bruchstellen-katalog.md` | Bleibt gültig. Die Kennung ist Wiedererkennung ÜBER Libraries, nicht Schlüssel. `sourceId` wird nicht angefasst. |

## 2. Bewertung der vier Wünsche

**W8-4 Libraries gehören zu Vorhaben: bauen, zuerst.** Klein, unabhängig,
ohne Risiko. Abweichungen von der Wunschliste: Der Befund feuert nur im
Voll-Scan (im Teilbaum sieht man nicht alle Berichte), nur in einer Library
mit Archivpflege (`config.agentView.enabled`), und nur für die EIGENEN
Libraries des Users (geteilte erzeugen sonst Rauschen; später erweiterbar).
Die gescannte Archiv-Library selbst zählt nicht als „ohne Vorhaben“.
`libraries:` nimmt Ids oder Namen; Namen werden getrimmt und ohne Groß- und
Kleinschreibung verglichen; ein Wert, der weder Id noch Name einer Library
ist, wird im Befund genannt statt verschluckt.

**W8-1 Inhaltshash am Twin: bauen, als „Quellkennung“.** Drei Felder am
Twin-Dokument: `sourceContentHash` (SHA-256, hex), `sourceSize`,
`sourceHashedAt`. Gerechnet in der Start-Route aus dem Blob, der ohnehin zum
Secretary geht, als Teil des Jobs gespeichert und beim Transkript-Upsert über
`UpsertArtifactContext` ans Dokument geschrieben. So bleibt die Regel „kein
Twin-Dokument ohne Artefakt“ unangetastet. Markdown-Quellen (Text-Feed) rechnen
die Kennung im Adapter. Index `{ libraryId, sourceContentHash }`. Kein
Migrationslauf (so die Wunschliste). Abweichung: Der Testfall der Wunschliste
(dieselbe Audio-Datei in beiden Libraries hat denselben Hash) gilt für alte
Bestände erst nach `nachrechnen` (W8-2), weil keine Transformation die Quelle
liest.

Gebaut (PR 2, 13.10.) mit zwei Abweichungen vom Absatz oben: Die Kennung
geht nicht über `UpsertArtifactContext` zum Transkript-Upsert, sondern wird
am Job gemerkt (`job.quellkennung`) und beim gemeinsamen Abschluss beider
Pfade (`finalize-completion.ts`) per `setzeQuellkennung` ans Twin-Dokument
geschrieben, ein Schreibweg statt drei Store-Pfade; und Markdown-Quellen
(Text-Feed) bekommen keine Kennung, weil ihr Job die Quelle nicht liest,
sie sind Ableitungen, keine Originale.

**W8-2 `quelle_suchen`: bauen.** Ein lesendes Werkzeug über alle eigenen
Libraries. Reihenfolge der Übereinstimmung: `hash` (Kennung in beiden),
`name_groesse` (Name gleich, Größe aus Kennung oder aus einem Listing des
Elternordners in der anderen Library), `name`. Je Treffer: `libraryId`,
`libraryName`, `pfad` (aufgelöst), `sourceId`, `erschliessung` (Transkript
ja/nein, Zahl der Transformationen), `uebereinstimmung`. `nachrechnen: true`
liest für höchstens fünf Namenstreffer bis 50 MB die Binärdateien beider
Seiten, rechnet die Kennung und schreibt sie an beide Twin-Dokumente; das ist
der einzige Weg, alte Bestände ohne Migrationslauf zu versorgen.
`quelle_verschwunden` bekommt `moeglicherweiseIn` über einen neuen Port
`sucheQuelleAnderswo`: nur Mongo (Kennung, sonst Name, Index
`{ libraryId, sourceName }`), kein Storage-Zugriff im Scan. Pfade liefert erst
`quelle_suchen` auf Nachfrage.

**W8-3 `familie_uebergeben`: bauen, zuletzt, erst nach drei Entscheiden.**
Ablauf als Service `transfer-family.ts` (kein Umbau von `moveFamily`):

1. Vorbedingungen: beide Libraries gehören dem User; Zielordner existiert und
   ist kein Twin-Ordner; am Ziel liegt nichts gleichen Namens; Quelle liegt
   nicht in einem Twin-Ordner; Größe unter dem Wächter.
2. Import in A (wie `moveFamily` Schritt 1), damit Mongo den Spiegel kennt.
3. Quelle A → B über `getBinary`/`uploadFile`; die neue `sourceId` kommt aus
   dem Upload.
4. Twin-Dokument in B anlegen: Transkript und Transformationen kopiert,
   `parentId` = Zielordner, Quellkennung mit, `checkStand` nicht,
   `compositeSources` nicht (Quellen einer Sammeldatei ziehen nicht mit),
   `binaryFragments` nicht (Blob-Adressen hängen an der Library; Seitenbilder
   entstehen in B per `extract-only` neu).
5. Transkript-Segmente nach B kopieren.
6. Export in B (`runLibrarySync` Preset `export`, Scope die neue Id).
7. Verweis in A: Datei `<Quellname>.verweis.md` mit flachem Frontmatter
   `type: verweis`, `uebergeben_nach_library`, `uebergeben_nach_pfad`,
   `uebergeben_am`, `source_content_hash`, `generated_by`, `generated_at`.
8. Herkunft: `herkunft: behalten | verwerfen`. `verwerfen` nutzt den Weg von
   `quelle_verwerfen` (Quelle samt Familie nach „zu klären“, umkehrbar).
   Es wird NIE gelöscht; Vektoren in A räumt `index_entfernen` auf Zuruf.
9. Antwort nennt, was in B noch fehlt: `index_aktualisieren` (Vektoren werden
   nie kopiert, die Embedding-Konfiguration ist je Library) und Seitenbilder.

## 3. Reihenfolge und PRs

Eine PR je Wunsch, jede mit `pnpm test`, `pnpm lint`, `npx tsc --noEmit`
(voll, nicht gefiltert) und `pnpm build` vor dem Merge. Werkzeugsatz,
`TOOL_NAMES`, `NEU_IN_VERSION` und ein Nachtrag in
`docs/concepts/mcp-library-betrieb.md` bei jeder PR mit Werkzeug- oder
Schema-Änderung.

| PR | Inhalt | Neue/geänderte Dateien (Richtwert) | Tests |
|---|---|---|---|
| 1 · W8-4 | `libraries-regel.ts` (pur), Port `listeLibraries` in `CoverageScanPorts` (optional, wie `readDocs`), Gap-Typen `library_ohne_vorhaben` + `library_unbekannt` (Abweichung: der unbekannte Wert bekommt einen eigenen Befund je Bericht statt im Library-Befund mitzulaufen), `VorhabenCard.libraries`, `abdeckung_lesen` nennt `libraries` je Vorhaben | `agent-view/libraries-regel.ts`, `types.ts`, `gap-registry.ts`, `coverage-service.ts`, `run-coverage-scan.ts`, `vorhaben-board.ts`, `auftrag-templates.ts`, `mcp/coverage-view-compact.ts`, `tools-info.ts` (2.49.0) | `tests/unit/agent-view/libraries-regel.test.ts`: Id-Treffer, Name-Treffer, unbekannter Wert, Teilbaum stumm, ohne Port stumm, Archiv-Library ausgenommen |
| 2 · W8-1 | `quellkennung.ts` (Hash aus Blob), Job-Feld, `UpsertArtifactContext.quellkennung`, `$set` im Repo, Index, Contract §9 `shadow-twin-contracts.md`, Anzeige in `artefakt_lesen`/`twins_pruefen` | `shadow-twin/quellkennung.ts`, `start/route.ts`, `sources/markdown-adapter.ts`, `shadow-twin-store.ts`, `shadow-twin-repo.ts`, `tools-artefakt.ts` | Hash deterministisch; Upsert schreibt die Kennung nur, wenn gesetzt; ohne Kennung bleibt das Dokument unverändert |
| 3 · W8-2 | `quelle-suche.ts` (pur: Treffer bewerten), `shadow-twin-suche.ts` (Mongo über mehrere Collections), Werkzeug `tools-quelle-suchen.ts`, Port `sucheQuelleAnderswo`, `moeglicherweiseIn` am Gap | `shadow-twin/quelle-suche.ts`, `repositories/shadow-twin-suche.ts`, `mcp/tools-quelle-suchen.ts`, `inventory-gaps.ts`, `coverage-view-compact.ts` | Rangfolge hash › name_groesse › name; Größenvergleich ohne Kennung; `nachrechnen` respektiert Grenzen; Gap trägt `moeglicherweiseIn` nur, wenn der Port antwortet |
| 4 · W8-3 | `transfer-family.ts`, Verweis-Datei, Werkzeug `familie_uebergeben`, Twin-Contract `type: verweis` | `shadow-twin/transfer-family.ts`, `shadow-twin/verweis-datei.ts`, `mcp/tools-uebergeben.ts`, `twin-rules.ts` | Vorbedingungen je einzeln; Abbruch nach Schritt 3 lässt A unverändert; `behalten` vs. `verwerfen`; Antwort nennt fehlende Schritte |

Aufwand, grob: PR 1 ein halber Tag; PR 2 ein Tag (die Start-Route ist groß
und heikel, nur die Lesestelle anfassen); PR 3 ein bis zwei Tage; PR 4 zwei
bis drei Tage plus Live-Prüfung mit echten Dateien in zwei Libraries.

## 4. Was der Owner vorher entscheidet

1. **Feldname.** `sourceContentHash` statt `source_hash`, weil
   `binaryFragments[].sourceHash` schon etwas anderes bedeutet. Im
   Verweis-Frontmatter heißt es flach `source_content_hash`.
2. **Alte Bestände.** Nur über `quelle_suchen nachrechnen: true` (begrenzt,
   auf Zuruf), kein Migrationslauf. Alternativ ein eigenes Werkzeug
   `kennung_nachtragen` für einen Ordner; nicht in diesem Plan.
3. **Herkunft bei der Übergabe.** Vorgabe `behalten` (Kopie plus Verweis)
   oder Vorgabe `verwerfen` (nach „zu klären“). Löschen ist keine Option.
4. **Verweis-Datei als Begleittyp.** `type: verweis` kommt in den
   Twin-Contract §3.1 neben `notiz` und `verlauf`; Pflichtfelder wie dort.
5. **Seitenbilder bei der Übergabe.** Nicht kopieren, in B neu erzeugen
   (`extract-only`). Wer das anders will, braucht einen Blob-Kopierer.
6. **Reichweite von `library_ohne_vorhaben`.** Nur eigene Libraries, nur im
   Voll-Scan, nur Archivpflege-Library. Geteilte Libraries später.
7. **Adressform.** `[[@<slug>/<pfad>]]` als Wikilink und `/@<slug>/<pfad>` als
   URL (Abschnitt 6). Alternative wäre ein eigenes Schema `ks://`; das `@`
   bleibt Obsidian-kompatibel und braucht keinen Protokoll-Handler.
8. **Slug für jede Library.** Vorgabe aus dem Namen, Änderung nur mit
   Merker des alten Slugs (sonst brechen Adressen in Dokumenten). Eindeutig
   je Instanz; Ids und Hashes erscheinen in Adressen nie.

## 5. Testfälle aus der Wunschliste

- W8-1: `Journalistenschulung Armut-Teil 2 - Britsko.m4a` in Archiv und
  Neuaufbau trägt nach `nachrechnen` denselben `sourceContentHash`.
- W8-2: Die acht Dateien aus `2026-09-25 Journalistenschulung Armut` werden in
  `72a883a0…` gefunden, nach `nachrechnen` mit `uebereinstimmung: hash`,
  davor mit `name_groesse`. Der Voll-Scan der Archiv-Library zeigt an den
  acht `quelle_verschwunden` ein `moeglicherweiseIn` mit der Neuaufbau-Library.
- W8-3: Eine Datei aus einem Testordner übergeben; in B liegt Quelle, Spiegel
  und Twin-Dokument; in A liegt die Verweis-Datei; ein zweiter Scan meldet in
  A kein `quelle_verschwunden`.
- W8-4: Der Bericht `24.09 KnowledgeScout` nennt `libraries:`; die
  Neuaufbau-Library ohne Eintrag ergibt genau einen Befund
  `library_ohne_vorhaben`.

## 6. Grundlage: Adressen über Library- und Instanz-Grenzen

Owner 13.10.: `quelle_suchen` ist die Vorwegnahme einer Library-übergreifenden
Suche, und später sollen Libraries auch auf anderen KnowledgeScout-Instanzen
liegen. Die Grundlage dafür wird jetzt festgelegt, gebaut wird sie in Stufen.
Drei Schichten, jede für sich nützlich:

**Schicht 1, die Adresse (was ein Mensch schreibt).** Eine Library hat einen
**Slug**: kurz, lesbar, eindeutig je Instanz, ohne Id und ohne Hash. Ein
Verweis auf Inhalt einer anderen Library lautet

```
[[@klima-archiv/Veranstaltungen/2026-09-25 Journalistenschulung/Flyer.pdf|Flyer]]
https://<instanz>/@klima-archiv/Veranstaltungen/2026-09-25 Journalistenschulung/Flyer.pdf
```

Das `@` sagt „andere Library“, davor steht nichts, dahinter der Slug und der
Library-relative Pfad; Anker `#Abschnitt` wie gewohnt. Dieselbe Adresse gilt
als Wikilink im Dokument, als URL im Browser und als Antwortfeld der Brücke.
Sie nennt nie eine Instanz, nie eine Library-Id und nie eine Storage-Id,
deshalb überlebt sie den Umzug einer Library auf eine andere Instanz oder
einen anderen Speicher. Der Pfad ist die lesbare Kennung; die Quellkennung
(W8-1) ist die Rückfallebene, wenn der Pfad nicht mehr stimmt. Für
Galerie-Einträge bleibt `?doc=<slug>` innerhalb der Library; ob eine Adresse
auf eine Datei zur Galerie-Ansicht führt, entscheidet der Auflöser, nicht die
Schreibweise.

**Schicht 2, das Verzeichnis (was die Instanz weiß).** Jede Instanz führt ein
Inhaltsverzeichnis aller Libraries, die sie adressieren kann: Slug, Name,
Library-Id, Sichtbarkeit, und **Heimat**: `lokal` (liegt hier) oder `fremd`
(liegt auf Instanz X unter Slug Y). Lokale Einträge sind die heutige
`libraries`-Collection plus Slug; fremde Einträge sind eine neue kleine
Tabelle, ein Verweis wie ein Weiterleitungs-Eintrag, kein Spiegel der
Inhalte. Die Brücke zeigt das Verzeichnis in `bibliotheken_auflisten`
(Slug, Heimat). Zieht eine Library um, ändert sich genau ein Eintrag.

**Schicht 3, das Auflösen (was beim Klick passiert).** Ein Auflöser nimmt die
Adresse und antwortet mit genau einem von drei Ergebnissen, nie still:
`lokal` (Library-Id plus Storage-Item, in der App öffnen, auf der Website
`/explore/<slug>?doc=`), `fremd` (dieselbe Adresse auf der anderen Instanz,
Weiterleitung) oder `unbekannt` mit Grund (Slug nicht im Verzeichnis, Pfad
nicht gefunden, keine Berechtigung). Über Instanzgrenzen gilt ADR 0008,
Nachtrag (a): nur öffentliche Inhalte, anonym lesbar; alles andere braucht
die Anmeldung auf der anderen Instanz. Das Einwilligungsmodell von ADR 0009
bleibt die Regel dafür, wer wen sehen darf.

**Was davon jetzt gebaut wird, in diesem Plan:**

- G1 Slug für jede Library (Config-Feld nach `library-config-field.md`,
  Vorgabe aus dem Namen, eindeutig je Instanz; veröffentlichte Libraries
  behalten ihren `slugName`). Teil von PR 3.
- G2 `library-adresse.ts` (pur): Adresse zerlegen und bauen, Fehler bei
  fehlendem Slug oder leerem Pfad. Die Verweis-Datei (W8-3), die Antwort von
  `quelle_suchen` und `moeglicherweiseIn` schreiben diese Form statt Ids.
  Teil von PR 3, genutzt in PR 4.
- G3 Der Verweis-Parser der Agentensicht erkennt `[[@…]]` als eigene Syntax
  `library-adresse`; der Verweis-Audit prüft nur, ob der Slug im Verzeichnis
  steht, nie den fremden Bestand. Teil von PR 3.

**Was später kommt, hier nur reserviert:** die Route `/@<slug>/<pfad>` als
Auflöser (App und Website), der Klick im Markdown-Renderer und im Embed, die
Tabelle fremder Libraries mit Instanz-Adresse, und die Suche nach Inhalt
(nicht nur nach Datei) über Libraries hinweg, die zu ADR 0009 und 0010
gehört. `quelle_suchen` sucht nach Dateiidentität; die inhaltliche Suche
braucht Embeddings je Library und ist ein eigenes Vorhaben.

## 7. Nicht Teil dieses Plans

Die drei Skill-Änderungen (`chat-abschliessen`, `veranstaltung-aufbereiten`,
`archiv-aufraeumen`) gehören nach `Organisation/Skills/` im Archiv und werden
dort von Cowork gemacht; nach PR 3 verweist `archiv-aufraeumen` auf
`quelle_suchen`. `repo-bericht` bleibt unverändert. Eine Umstellung der
`sourceId` auf einen Inhaltshash ist ausdrücklich nicht vorgesehen
(Bruchstellen-Katalog §2).
