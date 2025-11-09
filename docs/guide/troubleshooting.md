---
title: Troubleshooting
---

# Troubleshooting

## Sign-In Failed
- Sign in again and check browser blockers.
- Check server logs (Auth routes).

## Library Not Configured
- Message "Please configure the library...": Check `/settings` → Library and Storage.
- Check provider authentication status in header/storage context.

## Upload Fails
- Check file size/format.
- Check storage provider permissions.

## Preview Shows Nothing
- Is file type supported? For binary formats, use download if needed.

## Transformation/Transcription Doesn't Start
- Check Event Monitor (Batch/Job status, errors).
- Check `Secretary Service` configuration and API availability.

