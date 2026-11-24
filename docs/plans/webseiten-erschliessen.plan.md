---
name: webseiten-erschliessen
overview: "Eine ganze Webseite über die Brücke erschließen, ohne dass der Agent eine eigene Shell oder den Rechner des Nutzers braucht: Seiten wörtlich lesen, Links folgen, verlinkte Dateien holen, Seiten ohne Fließtext als Sammeldatei übernehmen, später Medien und gerenderte Seiten. Anlass: der Aufbau einer Library aus der Website einer Konferenzreihe (Übersichten mit Rednerlisten, Dokumentseiten, PDF-Statements, Webcasts); die Anforderungen und das Testmaterial stehen im Handover im Archiv."
vorhaben: [4]
status: welle-2c-gebaut-abnahme-offen
todos:
  - id: w1-schutz
    content: "Welle 1: Schutz gegen interne Adressen (adress-schutz.ts) und sicherer Abruf (sicherer-abruf.ts) für jeden Abruf im Auftrag von außen; bestehende Abrufe (Seite, Cover, direkt genanntes Medium) darauf umgestellt. Gebaut 24.11.2026."
    status: done
  - id: w1-seite-lesen
    content: "Welle 1 (Handover A3): seite_lesen — Seite wörtlich als Markdown mit Linkliste (html-baum.ts, seite-markdown.ts, seite-links.ts, seite-lesen.ts, tools-seite-lesen.ts). Gebaut 24.11.2026."
    status: done
  - id: w1-struktur
    content: "Welle 1 (A2, E3): webseite_erschliessen mit seitenModus struktur und elternAnlegen. Gebaut 24.11.2026."
    status: done
  - id: w1-datei-holen
    content: "Welle 1 (A1): datei_von_adresse_holen, Stapel bis 30, Prüfung von Typ, Endung, Signatur (datei-holen.ts, storage/tools-adresse-holen.ts). Gebaut 24.11.2026."
    status: done
  - id: w1-abnahme
    content: "Welle 1 Abnahme über die Brücke am Testmaterial des Handovers: Übersicht mit seite_lesen vollständig und jeder Link in seiner Zeile; Dokumentseite mit seitenModus struktur als Sammeldatei; ein PDF mit datei_von_adresse_holen im Zielordner. Zeigt zugleich, ob die Zielseite dem Server antwortet."
    status: pending
  - id: w2-kleines
    content: "Welle 2 (E1, E2, E5, C1): bibliothek_anlegen legt das Verzeichnis auf der Speicher-Verbindung an, speicher_pruefen unterscheidet fehlendes Verzeichnis von toter Verbindung; vorlage_lesen und vorlage_schreiben; vorlagenNamen beim Kopieren; Facetten-Platzhalter <<werte:…>> und <<legende:…>> in Vorlagen, Prüfung der gebundenen Felder nach der Transformation als Befund. Gebaut 24.11.2026, Werkzeugsatz 2.84.0."
    status: done
  - id: w2-abnahme
    content: "Welle 2 Abnahme über die Brücke: eine Vorlage mit <<werte:…>> schreiben, eine Quelle transformieren, einen erfundenen Wert im Befund und nicht im Index sehen; eine Library mit neuem Verzeichnis anlegen und speicher_pruefen grün sehen."
    status: pending
  - id: w2b-pilot
    content: "Welle 2b, Befunde aus dem Piloten (B1, B2, B10): leere Antwort eingeordnet (leer, Schutzseite, JavaScript, unbekannt) mit Länge und Anfang des rohen HTML; seite_lesen und webseite_erschliessen nehmen fertiges HTML aus dem Browser entgegen (html); 403/429 nennt Sperre und Auswege; Beschreibung von datei_von_adresse_holen gekürzt. Gebaut 24.11.2026, Werkzeugsatz 2.85.0."
    status: done
  - id: w2c-normalisierung
    content: "Welle 2c, Befunde aus dem Piloten (B4, B5, B6, B7): Feld-Bindungen in Vorlagen (<<max:N>>, <<maxWoerter:N>>, berechnete Felder =quellen, =zeilen, =quellenarten) mit Befund; Quellblöcke im Material nennen ihre Art; Ingest-Schalter cover_from_sources und attachments_order; medienHerkunft bei sammeldatei_anlegen. Gebaut 24.11.2026, Werkzeugsatz 2.86.0."
    status: done
  - id: w2c-abnahme
    content: "Welle 2c Abnahme am Piloten: Vorlage mit <<max:6>> und =zeilen(…) schreiben, Sammeldatei neu transformieren, Befund und berechneten Wert prüfen; Ingest mit cover_from_sources: false und attachments_order: source_files prüfen. Offen ist, ob feste Felder der Vorlage unverändert im Frontmatter des Ergebnisses ankommen."
    status: pending
  - id: w3-rechte
    content: "Welle 3 (C2, C3, Befund B8): Rechte-Status am Dokument (Volltext oder nur Zusammenfassung) für Galerie, Detailseite, Chat und Headless-API; der Ingest hängt bei „nur Zusammenfassung\" keine Quelldateien als Anhang an die Seite. Erst ADR, dann Code."
    status: pending
  - id: w4-medien
    content: "Welle 4 (A4, A5, D3), mit Secretary: gerenderte Seiten (Headless-Browser), medienAdresse für bekannte Stream-Adressen, Transkript an eine Rednerliste binden."
    status: pending
  - id: w5-kartieren
    content: "Welle 5 (B1, B3, E4, Befund B3 des Piloten: Abstand je Host, 403/429 als „später erneut\"): webseite_kartieren zweistufig wie playlist_erschliessen, mit robots.txt, Drosselung und Obergrenze je Lauf; Herkunft (Adresse, Abrufzeit, Hash) am Twin und erneuter Abruf; Stapel für webseite_erschliessen."
    status: pending
  - id: w6-struktur
    content: "Welle 6 (B2, C4, D1, D2): Zuordnungsregeln je Library, Belegpflicht für Facettenwerte, Teil-Dokumente mit eigenen Facetten, mehrsprachige Quellen. Braucht vorher ein Konzept im Archiv."
    status: pending
