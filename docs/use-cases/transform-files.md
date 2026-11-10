# Transform files into documents

## What you achieve

A recording, a PDF or an image in your storage becomes a structured document with a title, a summary and metadata, and that document becomes searchable. The original file is not changed.

!!! note "Language of the interface"
    Most of the interface is in German. This guide gives the label as it appears on screen, followed by an English translation.

## The three steps of processing

| Step | Label in the interface | What it produces |
|---|---|---|
| 1. Extract | **Transkript erstellen** (create transcript) | The plain text of the source: a transcript for audio and video, recognised text for PDFs, images and office files |
| 2. Transform | **Artefakte generieren** (generate artefacts) | A document shaped by a template: front matter with metadata, a structured body and, if you want, a cover image |
| 3. Publish | **Story publizieren** (publish story) | The document is split into passages and indexed, so that it appears in the gallery and can be used to answer questions |

Each step can be switched on or off, and each can be repeated on its own. The result of steps 1 and 2 is called the *shadow twin* of the source. It is stored in the database; a library can be set to write a copy as Markdown files into your storage as well.

Supported sources: PDF, audio (mp3, m4a, wav, ogg, opus, flac), video (mp4, mov, avi, webm, mkv, mpeg), images, Word, Excel and PowerPoint files, and Markdown. Markdown files skip step 1.

## Before you start

- A library with connected storage (see [Create a library](create-a-library.md)).
- The Secretary Service is running. It does the transcription and text recognition.

## Process one file

1. Open **Archive** and select the file.
2. In the preview, open the sheet **Aufbereiten & Publizieren** (prepare and publish).
3. Switch on the steps you want. A badge shows whether a result exists already and whether it will be overwritten.
4. Set the options:
    - **Transcript**: source and target language for audio and video. For audio you can add context such as the topic and special terms.
    - **Artefacts**: the **Vorlage** (template), the language, the model, whether to generate a cover image, and optional notes for corrections.
5. Click **Jetzt starten** (start now).

A progress bar in the preview shows the run. When it is finished, the tabs **Original**, **Transkript**, **Transformation**, **Story** and **Uebersicht** (overview) show the source and each result. To redo a step, use **Neu generieren** (regenerate) or **Erneut publizieren** (publish again) in the corresponding tab.

## Process a whole folder

1. In **Archive**, open the folder.
2. Click **Verzeichnis verarbeiten** (process directory) in the header. To process only some files, tick them in the list first.
3. Choose the steps. **Erzwingen** (force) repeats a step for files that have a result already.
4. Optionally give the run a name and limit it with a file name pattern; `*` is the wildcard.
5. Click **Jobs starten** (start jobs).

The folder and all its subfolders are scanned. Template, language and extraction method come from the library's defaults. Folders whose name starts with `_`, and folders named `test` or `tests`, are skipped; the dialog shows how many.

## Follow progress and errors

Open the job monitor from the header of the application. It lists the running and finished jobs, can be filtered by run, shows the error of a failed job under **Details anzeigen** (show details), and restarts failed jobs.

## Templates

A template decides what the document looks like. It consists of the metadata fields to fill, instructions for the language model and the layout of the body. Templates are managed under **Templates** in the top navigation, where you can also test one against a file.

The folder [`template-samples/`](https://github.com/bCommonsLAB/CommonKnowledgeScout/tree/master/template-samples) in the repository contains examples that can be imported.

## Web pages and video playlists

Importing a web article together with its embedded audio or video, or a whole video playlist, is available through the agent tools, not through the interface. See [Operate a library with an AI agent](operate-with-an-agent.md).

## Next

- [Publish a gallery and a website](publish.md)
- [Architecture overview](../architecture/overview.md#from-file-to-answer)
