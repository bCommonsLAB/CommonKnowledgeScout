# Library-Steckbriefe — die produktiven Libraries in den Worten des Owners

Quelle der Wahrheit für die Modularisierung: Was jede Library IST und WOHIN sie
soll, beschrieben vom Owner (Session 2026-08-25). Die daraus abgeleiteten
Konfigurations-Muster stehen in [`einsatz-szenarien.md`](einsatz-szenarien.md),
die Architektur-Entscheidungen in ADR
[0007](../adr/0007-modularisierung-monorepo-schale-module.md)/
[0008](../adr/0008-deployment-ziele.md)/
[0009](../adr/0009-library-foederation.md)/
[0010](../adr/0010-retrieval-profile.md).

Schema je Steckbrief: **Zweck** · **Nutzerkreis** · **Tätigkeiten** ·
**Inhalts-Zufluss** · **Laufzeit/Ort** · **Wunsch/Offen**.

## 1. Peters Archiv („OneDrive Test")

- **Zweck**: Persönliches Archiv der privaten Dateien des Owners.
- **Nutzerkreis**: Nur der Owner; Agenten (Claude Cowork) über die MCP-Brücke.
- **Tätigkeiten**: Aufräumen und Erschließen über die Agentensicht; nach dem
  Aufräumen die wichtigsten Dokumente publizieren und erkunden.
- **Inhalts-Zufluss**: Bestand (OneDrive); perspektivisch mobil unterwegs
  Erlebnisse diktieren und ins Archiv einfügen.
- **Laufzeit/Ort**: Perspektivisch vor allem LOKAL in der Electron-App (sehr
  private Daten), von dort Kommunikation mit Cowork; mobil zusätzlich online.
- **Wunsch/Offen**: Local-first-Betrieb; unterwegs diktieren; mit Inhalten im
  Erkundungs-/Story-Modus chatten und arbeiten.

## 2. SFSCON

- **Zweck**: Älteste Library — Muster dafür, wie man eine Konferenz verarbeitet.
- **Nutzerkreis**: Öffentlichkeit (Konferenz-Interessierte).
- **Tätigkeiten**: Konferenz-Inhalte ansehen, Beauskunftung im Story Mode.
- **Inhalts-Zufluss**: Heute noch mit Bezug zur alten Sessionverwaltung —
  veraltet, muss aktualisiert werden.
- **Laufzeit/Ort**: Eingebettet in eine (fremde) Webseite.
- **Wunsch/Offen**: Eine Konferenz-Session soll sich dynamisch aus einem
  YouTube-/anderen Video, einer PowerPoint und einer Webseite neu erstellen
  lassen — Import-Flow plus vereinfachtes Erkunden und Story Mode.

## 3. Umweltarchiv (Prototyp Naturmuseum)

- **Zweck**: ~900 Quellen zur Biodiversität in Südtirol — vom einzelnen
  Zeitungsartikel bis zum mächtigen Buch. Prototyp und Erfahrungsträger für das
  kommende Naturmuseum-Projekt.
- **Nutzerkreis**: Endanwender (stark vereinfachter Zugang) UND Experten
  (spezifische Interaktion); Biologen helfen beim Erfassen; kollektive Pflege
  (viele Eingeladene pflegen Inhalte ein).
- **Tätigkeiten**: Erkunden + Story Mode in ZWEI Versionen (Laie/Experte);
  Dokumente erfassen und klassifizieren.
- **Inhalts-Zufluss**: Erfassung durch Fachleute; Ingestion mit Post-Prozessen:
  Normalisierung von Autoren und Jahrgängen, eindeutige geografische Zuordnung
  von Texten. Geplant: Ortsnamen im Text gegen das Ortsnamenverzeichnis der
  Provinz klassifizieren/normalisieren, umgesetzt mit einer Graph-Datenbank.
- **Laufzeit/Ort**: Eingebettet in die Website des Naturmuseums; als PWA aufs
  Handy installierbar; für Vielnutzer/Experten als Electron-App.
- **Wunsch/Offen**: Retrieval-Flow getrennt für Einfach/Experte konfigurierbar;
  bei Fragen mit Orts-/Gebietsbegriffen Vorfilterung über einen
  Datenbank-/Graph-Filter statt rein semantisch. Eigenständiges Projekt, das
  die neue Gliederung hergeben muss.

## 4. Pluriversum

- **Zweck**: Wie das Umweltarchiv aufgebaut; Dokumente aus dem Umfeld von
  Raphael Verbas.
