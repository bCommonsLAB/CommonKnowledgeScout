---
name: d11-rechte-und-sichtbarkeit
overview: "Detailkonzept D11: Wer darf was, wer sieht was wann. Rollenmodell der Beteiligung über den Library-Rollen (Redaktion, Moderation je Tisch, Fachbegleitung, Teilnehmende), ein Helfer resolveDeliberationRole, die nötigen Änderungen am Bestand (Erfassen für Moderation, Chat für Contributors, Protokoll-Kanal app, Storage-Zugang beim Fensterschluss), Stille Runde, Vertrauensraum V1–V3 mit Bauunterschieden."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# D11 · Rechte und Sichtbarkeit

**Grundlage:** [D0](../beteiligung-objektmodell-original-und-kopie.plan.md),
[D2](d02-organisationen-und-personen.plan.md) (Rollen, Beitritt),
[D4](d04-tisch-laufzeit.plan.md) (Stille Runde). Geprüft gegen `master`
579f2d7.

## 1. Was der Bestand heute erlaubt

| Library-Rolle | Darf heute | Darf heute nicht |
|---|---|---|
| owner | alles, Mitglieder verwalten (`members/route.ts:101`) | — |
| moderator | Entwürfe sehen, Dokumente veröffentlichen und löschen, Lesezugänge verwalten (`isModeratorOrOwner`, `library-members-repo.ts:388`) | *beabsichtigt:* kein Storage-Provider (`server-provider.ts:76`), nicht erfassen (`resolveCreatorRole`, `submission-capture.ts:34-42`). *Wirksam:* beides geht, siehe Hinweis unten |
| co-creator | Storage, Chat der geteilten Library, Submissions prüfen und promoten (`isCoCreatorOrOwner`, `:490`), erfassen | Entwürfe im Chat sehen, `/docs/publish` |
| contributor | erfassen, eigene Submissions sehen | *beabsichtigt:* kein Chat (`loader.ts:296-315`), keine Entwürfe. *Wirksam:* beides geht, siehe Hinweis unten |
| (Lesezugang) | Chat/Galerie einer öffentlichen Library mit `requiresAuth` | — |

**Hinweis (Prüfung 24.09., `pruefbericht-2026-09-24.md` §1):** Die
Tabelle nennt die *beabsichtigten* Rechte. Wirksam ist heute weniger
streng: `LibraryService.getLibrary` (`library-service.ts:193-213`) liefert
die Library jedem aktiven Mitglied jeder Rolle, und `isModeratorOrOwner`,
`isCoCreatorOrOwner`, `resolveCaptureRole`, der Provider-Fallback in
`server-provider.ts:76`, `canSeeDrafts` und der Chat-Loader nutzen
`getLibrary(...) !== null` als Owner-Prüfung. Damit hat ein Moderator
heute Storage und Erfassung, ein Contributor Chat und Entwürfe. Das ist
Entscheidung O10 (README); die Änderungen in §4 setzen voraus, dass die
Helfer vorher strikt je Rolle prüfen.

Es gibt keine Rechte je Ordner (ADR 0005 zurückgestellt; Rechte je
Verzeichnis liegen beim Storage-Anbieter, nicht in KnowledgeScout).

## 2. Rollen der Beteiligung

Sie liegen **über** den Library-Rollen und kommen aus dem Snapshot (D1,
D2):

| Rolle | Erkannt an | Library-Rolle (mindestens) |
|---|---|---|
| Redaktion der Reihe | E-Mail in `series.editors[]` | `co-creator` |
| Moderation eines Tisches | E-Mail in `meeting_tables.roles[]` mit `moderation` **und** Teilnahme mit Rolle `moderation` | `moderator` |
| Fachbegleitung | `roles[]` mit `fachbegleitung` | `contributor` |
| Teilnehmende | Teilnahme mit Rolle `participant` am Tisch | `contributor` |
| Owner | Owner der Library | owner |

**Ein Helfer für alles:**

