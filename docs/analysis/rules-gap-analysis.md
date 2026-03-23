# Rules-Gap-Analyse

Diese Datei erklärt in **einfacher Sprache**, wie gut die wichtigen `.cursor/rules` zum aktuellen Code passen.

Die Idee dahinter:

- Die Rules beschreiben das **Soll**
- der Code zeigt das **Ist**

Wenn beides nicht zusammenpasst, muss man entscheiden:

- Regel anpassen
- oder Code anpassen

---

## Einfache Bewertung

Ich benutze hier nur drei einfache Urteile:

- **OK**: passt im Großen und Ganzen
- **Lücke**: Rule und Code passen noch nicht zusammen
- **Doku-Thema**: technisch nicht kritisch, aber die Beschreibung könnte klarer sein

---

## Welche Rules ich geprüft habe

- `storage-abstraction.mdc`
- `shadow-twin-architecture.mdc`
- `contracts-story-pipeline.mdc`
- `media-lifecycle.mdc`
- `no-silent-fallbacks.mdc`
- `ingest-mongo-only.mdc`

---

## 1) `storage-abstraction.mdc`

### Urteil: OK

Der Grundgedanke dieser Rule ist:

- UI soll nicht direkt mit konkreten Storage-Backends arbeiten
- stattdessen über Provider und Services

Das ist im Projekt **weitgehend** so umgesetzt.

### Kleine Einschränkung

Es gibt viele API-Routen rund um Shadow-Twin und Library.  
Das ist nicht direkt falsch, aber es macht das System breiter und schwerer zu überblicken.

Also:

- fachlich okay,
- architektonisch etwas verteilt.

---

## 2) `shadow-twin-architecture.mdc`

### Urteil: Lücke

Diese Rule sagt sinngemäß:

- Die UI soll nicht direkt wissen, ob `mongo` oder `filesystem` der primäre Store ist.

Im echten Code gibt es solche Stellen aber doch.

Beispiele:

- `src/components/library/file-preview.tsx`
- `src/components/creation-wizard/creation-wizard.tsx`
- `src/hooks/use-shadow-twin-analysis.ts`

### Was das bedeutet

Hier stimmen Rule und Code aktuell **nicht** sauber überein.

Jetzt gibt es zwei ehrliche Möglichkeiten:

1. Die Rule bleibt richtig, dann muss der Code später umgebaut werden.
2. Der Code ist absichtlich so, dann muss die Rule Ausnahmen klar benennen.

Im Moment ist das eine offene Stelle.

---

## 3) `contracts-story-pipeline.mdc`

### Urteil: Lücke

Hier gibt es im Kern denselben Konflikt wie oben:

- UI soll wenig über Speicher-Details wissen
- der Code weiß an mehreren Stellen doch davon

Zusätzlich gibt es hier noch ein zweites Thema:

- Für Transformationen soll `templateName` sauber und eindeutig gesetzt sein

Der Code hat teilweise Schutzlogik und Fallback-artige Rettungen.  
Das ist verständlich, aber langfristig nicht die schönste Lösung.

### Einfach gesagt

Die Rule ist sinnvoll.  
Der Code folgt ihr aber noch nicht überall konsequent.

---

## 4) `media-lifecycle.mdc`

### Urteil: OK

Diese Rule passt insgesamt recht gut zum Code.

Vor allem diese Punkte sind wirklich im Code sichtbar:

- `composite-transcript`
- `_source_files`
- `buildCompositeReference()`
- `resolveCompositeTranscript()`

### Was man noch verbessern könnte

Die kurze Rule könnte sprachlich noch ergänzt werden, weil der Code inzwischen mehr Details kennt, zum Beispiel bei Wiki-Link-Varianten.

Das ist aber eher ein Doku-Thema und kein Architekturproblem.

---

## 5) `no-silent-fallbacks.mdc`

### Urteil: eher OK, aber aufmerksam bleiben

Ich habe hier keinen vollständigen Beweis für das ganze Repo geführt.

Trotzdem ist die Rule wichtig, besonders bei Bereichen wie:

- `batch-transform-service.ts`

Dort sollte man bei späteren Refactorings genau hinschauen:

- Wird ein Fehler klar gemeldet?
- Oder springt das System still auf einen anderen Pfad?

---

## 6) `ingest-mongo-only.mdc`

### Urteil: OK

Für `ingest-markdown` passt die Rule gut zum Code.

Wichtige Datei:

- `src/app/api/chat/[libraryId]/ingest-markdown/route.ts`

Dort wird geprüft:

- welcher Store aktiv ist,
- und in Mongo-Modus wird direkt aus Shadow-Twin-Artefakten geladen.

Das ist konsistent mit der Rule.

---

## Was ist mit dem Sammeltranskript-Plan?

Der frühere Plan zum Thema Sammeltranskript ist weiterhin nützlich, aber er beschreibt **nicht das ganze System**.

Einfach gesagt:

- Der Plan ist gut für das Teilproblem „Medien und Sammeltranskript“
- er ist aber keine vollständige Gesamtarchitektur für Archiv, Transformation und Publishing

### Was schon erledigt aussieht

- MediaTab mit `_source_files`
- Aggregation mehrerer `sourceIds` für Fragmente

### Was noch offen wirkt

- einfachere Wikilink-Vorschau
- Fragmentnamen robuster auflösen

Diese offenen Punkte sollte man später gezielt gegen den Code prüfen.

---

## Meine einfache Empfehlung für die nächsten Schritte

Wenn du aus dieser Analyse etwas Praktisches ableiten willst, dann würde ich so vorgehen:

1. **Rule-Konflikte sichtbar machen**
   - besonders alles rund um `primaryStore` in UI

2. **Eine Entscheidung treffen**
   - Code an Rule anpassen
   - oder Rule sauber mit Ausnahmen ergänzen

3. **Nur danach refactoren**
   - sonst baut man leicht an der falschen Stelle um

---

## Kleine Prioritätenliste

### Priorität 1

- `PhasePolicies` zentralisieren
- `TransformSaveOptions` zentralisieren

### Priorität 2

- `primaryStore` aus UI entfernen oder kapseln
- `TransformService` und zentrale Markdown-Komposition angleichen

### Priorität 3

- alte Module prüfen und nur mit Beleg löschen

---

## Mein Fazit

Die Rules sind **nicht grundsätzlich falsch**.  
Das Hauptproblem ist eher:

- Der Code ist in manchen Bereichen weitergewachsen
- aber die Trennung zwischen UI, Service und Storage ist nicht überall sauber geblieben

Darum lohnt sich die Rule-Analyse auf jeden Fall.  
Sie ist aber nur dann wirklich hilfreich, wenn man danach auch entscheidet:

- welche Rules weiter gelten sollen,
- und welche Stellen im Code der neue Standardweg werden.

---

## Verweise

- `docs/analysis/pipeline-system-map.md`
- `docs/analysis/pipeline-redundancy-audit.md`