- **Nutzerkreis**: Aufbau gemeinsam mit Raphael Verbas und weiteren Personen.
- **Tätigkeiten**: Erfassen, Erkunden — „in allen möglichen Arten zugänglich".
- **Inhalts-Zufluss**: Gemeinsames Erfassen von Dokumenten.
- **Laufzeit/Ort**: Wie Umweltarchiv (mehrere Zugänge).
- **Wunsch/Offen**: Weiterbau mit Partner; Zugänglichkeit in allen Formen.

## 5. Klimamaßnahmen

- **Zweck**: 606 Maßnahmen für die Klimawende, mit Stakeholdern erarbeitet.
- **Nutzerkreis**: Endkunden (Startseite mit den ~20 wichtigsten Maßnahmen,
  eigene URL); wer sich anmeldet, wird Experte und kann eigene Beiträge
  einbauen.
- **Tätigkeiten**: Erkunden mit Spezial-Features in den Detailseiten
  (CO2-Äquivalent-Berechnung u. a.), Graph-Ansichten (ähnliche Maßnahmen;
  Wirkung von Maßnahmen aufeinander).
- **Inhalts-Zufluss**: Experten-Beiträge; zusätzlich Best-Praxis-Beispiele
  erfassen (wie Event-Erfassung: z. B. klimafreundliche Mobilität,
  Schwammstädte).
- **Laufzeit/Ort**: Ausbau zur eigenständigen Webseite.
- **Wunsch/Offen**: ERSTE Multi-Library-Anwendung — Kopplung von zwei/drei
  Libraries: Best-Praxis-Beispiele in eigener Library, gegliedert nach
  Organisationen (Autor:in ordnet sich einer Organisation zu; je Organisation
  vermutlich eine eigene Library mit Kurator; Community-Libraries für
  Bürger-Beispiele, eigene für Experten). Auf der Maßnahmen-Detailseite sollen
  passende Themen/Artikel aus anderen Libraries gelistet werden; Öffnen führt
  in die andere Library weiter (library-übergreifende Logik im Framework).
  Offen: pro Aufruf live berechnen vs. cachen und beim Hochladen neu berechnen.
  Weitere Features geplant (siehe Zielbilder `massnahmen-*.md` in diesem
  Verzeichnis).

## 6. CAST (Clima Action Südtirol)

- **Zweck**: Konferenz-Dokumentation, ähnlicher Use Case wie SFSCON.
- **Nutzerkreis**: Öffentlichkeit.
- **Tätigkeiten**: Story Mode und Galerieansicht.
- **Inhalts-Zufluss**: Video-Aufnahmen + sortierte PowerPoints der Konferenz.
- **Laufzeit/Ort**: Einbettung in andere Webseiten.
- **Wunsch/Offen**: Vereinfachung — vor Ort, sobald Video und PowerPoints
  vorliegen, sehr schnell aufbauen können.

## 7. Tapping into Abundance

- **Zweck**: Herzensprojekt mit Judith Hafner — Begegnungen mit Frauen und
  Frauenprojekten in Afrika und anderen Ländern dokumentieren.
- **Nutzerkreis**: Menschen vor Ort in Moderationstreffen; Leser/Hörer in
  mehreren Sprachen.
- **Tätigkeiten**: Botschaften ins Mikrofon diktieren (in Oromo, Amharisch und
  weiteren heimischen Sprachen), transkribieren, sichtbar machen; Beauskunftung
  im Story Mode — auch in diesen afrikanischen Sprachen, nicht nur
  Deutsch/Englisch.
- **Inhalts-Zufluss**: Audio-Diktat im Moderationstreffen — möglichst
  niederschwelliger Zugang ist die Kernanforderung.
- **Laufzeit/Ort**: Mobil/online im Feld.
- **Wunsch/Offen**: Niederschwelligkeit; Mehrsprachigkeit über Erfassung,
  Transkription UND Beauskunftung hinweg.

## 8. MCS Ethiopia

- Wie Steckbrief 7 (zweite Library desselben Vorhabens mit Judith Hafner).

## 9. AECED (Uni Marburg)

- **Zweck**: Projekt mit der Uni Marburg — Artefakt-Quellen organisieren:
  Musterkarten und Methoden, annotiert mit spezifischen Metadaten
  (Frontmatter-Markdown).
- **Nutzerkreis**: Projektteam (Pflege); eine ANDERE Anwendung (ebenfalls vom
  Owner entwickelt) als API-Konsument; deren Endnutzer mehrsprachig.
- **Tätigkeiten**: Inhalte organisieren und annotieren; von außen abfragen.
- **Inhalts-Zufluss**: Erfassung/Annotation im Projekt.
- **Laufzeit/Ort**: BESONDERHEIT — zwei Außen-Schnittstellen: (a) eine
  API-Schnittstelle nach außen, über die die andere Anwendung die Inhalte
  abfragt; (b) Einbettung als einfache React-Komponente in die andere
  Anwendung, um Galerie und Story Mode dort auszuspielen. Mehrsprachig.
