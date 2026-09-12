---
name: erfassungs-architektur-stationen-datenhaltung
overview: "Was die dreizehn Stationen S0–S11 mit dem Wizard zu tun haben, welche davon Konfiguration, Erweiterung oder Neubau sind, und wo die Ergebnisse jeder Station liegen (MongoDB, Storage mit flachem Frontmatter, Blob). Antwort auf die Owner-Frage vom 11.09. abends, vier Entscheidungen dazu vom Owner; Grundlage für den Implementierungsplan zu Vorhaben 3."
status: konzept
---

# Architektur und Datenhaltung der Stationen S0–S11

**Stand:** 2026-09-11, geprüft gegen `master` (v1.2.247) und die Analysen
[`erfassungs-flow-wiederverwendung.md`](../analysis/erfassungs-flow-wiederverwendung.md),
[`erfassungs-flow-bauweisen-vergleich.md`](../analysis/erfassungs-flow-bauweisen-vergleich.md)
sowie das Composer-Konzept
[`erfassungs-composer-s4-s5.plan.md`](erfassungs-composer-s4-s5.plan.md).
**Leitplanken:** ADR 0003 (Wizard/Schema getrennt, generische Bindung O1),
ADR 0004 (Inbox, nie ins Ziel schreiben), ADR 0006 (Widerstand zählen),
ADR 0008 (ein Deployment, Embed nur öffentlich). Frontmatter bleibt flach.
Keine stillen Fallbacks. Storage nur über Provider.

## 0. Die drei Fragen in je einem Satz

1. **Wizard und Stationen:** Der Wizard ist die Maschine von genau zwei
   Stationen, S4 Beitragen und S5 Prüfen & Abgeben. Die anderen elf sind
   keine Wizard-Flows, sondern Regelsatz je Library plus bestehende oder neue
   Modul-Oberflächen. Eine Wizard-Verwaltung braucht es für S4/S5, nicht für
   den Rest.
2. **Neu oder vorhanden:** Neu sind vier Dinge: das Anlagen-Modell im Composer
   (S4), das Bewertungsmodell mit Fenstern (S6), der Sichtbarkeits-Regelsatz
   (S7) und die Synthese mit Fassungen (S8b). Alles andere ist Konfiguration
   oder Erweiterung von Bestand, den es schon gibt: Mitgliedschaft, Inbox,
   Wartekorb, Galerie, Embed, „Meine Beiträge".
3. **Datenhaltung:** Verfahren liegt in MongoDB, Wissen im Storage. Was jemand
   später als Ergebnis wiederfinden soll, wird ein Dokument mit flachem
   Frontmatter im Storage (über die Promotion). Stimmen, Einwilligungen,
   Fassungsketten, Messfenster und Audit bleiben in MongoDB und kommen nie ins
   Frontmatter. Binärdaten liegen im Blob.

## 1. Wo der Wizard heute steht

Die Welle 3-VI ist auf halber Strecke, und die Hälfte ist die richtige:

| Gebaut | Beleg |
|---|---|
| Flow als eigene Entität, Weg B: `TemplateDocument.kind = 'schema' \| 'wizard'`, ein generischer Standard-Flow | `src/lib/creation/wizard-flow-entity.ts` (Δ1), `template-types.ts:332` |
| Datengetriebene Step-Engine, elf Presets in der Registry, kanonischer State | `src/components/creation-wizard/engine/step-registry.tsx:34-46` (U0–U2) |
| Generische Bindung: `editDraft` bindet an Feld-Metadaten `kind=content` des Schemas, keine Feldnamen mehr im Flow | ADR 0003 Nachtrag O1 |
| Inbox-Modell: Submission mit Statusmaschine, Repo, Wartekorb-UI, Analyse off-target, Promotion in Archiv und RAG | `src/lib/submissions/*`, `wizard-submissions-repo.ts`, U5a/b/e, U7 |
| Medien-agnostische Analyse-Fabrik (PDF, Audio) | `submission-media.ts` |

