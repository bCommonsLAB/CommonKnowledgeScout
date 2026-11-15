/**
 * @fileoverview Testdaten R2: gekuerzte Abbilder der echten Arbeitsliste (Form seit 08.11.2026).
 */

export const KOPF = '| Erl. | Nr | Beginn | Ende | Titel | Quelle | Repo · Branch/PR · Link | Bemerkung |\n|---|---|---|---|---|---|---|---|'

export const LISTE = [
  '# Arbeitsliste', '', '## Nachtrag: Abgleich', '', '| | Zahl |', '|---|---|', '| Zeilen | 471 |', '',
  '## Sitzungen nach Vorhaben', '',
  '### 4. Ökosozialer Aktivismus/24.03 bcoop (2, davon 1 abgeschlossen)', '', KOPF,
  '| [x] | A66 | 2026-09-15 | 2026-09-18 | Projektheft Wiki Konzept | Code lokal | bcoop-notion2wiki · `feature/bcoop-logo-svg` #9 merged | erledigt 2026-11-05, [[2026-09-15 Projektheft-Wiki, bcoop-Logo und QR-Fix]]; in der Code-App archiviert |',
  '| [ ] | B82 | 2026-09-15 |  | bcoop Projektheft Emails analysieren | Cowork/Chat |  |  |',
  '### 4. Ökosozialer Aktivismus/24.05 Konferenzen und Netzwerk (1, davon 1 abgeschlossen)', '', KOPF,
  '| [x] | B17 | 2026-10-24 |  | Dokument ausfüllen | Cowork/Chat |  | Export: conversations.json `36a7ce26` (10 Nachr., 2026-10-24); erledigt 2026-11-08, [[2026-10-24 Dokument aus Projektordner ausfüllen]]; Vorhaben: 24.05 Konferenzen und Netzwerk (+ 24.02 Commoning mit der Uni Marburg); Formular |',
  '### 6. bCommonsLab prototyping/24.09 KnowledgeScout (2, davon 1 abgeschlossen)', '', KOPF,
  '| [x] | C4 | 2025-08-16 |  | Knowledge Scout Project Overview | Chat 2024/25 |  | Export: conversations.json `aade4646` (2 Nachr., 2025-08-16); überspringen: 1 Zug („Weiter“), Fortsetzung ohne Inhalt |',
  '| [ ] | D93 | 2026-05-27 |  | DIVA Texture template refactor | Code Cloud | CommonKnowledgeScout · [Sitzung](https://claude.ai/code/session_01N8C1k45v7euqTxNaNhayrh) | offen; [PR](https://github.com/bCommonsLAB/CommonKnowledgeScout/pull/62) |',
  '### Ohne Zuordnung (1, davon 0 abgeschlossen)', '', KOPF,
  '| [ ] | B41 | 2026-10-12~ |  | EU-Projekt Einladung | Cowork/Chat |  | Notiz vorhanden: [[2026-10-12 Einladung Marburg]] |',
].join('\n')
