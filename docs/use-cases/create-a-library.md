# Create a library and connect storage

## What you achieve

A library is a folder in your own storage together with everything Common Knowledge Scout knows about it: the documents made from your files, the gallery, the website and the settings. After this guide you have a library that points at your files and is ready for processing.

!!! note "Language of the interface"
    Most of the interface is in German. This guide gives the label as it appears on screen, followed by an English translation.

## Before you start

- You are signed in.
- You know where the files are: on the server's file system, in OneDrive or in Nextcloud.
- For OneDrive you need the tenant ID, client ID and client secret of an app registration. For Nextcloud you need the WebDAV address, your user name and an app password.

## Step 1: Add a storage connection

Skip this step if the files are on the server's file system.

Access to OneDrive and Nextcloud belongs to your account, not to a single library. You sign in once and use the connection for as many libraries as you like. The credentials are stored encrypted.

1. Open **Settings → Speicher-Verbindungen** (storage connections).
2. Click **Neue Verbindung** (new connection).
3. Enter a **Bezeichnung** (name) and choose the **Typ**:
    - **Nextcloud (WebDAV)**: WebDAV address, user name, app password.
    - **OneDrive (Microsoft 365)**: tenant ID, client ID, client secret.
4. Click **Anlegen** (create).
5. For OneDrive, click **Anmelden** (sign in) on the new card and complete the Microsoft sign-in.
6. Click **Testen** (test) to confirm that the connection works.

A connection cannot be deleted while a library uses it.

## Step 2: Create the library

1. On the start page, click **Neue Bibliothek** (new library). The same entry is in the library switcher at the top of the page.
2. Go through the steps of the dialog. Three things are required; everything else is a recommendation you can change later.

| Step | What you decide | Required |
|---|---|---|
| **Grundlagen** (basics) | The name and what the library will contain, for example books and documents, or events and sessions. You can copy the configuration of an existing library of the same kind. | Name, content type |
| **Quelle** (source) | Where the files are: Nextcloud, OneDrive or a local directory on the server. For cloud storage you choose a connection and a folder on it; for local storage you enter an absolute path. | Yes |
| **Verarbeitung** (processing) | How files are transformed by default | No |
| **Finden** (finding) | How visitors explore the gallery | No |
| **Story** | How answers to questions are given | No |
| **Erfassen** (capture) | Forms for adding new content. Shown only for content types that have them. | No |
| **Zusammenfassung** (summary) | A review of your choices | – |

3. Click **Bibliothek anlegen** (create library).

The library appears in the library switcher. Open **Archive** in the top navigation to see its files.

## Step 3: Invite people

Only the owner of a library can do this.

1. Open **Settings → Personen** (people).
2. Click **Person einladen** (invite a person).
3. Enter the e-mail address, choose a role and, if you like, add a personal message.

| Role | What the person can do |
|---|---|
| **Leser** (reader) | Read the library |
| **Mitwirkender** (contributor) | Submit content, but not publish it |
| **Co-Creator** | Work in the archive, gallery, story mode and templates, without access to the settings |
| **Moderator** | Handle access requests and send invitations |

## Where the settings are

| Section | What it controls |
|---|---|
| **Library** | Name and basic settings |
| **Archive** | Storage source, content type and processing defaults |
| **Explore** | How visitors browse the gallery |
| **Story** | How answers sound and which rules they follow |
| **Fragen & Antworten** (questions and answers) | Stored answers |
| **Erweitert** (advanced) | Search and models, storage of twins, extraction, maintenance |
| **Personen** (people) | Members and roles |
| **Öffentlicher Auftritt** (public presence) | Publishing the library |
| **Zugriffsanfragen** (access requests) | Requests from people who want access |
| **Mein Zugang**, **Speicher-Verbindungen** | Your account: agent access and storage connections |

To change the storage of an existing library, open **Settings → Archive → Quelle** (source).

## Next

- [Transform files into documents](transform-files.md)
