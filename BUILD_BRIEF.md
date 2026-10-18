# MailBrief Chrome Extension — Build Brief

Build a production-quality Chrome Manifest V3 extension called MailBrief. It adds user-triggered attachment summaries to Gmail and Outlook Web.

## Product requirements
- Supported hosts: `mail.google.com`, `outlook.office.com`, `outlook.live.com`.
- Detect attachment rows/cards in the currently open message, but never scrape or send unrelated thread content.
- User clicks a visible “Summarise” action next to an attachment. No automatic processing by default.
- MVP file types: PDF, DOCX, TXT. Design extraction modules so XLSX and OCR can be added later. For scanned PDFs, show a clear OCR-required error rather than silently summarising empty text.
- Enforce configurable hard limits: 20 MB file size and 100,000 extracted characters. Deterministically chunk text for long documents.
- Send extracted text only to a configurable OpenAI-compatible endpoint. Settings: base URL, API key, model, timeout, custom prompt, max output tokens, and “include document title” toggle.
- Default prompt must return: executive summary, key points, action items with owner/deadline when present, decisions, risks/important clauses, and unanswered questions. Make the prompt editable.
- Show the result in a side panel or clean injected card with loading, partial extraction, success, and actionable error states. Include source filename and timestamp, but do not persist raw document text.
- Provide options page with a “Test connection” button, endpoint validation, clear save/reset controls, and a privacy notice stating the configured endpoint receives extracted document text.
- Store settings with chrome.storage.local. Never log API keys, auth headers, attachment contents, email identifiers, or full model responses.
- Use least privilege: MV3, service worker, content scripts limited to the three mail hosts, `storage`, and only permissions needed for downloading attachment bytes. Do not use `<all_urls>`, tabs, history, downloads, remote scripts, or eval.

## Architecture
Use TypeScript, Vite, React only where it materially helps UI, and a small testable core. Separate modules:
- `src/adapters/gmail.ts`
- `src/adapters/outlook.ts`
- `src/extraction/` for PDF/DOCX/TXT and limits/chunking
- `src/llm/` for OpenAI-compatible client, endpoint normalization, prompt/schema, error mapping
- `src/background/` service worker orchestration and messaging
- `src/content/` provider DOM integration and result UI
- `src/options/` settings page
- `src/shared/` types, constants, storage, redacted logger

Use a provider adapter interface so Gmail DOM changes cannot break Outlook. Prefer semantic selectors and graceful degradation. Handle duplicate clicks, navigation during processing, missing attachment URLs, 401/403/429/5xx, malformed responses, context-limit errors, timeouts, and cancellation.

## Security and privacy
- No secrets in source, fixtures, README examples, build output, screenshots, or git history.
- Validate HTTPS base URLs, with localhost allowed for development, and do not add arbitrary remote script execution. Keep network destinations documented.
- Display the configured destination endpoint before first request and make user consent explicit.
- Redact logs. Do not persist extracted content unless a future opt-in history feature is added.
- Include a privacy policy draft and Chrome Web Store data-use checklist.

## Tests and acceptance
- Unit tests for endpoint normalization, settings validation, chunk ordering, prompt construction, extraction limits, response parsing, redaction, and error mapping.
- Browser tests with Playwright or equivalent using mocked Gmail and Outlook fixture pages for attachment detection and summary rendering. Do not require real accounts or real LLM keys.
- Run lint, typecheck, unit tests, browser tests, production build, and package a clean ZIP. Inspect ZIP contents and search for secret markers.
- README must include setup, local Chrome installation, settings, supported files, privacy/data flow, test commands, build/package commands, known limitations, and Chrome Web Store publication checklist.
- Add CI workflow for checks if practical.

## Delivery order
1. Inspect repo and create an implementation plan in `docs/IMPLEMENTATION_PLAN.md`.
2. Scaffold project and tests.
3. Implement shared core, extraction, LLM client, settings.
4. Implement Gmail adapter and UI.
5. Implement Outlook adapter and UI.
6. Add tests, security checks, packaging, README, privacy policy.
7. Run every verification command and fix failures. Do not stop at a stub.

Work directly in this repository. Keep changes coherent and explain decisions in the README. Never ask for or hard-code provider credentials; tests must use mocks.
