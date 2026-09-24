---
name: d02-organisationen-und-personen
overview: "Detailkonzept D2: Organisationen als Steckbrief-Dateien mit eigenem Ordner, Interessengruppen, Rollen und Einladungen je Tisch, Beitritt der Teilnehmenden über den Tisch-QR nach Clerk-Anmeldung, Profil und Tischvereinbarung je Treffen, Teilnahme ohne Konto über die Moderation. Schnittstellen zu Mitgliedschaft, Einladungen, Clerk und Middleware."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# D2 · Organisationen und Personen

**Grundlage:** [D0](../beteiligung-objektmodell-original-und-kopie.plan.md)
(Klassen P und V, E1 „Datei zuerst“, E3, E6),
[D1](d01-veranstaltung-aufsetzen.plan.md) (Freigabe, Rollen-Tabelle in
`_tisch.md`). Geprüft gegen `master` 579f2d7.

## 1. Zweck und Screens

| Screen | Was passiert |
|---|---|
| T-S1.1 Willkommen, T-S1.1b Code eingeben | Tisch-QR öffnet eine öffentliche Seite, danach Clerk-Anmeldung mit E-Mail-Code |
| T-S2.1 Ihr Platz am Tisch | Name, Organisation (Auswahl aus der Liste), Interessengruppe; Tisch nur Anzeige |
| T-S2.2 Was am Tisch gilt | Tischvereinbarung einmal lesen, „Verstanden“ |
| M-S1.2 Mein Tisch heute, M-S2.1 Ihre Rolle heute | Die Moderation kommt über denselben QR und wird an ihrer E-Mail als Moderation erkannt |
| M-S4.4 Für wen erfassen Sie? | Die Moderation legt eine Teilnahme ohne Konto an (Zettel, kein Telefon) |
| R-S0.4 Moderation einladen, Tisch-QR drucken | Einladungen aus der Rollen-Tabelle, QR-Karte je Tisch |

## 2. Objekte

| Objekt | Klasse | Original | Kopie | Kennung |
|---|---|---|---|---|
| Organisation | P | `Organisationen/{Name}/_organisation.md` | `organisations` | `organisation_id` |
| Interessengruppe | P | Tabelle in `_reihe.md` (D1) | `series.interestGroups[]` | Kürzel |
| Mitgliedschaft in der Library | V (Bestand) | `library_members` | — | (libraryId, E-Mail) |
| Rolle am Tisch | P | Rollen-Tabelle in `_tisch.md` (D1) | `meeting_tables.roles[]` | E-Mail |
| Redaktion | P | `redaktion: [...]` in `_reihe.md` | `series.editors[]` | E-Mail |
| Teilnahme | V | `table_participations` | — | (meetingId, tableId, participantId) |

## 3. Organisation

### 3.1 Datei — `Organisationen/{Name}/_organisation.md`

```markdown
---
typ: organisation
organisation_id: gemeinde-kastelbell
name: Gemeinde Kastelbell
kurzname: Kastelbell
interessengruppe: gem
aliase: [Gem. Kastelbell, Kastelbell-Tschars]
status: bestaetigt
---

Kurzbeschreibung der Organisation (optional).
```

- `interessengruppe` ist ein Kürzel aus der Tabelle der Reihe.
- `aliase` hilft beim Zuordnen freier Eingaben.
- `status` ist `bestaetigt` oder `vorlaeufig`. `vorlaeufig` heißt: von der
  App angelegt, von der Redaktion noch nicht bestätigt (3.3).
- Der Ordner hat drei feste Unterordner:
  - `Dokumente/` für eigene Unterlagen (E6: heute legt die Redaktion für
    die Organisation ab);
  - `Beiträge/` als Ziel der Promotion beim Fensterschluss (D5);
  - die Steckbrief-Datei selbst.
- Keine `_`-Ordner (D1, 3.1).

### 3.2 Übernahme in die Datenbank

Jede Treffen-Freigabe (D1) liest zusätzlich alle
`Organisationen/*/_organisation.md`, eine Ebene tief, und frischt den
Katalog `organisations` auf:
- Schlüssel ist `(libraryId, organisationId)`.
- Felder: `name`, `shortName`, `interestGroup`, `aliases[]`, `status`,
  `folderPath`, `provenance`.
- Prüfregeln:
  - Kennung eindeutig;
  - `interessengruppe` existiert in der Reihe;
  - kein Alias kollidiert mit dem Namen oder Alias einer anderen
    Organisation.

Verstöße sind Fehler.

### 3.3 Organisation unbekannt

