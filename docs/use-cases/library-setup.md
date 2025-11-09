# Library Setup

## What is achieved?

Create a new library to organize your knowledge. Libraries serve as containers for documents, media files, and transformed content.

## Prerequisites

- Authenticated user
- Access to storage provider (Local Filesystem or OneDrive)

## Steps

1. Go to **Settings → Library**
2. Click **"Create New Library"** (if no library exists yet)
3. Fill out the form:
   - **Name**: Enter a meaningful name (at least 3 characters)
   - **Storage Type**: Choose between "Local" (local filesystem) or "OneDrive"
   - **Storage Path**: Enter the path where files should be stored
   - **Description** (optional): Short description of the library
4. Configure the transcription strategy:
   - **Shadow Twin**: Transformed files are saved as separate Markdown files
   - **Database**: Transcripts are stored in the database
5. Click **"Save"**

## Result

A new library is created and can be used for files. The library appears in the Library Switcher and can be selected as the active library.

## Further Information

- [Library Module Documentation](../reference/modules/library.md)
- [Storage Provider Concepts](../reference/modules/storage.md)
