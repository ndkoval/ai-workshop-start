# Command line
`./skill-atlas scan <GitHub URL | directory>`
Prints the result **at once**; *nothing is stored*.
`GITHUB_TOKEN`, optional: a higher GitHub rate limit.
## Output
```
JetBrains/kotlin · 6 skills
build-tools-bump-gradle-api — Bumps the Gradle API…
  https://github.com/JetBrains/kotlin/blob/<commit>/…
```
- The header counts unique project skills after grouping copies; an empty result
  prints `<repository> · 0 skills` and exits with code 0
- Sorted by **name**, then canonical path, using case-sensitive, locale-independent
  lexicographic order; the description's *first sentence*
- `also in <paths>` lists the other `SKILL.md` paths from the [copy rules](analysis.md#copies-and-identity),
  comma-separated; omitted when there are no copies
- Missing descriptions print only the name, without a trailing separator
- Warnings go to *stderr* and do not change a successful scan's exit code