Wählt jemand am Tisch keine Organisation aus der Liste, sondern tippt eine
neue, dann gilt:
1. Die Teilnahme speichert `organisationText` und `organisationId: null`.
2. Der Beitrag lässt sich trotzdem abgeben.
3. **Beim Fensterschluss (D5)** legt die App für jede unbekannte
   Organisation **Ordner und Steckbrief-Datei mit `status: vorlaeufig`**
   an: Datei zuerst, sichtbar, protokolliert. Erst dann wird der Beitrag
   dorthin geschrieben.
4. Die Redaktion prüft und bestätigt die Organisation (`status:
   bestaetigt`) oder führt sie mit einer bestehenden zusammen (Alias
   ergänzen, Ordner verschieben).
5. **Kein stiller Sammelordner.** `Einzelpersonen/` gibt es nur, wenn
   jemand am Tisch ausdrücklich „keine Organisation“ wählt. Das ist eine
   eigene Auswahl in T-S2.1.

## 4. Rollen und Einladungen

| Rolle | Woher | Library-Rolle (Bestand) | Zusätzlich |
|---|---|---|---|
| Redaktion | `_reihe.md` → `series.editors[]` | `co-creator` (Storage-Zugang über `getServerProvider`, Prüfen/Freigeben, Promotion) | Redaktionsrechte der Reihe (D11) |
| Moderation | `_tisch.md` Rollen → `meeting_tables.roles[]` | `moderator` | an **einen** Tisch je Treffen gebunden; braucht Erfassen in Vertretung (D11: `resolveCaptureRole` erweitern) |
| Fachbegleitung | `_tisch.md` Rollen | `contributor` | liest am Tisch mit, trägt bei |
| Teilnehmende | Tisch-QR | `contributor`, per Selbstbeitritt | — |

**Einladungen beim Freigeben:** Für jede E-Mail aus Rollen und Redaktion,
die noch kein aktives Mitglied mit mindestens dieser Rolle ist, legt die
Freigabe eine Einladung an. Sie nutzt `addMember(libraryId, email, role,
addedBy)` (`library-members-repo.ts:66`) und die Einladungs-Mail
`MailjetService.sendMemberInviteEmail` (`mailjet-service.ts:145`).

Die Mitglieder-Route ist heute nur für den Owner
(`members/route.ts:101`). Deshalb ruft die Freigabe die Repo-Funktion
direkt auf, nach eigener Rechteprüfung (Redaktion der Reihe oder
Owner/Co-Creator). Die Route wird nicht geöffnet.

Eine bestehende höhere Rolle wird nie herabgestuft. Achtung:
`addMember` setzt ein bestehendes Mitglied auf `pending` zurück (`:66`).
Deshalb wird vor dem Aufruf `getActiveMemberRole` (`:533`) geprüft.

Die Rolle am Tisch entsteht nicht durch die Einladung, sondern steht im
Snapshot (`meeting_tables.roles[]`). Die Moderation eines Tisches ist also
**Library-Moderator und im Snapshot des Tisches genannt**.

## 5. Beitritt über den Tisch-QR

### 5.1 Ablauf

1. **QR-Token:** Beim Freigeben bekommt jeder Tisch `qrToken`: 32
   Zufallsbytes, base64url. Muster: Einladungs-Token
   (`api/libraries/[id]/invites/route.ts:93-104`, `crypto.randomBytes(32)`).
   Dazu kommt `qrValidUntil` = Treffen-Ende + 12 h. Eine erneute Freigabe
   behält den Token; „Token erneuern“ ist eine eigene Aktion (Widerruf).
2. **`/t/{qrToken}`** ist öffentlich (neu in `isPublicRoute`,
   `src/middleware.ts:39-56`). Die Seite zeigt nur Reihe, Treffen, Tisch
   und Handlungsfeld, keine Personen und keine Inhalte. Ein ungültiger oder
   abgelaufener Token zeigt eine klare Meldung, keinen anderen Tisch.
3. **Anmeldung:** `SignInButton mode="modal"
   fallbackRedirectUrl="/t/{qrToken}"`, wie auf der Einladungsseite
   (`src/app/invite/[token]/page.tsx:211-213`). Der E-Mail-Code ist eine
   Einstellung im Clerk-Dashboard und gilt für die ganze Instanz.