---

# Webseiten erschließen

## Zielbild

Aus einem Agenten heraus eine Webseite vollständig erschließen und alle
technischen Schritte über KnowledgeScout abwickeln: Seiten lesen, Links
folgen, Dateien holen, Medien auflösen, transkribieren, transformieren,
publizieren. Der Agent braucht dafür weder eine Shell noch Netzzugang; der
Server lädt.

Heute bricht das an vier Stellen ab: Der Agent kommt an verlinkte Dateien
nicht heran, Seiten ohne Fließtext werden abgewiesen, Rednerlisten und
Linksammlungen sind nicht wörtlich lesbar, und Seiten, die erst im Browser
entstehen, liefern nichts. Welle 1 schließt die ersten drei.

## Welle 1 (gebaut 24.11.2026, Werkzeugsatz 2.83.0)

### Schutz gegen interne Adressen

Ein Werkzeug, das beliebige Adressen vom Server aus lädt, erreicht ohne
Schutz auch interne Dienste. Deshalb läuft jeder Abruf im Auftrag von außen
über `sichererAbruf` (`src/lib/web-source/sicherer-abruf.ts`):

- nur `http`/`https`, nur Port 80 und 443, keine Zugangsdaten in der Adresse;
- keine internen Namen (`localhost`, einteilige Namen, `.local`, `.internal`
  und verwandte) und keine internen IPs (privat, Loopback, Link-Local,
  CGNAT, Multicast, die IPv6-Entsprechungen, IPv4-abgebildete Adressen);
- die Namensauflösung der Verbindung selbst wird geprüft, nicht nur eine
  Auflösung vorab (gegen DNS-Rebinding);
- jede Umleitung wird wie eine neue Adresse geprüft, höchstens fünf;
- Größen- und Zeitgrenze; über der Grenze bricht der Abruf ab, statt ein
  Bruchstück zu liefern.

Umgestellt sind auch die bestehenden Abrufe von `webseite_erschliessen`
(Seite, Cover, direkt genanntes Medium). Aufrufe an den Secretary sind davon
nicht berührt; ihre Adresse kommt aus der Konfiguration.

**Offen:** yt-dlp im Secretary lädt Adressen selbst und kennt diesen Schutz
nicht. Das gehört in die Secretary-Welle (Welle 4).

### `seite_lesen` (liest nur)

Gibt eine Seite ohne Sprachmodell zurück: Metadaten (Open Graph, JSON-LD),
den Seitentext wörtlich als Markdown und die Linkliste.

