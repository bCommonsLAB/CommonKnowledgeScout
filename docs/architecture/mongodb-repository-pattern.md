# MongoDB-Repository-Pattern

> Konvention fuer alle MongoDB-Repositories unter `src/lib/repositories/`.
> Wer ein neues Repo anlegt, folgt diesem Muster — dann muss kein bestehendes
> Repo komplett gelesen werden.

## Kernprinzipien

1. **Eine Collection pro Library.** Collection-Name = `<domain>__<libraryId>`,
   erzeugt durch eine exportierte `get<Domain>CollectionName(libraryId)`-Funktion.
   Beispiele: `shadow_twins__<libraryId>`, `archive_item_properties__<libraryId>`,
   `vectors__<libraryId>`.
2. **Zugriff nur ueber `getCollection<T>()`** aus `src/lib/mongodb-service.ts`:
   ```ts
   export async function getCollection<T extends Document = Document>(
     collectionName: string,
   ): Promise<Collection<T>>
   ```
   Kein direkter `MongoClient`-Zugriff im Repo.
3. **In-Memory-Caches** (Modul-Scope, nicht pro Request):
   - `collectionCache: Map<string, Collection<T>>` — vermeidet wiederholtes
     `getCollection`.
   - `indexCache: Set<string>` — stellt sicher, dass `createIndex` pro
     Collection nur einmal pro Prozess laeuft.
4. **`ensure<Domain>Indexes(libraryId)`** legt Indizes lazy an (idempotent ueber
   `indexCache`) und wird vor dem ersten schreibenden Zugriff aufgerufen.
5. **Dokument-Interface** mit `_id?: string`, `libraryId: string`, fachlichem
   Key, `createdAt`/`updatedAt` als ISO-Strings.
6. **Kein stiller Fallback** (siehe `.cursor/rules/no-silent-fallbacks.mdc`):
   Domain-Verletzungen werfen, statt leise „nichts zu tun".

## Kanonisches Minimal-Beispiel

`src/lib/repositories/archive-item-properties-repo.ts` ist das **kuerzeste**
vollstaendige Beispiel (Naming + beide Caches + `ensureIndexes` + Upsert/Read):

```ts
const collectionCache = new Map<string, Collection<Doc>>()
const indexCache = new Set<string>()

export function getArchiveItemPropertiesCollectionName(libraryId: string): string {
  return `archive_item_properties__${libraryId}`
}

async function getCol(libraryId: string): Promise<Collection<Doc>> {
  const name = getArchiveItemPropertiesCollectionName(libraryId)
  const cached = collectionCache.get(name)
  if (cached) return cached
  const col = await getCollection<Doc>(name)
  collectionCache.set(name, col)
  return col
}

async function ensureIndexes(libraryId: string): Promise<void> {
  const name = getArchiveItemPropertiesCollectionName(libraryId)
  if (indexCache.has(name)) return
  const col = await getCol(libraryId)
  await col.createIndex({ libraryId: 1, itemKey: 1 }, { unique: true })
  indexCache.add(name)
}
```

## Voller Funktionsumfang

`src/lib/repositories/shadow-twin-repo.ts` zeigt zusaetzlich: verschachtelte
Dokument-Pfade (`buildArtifactPath`), `$set`/`$setOnInsert`-Upserts, Aggregationen
mit `$unwind`/`$match`, `$pull`+`$push` fuer Array-Felder und `$unset`-Deletes.

## Stabile Keys

Fachliche Keys, an denen Properties haengen, muessen **stabil** sein (z. B.
Liefersystem-`VCodex`), **nicht** der filePath — sonst gehen Daten bei
Umbenennen/Verschieben verloren.