4. **`POST /api/deliberation/join {qrToken}`** (angemeldet):
   - Token und Treffen-Zustand prüfen: freigegeben, läuft oder angehalten.
   - E-Mail über `getPreferredUserEmail` (`src/lib/auth/user-email.ts:39`).
     Die Accept-Routen nehmen heute `emailAddresses[0]`; die neue Route
     nimmt einheitlich die bevorzugte Adresse.
   - **Mitgliedschaft sicherstellen:** Ist die Person kein aktives
     Mitglied, legt die neue Repo-Funktion `joinAsContributor(libraryId,
     email, via: 'table-qr', tableId)` sie als `contributor` mit Status
     `active` an. Es gibt keinen Token und keine Mail; das ist der **dritte
     Zugangsweg** neben Einladung und Lesezugang. Eine bestehende Rolle
     bleibt.
   - **Teilnahme anlegen oder wiederfinden:**
     - Wer in `roles[]` des Tisches steht, bekommt die Rolle
       `moderation`/`fachbegleitung`, alle anderen `participant`.
     - Wer schon an einem **anderen** Tisch desselben Treffens angekommen
       ist, bekommt 409 („Sie sind an Tisch 3 angemeldet“). Die
       Moderation kann umsetzen.
   - Protokolleintrag (D11, `kanal: 'app'`).
   - Die Anfragen werden je E-Mail und IP begrenzt, Muster
     `realtime-rate-limit.ts:46`.
5. Weiter zu T-S2.1 (Profil) und T-S2.2 (Vereinbarung).

### 5.2 Warum Selbstbeitritt vertretbar ist

- Der Token ist nur am Tisch sichtbar.
- Er läuft mit dem Treffen ab und lässt sich erneuern.
- Die Rolle `contributor` darf nur erfassen und die eigenen Beiträge sehen
  (`library-members.ts:11-20`).
- Jeder Beitritt steht im Protokoll.

Nach AGENTS.md (Stop-Bedingung „sicherheitsrelevante Änderungen“) braucht
dieser Weg die **ausdrückliche Freigabe des Owners vor dem Bau** (W1-E3
im Wellen-Plan).

## 6. Teilnahme, Profil, Tischvereinbarung

**`table_participations`**, Schlüssel `(libraryId, meetingId, participantId)`,
Index `(meetingId, tableId)`:

```ts
interface TableParticipation {
  libraryId: string; meetingId: string; tableId: string
  participantId: string            // = normalisierte E-Mail, oder 'proxy:<uuid>' ohne Konto
  email?: string                   // fehlt bei Teilnahme ohne Konto
  role: 'participant' | 'moderation' | 'fachbegleitung'
  displayName: string
  organisationId: string | null
  organisationText?: string        // nur bei unbekannter Organisation oder „keine“
  noOrganisation?: true            // ausdrücklich „keine Organisation“ → Einzelpersonen
  interestGroup: string            // Kürzel aus der Reihe; Pflicht
  arrivedAt: string
  agreementReadAt?: string
  createdBy?: string               // bei Teilnahme ohne Konto: E-Mail der Moderation
  channel?: 'self' | 'proxy'
  updatedAt: string
}
```

- **Vorbelegung:** Name aus Clerk. Organisation und Gruppe kommen aus der
  jüngsten Teilnahme derselben Person in dieser Reihe, sonst aus der
  Organisation (`interessengruppe`).
- **Pflicht:** `interestGroup` ist Pflicht, weil die Auswertung nach
  Gruppen zählt (D7). Ohne sie ist der Composer gesperrt, mit Hinweis.
- **Tischvereinbarung:** `agreementReadAt` wird beim Tippen auf
  „Verstanden“ gesetzt. Ohne diesen Zeitpunkt nimmt die API keinen
  Beitrag an (D3). Ein eigenes `consents`-Objekt kommt erst mit V2/V3
  (D0, Entscheidung 3).

**Teilnahme ohne Konto** (M-S4.4):
- Die Moderation legt `participantId: 'proxy:<uuid>'` an, mit Name,
  Organisation und Gruppe, `channel: 'proxy'` und `createdBy`.
- Beiträge für diese Person erfasst die Moderation in Vertretung (D3).
- Einen Widerruf durch die Person selbst gibt es nicht; das kann nur die
  Moderation.

## 7. Schnittstellen

### 7.1 Bestand

