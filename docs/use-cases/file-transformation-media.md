# Media Transformation (Audio/Video)

## What is achieved?

Transcribe audio and video files to text. Extract transcripts with speaker identification and save them as searchable Markdown files.

## Prerequisites

- Active library selected
- Audio or video file available in Library Browser

## Steps

1. Open the **Library** view
2. Navigate to the folder containing the audio/video file
3. Select the media file (single file or multiple for batch processing)
4. Click the **Transcription icon** or use the context menu
5. In the transcription dialog:
   - Select the **target language** for transcription
   - Optional: Choose a **template** for structured output
6. Click **"Start Transcription"**
7. Monitor progress in the dialog
8. After completion: The transcript Markdown file appears next to the original

## Result

A new Markdown file named `[OriginalName].md` is created. It contains the transcribed text, speaker identification (if available), and metadata in frontmatter.

## Tips

- Transcription runs in the background - you can continue working
- For video files, transcripts can be extracted from VTT files if available
- Errors are displayed in an error message
- Batch processing is supported for multiple files

## Further Information

- [Transform Service Documentation](../reference/file-index.md#transform--processing)
- [Batch Operations](batch-operations.md) for multiple files