| Offen | Beleg |
|---|---|
| `publish` fehlt in der Registry; Publish-Weiche hängt an Template-Namen | `step-registry.tsx` (elf Presets), `creation-wizard.tsx:2462-2465` |
| `creation-wizard.tsx` ist noch der Monolith mit Sonderfällen | 3.302 Zeilen, Umbauplan §3 |
| Nur eine Quelle je Durchlauf; `binaryRefs` ohne Zustand je Anlage | `collect-source-step.tsx`, `wizard-submission.ts:44-61` |
| U5c (Compute-Verdrahtung Datei-Medien) und U6 (ein generischer Einstieg) | `docs/wizards/umbauplan-generischer-erfassungs-wizard.md` §8.1 |
| Wizard-Editor (ADR 0003 Phase 4) nicht begonnen | — |
| Alt-Endpunkte `events/finalize`, `events/publish-final` | STAND, Vorhaben 3 |

Das Composer-Konzept (Scheiben C0–C10) ist genau die Fertigstellung dieser
Strecke: Anlagen-Modell, `publish` in die Registry, Weiche nach Schema statt
Template-Name, Orchestrator unter 400 Zeilen. **Es ersetzt den Wizard nicht,
es beendet ihn.** Die Bühne mit Karten ist ein neues Preset-Paar
(`composer`, `review`) im selben Flow-Vokabular; der Standard-Flow bekommt
damit eine zweite, mobile Ausprägung, die Schema-Bindung bleibt dieselbe.

**Wizard-Verwaltung:** Für Vorhaben 3 reicht **ein Flow je Zieltyp als
Seed** (Beitrag zum Thema, Vorschlag, Zitat-Freigabe, Methode, Maßnahmen-
Hinweis, Beobachtung, Sitzungsnotiz), gepflegt als `kind='wizard'`-Dokumente
im Template-Repo. Der Editor dafür ist Phase 4 und kann nach dem Freeze
kommen. Was Testpersonen im Klickmodell als „anders je Anwendung" sehen,
ist zu neun Zehnteln nicht der Flow, sondern der Regelsatz (Abschnitt 2).

## 2. Was jede Station ist: Regelsatz, Modul oder Neubau

Die Stationen lassen sich in drei Schichten legen. Die Schicht sagt, wo der
Code hingehört und wer ihn ändert.

**Schicht A · Regelsatz je Library** (Konfiguration, kein Code je Anwendung).
Ein neues Feld `capture` an der Library-Konfiguration nach dem Muster
[`library-config-field.md`](../contracts/library-config-field.md). Flach,
validiert, in den Settings sichtbar:

| Schlüssel | Bedeutet | Station |
|---|---|---|
| `capture.zieltypen[]` | erlaubte `docType`s mit je einem Flow (`wizardId`) und dem Bezugsobjekt-Typ (Thema, Gespräch, Maßnahme, Art, Vorhaben) | S3, S4 |
| `capture.rollen` | welche Library-Rolle was darf (heute vier Rollen in `library-members.ts:21`); Kontext-Rolle „Moderation an Tisch 2" als Token-Attribut | S0, S1 |
| `capture.zuordnung` | welche Zuordnungsfelder gefragt werden (Name, Organisation, Interessengruppe, Sprache, Sektor) und ob „in Vertretung" erlaubt ist | S2 |
| `capture.einwilligung` | Zwecke, die eingewilligt werden müssen (Veröffentlichung, Namensnennung, Zitat) | S2 |
| `capture.bewertung` | Bewertungsart je Zieltyp: `stern \| einwand \| widerstand \| zitat_freigabe \| pruefmarke`, Skala, Begründung Pflicht, Fenster ja/nein | S6 |
| `capture.sichtbarkeit` | Regeln „wer · wann · was": Stufenleiter (Moderation, Tisch, alle, öffentlich), „fremde erst nach eigener Abgabe", „nicht während Messung", Anonymisierung je Feld | S7 |
| `capture.kuratierung` | ob Freigabe nötig ist oder Owner sofort veröffentlicht (heute implizit über die Rolle) | S8 |

**Schicht B · Bestehende Module erweitern** (Code, aber generisch):

