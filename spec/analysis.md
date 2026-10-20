# Repository analysis
## Input
A **GitHub repository** URL, or a local directory
## Output
Every `SKILL.md`: **name**, **description**, **link**
## Architecture
Core: fetch → find → parse. CLI: a *thin client*.
Skill: id = `repo:path`, name, description, commit
## Details
- **GitHub API**, no clone; *under 5 s* for intellij-community
- The name: front matter, else the directory
- The link pins the *scanned commit*
- Malformed front matter → a *warning*, the scan goes on
- Unreachable repository → a clear message, exit code 1
## What is a project skill?
`…/skills/<name>/SKILL.md`, anywhere in the repository,
except under test code
- Test code: a folder before `skills` with the word `test(s)`
  or `fixture(s)` in its name: `tests`, `integration-tests`, `jvmTest`
- `agent/skills`: a repository's own folder, not an agent's;
  e.g. JetBrains/android `agent/skills/writing-lint-checks`
- Shipped inside a plugin → a skill; e.g. JetBrains/MPS
  `plugins/mcp-tools/resources/…/skills/mps-aspect-generator`
- Test data → not a skill; e.g. JetBrains/koog
  `integration-tests/src/jvmTest/resources/skills/weather-retrieval`
- The same `<name>` in two of `.agents/skills`, `.claude/skills`,
  `.github/skills`, `agent/skills` → one skill; elsewhere → two
- Anything else → not a skill
