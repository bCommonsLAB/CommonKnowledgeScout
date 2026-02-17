# Analyse: Mehrzeilige Strings (z. B. summary) im Frontmatter

## Problem

Im Feld `summary` des Frontmatters steht oft Markdown mit Zeilenumbrüchen. YAML-Frontmatter erfordert entweder:
- **Literal Block Scalar** (`key: |` mit eingerückten Folgenzeilen), oder
- **Quoted String** mit escaped Newlines (`"line1\nline2"`)

Rohe Newlines ohne Escaping oder Block-Syntax führen zu ungültigem YAML (Folgezeilen werden als neue Keys interpretiert).

## Übersicht: Wo wird Frontmatter serialisiert?

| Ort | Datei | Logik für mehrzeilige Strings |
|-----|-------|-------------------------------|
| **Wizard (handleSave, onPublish)** | `creation-wizard.tsx` | YAML literal block `\|` mit Einrückung |
| **Job Worker (Template-Phase)** | `phase-template.ts` → `compose.ts` | `JSON.stringify(v)` → quoted string mit `\n` |
| **Integration-Tests** | `orchestrator.ts` | YAML literal block `\|` (wie Wizard) |
| **TransformService** | `transform-service.ts` | Quoted string mit escaped quotes |
| **generate-draft-step** | `generate-draft-step.tsx` → `compose.ts` | `JSON.stringify(v)` |
| **frontmatter-patch** | `frontmatter-patch.ts` | **BUG**: Quoted string, aber Newlines werden NICHT escaped |

## Detailanalyse

### 1. Wizard (`creation-wizard.tsx`)

**Zeilen 2062–2075, 2145–2153, 3562–3577**

```ts
if (typeof value === 'string' && value.includes('\n')) {
  return `${key}: |\n${value.split('\n').map(line => `  ${line}`).join('\n')}`
}
```

- Verwendet YAML literal block scalar (`|`).
- Mehrzeilige Strings werden korrekt mit 2 Leerzeichen eingerückt.
- **Ergebnis**: Gültiges YAML.

### 2. Job Worker / compose.ts (`src/lib/markdown/compose.ts`)

**Zeilen 11–15**

```ts
function formatValue(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v)
  // ...
}
```

- `JSON.stringify("line1\nline2")` ergibt `"line1\nline2"` (mit escaped Newline).
- In YAML ist `\n` in doppelten Anführungszeichen ein gültiger Zeilenumbruch.
- **Ergebnis**: Gültiges YAML.

**Verwendung**: `phase-template.ts` (Zeile 1601–1602), `generate-draft-step.tsx`, `markdown-adapter.ts`, `website-adapter.ts`, `txt-adapter.ts`.

### 3. frontmatter-patch.ts – potenzieller Bug

**Zeilen 21–29**

```ts
if (typeof value === 'string') {
  const needsQuotes = value.includes(' ') || value.includes(':') || value.includes('\n') || ...
  if (needsQuotes) {
    lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`)
  }
}
```

- Es werden nur Anführungszeichen escaped, **keine Newlines**.
- Ein String mit echten Newlines wird als `"line1` + Newline + `line2"` ausgegeben.
- Die Newline beendet den String in der YAML-Zeile, die nächste Zeile wird als neuer Key interpretiert.
- **Ergebnis**: Ungültiges YAML bei mehrzeiligen Werten.

**Einschränkung**: `patchFrontmatter` wird aktuell nur mit einfachen Patches genutzt (`eventStatus`, `coverImageUrl`, `coverThumbnailUrl`). Wenn `parseFrontmatter` jedoch bereits mehrzeilige Werte aus dem bestehenden Dokument liefert und diese in `buildFrontmatter` neu serialisiert werden, kann der Bug auftreten.

### 4. Doppelte Implementierung?

**Ja – es gibt mehrere Stellen mit eigener Serialisierungslogik:**

1. **creation-wizard.tsx**: Inline-Logik (3×: handleSave, PDF-Publish, onPublish serializeFrontmatter)
2. **compose.ts**: Zentrale Funktion `createMarkdownWithFrontmatter` mit `formatValue`
3. **orchestrator.ts**: Eigene `serializeFrontmatter` (Integration-Tests)
4. **TransformService**: Eigene `createMarkdownWithFrontmatter` (andere Metadaten-Struktur)
5. **frontmatter-patch.ts**: Eigene `buildFrontmatter`

Wizard und Integration-Tests nutzen die gleiche Idee (literal block `|`), aber **nicht** die zentrale `compose.ts`-Funktion.

## Konsolidierung (erledigt)

Die verschiedenen Methoden wurden auf die zentrale `createMarkdownWithFrontmatter` aus `compose.ts` zusammengeführt:

1. **Wizard** (`creation-wizard.tsx`): Nutzt jetzt `createMarkdownWithFrontmatter` statt Inline-Logik (3 Stellen).
2. **frontmatter-patch.ts**: Nutzt jetzt `createMarkdownWithFrontmatter` statt eigener `buildFrontmatter` – behebt den Newline-Bug.
3. **orchestrator.ts** (Integration-Tests): Nutzt jetzt `createMarkdownWithFrontmatter` statt eigener `serializeFrontmatter`.

## Offen

- **parseSecretaryMarkdownStrict**: Unterstützt derzeit keine YAML literal blocks (`|`); mehrzeilige Werte werden falsch geparst (nur `|` als Wert). Das kann beim Lesen und erneuten Schreiben zu Informationsverlust führen.

## Sample-Datei (south-tyrol-cloud-...)

Die Datei enthält zwei Frontmatter-Blöcke:
- **Block 1 (Zeilen 1–49)**: Korrektes YAML mit `summary: |` und eingerückten Zeilen.
- **Block 2 (Zeilen 51–80)**: Ungültiges YAML – `summary` mit rohen Newlines, Folgezeilen ohne Einrückung.

Die Ursache des zweiten Blocks ist unklar (manuell, alter Code, anderer Flow). Die aktuelle Job-Worker- und Wizard-Logik sollte gültiges YAML erzeugen; `frontmatter-patch` kann bei mehrzeiligen Werten fehlerhaft sein.