| Station | Modul | Was erweitert wird |
|---|---|---|
| S0 Einrichten | Settings / Mitglieder (`@ks/module-settings`) | Einladungs-Token um Zieltyp, Kontext (Tisch), Ablauf, Erinnerung; Bezugsobjekte anlegen = Dokumente im Storage (Thema, Gespräch, Maßnahme) |
| S1 Ankommen | Shell / Middleware | `/beitragen/[zugang]` löst Token auf, verlangt Clerk-Session, setzt Mitgliedschaft `pending → active` |
| S3 Orientieren, S9 Wiederfinden | Explorer (`@ks/module-explorer`) | Facette „Zustand je Bezugsobjekt", „von dir offen"; Submissions im Index mit Status-Flag; Frage mit Quellenangabe ist der bestehende Chat |
| S4 Beitragen, S5 Prüfen | Creation (`@ks/module-creation`, neu `@ks/capture`) | Composer-Konzept C0–C10 |
| S8 Kuratieren | Creation, Wartekorb | Filter, Mehrfachauswahl, Original neben Transkript, Rückweisung mit Grund |
| S10 Zeigen | `@ks/embed`, Explorer | Beamer-Route (klein), Karte als zweite Ansicht (Naturmuseum, später) |
| S11 Nachverfolgen | Creation, „Meine Beiträge" | Zustände `gezählt`, `im Ergebnis`, `Rückfrage`; Rückweisungsgrund; Widerruf |

**Schicht C · Neubau** (neuer Code, neue Daten):

| Station | Bauteil | Warum neu |
|---|---|---|
| S4 | Anlagen-Modell, Wiederaufnahme, Karten-Bühne | `binaryRefs` ohne Zustand, Outbox nicht persistent |
| S6 | Bewertungsmodell Person × Objekt × Wert + Begründung + Runde, Messfenster; SHF-Einwandstufen und Auswertung als Modul `@shf/deliberation` | Stimme heute binär (`source-user-state.ts:26`), keine Fenster |
| S7 | Regel-Auswertung im zentralen Sichtbarkeitsfilter | heute nur Draft-Regel (`publication-filter.ts:43-53`) |
| S8b | Synthese mit Belegspur auf Quellstellen, Fassungskette mit Snapshots | Overlap-Bericht referenziert nur Katalogzeilen; keine Snapshots im Repo (Lib aus BetterWriter portierbar) |

Antwort auf „sind die anderen Stationen komplette Neuprogrammierungen": nein.
Neubau sind vier Bauteile, davon eines (S4) schon geplant. Der Rest ist
Regelsatz plus Erweiterung. Die Anwendungs-Zeilen der Matrix unterscheiden
sich fast nur in Schicht A.

## 3. Datenhaltung: wo die Ergebnisse jeder Station liegen

### 3.1 Die Regel

| Art | Ort | Beispiele |
|---|---|---|
| **Wissen** — soll wiedergefunden, zitiert, gezeigt werden | Storage über Provider: Markdown mit **flachem** Frontmatter; dazu `doc_meta__<lib>` (Facetten) und `vectors__<lib>` (Suche), Shadow-Twin-Artefakte in MongoDB | Beitrag nach Freigabe, Thema, Gespräch, Maßnahme, Beobachtung, freigegebene Fassung, Sitzungsnotiz |
| **Verfahren** — Zustand eines laufenden Vorgangs | MongoDB, eigene Collections | Submission im Wartekorb, Anlagen-Zustände, Stimmen, Fenster, Einwilligungen, Fassungskette, Audit |
| **Rohdaten** — Audio, Foto, PDF | Azure-Blob-Inbox (content-addressed), nach Freigabe Kopie in den Zielordner | Diktat-Mitschnitt, Zettel-Foto, Positionspapier |
| **Personenbezug** — wer hat was gesagt | MongoDB an Mitglied und Submission; ins Frontmatter nur die **Zuschreibungsstufe** (Name · Organisation · Gruppe, anonym) nach S7 | `attribution`, `consent` |

Warum so: Frontmatter ist die Schnittstelle nach außen (Obsidian, Embed,
Export) und muss flach und stabil bleiben. Stimmen und Einwilligungen ändern
sich, werden widerrufen, gelten je Fenster; im Frontmatter wären sie sofort
veraltet und kaum löschbar. Genau das trennt ADR 0002 schon für die Sterne
(MongoDB statt Datei) und ADR 0004 für die Erfassung (Inbox statt Ziel).

### 3.2 Je Station