```ts
resolveDeliberationRole(libraryId, email, scope: { seriesId?, meetingId?, tableId? }): Promise<{
  isOwner: boolean
  isEditor: boolean                    // Redaktion der Reihe
  moderatesTableIds: string[]          // in diesem Treffen
  participatesAt?: { tableId: string; role: 'participant' | 'moderation' | 'fachbegleitung' }
  libraryRole: LibraryRole | null
}>
```

Jede Route der Beteiligung fragt nur diesen Helfer. Die Moderation eines
Tisches handelt nur an **ihrem** Tisch.

## 3. Rechte je Aktion

| Aktion | Owner | Redaktion | Moderation (eigener Tisch) | Fachbegleitung | Teilnehmende |
|---|---|---|---|---|---|
| Treffen prüfen, freigeben (D1) | ✓ | ✓ | — | — | — |
| Tisch-QR erneuern, drucken (D2) | ✓ | ✓ | drucken | — | — |
| Beitreten (D2) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Treffen starten, anhalten, beenden (D4) | ✓ | ✓ | ✓ (starten/anhalten) | — | — |
| Runde steuern, Fenster öffnen und schließen (D4) | ✓ | ✓ | ✓ | — | — |
| Beitragen für sich (D3) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Beitragen in Vertretung (D3) | ✓ | ✓ | ✓ | — | — |
| Eigenen Beitrag widerrufen (D3) | — | — | für Teilnahmen ohne Konto | ✓ | ✓ |
| Beitrag herausnehmen (D3) | ✓ | ✓ | ✓ | — | — |
| Synthese auslösen, Entwurf übernehmen (D6) | ✓ | ✓ | ✓ | — | — |
| Messung anlegen, schließen (D7) | ✓ | ✓ | ✓ | — | — |
| Stellung nehmen (D7) | — | — | — | ✓ | ✓ |
| Tisch-Abschluss (D8) | ✓ | ✓ | ✓ | — | — |
| Redaktions-Freigabe (D8, D10) | ✓ | ✓ | — | — | — |
| Beauskunften (D9) | ✓ | ✓ | ✓ | ✓ | ✓ (mit `chat.allowMemberRoles`) |

## 4. Nötige Änderungen am Bestand

| Änderung | Wo | Warum |
|---|---|---|
| Moderation darf erfassen (Vertretung) | `resolveCaptureRole` (`capture-access.ts:24`) um `moderator` erweitern, **nur** für Routen der Beteiligung (Parameter `context: 'deliberation'`), sonst wie heute | M-S4.4 |
| Contributors dürfen chatten, wenn konfiguriert | `loadLibraryChatContext` + `chat.allowMemberRoles` (D9) | T-S9.1 |
| Storage-Zugang beim Fensterschluss | Promotion läuft mit dem Server-Provider im Namen des Owners (`getServerProvider(ownerEmail, …)`); Recht aus „Moderation dieses Tisches“; Protokoll nennt die Moderation (D5) | die Moderation hat keinen Provider |
| Protokoll aus der App | `AktionsProtokollEintrag.kanal` um `'app'` erweitern (`aktions-protokoll-repo.ts:50`); `werkzeug` = Aktionsname | Freigabe, Beitritt, Fensterschluss, Herausnehmen, Freigaben nachvollziehbar |
| Selbstbeitritt als contributor | `joinAsContributor` (D2) | dritter Zugangsweg; **Owner-Freigabe vor dem Bau** (Stop-Bedingung „sicherheitsrelevant“) |
| E-Mail einheitlich | Neue Routen nutzen `getPreferredUserEmail`; die Accept-Routen nehmen heute `emailAddresses[0]` | keine zwei Identitäten derselben Person |

## 5. Sichtbarkeit

### 5.1 Stille Runde (Entscheidung 4, D4)

Solange ein Fenster offen ist, sieht niemand fremde Inhalte, auch nicht
Owner oder Redaktion. Die Moderation sieht nur, wer abgegeben hat. Die
Regel gilt an jedem Lese-Endpunkt (Beiträge D3, Stellungnahmen und
Auswertung D7) und ist getestet.

### 5.2 Nach dem Fenster

