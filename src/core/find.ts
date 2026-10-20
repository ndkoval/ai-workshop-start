/** A skill found in a repository: its canonical SKILL.md, its name and its copies. */
export type SkillFile = { path: string; name: string; copies: string[] };

/** Where agents keep a repository's own skills. */
export const SKILL_ROOTS = ['.agents/skills', '.claude/skills', '.github/skills', 'agent/skills'];

/**
 * Every project file named exactly SKILL.md, named after its directory (a SKILL.md
 * at the root after the repository). Agent-root copies with the same relative path
 * are one skill. SKILL.md files in test resource source sets are test data.
 */
export function findSkills(paths: string[], repositoryName: string): SkillFile[] {
  const candidates = paths
    .filter((path) => path.split('/').at(-1) === 'SKILL.md' && !isTestResource(path))
    .map((path) => ({ path, root: SKILL_ROOTS.findIndex((root) => path.startsWith(`${root}/`)) }))
    .sort((a, b) => rank(a.root) - rank(b.root) || compare(a.path, b.path));
  const skills = new Map<string, SkillFile>();
  for (const candidate of candidates) {
    const relative = candidate.root < 0 ? candidate.path : candidate.path.slice(SKILL_ROOTS[candidate.root].length + 1);
    const key = candidate.root < 0 ? `path:${candidate.path}` : `agent:${relative}`;
    const existing = skills.get(key);
    if (existing) existing.copies.push(candidate.path);
    else {
      skills.set(key, {
        path: candidate.path,
        name: candidate.path.split('/').at(-2) ?? repositoryName,
        copies: [],
      });
    }
  }
  return [...skills.values()];
}

function isTestResource(path: string): boolean {
  const parts = path.split('/');
  return parts.some((part, index) => part === 'src' && /test$/i.test(parts[index + 1] ?? '') && parts[index + 2] === 'resources');
}

function rank(root: number): number {
  return root < 0 ? SKILL_ROOTS.length : root;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