| Station | Ergebnis | Ort | Heute | Zu tun |
|---|---|---|---|---|
| S0 Einrichten | Reihe, Treffen, Tische, Themen, Organisationen (Bezugsobjekte) | Storage: Verzeichnisse nach 3.4 mit Steckbrief-Dokumenten `_reihe.md`, `_treffen.md`, `_organisation.md`; Themen als Dokumente `docType: thema` mit flachem `tisch: 2`; Facetten in `doc_meta__<lib>` | Dokumente ja, Zieltyp-Schemas und Ablage-Regel fehlen | Schemas `reihe`, `treffen`, `organisation`, `thema`, `gespraech`, `massnahme` (Klima hat eins), `beobachtung`, `vorhaben`; `capture.ablage` |
| S0 | Mitglieder, Rollen, Einladungen | MongoDB `library_members` (exists: Rolle, `pending → active`, `inviteToken`) | ja | Token-Felder: `zieltyp`, `kontext` (Tisch), `laeuftAb`, `erinnertAm`, `kontingent`; Kontext-Rolle |
| S1 Ankommen | Session, Einlösung | Clerk (Session) + `library_members.status`; Eintrag im Aktions-Protokoll (`aktions_protokoll`) | ja | Route `/beitragen/[zugang]` (C9) |
| S2 Zuordnen | Profil der Person je Library | MongoDB `library_members.profil` (neu, flach: `anzeigename`, `organisation`, `gruppe`, `sprache`) | nein | Feld + Settings |
| S2 | Einwilligung | MongoDB **neu** `consents`: `(libraryId, userEmail, zweck, erteiltAm, widerrufenAm, bezug?)` — nie im Frontmatter | nur Checkbox | Collection + Route + Widerruf in S11 |
| S3 Orientieren | Zustand je Bezugsobjekt („im Konsent", „Einwand offen"), „von dir offen" | **berechnet** aus S6/S11; Cache als Facette `verfahrensstand` in `doc_meta__<lib>` | nein | Aggregation nach jeder Stimme; kein eigener Speicher |
| S4 Beitragen | Beitrag mit Anlagen | MongoDB `wizard_submissions` + `attachments[]` mit Zustand je Anlage; Blob-Inbox; Analyse als `external_jobs` je Anlage | Submission ja, Anlagen nein | Composer C1–C4 |
| S4 | Entwurf-Wiederaufnahme | Browser: `localStorage` (Submission-Id je Zugang), IndexedDB `pending-uploads` | nein | C6 |
| S5 Prüfen & Abgeben | Fassung des Erfassers: `metadata`, `markdownBody`, `confidence`, `attribution`, `visibility` | MongoDB `wizard_submissions` (Status `pending`); nach Freigabe Storage unter `Organisationen/{organisation}/Beiträge/{reihe}/{treffen}` | ja, ohne `attribution`/`visibility` | C5 + zwei flache Felder; Ablage-Regel in der Promotion |
| S6 Mitentscheiden | Äußerung Person × Objekt × Wert | MongoDB **neu** `assessments`: `(libraryId, zielId [fileId oder submissionId], userEmail, art, wert, stufe?, begruendung?, runde?, fensterId?, erstelltAm)`; Unique je `(zielId, userEmail, art, runde)` | nur `source_user_states` binär | Collection; Migration `favorite → art: stern`; Aggregat in `doc_meta` (`sterne`, `einwaende_schwer`) |
| S6 | Messfenster, Runden | MongoDB **neu** `assessment_windows`: `(libraryId, zielId, runde, offenVon, offenBis, zeigeWerte: bool)` | nein | SHF-Modul |
| S7 Sehen dürfen | keine Daten — eine Regel | Regelsatz in `libraries.config.capture.sichtbarkeit`; Auswertung in `publication-filter.ts` (Chat, Galerie, Submissions) | Draft-Regel | Regel-Engine, Tests je Fall der Landkarte |
| S7 | Sichtbarkeitsstufe und Anonymität je Beitrag | Frontmatter, flach: `sichtbarkeit: moderation \| tisch \| alle \| oeffentlich`, `anonym: true`; Quelle ist `submission.visibility` | nein | Promotion setzt beide (`publish-frontmatter.ts`) |
| S8 Kuratieren | Freigabe, Rückweisung mit Grund | MongoDB `wizard_submissions.review` + `events[]` (exists) | ja | Bulk, Filter; nichts Neues an den Daten |
| S8b Verdichten | Synthese-Vorschlag mit Belegen | MongoDB **neu** `syntheses`: `(libraryId, zielId, fassungen[] {seq, markdown, aussagen[] {text, belege[] {submissionId \| fileId, stelle}}, erstelltAm, erstelltVon, wiederhergestelltAus?}, zeiger {aktuell, neueste})` — Snapshots unveränderlich (Muster BetterWriter `history/snapshots.ts`) | nein | Collection + Lib-Port; Synthese-Job als External Job |
| S8b | Freigegebene Fassung | Storage unter `Veranstaltungen/{reihe}/{treffen}/Ergebnisse`: Dokument `docType: ergebnis`, `fassung: 3`, `synthese_id: …`; Belege bleiben in MongoDB (Submission-Id), im Markdown nur Fußnoten-Marker | nein | Promotion-Variante „Fassung" |
| S9 Wiederfinden | Index | `vectors__<lib>`, `doc_meta__<lib>` — auch für Submissions im Wartekorb mit Status-Flag | nur publizierte | `upsertMarkdown` bei Abgabe, Filter erweitert |
| S10 Zeigen | keine eigenen Daten | liest publizierte Dokumente über `@ks/embed` bzw. Beamer-Route | ja | — |
| S11 Nachverfolgen | „Meine Beiträge", „Neu:" | **berechnet**: Submissions (`mine`), `assessments` (eigene), `syntheses` mit Belegen auf eigene Submissions (Rückwärts-Index `belege.submissionId`), Ereignisse seit `library_members.zuletztGesehen` | Liste ja | Rückwärts-Index, `zuletztGesehen`, Widerruf-Route |

