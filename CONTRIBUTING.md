# Contributing to MailBrief

Thank you for helping improve MailBrief. Contributions should preserve the extension's privacy-first behavior and least-privilege permissions.

## Development setup

Requirements: Node.js 22+, npm, Chrome or Chromium, and Xvfb for browser tests on headless Linux.

```bash
git clone https://github.com/GautamVhavle/MailBrief.git
cd MailBrief
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

Run browser tests on Linux with:

```bash
xvfb-run -a npm run test:browser
```

## Pull requests

1. Create a focused branch from `main`.
2. Keep provider-specific DOM changes inside `src/adapters/`.
3. Never commit API keys, OAuth secrets, copied email content, or generated `dist/`, ZIP, `test-results/`, or `node_modules/` files.
4. Add or update unit tests for extraction, settings, endpoints, prompts, and error handling.
5. Add browser fixture coverage for Gmail/Outlook UI changes.
6. Run lint, typecheck, unit tests, browser tests, build, and the secret scan.
7. Explain privacy, permission, or data-flow implications in the pull request.

## Commit and review guidelines

Use clear, focused commits such as `fix: handle Outlook attachment selector`. Reviewers should check functionality, least privilege, secret handling, endpoint validation, and whether extracted document text is retained or logged.

## Architecture rules

- Summarisation is user-triggered by default.
- Only the selected attachment's extracted text may be sent to the configured endpoint.
- Gmail and Outlook adapters must remain separate.
- New permissions and network destinations require documentation and review.
- Do not add remote scripts, `eval`, `<all_urls>`, or broad browser permissions without a documented security justification.