| Zweck | Bestand |
|---|---|
| Mitgliedschaft | `addMember` `:66`, `getActiveMemberRole` `:533`, `isCoCreatorOrOwner` `:490`, `isModeratorOrOwner` `:373` in `library-members-repo.ts` |
| Einladungs-Mail | `MailjetService.sendMemberInviteEmail` (`src/lib/services/mailjet-service.ts:145`) |
| Annahme | `/invite/[token]` + `POST /api/member-invites/[token]/accept` (unverändert) |
| E-Mail des Nutzers | `getPreferredUserEmail`, `normalizeEmail` (`src/lib/auth/user-email.ts:27`, `:39`) |
| Öffentliche Routen | `isPublicRoute` in `src/middleware.ts:39-56` |
| Anmelde-Rücksprung | Muster `SignInButton … fallbackRedirectUrl` (`src/app/invite/[token]/page.tsx:211-213`) |
| QR | `react-qr-code` (`session-detail.tsx:681`); Druck über `@media print` mit `[data-print-flow]` (`src/styles/globals.css:203`) |

### 7.2 Neu

| Baustein | Signatur |
|---|---|
| `joinAsContributor` (Members-Repo) | `(libraryId, email, via: 'table-qr', tableId): Promise<'created' \| 'existing'>` |
| Organisations-Katalog | `organisations`-Repo; Parser `parsePlanFile` um `typ: organisation` erweitert (D1) |
| Vorläufige Organisation anlegen | `ensureProvisionalOrganisation(provider, libraryId, text): Promise<{organisationId, folderId}>` (legt Ordner + `_organisation.md` an; D5 ruft auf) |
| Teilnahme-Repo | `upsertParticipation`, `getParticipation(meetingId, participantId)`, `listParticipations(meetingId, tableId)` |
| Routen | `GET /api/deliberation/join/[qrToken]` (öffentlich: nur Reihe, Treffen, Tisch, Handlungsfeld) · `POST /api/deliberation/join` · `PATCH /api/deliberation/[libraryId]/participations/me` (Profil, Vereinbarung) · `GET …/tables/[tableId]/participants` (Moderation des Tisches) · `POST …/tables/[tableId]/proxy-participants` (Moderation) · `POST …/tables/[tableId]/qr-token/renew` (Redaktion) |
| Seiten | `src/app/t/[qrToken]/page.tsx` (öffentlich), QR-Karte je Tisch als Druckansicht |

## 8. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Token unbekannt, abgelaufen oder erneuert | Seite: „Dieser Tisch-Code gilt nicht mehr. Bitte fragen Sie die Moderation.“ API: 404 |
| Treffen noch nicht freigegeben oder beendet | 409 mit Zustand |
| Person schon an einem anderen Tisch | 409; die Moderation kann umsetzen |
| Clerk liefert keine E-Mail | 401, kein Beitritt |
| Mail-Versand der Einladung scheitert | Einladung bleibt bestehen; der Freigabebericht nennt die fehlgeschlagenen Mails (wie `members/route.ts`: `emailSent`) |
| Organisation unbekannt | kein Fehler; vorläufige Organisation beim Fensterschluss (3.3) |

## 9. Tests

- Parser und Prüfregeln für `_organisation.md`: Alias-Kollision,
  unbekannte Gruppe.
- `joinAsContributor`: neue Person, bestehender Contributor, bestehender
  Moderator (bleibt Moderator), abgelehnter Status.
- Join-Route: Token gültig, abgelaufen, falscher Zustand, anderer Tisch
  (409), Rolle aus `roles[]`, Rate-Limit.
- Teilnahme: Vorbelegung aus der letzten Teilnahme; ohne `interestGroup`
  wird kein Beitrag angenommen.
- Proxy-Teilnahme: nur die Moderation des Tisches darf sie anlegen.

## 10. Offene Fragen

1. Die Freigabe des Selbstbeitritts durch den Owner (5.2).
2. Wer stellt die Moderatorinnen? Deren Organisation erscheint in M-S2.1.
3. Ist eine Umsetzung an einen anderen Tisch während des Treffens nötig,
   oder genügt eine Korrektur durch die Moderation?
4. Soll `getSharedLibrariesForUser` Contributor-Mitgliedschaften zeigen?
   Heute sieht eine Teilnehmerin die Library nicht in ihrer Liste
   (`library-service.ts:~920`); der Weg geht immer über den QR bzw. „Meine
   Beiträge“.

## 11. Aufwand

| Teil | PT |
|---|---|
| Organisationen: Parser, Katalog, vorläufige Organisation | 1 |
| Einladungen aus der Freigabe (ohne Herabstufen), QR-Token, Druckkarte | 1 |
| Beitritt: öffentliche Seite, Route, `joinAsContributor`, Rate-Limit, Protokoll | 1–1,5 |
| Teilnahme-Repo, Profil, Vereinbarung, Proxy-Teilnahme | 1 |
| **Summe D2** | **4–4,5** |