Drei Collections sind neu (`consents`, `assessments` mit `assessment_windows`,
`syntheses`), zwei bestehende wachsen (`library_members`, `wizard_submissions`),
ein Konfigurationsfeld kommt an die Library. Das Storage bekommt acht
Zieltyp-Schemas, die Verzeichnisstruktur aus 3.4 und die flachen
Frontmatter-Felder `sichtbarkeit`, `anonym`, `fassung`, `reihe`, `treffen`,
`thema`, `tisch`, `organisation`. Nichts davon verletzt die Flat-Frontmatter-Regel.

### 3.3 Was ausdrücklich nicht ins Frontmatter geht

Stimmen und Widerstandswerte, Einwilligungen, Namen von Personen jenseits der
Zuschreibungsstufe, Messfenster, Fassungsketten, Audit-Ereignisse, Job-Ids.
Wer diese Daten in Obsidian sehen will, sieht sie über die Agentensicht
(MCP-Werkzeuge), nicht über die Datei.

### 3.4 Verzeichnisstruktur im Storage (Owner 12.09.)

Eine Library für das ganze Forum, aber so gegliedert, dass ein späterer Umzug
einer Organisation in eine eigene Library **das Verschieben eines
Verzeichnisses** ist und dass Storage-seitig (OneDrive/Nextcloud-Freigabe,
ADR 0005) je Organisation Lese- und Schreibrechte gesetzt werden können.
Veranstaltungen sind ebenfalls Verzeichnisse: ein Treffen ist ein Ordner,
eine wiederkehrende Reihe (SHF 2026 mit sechs Treffen) ein übergeordneter
Ordner, SHF 2027 ein neuer Hauptordner.

Zwei Bäume unter dem Library-Root, weil zwei Dinge umziehen können — die
Organisation mit ihren Beiträgen, und die Veranstaltung mit ihren Ergebnissen:

```
<Library-Root>/
  Veranstaltungen/
    SHF 2026/                              ← Reihe (docType: reihe), _reihe.md
      2026-09-24 Treffen 1/                ← Treffen (docType: treffen), _treffen.md
        Themen/                            ← Bezugsobjekte: Thema 3 Mobilität im Alltag.md (tisch: 2)
        Ergebnisse/                        ← freigegebene Fassungen (docType: ergebnis, fassung: 3)
        Protokoll/                         ← Auswertung, Beamer-Export, Anwesenheit
      2026-10-15 Treffen 2/
    SHF 2027/                              ← neuer Hauptordner
  Organisationen/
    Gemeinde Kaltern/                      ← Organisation (docType: organisation), _organisation.md
      Beiträge/
        SHF 2026/2026-09-24 Treffen 1/     ← spiegelt den Veranstaltungspfad
          Halbstundentakt und sichere Radwege.md
    Landwirtschaftsverband/
    Einzelpersonen/                        ← explizit konfiguriert, kein stiller Default
```

Regeln:

- **Beiträge liegen bei der Organisation**, nicht beim Treffen. Der Ordner
  der Organisation ist damit vollständig und für sich lesbar; der
  Unterpfad spiegelt die Veranstaltung. Umzug = `Organisationen/<Name>/`
  in den Root der neuen Library verschieben.
