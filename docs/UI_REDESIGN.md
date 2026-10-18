# MailBrief UI Redesign Brief

Redesign the product UI, not just the README.

## User requirements

- The summary must open in a centered modal dialog anchored to the current page, not as a tall inline card under each attachment.
- The dialog must be compact, beautiful, readable, and responsive.
- Use the system color scheme with `prefers-color-scheme`. Support light and dark themes automatically. Do not force Gmail or Outlook colors.
- Use a calm premium visual style: neutral surfaces, subtle borders, restrained blue or violet accent, clear typography, generous spacing, no gradients, no childish decoration.
- The first viewport should show the short executive summary immediately. Keep the default summary concise, around 3 to 5 sentences, with a compact key-points list and action items. Put secondary sections behind compact tabs or collapsible sections.
- Show the selected filename, file type, and a small source badge in the dialog header.
- Before the first request, show a consent step in the same modal. Make the destination endpoint prominent and readable.
- While working, show a clear processing state with an animated horizontal left-to-right progress indicator, current stage text, and step labels: Fetching, Reading, Summarising, Finishing. The user should immediately understand that work is happening.
- Support real streaming when the endpoint supports OpenAI-compatible SSE streaming. Stream partial summary text into the dialog from left to right. If streaming is unavailable, show the same progress UI and render the final result when complete.
- Add a stop/cancel control during processing.
- Add copy summary and close controls after completion. Add retry on recoverable errors.
- Trap focus in the modal, support Escape to close when safe, and preserve accessible labels and keyboard navigation.
- Do not alter the host email page layout more than necessary. The attachment action should be a compact secondary button. Opening the modal should be the primary experience.

## Technical requirements

- Keep provider adapters separate.
- Refactor `AttachmentControl.tsx` and `src/content/style.css` into a modal-oriented UI.
- Add a portal-like fixed overlay appended to the document body, with a shadow root or strong `.mbx-` namespace to avoid Gmail and Outlook CSS collisions.
- Extend shared messages and the service worker for progress, partial streaming text, completion, cancellation, and errors.
- Implement a robust OpenAI-compatible streaming parser for `text/event-stream` in the LLM client. Parse `data:` lines, `[DONE]`, partial content deltas, and graceful fallback when the response is JSON.
- Keep the structured `Summary` output. During streaming, show a concise live preview, then replace it with parsed structured output on completion. If JSON cannot be parsed until the end, show the streamed text as a live preview without pretending it is final.
- Use no LangChain dependency unless it materially improves the browser-compatible streaming path. Prefer a small native SSE parser to avoid bundle bloat and extension complexity.
- Never stream or log API keys or raw email content. Keep explicit consent and endpoint display.
- Add or update unit tests for SSE parsing, cancellation, stage mapping, and summary-shortening behavior.
- Add or update browser tests for modal opening, light/dark theme tokens, consent, processing progress, streaming preview, completion, close, copy, and error states.
- Rebuild screenshots after the new UI is verified. Add a polished modal screenshot to `docs/screenshots/`.
- Update README to describe the modal experience and streaming behavior. Avoid em dash characters in README and new docs.

## Acceptance criteria

1. Clicking Summarise opens a modal dialog.
2. The modal is visually polished in both light and dark system themes.
3. The first view is a short summary, not a wall of text.
4. Processing visibly moves left to right and names the active stage.
5. Streaming preview appears when the mocked SSE endpoint emits deltas.
6. The user can cancel, close, copy, retry, and use keyboard controls.
7. Existing 77 unit tests and existing browser tests continue to pass, with new tests added for the redesign.
8. Lint, typecheck, build, browser tests, secret scan, and packaging pass.
