# AGENTS.md
## Specs
Read [./spec](spec/) first. Update it with the code.
## Tests
Integration tests for every case in the spec.
## Definition of done
- All tests pass locally

## Commands
- `npm ci`: first, in a fresh checkout
- `npm test`: the tests
- `npm run test:browser`: the web page in headless Chromium; `npx playwright install chromium-headless-shell` once