- **Ergebnisse, Themen und Protokolle liegen bei der Veranstaltung**, weil
  sie dem Forum gehören, nicht einer Organisation.
- **Der Bezug steht im Frontmatter, flach:** `reihe: SHF 2026`,
  `treffen: 2026-09-24 Treffen 1`, `thema: Mobilität im Alltag`, `tisch: 2`,
  `organisation: Gemeinde Kaltern`. Nach einem Umzug bleiben diese Felder
  als Text gültig; die Galerie filtert darüber (Facetten in `doc_meta`),
  nicht über den Ordnerpfad.
- **Belege der Synthese referenzieren die Submission-Id (MongoDB), nicht nur
  die `fileId`.** Storage-Ids können bei einem Umzug in eine andere Library
  (anderes Laufwerk) wechseln; die Submission-Id bleibt. Innerhalb der
  Library übernimmt die Sync-Engine den Umzug (`familie_umziehen`).
- **Die Ablage ist Konfiguration** (`capture.ablage`): je Zieltyp eine
  Pfadvorlage, z. B. Beitrag → `Organisationen/{organisation}/Beiträge/{reihe}/{treffen}`,
  Ergebnis → `Veranstaltungen/{reihe}/{treffen}/Ergebnisse`. Die Promotion
  löst sie mit find-or-create auf (ersetzt den heutigen `root/inbox`-Default).
  Fehlt ein Platzhalterwert (keine Organisation), schlägt die Promotion mit
  klarer Meldung fehl — außer die Konfiguration nennt ausdrücklich einen
  Sammelordner wie `Einzelpersonen`.
- **Reihe, Treffen und Organisation sind Bezugsobjekte** mit eigenem
  Steckbrief-Dokument (`_reihe.md`, `_treffen.md`, `_organisation.md`): Zeit,
  Ort, Tische, Themen, Regelsatz-Abweichungen, Kontaktperson. Das
  Einladungs-Token bindet neben Zieltyp und Tisch auch das Treffen.
- **Rechte je Verzeichnis** sind kein Thema in Vorhaben 3: die App liest über
  die Owner-Credentials, Sichtbarkeit regelt S7. Die Struktur ist so gebaut,
  dass ADR 0005 (eigene Storage-Auth je Organisation) später nur die Freigabe
  des Organisationsordners braucht.

Verworfene Alternative: Beiträge unter dem Treffen (`Treffen 1/Beiträge/
<Organisation>/`). Dann wäre der Umzug einer Organisation ein Einsammeln
über alle Treffen, kein Verschieben eines Ordners.

Dasselbe Muster gilt für die anderen Anwendungen mit eigener Pfadvorlage:
Klimamaßnahmen `Sektoren/{sektor}/Maßnahmen`, Naturmuseum
`Beobachtungen/{jahr}/{art}`, Dialogformate `Gespräche/{gespraech}`.

## 4. Wie eine Anwendung entsteht

Eine neue Anwendung (Naturmuseum, Klimamaßnahmen) braucht nach diesem Modell:

1. **Schemas** für ihre Zieltypen (Storage-Templates, `kind='schema'`), mit
   Feld-Metadaten `kind=content` für den Prüfen-Schirm.
2. **Einen Flow je Zieltyp** (`kind='wizard'`), meist eine Kopie des
   Standard-Flows mit anderer Karten-Reihenfolge, etwa „Foto zuerst".
3. **Den Regelsatz** `capture.*` in der Library-Konfiguration.
4. **Optional ein Modul** für die eigene Äußerungsart (SHF: Einwandstufen und
   Auswertung; Naturmuseum: Prüfmarke), wenn `capture.bewertung` nicht
   reicht.

Kein Wizard-Code, kein neuer Station-Code. Das ist die Aussage, die die
Matrix im Klickmodell belegt: dieselbe Station, anderer Regelsatz.

## 5. Implementierungsplan (Reihenfolge nach Abhängigkeit)

Personentage aus der Wiederverwendungs-Analyse, ohne Puffer. Das Fenster
17.09. bis 09.10. hat siebzehn Arbeitstage.