- Nichts wird gefiltert. Die Artikel-Extraktion (`page-extract.ts`) lässt
  kurze Listenpunkte und doppelte Absätze weg; das ist für Artikel richtig
  und für eine Rednerliste falsch. Deshalb ein eigener Umsetzer
  (`seite-markdown.ts`) auf einem kleinen HTML-Baum (`html-baum.ts`), weiter
  ohne DOM-Bibliothek.
- Inhaltsbereich: `<main>`, sonst das einzige `<article>`, sonst `<body>`
  ohne Navigation, Fuß, Randspalte, Formulare. `ganzeSeite` nimmt alles.
- Jeder Link trägt `text`, `url`, `art`, `abschnitt` (letzte Überschrift
  davor) und `kontext` (die Zeile, in der er steht). `art` ist nur aus der
  Endung gelesen; eine Adresse ohne sprechende Endung ist `seite`, auch wenn
  sie ein PDF liefert.
- Kein JavaScript. Eine Seite, die erst im Browser entsteht, kommt mit leerem
  Markdown und einem Hinweis zurück.

### `webseite_erschliessen`: `seitenModus` und `elternAnlegen`

`seitenModus: "struktur"` übernimmt eine Seite ohne Fließtext wörtlich in die
Sammeldatei: Abschnitt „Seite" mit Listen, Tabellen und Links, darunter
„Verlinkte Dateien" mit den PDF-, Dokument- und Medien-Links. Titel, Datum,
Sprache und Quelle stehen wie bisher im Frontmatter.

Entschieden: ein ausdrücklicher Modus, kein automatischer Rückfall. Wer eine
Artikelseite erwartet und eine Linksammlung bekommt, soll das erfahren
(`no-silent-fallbacks`). Die Absage im Modus `artikel` nennt den anderen Weg.

Dokumenttyp, Sprache und ähnliche Angaben einer Dokumentseite werden nicht
als eigene Frontmatter-Felder geraten. Sie stehen wörtlich im Abschnitt
„Seite"; die Vorlage der Library zieht daraus ihre Felder.

### `datei_von_adresse_holen` (schreibt)

Der Server lädt bis zu 30 Dateien in einen Ordner. Vor dem Schreiben geprüft:
keine HTML-Seite statt der Datei, `erwarteterTyp`, Endung passend zum
Content-Type, Signatur bei PDF, Bild und Office, 100 MB je Datei. Jede
Adresse hat ihr eigenes Ergebnis (`abgelegt`, `abgelehnt`, `vorhanden`,
`nicht_begonnen`), vorhandene Dateien werden nie überschrieben.

Herkunft (Adresse, Abrufzeit, sha256) steht in der Antwort und damit im
Aktions-Protokoll. Am Twin steht sie noch nicht; das ist Welle 5.

### Nicht in Welle 1

- Stapel für `webseite_erschliessen` (E4): braucht Jobs wie bei Playlists,
  ein Aufruf reicht dafür nicht. Steht bei Welle 5.
- robots.txt und Drosselung: gelten für das Kartieren (Welle 5). Ein
  einzelner, vom Menschen genannter Abruf verhält sich wie ein Browser.

## Welle 2 (gebaut 24.11.2026, Werkzeugsatz 2.84.0)

### Facetten-Wörterbuch in Vorlagen

Die erlaubten Werte einer Facette standen zweimal: im Wörterbuch
(`chat.gallery.facets[].werte`) und abgeschrieben in der Vorlage. Zwei
Platzhalter ersetzen die Abschrift, überall in der Vorlage (Feldbeschreibung,
Body, Systemprompt), immer einzeilig:

- `<<werte:metaKey>>` wird zu `a, b, c`
- `<<legende:metaKey>>` wird zu `a = Label (Bedeutung); b = Label`

Entschieden:

- **Eigene Schreibweise, nicht `{{…}}`.** Die Antwortregeln im Chat nutzen
  `{{facette:…}}`; in einer Vorlage gehört `{{feld|beschreibung}}` dem
  Feld-Parser, und der liest bis zur ersten `}`.
- **Der Platzhalter bindet das Feld.** Nach der Transformation werden Werte
  außerhalb des Wörterbuchs verworfen (Liste: Eintrag weg, Einzelwert: null)
  und als Befund gemeldet (`job_status.befunde`, Ereignis
  `facet_values_rejected`). Das folgt dem Muster der Medien-Prüfung im selben
  Schritt.
