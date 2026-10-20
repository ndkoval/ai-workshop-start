# Web view
`./skill-atlas serve [port]`: a page at `http://localhost:<port>`, 3000 by default.
Scans on request; *nothing is stored*. `GITHUB_TOKEN` as in the CLI.
## The page
- A field for a **GitHub repository** URL; `?repository=<URL>` scans at once
- The repository, then its skills, sorted by **name**: the description's *first sentence*
- A skill selected: its name, description, **link**, copies and its whole `SKILL.md`
- Warnings and errors: shown on the page, in the CLI's words
## API
`GET /api/scan?repository=<URL>` → JSON `{ repository, skills, warnings }`;
each skill with its `link` and its `SKILL.md` as `content`.
Not a GitHub URL, unreachable repository → status 400, `{ error }`.