| Welle | Inhalt | Hängt ab von | PT |
|---|---|---|---|
| **E0 Regelsatz** | Feld `capture` an der Library (Zieltypen, Zuordnung, Einwilligung, Bewertung, Sichtbarkeit, **Ablage-Pfadvorlagen**), Settings-Formular, Seed für SHF; Zieltyp-Schemas `reihe`, `treffen`, `organisation`, `thema`, `vorschlag`; Verzeichnisbaum anlegen | — | 4–5 |
| **E1 Composer** | Scheiben C0–C10 des Composer-Konzepts, inkl. Einladungs-Token (C9) und `publish` in der Registry | E0 (Zieltypen) | 14–20 |
| **E2 Zuordnung und Einwilligung** | `library_members.profil`, `consents`, `attribution`/`visibility` an der Submission, Prüfen-Schirm zeigt beides | E1 | 3–4 |
| **E3 Bewertungsmodell** | `assessments`, `assessment_windows`, Migration der Sterne, Aggregat in `doc_meta`; SHF-Einwandstufen, Fenster, Auswertung als Modul | E0 | 2–3 + 6–10 |
| **E4 Sichtbarkeit** | Regel-Engine im zentralen Filter, Frontmatter-Felder in der Promotion, Fälle der Landkarte als Tests | E2, E3 | 3–4 |
| **E5 Wartekorb unter Last** | Filter, Bulk, Original neben Transkript, Grund bei Rückweisung | E1 | 3–5 |
| **E6 Synthese und Fassungen** | `syntheses`, Snapshot-Lib (Port), Synthese-Job mit Belegspur, Promotion „Fassung" | E1, E5 | 6–10 |
| **E7 Wiederfinden und Nachverfolgen** | Submissions im Index, `verfahrensstand`-Facette, „Neu:"-Berechnung, Widerruf, Beamer-Route | E3, E4, E6 | 4–6 |

Pflicht bis zum Freeze: E0, E1, E2, E3 (Skala und Einwandstufen), E4 — rund
35 bis 50 PT, also nur zu zweit oder mit dem Schnitt aus der Analyse (E5 auf
das Nötigste, S0-Verwaltung per Skript, E6/E7 ins Vorhaben danach).
Jede Welle: eine PR, Diff-Grenzen nach `AGENTS.md`, `pnpm test`, `pnpm lint`,
vollständiger `tsc`-Vergleich, Freeze-Tests vor dem Umbau (C0).

## 6. Entscheidungen (Owner, 11.09. abends)

| # | Frage | Entschieden | Wirkung |
|---|---|---|---|
| 1 | Flows als Dokumente oder Dateien | **Dokumente in MongoDB**, `kind='wizard'` im Template-Repo, wie heute | BetterWriters Datei-Registry wird nicht portiert; Seeds je Zieltyp als Dokumente; der spätere Editor dockt in den Settings an |
| 2 | Eine oder mehrere Libraries je Forum | **Eine Library für das SHF.** Eine Library je Organisation kommt später. **Korrektur 12.09.:** Organisationen und Veranstaltungen sind im Storage eigene Verzeichnisse (3.4), damit der spätere Umzug ein Verschieben ist | Tische und Organisationen sind Felder am Mitglied und Token (`kontext`, `profil.organisation`) **und** Ordner im Storage; `capture.ablage` legt die Pfadvorlagen fest; `capture.*` gilt für diese eine Library |
| 3 | Aufbewahrung | **So lange wie möglich, keine automatische Löschung.** `consents` bleiben auch nach Widerruf (mit `widerrufenAm`), `assessments` nach Rundenende, Submissions nach `published`/`rejected` | Kein Aufräum-Job in Vorhaben 3 (schließt ADR 0004, O2 vorerst); Löschung nur auf ausdrücklichen Wunsch einer Person, dann als eigener Vorgang mit Protokoll |
| 4 | Wizard-Editor | **Später**, nach dem Freeze | Vorhaben 3 arbeitet mit Seeds; ADR 0003 Phase 4 bleibt geplant |

## Verweise

- Analysen: `docs/analysis/erfassungs-flow-wiederverwendung.md`,
  `docs/analysis/erfassungs-flow-bauweisen-vergleich.md`
- Composer: `docs/plans/erfassungs-composer-s4-s5.plan.md`
- Wizard-Stand: `docs/wizards/umbauplan-generischer-erfassungs-wizard.md`,
  `docs/refactor/welle-3-vi-creation-wizard/`, `docs/wizards/abnahme-inbox-plan.md`
- Muster: `docs/architecture/mongodb-repository-pattern.md`,
  `docs/contracts/library-config-field.md`
- Klickmodell: https://www.figma.com/design/2Eb9gkeKcHzhY7kR1kPyKs?node-id=60-2
