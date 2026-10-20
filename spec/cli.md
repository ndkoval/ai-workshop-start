# Command line
`./skill-atlas scan <GitHub URL | GitHub /tree/<commit> URL | directory>`
Prints the result **at once**; *nothing is stored*.
`GITHUB_TOKEN`, optional: a higher GitHub rate limit.
## Output
```
JetBrains/kotlin · 6 skills
build-tools-bump-gradle-api — Bumps the Gradle API…
  https://github.com/JetBrains/kotlin/blob/<commit>/…
```
- Sorted by **name**; the description's *first sentence*
- Agent-root copies with the same relative path print once, followed by
  `also in <paths>`; warnings go to *stderr*
