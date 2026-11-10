# Operate a library with an AI agent

## What you achieve

An AI agent such as Claude works on your library for you: it checks what has been processed, starts transformations, publishes pages, changes settings and measures the quality of answers. It does this through an MCP server that is part of Common Knowledge Scout.

Every tool calls the same function as the user interface. There is no second set of rules for agents.

## Before you start

- You are signed in and own at least one library.
- The operator of your instance has enabled the MCP server (see [Configuration](../operations/configuration.md#mcp-server)). If it is not enabled, the server answers with HTTP 503.
- You use Claude Desktop. This is the client the application ships an extension for.

## Connect Claude Desktop

The settings page for this is in German.

1. Open **Settings → Mein Zugang** and find the card **Claude-Zugang (MCP)**.
2. Click **Erweiterung herunterladen (.mcpb)**. The downloaded file contains the address of your instance and a personal key.
3. In Claude Desktop, open **Settings → Extensions**, choose to install an extension and select the file.
4. Ask Claude to list your libraries. If it answers with their names, the connection works.

Things to know about the key:

- **It is never displayed.** It exists only inside the downloaded file.
- **Each download creates a new key.** An extension installed from an older download stops working.
- **It acts as you.** The key has the full rights of your account in all your libraries and cannot be limited to reading. Give it only to an agent you would trust with write access.
- **You can withdraw it** with **Schlüssel widerrufen** on the same card.

## What the agent can do

The server offers 80 tools (tool set 2.70.0). Tool names are German.

| Area | Examples | What they do |
|---|---|---|
| Libraries and storage | `bibliotheken_auflisten`, `bibliothek_anlegen`, `speicher_verbindung_testen` | List and create libraries, test and assign storage connections |
| Files | `ordner_listen`, `datei_lesen`, `datei_patchen`, `verschieben` | Read, write, move and delete files and folders in the library's storage |
| Coverage and twins | `abdeckung_scannen`, `twins_pruefen`, `twins_synchronisieren` | Find sources that are not processed yet, check and repair shadow twins |
| Transformation and jobs | `quelle_erschliessen`, `transformation_starten`, `batch_bilanz`, `batch_neustart` | Transcribe or extract a source, apply a template, summarise a batch run, restart failed jobs |
| Web capture | `webseite_erschliessen`, `playlist_erschliessen` | Import a web page or a video playlist as sources |
| Documents and index | `dokumente_auflisten`, `bestand_pruefen`, `index_aktualisieren` | List gallery entries, audit the index, rebuild it from existing transformations |
| Publishing | `dokument_publizieren`, `seite_pruefen`, `veroeffentlichung_setzen` | Publish and withdraw documents, check the website, change publishing settings |
| Configuration | `konfiguration_lesen`, `konfiguration_setzen` | Read and change the library's chat and gallery configuration, with the same validation as the settings form |
| Questions | `frage_stellen`, `golden_set_fahren`, `fragen_log`, `antworten_verwerfen` | Ask story mode a question, run a fixed set of test questions, review and discard stored answers |
| Log | `protokoll_lesen`, `bruecke_info` | Read why actions ran; report the tool set version and what changed |

## Rules the tools follow

- **Writing needs a reason.** Every tool that changes something requires a short reason and records it in an action log, which `protokoll_lesen` reads back.
- **Batches are limited.** A batch takes up to 30 sources, a folder batch up to 200. An error is reported for the affected row; the rest of the batch continues.
- **Long work runs as a job.** A tool call has to finish within about 60 seconds. Anything longer is started as a job, and the agent asks for its status.
- **Working folders are skipped.** Batches never enter folders whose name starts with `_`, or `test/`.
- **Nothing is assumed silently.** When a check cannot run or a value is invalid, the tool says so and does not fall back to a default.

## Ready-made procedures

The repository contains instructions ("skills") that guide an agent through a complete task:

| Skill | Task |
|---|---|
| `veranstaltung-aufbereiten` | Take the recordings and slides of an event to published pages, with a stop for a person to review the transcripts |
| `webseite-erschliessen` | Turn a web article or a video playlist into gallery documents |
| `website-publishing` | Create, check and publish the pages of a library's website |
| `archiv-aufraeumen` | Bring a folder in order: check coverage, process what is missing, name files consistently |

They are in [`.claude/skills/`](https://github.com/bCommonsLAB/CommonKnowledgeScout/tree/master/.claude/skills) and are written in German.

## If something does not work

- **Claude sees fewer or different tools than expected.** Claude Desktop keeps a copy of the tool list. Switch the extension off and on under **Settings → Extensions**; `bruecke_info` shows which tools the server expects.
- **Access is refused (401).** The key was replaced by a newer download or withdrawn. Download the extension again and reinstall it.
- **Service unavailable (503).** The MCP server is not configured on this instance.

## Further information

- [Operating a library over MCP](https://github.com/bCommonsLAB/CommonKnowledgeScout/blob/master/docs/concepts/mcp-library-betrieb.md) – the concept, with every tool and the function it calls (German)