| Inhalt | Teilnehmende | Moderation (Tisch) | Redaktion | Öffentlich |
|---|---|---|---|---|
| eigene Beiträge | ✓ | ✓ | ✓ | — |
| fremde Einzelbeiträge mit Namen | — | ✓ (Owner 21.09.: „das muss schon sein“) | V1: — · V2: ✓ · V3: ✓ | — |
| Synthese-Vorschlag mit Belegen | nur eigene Sätze (T-S8b.1) | ✓ | ✓ | — |
| Auswertung auf Gruppenebene | ✓ | ✓ | ✓ | — |
| freigegebenes Ergebnis | ✓ | ✓ | ✓ | erst mit der öffentlichen Sicht (späteres Vorhaben, nur `ergebnis_stand: freigegeben`) |

**Achtung, Archivzugang:** Beitragsdateien liegen im Storage. Wer Zugang
zum Archiv hat (Owner, Co-Creator, Personen mit Zugang zum
Nextcloud/OneDrive der Library), liest sie dort. Deshalb stehen bei V1
**keine Namen** in den Dateien (D5). Der Name ist nur in MongoDB und
über die App sichtbar, und nur für die Rollen oben.

### 5.3 Vertrauensraum: was je Variante anders gebaut wird

| Variante | Namen in Beitragsdateien | Redaktion sieht Einzelbeiträge mit Namen | Verbände sehen die Beiträge ihrer Gruppe | Suchindex | Export | Mehr-PT |
|---|---|---|---|---|---|---|
| **V1** (Vorschlag bis zur Klärung) | nein | nein (nur Gruppenebene) | nein | ohne Beiträge | keiner | 0 |
| **V2** | ja (`anzeigename`) | ja | nein | ohne Beiträge | Export mit Namen nur für die Redaktion, jeder Export protokolliert | 1–1,5 |
| **V3** | ja | ja | ja: eigene Sicht je Interessengruppe, Konto je Verband (Lesezugang mit `gruppe`) | Beiträge im Index mit `$nin`-Ausschluss für alle anderen (D9) | wie V2 | 2–3 |

Satz 3 der Tischvereinbarung („veröffentlicht wird auf Gruppenebene“)
muss zur gewählten Variante passen. Die Variante gehört **vor den ersten
echten Beitrag** festgelegt. Ein Wechsel danach braucht für schon
Gesagtes eine neue Zustimmung.

## 6. Missbrauch und Grenzen

- **Rate-Limits:** Beitritt je E-Mail und IP; Tickets für das
  Live-Diktat (Bestand, `realtime-rate-limit.ts:46`). Beide sind
  prozesslokal; das reicht für eine Instanz. Ein verteiltes Limit steht im
  Vorrat.
- **Token:** QR-Token mit Ablauf und Erneuern (D2).
- **Ohne Konto:** Teilnahmen ohne Konto legt nur die Moderation an (D2).

## 7. Tests

- `resolveDeliberationRole`: jede Rolle, falscher Tisch, abgelaufenes
  Treffen.
- Rechte-Matrix aus 3 als tabellengetriebener Test gegen die Routen, mit
  gemockten Repos.
- Stille Runde an allen Lese-Endpunkten.
- `resolveCaptureRole` außerhalb der Beteiligung: unverändert.
- Loader: ohne `allowMemberRoles` wie heute.

## 8. Offene Fragen

1. Der Vertrauensraum (V1–V3), Frage an Verfahrensverantwortung und
   Fachbegleitung.
2. Die Freigabe des Selbstbeitritts durch den Owner.
3. Soll die Redaktion eine eigene Library-Rolle werden, statt
   `co-creator` plus `series.editors`? Vorschlag: nein, der Zuschnitt
   über den Snapshot genügt.

## 9. Aufwand

| Teil | PT |
|---|---|
| `resolveDeliberationRole` + Rechte-Matrix als Test | 1 |
| Änderungen am Bestand (Erfassen, Protokoll-Kanal, E-Mail) | 0,5–1 |
| Stille-Runde-Filter als gemeinsamer Baustein | 0,5 |
| **Summe D11** (ohne V2/V3) | **2–2,5** |
