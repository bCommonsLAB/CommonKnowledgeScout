# Shadow‑Twin (User Guide)

## What is a Shadow‑Twin?

A **Shadow‑Twin** is the “working text representation” of an original file (PDF, audio, video, image, …).  
It is created when you run **Extract/Transcribe** and/or a **Template transformation**.

## Why does it exist?

- **Searchability**: turn non-text sources into searchable Markdown.
- **Consistency**: store structure/metadata in a stable form.
- **Downstream processing**: make ingestion/RAG use the correct Markdown reliably.

## Key principles (current system)

- **Transcript vs. Transformation is semantic**
  - **Transcript**: the authentic extracted text (typically *without* frontmatter).
  - **Transformation**: a prepared/structured version (typically *with* frontmatter), driven by a template.
- **No big storage reshuffle**
  - Shadow‑Twins live next to the source file or inside a hidden dot-folder.
- **Re‑runs update instead of duplicating**
  - Same source + same parameters → the existing result is updated.
- **UI stays simple**
  - The UI does not guess filenames; it asks the backend resolver (bulk) for the best match.

## What will I see in the Library?

You still work primarily with the original file (e.g. a PDF). Additionally, you may see:
- **Transcript Markdown**: result of Extract/Transcribe
- **Transformed Markdown**: result of Template transformation
- Optionally a hidden **Shadow‑Twin folder** (starts with `.`) when many assets exist (e.g. extracted images)

The UI should automatically pick the right companion Markdown when previewing metadata/content.

## FAQ

### Why are there multiple Markdown files?
Because **transcript** and **transformation** serve different purposes:
- transcript = raw text
- transformation = structured text + metadata

### Where are Shadow‑Twin files stored?
Either:
- next to the original file, or
- in a hidden dot-folder (starts with `.`) when additional assets belong together (images, media).

### Why is the file list faster now?
The UI resolves Shadow‑Twin information via **bulk backend calls**, instead of doing many per-item requests.

### What to do if the UI shows the wrong file?
Please capture:
- Library (name/id)
- Source file name
- Expected outcome (transcript vs transformation, language, template)
- Screenshot + browser console logs (if possible)

This is usually enough to validate resolver behavior and metadata consistency.
