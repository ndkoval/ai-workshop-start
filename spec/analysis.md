# Repository analysis
## Input
A **GitHub repository** URL, or a local directory
## Output
Every **project skill**, once: **name**, **description**, **link**, and paths to its copies.
## Architecture
Core: fetch → find → parse. CLI: a *thin client*.
Skill: id = `repo:path`, name, description, commit, copies.
`path` is the canonical `SKILL.md` path relative to the repository root.

## What is a project skill?
A project skill is a workflow for working on the scanned project. A skill shipped
to the project's users as part of a product or plugin is outside this scan's scope.
Discovery uses the following path convention, not guesses based on file contents.

A regular file at exactly `<root>/<directory>/SKILL.md`, relative to the scanned
repository or local directory. `<directory>` is one non-empty path segment.
The supported roots, in canonical-copy priority order, are:

1. `.agents/skills`
2. `.claude/skills`
3. `.github/skills`
4. `agent/skills`

Paths and the filename are **case-sensitive**. There is exactly one directory
between a supported root and `SKILL.md`; deeper files are not separate skills.
Roots are recognized only at the top level of the scanned directory, not inside
subprojects, dependencies, examples or test data. Files elsewhere are ignored,
even if their front matter looks like a skill. Ignored files produce no warnings.
Symbolic links to files or directories are not followed; Git submodules are not scanned.
The same discovery rules apply to local and GitHub scans, with or without a token.

### Copies and identity
- The same `<directory>` in several supported roots represents **one skill**,
  regardless of its front-matter name or contents. This grouping is confined to
  one scanned repository.
- The first existing copy in the priority order above is canonical. Its path
  determines the skill's `id` and link; its front matter supplies the metadata.
- `copies` contains the other repository-relative `SKILL.md` paths, sorted
  lexicographically, without the canonical path or repeated paths.
- Metadata from copies is not merged. If copies disagree, the canonical copy
  wins. Malformed canonical front matter uses the normal fallback below, rather
  than taking metadata from another copy.
- Different directories remain distinct skills even if their front-matter names
  or file contents are identical. Directory names differing only in case also
  remain distinct.

### Discovery examples
Each row is an independent case, relative to the scanned root.

| Path or condition | Expected result |
| --- | --- |
| `.agents/skills/review/SKILL.md` | One project skill |
| `.claude/skills/review/SKILL.md` | One project skill |
| `.github/skills/review/SKILL.md` | One project skill |
| `agent/skills/review/SKILL.md` | One project skill |
| `SKILL.md`, `skills/review/SKILL.md`, `.cursor/skills/review/SKILL.md` | Ignored: outside supported roots |
| `.agents/skills/SKILL.md` | Ignored: missing skill directory |
| `.agents/skills/group/review/SKILL.md` | Ignored: nested too deeply |
| `.agents/skills/review/references/SKILL.md` | Ignored: supporting file inside a skill |
| `tests/resources/.agents/skills/review/SKILL.md` | Ignored: test data, not a top-level root |
| `packages/app/.claude/skills/review/SKILL.md` | Ignored: nested project |
| `node_modules/pkg/.agents/skills/review/SKILL.md` | Ignored: dependency |
| `.agents/skills/review/skill.md`, `.Agents/skills/review/SKILL.md` | Ignored: case does not match |
| A symlink named `.agents/skills/review/SKILL.md`, or a symlinked skill directory | Ignored |
| No matching files | Successful scan with zero skills |

### Copy examples
Paths below omit the trailing `/SKILL.md`.

| Files in one repository | Expected result |
| --- | --- |
| `.agents/skills/x` and `.claude/skills/x` | One skill; `.agents` is canonical, `.claude` is in `copies` |
| `.github/skills/x` and `agent/skills/x` | One skill; `.github` is canonical |
| `x` in all four supported roots | One skill with three copies in lexicographic path order |
| `.agents/skills/x` named `alpha`, `.claude/skills/x` named `beta` | One skill displayed as `alpha` |
| `.agents/skills/x` with malformed front matter, valid `.claude/skills/x` | One skill named `x`, empty description, canonical-file warning |
| `.agents/skills/x` and `.claude/skills/y`, both named `review` | Two skills, both displayed as `review` |
| `.agents/skills/x` and `.agents/skills/X` | Two distinct skills |
| `.agents/skills/x` and `tests/.claude/skills/x` | One skill with no copies; test data is ignored |

### Examples from the workshop
The [edge-cases slide](https://nikitakoval.org/ai-workshop/#slides/edge-cases)
provides these concrete acceptance cases. Links pin the examples to the commits
used in the workshop; tests should use local fixtures or recorded GitHub responses.

| Repository and files | Expected result |
| --- | --- |
| MPS: identical `mps-tests` files in [`.agents/skills`](https://github.com/JetBrains/MPS/blob/632f14db9187594fa3510c70ac38925df63eddd3/.agents/skills/mps-tests/SKILL.md) and [`.claude/skills`](https://github.com/JetBrains/MPS/blob/632f14db9187594fa3510c70ac38925df63eddd3/.claude/skills/mps-tests/SKILL.md) | One project skill; `.agents` is canonical and `.claude` is listed as a copy |
| Android: [`agent/skills/writing-lint-checks/SKILL.md`](https://github.com/JetBrains/android/blob/0867bfe2b625b278820b2f0484e8750bec8b6e80/agent/skills/writing-lint-checks/SKILL.md) | Included: `agent/skills` is a supported project root |
| MPS: [`plugins/mcp-tools/resources/jetbrains/mps/agents/mcp/skills/mps-aspect-generator/SKILL.md`](https://github.com/JetBrains/MPS/blob/632f14db9187594fa3510c70ac38925df63eddd3/plugins/mcp-tools/resources/jetbrains/mps/agents/mcp/skills/mps-aspect-generator/SKILL.md) | Excluded: a skill shipped inside the product, outside the supported project roots |
| Koog: [`integration-tests/src/jvmTest/resources/skills/weather-retrieval/SKILL.md`](https://github.com/JetBrains/koog/blob/16d83270f8a7f25358ae0165466f14e70416c428/integration-tests/src/jvmTest/resources/skills/weather-retrieval/SKILL.md) | Excluded: test data, outside the supported project roots |

## Details
- **GitHub API**, no clone; *under 5 s* for intellij-community
- GitHub discovery reads only supported roots through non-recursive Git Trees
  requests at the resolved commit. A token changes authentication, not discovery.
- An incomplete GitHub directory listing fails with a clear message and exit code 1;
  it must not be presented as a complete scan. Suggest scanning a local checkout.
- The name: canonical front matter, else the skill directory (never the agent root)
- The link pins the *scanned commit*
- Local links point to the canonical file via `file://`; no commit is claimed
- Missing or malformed canonical front matter → directory name, empty description,
  a *warning* identifying the file; the scan goes on
- A listed canonical file missing at read time is skipped with a warning
- Unreachable repository → a clear message, exit code 1