- **Wunsch/Offen**: — (vom Owner als Pilot für Welle M5 gewählt).

## 10. Oldies for Future

- **Zweck**: Erstes Projekt mit Verbindung zu einer öffentlichen Webseite unter
  eigener URL: Startseite mit den neuesten Aktionen, Absprung in die
  Galerieansicht.
- **Nutzerkreis**: Anonyme Öffentlichkeit; wenige Vereins-Creator.
- **Tätigkeiten**: Ansehen, Erkunden.
- **Inhalts-Zufluss**: Pflege durch Creator (heute in der Zentral-App).
- **Laufzeit/Ort**: Eigene Domain (`oldiesforfuture.org`).
- **Wunsch/Offen**: Erklärtes MUSTER für andere Seiten — und Referenzbeispiel
  für den Framework-Umbau: clientseitig möglichst abgespeckt nur die Teile
  laden, die diese Features benötigen.

## 11. Stakeholder Klimaarchiv

- **Zweck**: Geschütztes Archiv mit Dokumenten von Stakeholdern —
  Arbeitsverzeichnis für Mitarbeiter des Dachverbands.
- **Nutzerkreis**: Mitarbeiter des Dachverbands (vertrauenswürdiger Zugang).
- **Tätigkeiten**: Protokolle sehr schnell ablegen und mit ihnen interagieren;
  Beauskunftung.
- **Inhalts-Zufluss**: Laufende Ablage durch die Mitarbeiter.
- **Laufzeit/Ort**: Geschützter Bereich (kein öffentlicher Zugang).
- **Wunsch/Offen**: Vertrauenswürdiger Zugang für Erfassen UND Beauskunften.

## 12. SwapToLearn (nuvola)

- **Zweck**: Geschichten aus der Organisation veröffentlichen.
- **Nutzerkreis**: Organisation (Erfassung), Öffentlichkeit (Webseite).
- **Tätigkeiten**: Sehr niederschwellig erfassen; auf einer Webseite
  veröffentlichen.
- **Inhalts-Zufluss**: Niederschwellige Erfassung.
- **Laufzeit/Ort**: Veröffentlichung in einer Webseite.
- **Wunsch/Offen**: Niederschwelligkeit von Erfassung und Veröffentlichung.

## 13. SwapToLearn (PCs)

- **Zweck**: PCs klassifizieren (Schwester-Library zu 12).
- Übrige Punkte wie 12.

## 14. Tamera

- **Zweck**: Versuch, für eine Organisation ihre Dokumente zu organisieren und
  der Öffentlichkeit zugänglich zu machen.
- **Nutzerkreis**: Organisation (Pflege), Öffentlichkeit (Beauskunftung).
- **Tätigkeiten**: Beauskunftung; Pflege.
- **Inhalts-Zufluss**: Dokumente der Organisation.
- **Laufzeit/Ort**: Soll einfach in die Seite der Organisation einbettbar sein.
- **Wunsch/Offen**: LEHRE aus dem Projekt: Es war am Ende ZU KOMPLIZIERT.
  Anforderung an das Framework: einfacher Zugang für Beauskunftung und Pflege.

## 15. Diva-Texturen-Katalog

- **Zweck**: Werkzeug aus der täglichen Arbeit des Owners — LOKAL gebaut, nicht
  in der Produktivumgebung: ein Verzeichnis scrapen, Texturen finden, über eine
  dort liegende JSON-Datei mit Hersteller-/Lieferantendaten annotieren, danach
  die Textur über ein bildverarbeitendes LLM weiter klassifizieren.
- **Nutzerkreis**: Anwender, die sehr viele Daten verarbeiten.
- **Tätigkeiten**: Massen-Annotation und -Klassifikation; annotierte Texturen
  übersichtlich anzeigen und wiederfinden.
- **Inhalts-Zufluss**: Scraping + JSON-Annotation + Bild-LLM-Klassifikation.
- **Laufzeit/Ort**: Electron-App.
- **Wunsch/Offen**: Fließender Workflow für große Mengen fehlt noch;
  Ähnlichkeitsdarstellung („ähnliche Texturen zeigen") ist offen. Projekt wird
  weitergetragen.

## Beschreibung ausstehend

Im Repo vorhanden, vom Owner noch nicht beschrieben — hier nur als Lücke
geführt, nicht interpretiert:

- **Gaderform** (Betten-Steckbriefe, Holzarten — `template-samples/gaderform-*`)
- **Refurbed-Geräte** (`detailViewType: refurbedDevice`)
