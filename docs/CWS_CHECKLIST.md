# Chrome Web Store — Data Use & Publication Checklist

## Manifest & permissions

- [ ] MV3 manifest, service worker, no remote code
- [ ] Permissions limited to `storage`
- [ ] Content scripts limited to `mail.google.com`, `outlook.office.com`, `outlook.live.com`
- [ ] No `<all_urls>`, `tabs`, `history`, `downloads`, remote scripts, or `eval`
- [ ] `web_accessible_resources` limited to hashed assets and scoped to supported hosts
- [ ] Icons 16/48/128 present

## Privacy

- [ ] Privacy policy URL provided in store listing
- [ ] Data use disclosures: attachment text sent to user-configured endpoint only
- [ ] No sale of personal data; no advertising use
- [ ] Consent flow shown before first request; resets on endpoint change
- [ ] Privacy notice on options page

## Build & packaging

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] `npm run test:browser` passes (xvfb)
- [ ] `npm run build` passes (production manifest, no test host)
- [ ] `npm run package` produces ZIP
- [ ] `node scripts/secret-scan.mjs dist` passes
- [ ] ZIP contents inspected; no secrets, maps, or test files
- [ ] Version bumped in `package.json` and `manifest.json`

## Store listing

- [ ] Description, screenshots (no secrets), category, language
- [ ] Support email / homepage
- [ ] Known limitations documented
