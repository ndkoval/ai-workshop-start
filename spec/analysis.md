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
- Skills live under any **agent root**: `.agents/skills`, `.claude/skills`, `.github/skills`, or `agent/skills` — including the repository's own workflow directory (`agent/skills/`)
- Skills may also appear **outside** agent roots — e.g. shipped inside a plugin (`plugins/…/resources/skills/…/SKILL.md`). These are discovered and reported like any other skill.
- `SKILL.md` files inside **test resource directories** (`src/test/resources/`, `src/jvmTest/resources/`, `src/testFixtures/resources/`) are **excluded** — they are test fixtures, not real skills.
- Duplicates: same skill name in multiple agent roots → **one copy** (first by path), the rest listed as `also in`
- Unreachable repository → a clear message, exit code 1
