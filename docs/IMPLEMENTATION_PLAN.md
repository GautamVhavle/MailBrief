# MailBrief — Implementation Plan

## Goal
Chrome MV3 extension that adds user-triggered, on-demand attachment summaries to Gmail and Outlook Web,
sending only extracted attachment text to a user-configured OpenAI-compatible endpoint.

## Architecture decisions

- **Stack**: TypeScript + Vite, React for the injected result card and options page (the only places
  where component state materially helps), pdfjs-dist v3 for PDF text extraction, mammoth for DOCX.
  pdfjs pinned to v3 because v4's ESM uses top-level await which is invalid in classic content-script
  contexts.
- **Single content script** (`src/content/content.ts`) matches all three mail hosts and dispatches to
  per-host adapters. One entry keeps the UI shared; adapters are isolated modules behind
  `HostAdapter` so Gmail DOM changes cannot break Outlook and vice versa.
- **Data flow**:
  1. Content script observes DOM, injects "Summarise" buttons next to detected attachment cards.
  2. Click → content script fetches attachment bytes **same-origin from the page** (no extra host
     permissions; no `tabs`, `downloads`, `<all_urls>`).
  3. Extraction (TXT/PDF/DOCX) runs in the content script; hard limits (default 20 MB / 100k chars,
     configurable) enforced before and after extraction.
  4. Deterministic chunking (paragraph-boundary greedy split, ordered reassembly). Background does
     map-reduce: per-chunk summary → single combine call.
  5. Background validates consent, loads settings from `chrome.storage.local`, calls the configured
     endpoint, parses/normalises the JSON response, returns to content. Raw text never persisted.
- **Consent**: explicit, per-endpoint. First click shows an inline consent card naming the exact
  destination endpoint; consent resets if the endpoint changes. Options page repeats the notice.
- **Messaging**: `chrome.runtime` ports (long-lived) so the service worker stays alive during
  processing; port disconnect (navigation) cancels in-flight work via AbortController.
- **Redaction**: all logging goes through `src/shared/logger.ts`; long strings, headers and keys are
  truncated/redacted. No raw document text in logs or storage.
- **Errors**: mapped taxonomy (`auth`, `forbidden`, `rate-limit`, `server`, `timeout`,
  `context-limit`, `malformed`, `extraction`, `ocr-required`, `missing-url`, `cancelled`,
  `consent-required`, `network`) surfaced as actionable card states.

## Privacy / permissions
- MV3, `permissions: ["storage"]`, content-script matches limited to the three mail hosts, options page.
- No remote scripts, no eval, no `tabs`/`history`/`downloads`, no `<all_urls>`.
- HTTPS-enforced base URL with localhost exception for development.
- Privacy policy draft in `PRIVACY_POLICY.md`; Chrome Web Store checklist in `docs/CWS_CHECKLIST.md`.

## Delivery order mapping
1. ✅ This plan.
2. Scaffold: package.json, tsconfig, vite, eslint, vitest, playwright configs.
3. Shared core: `src/shared/{types,constants,storage,logger,endpoints,settings}.ts`;
   extraction: `src/extraction/{limits,chunking,text,pdf,docx,index}.ts`;
   LLM: `src/llm/{prompt,client,parse,errors}.ts`.
4. `src/adapters/gmail.ts` + content UI (`src/content/`).
5. `src/adapters/outlook.ts` + content UI shared card.
6. Unit tests (vitest), browser tests (Playwright + mocked Gmail/Outlook fixture pages + mocked LLM),
   lint, typecheck, build, ZIP package + secret scan, README, privacy policy, CWS checklist, CI workflow.
7. Run every verification command and fix failures.

## Testing strategy
- Unit: endpoint normalization/validation, settings validation, chunk ordering, prompt construction,
  extraction limits (TXT/PDF/DOCX with real small fixtures), response parsing, redaction, error mapping.
- Browser: Playwright loads the **built** extension into Chromium via a test manifest variant that adds
  a `http://localhost:*` match. Fixture pages mimic Gmail/Outlook attachment DOM; attachment binaries are
  served locally; the LLM endpoint is intercepted and mocked. No real accounts or keys.
