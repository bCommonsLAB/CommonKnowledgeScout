# File-Preview: Tab-Architektur

> Wo die Tabs der Datei-Vorschau leben — nach dem Welle-3-II-Refactor. Diese
> Notiz verhindert das haeufige Missverstaendnis, Tabs wuerden in
> `file-preview.tsx` gerendert.

## Regel

**Die View-Komponenten besitzen ihr eigenes Tab-Rendering.** Jede
`src/components/library/file-preview/views/*-view.tsx` rendert ihre eigenen
`<Tabs>/<TabsList>/<TabsTrigger>/<TabsContent>` (Shadcn). Die Eltern-Komponente
`src/components/library/file-preview.tsx` rendert **keine** Tabs selbst — sie
haelt nur den aktiven Tab-State (`infoTab`) und reicht ihn ueber die
`PreviewViewProps` an die jeweilige View durch.

```
file-preview.tsx (PreviewContent)
  ├─ useState<PreviewInfoTab>("original")   ← State lebt hier
  └─ <ImageView … infoTab setInfoTab />     ← View rendert die Tabs
        └─ <Tabs value={infoTab} …>
             <TabsList> … <TabsTrigger value="diva-info"> …
             <TabsContent value="diva-info"> …
```

## Einen neuen Tab hinzufuegen

1. **Union erweitern**: `PreviewInfoTab` in
   `src/components/library/file-preview/views/view-props.ts`.
2. **Inline-Union angleichen**: den `useState`-Typ in `file-preview.tsx`
   (`PreviewContent`) — er muss zu `PreviewInfoTab` kompatibel bleiben, sonst
   passt die `setInfoTab`-Signatur in `PreviewViewProps` nicht.
3. **Tab im passenden View einhaengen**: `TabsTrigger` + `TabsContent` in der
   zustaendigen `*-view.tsx` (z. B. Bilder → `image-view.tsx`,
   nicht in `file-preview.tsx`).
4. Optional: Sichtbarkeit konditional (Beispiel: der `diva-info`-Tab erscheint
   nur bei gesetztem Library-Flag **und** einem Treffer).

## Referenz

- DIVA-Info-Tab: `image-view.tsx` (Trigger + `TabsContent`), Daten via
  `use-diva-supplier-data.ts`, Inhalt in `views/diva-supplier-data-view.tsx`.
- Reset-Verhalten: `PreviewContent` setzt `infoTab` bei `item.id`-Wechsel zurueck
  auf `"original"` — verschwindende Tabs bleiben so nicht „haengen".
