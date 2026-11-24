---
name: webseiten-erschliessen
overview: "Eine ganze Webseite über die Brücke erschließen, ohne dass der Agent eine eigene Shell oder den Rechner des Nutzers braucht: Seiten wörtlich lesen, Links folgen, verlinkte Dateien holen, Seiten ohne Fließtext als Sammeldatei übernehmen, später Medien und gerenderte Seiten. Anlass: der Aufbau einer Library aus der Website einer Konferenzreihe (Übersichten mit Rednerlisten, Dokumentseiten, PDF-Statements, Webcasts); die Anforderungen und das Testmaterial stehen im Handover im Archiv."
vorhaben: [4]
status: welle-1-gebaut-abnahme-offen
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
    content: "Welle 2 (E1, E2, E5, C1): bibliothek_anlegen legt den Zielordner an oder benennt den Grund; vorlage_lesen und vorlage_schreiben; vorlagenKopieren mit Auswahl; Facetten-Platzhalter in Vorlagen und Prüfung der Werte nach der Transformation als Befund."
    status: pending
  - id: w3-rechte
    content: "Welle 3 (C2, C3): Rechte-Status am Dokument (Volltext oder nur Zusammenfassung) für Galerie, Detailseite, Chat und Headless-API. Erst ADR, dann Code."
    status: pending
  - id: w4-medien
    content: "Welle 4 (A4, A5, D3), mit Secretary: gerenderte Seiten (Headless-Browser), medienAdresse für bekannte Stream-Adressen, Transkript an eine Rednerliste binden."
    status: pending
  - id: w5-kartieren
    content: "Welle 5 (B1, B3, E4): webseite_kartieren zweistufig wie playlist_erschliessen, mit robots.txt, Drosselung und Obergrenze je Lauf; Herkunft (Adresse, Abrufzeit, Hash) am Twin und erneuter Abruf; Stapel für webseite_erschliessen."
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
