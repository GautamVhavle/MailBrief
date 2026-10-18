# Security Policy

## Supported versions

Security fixes are applied to the latest `main` branch and the latest published release. Please include the affected version or commit when reporting an issue.

## Reporting a vulnerability

Please do **not** open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for this repository, or contact the maintainer privately through the email listed on the repository owner's GitHub profile.

Include:

- A clear description and impact
- Reproduction steps or a minimal proof of concept
- Affected browser, mail client, extension version, and endpoint configuration
- Whether email content, attachment text, API keys, or other sensitive data may be exposed

Do not include real emails, confidential attachments, API keys, OAuth secrets, or personal access tokens in a report. Redact logs and replace sensitive content with synthetic fixtures.

## Security design commitments

- API keys are stored in Chrome local storage and are never committed to source or included in release artifacts.
- Attachment text is sent only after explicit user consent and only to the configured endpoint.
- Raw extracted text is not retained by the extension.
- Logs redact authorization headers, document content, and identifiers.
- Host permissions are limited to Gmail and Outlook Web.
- The extension does not use remote scripts, `eval`, `<all_urls>`, history, or downloads permissions.
- PDF/DOCX/TXT processing is bounded by file-size and extracted-character limits.

## Response process

Reports are acknowledged as soon as practical, investigated privately, and addressed with a patch, documentation update, or mitigation. Coordinated disclosure timing will be agreed with the reporter where appropriate.
