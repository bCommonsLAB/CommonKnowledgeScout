# ADR 0008 — Library-Föderation: mehrere Libraries in einer Anwendung

- **Status**: Vorgeschlagen
- **Datum**: 2026-08-25
- **Kontext**: Erweitert [ADR 0006](0006-modularisierung-monorepo-schale-module.md)
  (dessen SiteConfig band genau EINE Library — das reicht nicht). Getrieben vom
  Klimamaßnahmen-Steckbrief
  ([`library-steckbriefe.md` §5](../architecture/library-steckbriefe.md));
  baut auf dem bestehenden Zielbild
  [`perspektiven-bruecken-zielbild.md`](../architecture/perspektiven-bruecken-zielbild.md)
  auf.
- **Entscheider**: Repo-Owner

## Kontext

Klimamaßnahmen ist die erste Anwendung, die mehrere Libraries ZUSAMMENFÜHRT:
die Maßnahmen-Library, eine Best-Praxis-Library und Organisations-Libraries
(je Organisation eine Library mit Kurator; Community-Libraries für
Bürger-Beispiele). Auf der Maßnahmen-Detailseite sollen passende Inhalte aus
den anderen Libraries erscheinen; ein Klick führt in die andere Library weiter.
Diese library-übergreifende Logik muss das Framework tragen — sie darf nicht
als Sondercode in einer Detailansicht landen.

## Entscheidung

### 1. Einwilligungsmodell der Perspektiven-Brücken gilt unverändert

Das bestehende Zielbild bleibt die Grundlage und wird NICHT neu erfunden:
Die Quell-Library (B) gibt sich aktiv frei und bestimmt Antwortverhalten
(Frage, Prompt-Regeln, Persona); Brücken sind read-only („Einladung, kein
Voll-Zugriff"); Sichtbarkeit folgt der Berechtigung auf B; Vertiefung führt in
B's Story-Modus mit eigener Anmeldung.

### 2. Zwei Brückentypen

- **Frage-Brücke** (bestehendes Zielbild): Button auf A's Detailseite stellt
  EINE vordefinierte Frage an B und zeigt die KI-Antwort mit Quellenangabe.
- **Inhalts-Brücke** (NEU, Klimamaßnahmen-Anforderung): passende DOKUMENTE aus
  B werden auf A's Detailseite gelistet; Öffnen navigiert in B's Detailansicht
  (mit B's Berechtigungen und B's Profil). Dasselbe Einwilligungsmodell gilt.

### 3. Inhalts-Brücken werden vorberechnet, nicht live abgefragt

Entscheidung zur vom Owner offen gelassenen Cache-Frage: Die Zuordnung
„Dokument in A ↔ passende Dokumente in B" wird beim Ingest/Recompute
VORBERECHNET und persistiert; Live-Abfrage nur als expliziter Fallback.

- Begründung: 606 Maßnahmen × n Partner-Libraries live zu verknüpfen ist
  latenz- und kostenseitig nicht tragbar — und die Infrastruktur existiert
  bereits: `src/lib/graph/similarity-persist.ts`,
  `src/lib/graph/doc-neighbors-service.ts`,
  `api/library/[libraryId]/doc-relations/recompute`. Sie wird von
  „innerhalb einer Library" auf „über Library-Grenzen (mit Einwilligung)"
  erweitert.

### 4. SiteConfig bindet eine Primär-Library plus föderierte Libraries

Schema-Änderung gegenüber ADR 0006 §3:

```ts
libraries: {
  primary: LibraryRef              // bestimmt Profil, Chrome, Detail-Views
  federated?: Array<{
    library: LibraryRef
    role: 'question-bridge' | 'content-bridge' | 'capture-target'
  }>
}
```

`capture-target` deckt den Erfassungspfad ab: In A erfasste Best-Praxis-
Beispiele landen in der Best-Praxis-/Organisations-Library, nicht in A
(Submission-Weg nach [ADR 0004](0004-capture-publish-entkopplung-inbox-modell.md)).

### 5. Organisations-Libraries nutzen das bestehende Rollenmodell

Je Organisation eine Library; der „Kurator" ist deren `moderator`/`owner` im
bestehenden 4-Tier-Modell (`owner | co-creator | moderator | reader`) mit dem
bestehenden Invite-System (`api/libraries/[id]/invites|members`). KEIN neues
Rechtesystem.

## Konsequenzen

- Positiv: Klimamaßnahmen wird beschreibbar, ohne Sondercode; Frage- und
  Inhalts-Brücken teilen Einwilligung, Konfiguration und UI-Bausteine;
  vorhandene Graph-/Similarity-Infrastruktur wird wiederverwendet.
- Negativ/Aufwand: Cross-Library-Recompute braucht einen Trigger-Weg
  (Ingest in B ⇒ Neuberechnung betroffener A-Brücken); Navigations-Kontext
  „aus A kommend in B" muss die Schale tragen (Rücksprung, Breadcrumb);
  Berechtigungsprüfung je Brücke auf B-Seite.
- Korrigiert ADR 0006 §3 (Single-Library-Annahme); dort ist eine
  Korrektur-Notiz mit Verweis hierher ergänzt.
- Umsetzung frühestens Welle M8 (siehe
  [`migrations-strategie.md`](../architecture/migrations-strategie.md)).
