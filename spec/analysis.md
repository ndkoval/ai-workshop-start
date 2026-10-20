# Repository analysis
## Input
A **GitHub repository** URL, optionally pinned as `/tree/<40-character commit>`,
or a local directory
## Output
Every project skill: **name**, **description**, **link**
## Architecture
Core: fetch → find → parse. CLI and web: *thin clients*.
Skill: id = `repo:path`, name, description, commit
## Project skill
A project skill is an exact, case-sensitive `SKILL.md`, except under a test
resources source set (`src/<...Test>/resources`).

The same root-relative path under `.agents/skills`, `.claude/skills`,
`.github/skills`, or `agent/skills` is one skill with copies. The first root in
that order is canonical: its path supplies the skill id, metadata and link;
the other paths are copies.
## Details
- **GitHub API**, no clone; *under 5 s* for intellij-community
- Exact, case-sensitive `SKILL.md` files can live anywhere, including product resources
- Test resources under `src/<...Test>/resources` are excluded
- A truncated tokenless GitHub tree scans the four agent roots and
  `plugins/mcp-tools/resources`, with a warning that discovery was scoped
- GitHub code search warns when its 1,000-result limit makes discovery incomplete
- The name: front matter, else the directory
- The link pins the *scanned commit*
- A commit-pinned input scans exactly that commit
- Malformed front matter → a *warning*, the scan goes on
- Unreachable repository → a clear message, exit code 1

## End-to-end proof
The real CLI scans fixed commits of `JetBrains/MPS`, `JetBrains/android`, and
`JetBrains/koog`. Their stdout is compared byte-for-byte with checked-in text
snapshots; scoped-tree warnings are checked on stderr.
