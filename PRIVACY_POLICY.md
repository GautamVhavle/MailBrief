# MailBrief Privacy Policy (Draft)

Last updated: 2026-10-19

## Summary

MailBrief is a browser extension that summarises email attachments on demand. It does not collect, store, or transmit personal data to the extension developer. Extracted attachment text is sent only to an endpoint that the user configures.

## Data handled

- **Attachment bytes and extracted text**: processed locally in the browser to produce a summary. Extracted text is sent only to the user-configured OpenAI-compatible endpoint. Raw document text is not persisted by the extension.
- **Settings**: base URL, model, limits, prompt, and consent state are stored in `chrome.storage.local`. The API key is stored there as well and is never logged.
- **No email metadata**: MailBrief does not read thread content, sender/recipient lists, or email bodies beyond the attachment card needed to locate the download link.

## What is sent and where

- Destination: the user-configured base URL (must be HTTPS, or localhost/127.0.0.1 for development).
- Payload: extracted text from the selected attachment (chunked), plus the document title if enabled and the configured prompt.
- The configured endpoint receives extracted document text. The user must explicitly acknowledge this before the first request, and consent resets if the endpoint changes.

## Data retention

- The extension does not maintain a history of summaries or documents.
- Settings persist until the user clears them or uninstalls the extension.

## Permissions

- `storage`: store settings locally.
- Content scripts: limited to `mail.google.com`, `outlook.office.com`, `outlook.live.com`.
- No `tabs`, `history`, `downloads`, `<all_urls>`, remote scripts, or `eval`.

## Third parties

The configured endpoint operator (for example an OpenAI-compatible provider) receives extracted attachment text and is responsible for its handling. Review that provider's privacy policy.

## Contact

Replace with maintainer contact before publication.
