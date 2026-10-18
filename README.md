# MailBrief

MailBrief is a Chrome Manifest V3 extension that adds user-triggered document summaries to Gmail and Outlook Web.

## Features

- Gmail and Outlook Web attachment detection
- PDF, DOCX, and TXT extraction
- OpenAI-compatible API endpoints
- Configurable base URL, model, timeout, prompt, and output limit
- Explicit consent before extracted attachment text is sent to an endpoint
- Summary sections for executive summary, key points, action items, decisions, risks, and unanswered questions
- Local-only settings storage with redacted logging

## Local setup

```bash
npm install
npm run build
```

Load the `dist/` directory in Chrome at `chrome://extensions` with Developer mode enabled and **Load unpacked**. Open the extension's Options page and configure the endpoint, model, and API key. The API key is stored in Chrome local storage and is never included in source or build artifacts.

Supported hosts:

- `https://mail.google.com/*`
- `https://outlook.office.com/*`
- `https://outlook.live.com/*`

## Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run package
node scripts/secret-scan.mjs dist
```

Browser tests use local fixtures and require a display server in headless Linux environments:

```bash
xvfb-run -a npm run test:browser
```

## Privacy and data flow

Summarisation is user-triggered by default. The extension downloads only the selected attachment, extracts its text, and sends that extracted text to the endpoint configured in Options after explicit consent. Raw attachment text is not retained by the extension. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

## Release

The packaged artifact is created with:

```bash
npm run package
```

This writes `mailbrief-0.1.0.zip`. Review `docs/CWS_CHECKLIST.md` before submitting to the Chrome Web Store. Do not publish until the manifest permissions, data-use disclosure, screenshots, privacy policy, and support contact have been reviewed.

## Known limitations

- Scanned PDFs require OCR and are reported as `OCR required`; OCR is not bundled in the MVP.
- Gmail and Outlook DOM changes may require adapter updates.
- The configured endpoint must accept OpenAI-compatible `/chat/completions` requests.
