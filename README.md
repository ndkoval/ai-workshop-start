# Skill Atlas

Every project skill in a repository: `./skill-atlas scan` finds
`<root>/<name>/SKILL.md` in `.agents/skills`, `.claude/skills`, `.github/skills`,
and `agent/skills` at the repository root, and prints its name, description and link.
Copies with the same directory name are listed once, with `also in` paths.
Product resources, test data, nested projects and symbolic links are excluded.

```console
$ npm ci
$ ./skill-atlas scan https://github.com/JetBrains/kotlin
JetBrains/kotlin · 6 skills
…
build-tools-bump-gradle-api — Bumps the Gradle API version that Kotlin Gradle plugins are compiled against in the Kotlin compiler repository.
  https://github.com/JetBrains/kotlin/blob/5ab6270ab772d113e8ad52ebfcaa0109c522ae00/.claude/skills/build-tools-bump-gradle-api/SKILL.md
…
```

Set `GITHUB_TOKEN` for a higher GitHub rate limit. `npm test` runs the tests.
`npm run typecheck` checks TypeScript. Tests cover local scans and recorded GitHub
responses, with and without a token; they do not require network access.

- [spec/](spec/): what it does. [AGENTS.md](AGENTS.md): the definition of done.
- [fixture/](fixture/README.md): a small repository for the tests.
