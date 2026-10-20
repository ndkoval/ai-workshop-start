# Repository analysis

## Input
A **GitHub repository** URL, or a local directory

## Output
Every **project skill**: **name**, **description**, **link**

## Architecture
Core: fetch → find → parse. CLI: a *thin client*.
Skill: id = `repo:path`, name, description, commit

## Details
- **GitHub API**, no clone; *under 5 s* for intellij-community
- The name: front matter, else the directory
- The link pins the *scanned commit*
- Malformed front matter → a *warning*, the scan goes on
- Unreachable repository → a clear message, exit code 1

## Project skill
A skill the repository **keeps for its own agents**: `<root>/<name>/SKILL.md`, the root at the top of the repository.
- Roots: `.agents/skills`, `.claude/skills`, `.github/skills`, `agent/skills`
- Not a project skill: any other `SKILL.md`. It belongs to the product or to the tests, not to the agents working on the repository.
- One skill is one directory *name*, however many roots hold it

## Edge cases
| Case | Example | Result |
| --- | --- | --- |
| Duplicates, one copy per agent | `.agents/skills/x`, `.claude/skills/x` | one skill; the first root wins (`.agents` before `.claude`), the others are `also in` |
| An unusual folder | `agent/skills/x` | a skill |
| Part of the product, shipped in a plugin | `plugins/p/resources/skills/x` | not a skill |
| Test data, a fixture | `src/jvmTest/resources/skills/x` | not a skill |
| Anywhere else | `tests/x`, `docs/.claude/skills/x` | not a skill |