- **Facetten ohne Platzhalter bleiben ungeprüft.** Bestehende Wörterbücher
  tragen oft nur Bedeutungen und sind nicht vollständig; eine Prüfung für alle
  hätte in bestehenden Libraries Werte gestrichen.
- **Nicht auflösbar ist ein Fehler.** Unbekannte Facette, fehlendes Wörterbuch
  oder ein Schreibfehler lassen den Job im Template-Schritt scheitern, bevor
  das Sprachmodell läuft; `vorlage_schreiben` weist so eine Vorlage schon beim
  Speichern ab.

Voraussetzung: Der `metaKey` der Facette ist der Name des Frontmatter-Felds.

**Offen:** Das Vorlagen-Formular der Oberfläche und `vorlage_uebernehmen`
prüfen die Platzhalter beim Speichern noch nicht; dort fällt ein Fehler erst
beim ersten Job auf.

### `vorlage_lesen`, `vorlage_schreiben`

Eine Vorlage als Markdown lesen und aus Markdown anlegen oder ersetzen, ohne
Umweg über eine Datei in `templates/`. Geschrieben wird nur, was der
Vorlagen-Parser fehlerfrei liest; ersetzt wird nur mit `ueberschreiben: true`
und immer ganz.

### `bibliothek_anlegen`, `speicher_pruefen`

`bibliothek_anlegen` legt das Verzeichnis der Library auf der
Speicher-Verbindung an, wenn es fehlt, über einen Provider an der Wurzel der
Verbindung (`getServerProviderAnVerbindungsWurzel`). Die Antwort nennt
`zielordner`. Scheitert das Anlegen, bleibt die Library bestehen und der Grund
steht in der Antwort. `vorlagenNamen` kopiert nur die genannten Vorlagen.

`speicher_pruefen` sagt bei nicht lesbarer Wurzel, ob die Verbindung selbst
antwortet oder nur das Verzeichnis fehlt.

## Welle 2b: Befunde aus dem Piloten (gebaut 24.11.2026, Werkzeugsatz 2.85.0)

Der Pilot hat die Wellen 1 und 2 an einer echten Website benutzt. Die
Befunde im Wortlaut liegen im Archiv (Handover 4 im Vorhabensordner).

**Belegt:** `datei_von_adresse_holen` holt 19 von 19 PDFs; `vorlage_lesen`,
`vorlage_schreiben` und die Facetten-Platzhalter arbeiten wie gebaut.

**Nicht bestanden:** `seite_lesen` bekam von der Zielseite mit HTTP 200 eine
Antwort ohne Text und ohne Titel. Der Hinweis nannte JavaScript; die Seite
steht im Browser aber als gewöhnliches HTML. Vermutlich gibt die Website dem
Server eine Schutzseite gegen Automaten. Damit trugen `seite_lesen` und der
Struktur-Modus für diese Quelle nicht.

Daraus gebaut:

- **Leere Antwort einordnen** (`leere-antwort.ts`): `leereAntwort` nennt
  `art` (`leer | schutzseite | javascript | unbekannt`), die Länge und den
  Anfang des rohen HTML. „JavaScript" steht nur noch dort, wo das HTML ein
  Anwendungsgerüst zeigt; ohne Indiz heißt es „Grund nicht erkennbar".
- **HTML von außen annehmen**: `seite_lesen` und `webseite_erschliessen`
  nehmen mit `html` das fertige HTML einer im Browser geöffneten Seite
  entgegen und laden dann nicht selbst. `url` bleibt Herkunft und Basis der
  Links. Es entsteht dieselbe Sammeldatei, egal wer geladen hat. Das ersetzt
  das Rendern auf dem Server überall, wo ein Rechner mit Browser
  angeschlossen ist.
- **403 und 429** beim Laden nennen die Sperre und beide Auswege.

Nicht gebaut und im Plan verteilt: Abstand je Host (Welle 5), neutrale
Quellen-Kopfzeilen, berechnete Felder, Obergrenzen, Cover und Reihenfolge der
Anhänge (Welle 2c), Anhänge als Rechtefrage (Welle 3).

