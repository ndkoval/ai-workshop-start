/** A skill found in a repository: its SKILL.md, its name and its copies. */
export type SkillFile = { path: string; name: string; copies: string[] };

/** Where agents keep a repository's own skills, the first one is preferred for a duplicate. */
export const SKILL_ROOTS = ['.agents/skills', '.claude/skills', '.github/skills', 'agent/skills'];

/**
 * Every `<root>/<name>/SKILL.md` for a root of SKILL_ROOTS at the top of the repository;
 * any other SKILL.md is not a skill. The same name in several roots is one skill:
 * the first root has it, the others are its copies.
 */
export function findSkills(paths: string[]): SkillFile[] {
  const byName = new Map<string, SkillFile>();
  for (const root of SKILL_ROOTS) {
    const prefix = `${root}/`;
    const found = paths
      .filter((path) => path.startsWith(prefix) && /^[^/]+\/SKILL\.md$/.test(path.slice(prefix.length)))
      .sort();
    for (const path of found) {
      const name = path.slice(prefix.length).split('/')[0];
      const skill = byName.get(name);
      if (skill) skill.copies.push(path);
      else byName.set(name, { path, name, copies: [] });
    }
  }
  return [...byName.values()];
}
