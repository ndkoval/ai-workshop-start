/** A skill found in a repository: its SKILL.md, its name and its copies. */
export type SkillFile = { path: string; name: string; copies: string[] };

/** Where agents keep a repository's own skills, in canonical-copy priority order. */
export const SKILL_ROOTS = ['.agents/skills', '.claude/skills', '.github/skills', 'agent/skills'];

/** Exactly <root>/<name>/SKILL.md; the directory name identifies copies across roots. */
export function findSkills(paths: string[]): SkillFile[] {
  const skills = new Map<string, SkillFile>();
  const uniquePaths = [...new Set(paths)].sort();
  for (const root of SKILL_ROOTS) {
    for (const path of uniquePaths) {
      if (!path.startsWith(`${root}/`)) continue;
      const [name, file, ...rest] = path.slice(root.length + 1).split('/');
      if (!name || name === '.' || name === '..' || file !== 'SKILL.md' || rest.length > 0) continue;
      const canonical = skills.get(name);
      if (canonical) canonical.copies.push(path);
      else skills.set(name, { path, name, copies: [] });
    }
  }
  return [...skills.values()].map((skill) => ({ ...skill, copies: skill.copies.sort() }));
}
