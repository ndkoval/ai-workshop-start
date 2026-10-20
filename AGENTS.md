# AGENTS.md
## Specs
Read [./spec](spec/) first. Update it with the code.
## Tests
Integration tests for every case in the spec.
## Definition of done
- All tests pass locally
- Type checking and the CLI smoke tests pass locally
- The CI build must be green for the final commit before a PR is ready for review
- Open a PR when done, unless the user requests local-only work

## Commands
- `npm ci`: first, in a fresh checkout
- `npm test`: the tests
- `npm run typecheck`: TypeScript validation
- `./skill-atlas help` and `./skill-atlas scan ./fixture`: CLI smoke tests