**Offen aus dem Piloten:** Der Sicherheitstest mit internen Adressen über die
Brücke ist nicht gelaufen. Parallele Brücken-Aufrufe kamen im Piloten ohne
Ergebnis zurück; ob das an der Brücke oder am Client liegt, ist ungeklärt.

## Welle 2c: Normalisierung prüfbar machen (gebaut 24.11.2026, Werkzeugsatz 2.86.0)

Aus dem Piloten: Die Vorlage verlangte höchstens 6 Themen und bekam 16, ein
Zählfeld war in zwei Läufen falsch, und das Modell ordnete PDF-Text als
Transkript ein. Grundsatz dieser Welle: Was sich prüfen oder ausrechnen
lässt, bleibt nicht dem Sprachmodell überlassen.

### Feld-Bindungen (`src/lib/external-jobs/feld-bindungen.ts`)

In der Beschreibung eines Felds `{{feld|beschreibung}}`:

- `<<max:N>>`: Liste mit höchstens N Einträgen. Mehr wird hinten gekürzt und
  gemeldet. Die Vorlage sollte das Modell deshalb nach Gewicht ordnen lassen.
- `<<maxWoerter:N>>`: Text mit höchstens N Wörtern. Mehr wird gemeldet, der
  Text bleibt; einen Text mitten im Satz abzuschneiden wäre schlimmer als ein
  zu langer.

Beginnt die Beschreibung mit `=`, rechnet der Server das Feld:

- `=quellen("muster")`: Anzahl der Quelldateien der Sammeldatei, deren Name
  auf das Muster passt (`*`, `?`).
- `=zeilen("abschnitt", "text")`: Zeilen des Abschnitts im Material, die den
  Text enthalten.
- `=quellenarten(wert: "muster"; …)`: die Werte, deren Muster auf mindestens
  eine Quelldatei passt.

Der Wert des Modells wird ersetzt und steht zum Vergleich im Ereignis
`field_bindings_applied`. Lässt sich ein Feld nicht rechnen (Abschnitt fehlt,
keine Sammeldatei), wird es leer und Befund. Ein Schreibfehler in der Vorlage
ist ein Fehler vor dem Lauf; `vorlage_schreiben` weist ihn ab.

Eine bewusst kleine, feste Menge von Funktionen, keine Ausdruckssprache.

### Material, Cover, Anhänge

- Jeder Quellblock im Material trägt `inhalt` (`PDF-Text`,
  `Audio-Transkript`, `Markdown` …). Die Quellenübersicht bleibt, wie sie ist.
- `cover_from_sources: false` im Frontmatter: kein Cover aus den Seitenbildern
  der Quellen. Vorgabe bleibt an.
- `attachments_order: source_files`: PDF-Anhänge in der Reihenfolge der
  Sammeldatei. Vorgabe bleibt „Folien zuerst", weil das für einen Vortrag
  richtig ist.
- `sammeldatei_anlegen` erklärt `medienErkannt` mit `medienHerkunft`.

Beide Schalter sind flache Frontmatter-Felder des Ergebnisses; sie kommen als
festes Feld aus der Vorlage oder über `dokument_felder_setzen`.

**Nicht gebaut:** Die Schwankung zwischen zwei Läufen. Die Temperatur der
Transformation setzt der Secretary (dort in der Konfiguration niedrig
vorgegeben); ob die laufende Instanz davon abweicht, ist zu prüfen. Die
Bindungen machen die Schwankung sichtbar und begrenzen ihre Folgen, sie
beseitigen sie nicht.

## Abnahme Welle 1

Über die Brücke, am Testmaterial des Handovers:

1. `seite_lesen` auf die Übersichtsseite: alle Listenzeilen da, jeder
   Dokument-Link in der Zeile seines Redners.
2. `webseite_erschliessen` mit `seitenModus: "struktur"` auf eine
   Dokumentseite: Sammeldatei mit Titel, Datum, Sprache, den Angaben der
   Seite und dem PDF-Link.
3. `datei_von_adresse_holen` auf ein PDF: Datei im Zielordner, Antwort nennt
   Größe, Typ und Hash.

Antwortet die Zielseite dem Server nicht (Sperre für Automaten), zeigt
Schritt 1 das mit dem HTTP-Status. Dann ist vor Welle 2 zu klären, ob die
Kennung der Abrufe geändert oder der Betreiber gefragt wird.
