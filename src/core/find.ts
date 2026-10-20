/** A skill found in a repository: its SKILL.md, its name and its copies. */
export type SkillFile = { path: string; name: string; copies: string[] };

/** Where agents keep a repository's own skills; the same name in several of them is one skill. */
export const SKILL_ROOTS = ['.agents/skills', '.claude/skills', '.github/skills', 'agent/skills'];

/** Words that make a folder test code: `tests`, `integration-tests`, `jvmTest`, `fixtures`. */
const TEST_WORDS = new Set(['test', 'tests', 'fixture', 'fixtures']);

/**
 * Each `…/skills/<name>/SKILL.md` outside test code, named after its directory. The same name in
 * several of SKILL_ROOTS is one skill, in the first of them, with the others as its copies.
 */
export function findSkills(paths: string[]): SkillFile[] {
  const rank = (path: string) => {
    const root = SKILL_ROOTS.findIndex((root) => path.startsWith(`${root}/`));
    return root === -1 ? SKILL_ROOTS.length : root;
  };
  const skills: SkillFile[] = [];
  const inRoots = new Map<string, SkillFile>();
  for (const path of [...paths].sort().sort((a, b) => rank(a) - rank(b))) {
    const parts = path.split('/');
    if (parts.length < 3 || parts.at(-1) !== 'SKILL.md' || parts.at(-3) !== 'skills') continue;
    if (parts.slice(0, -3).some(isTestCode)) continue;
    const name = parts.at(-2)!;
    const inRoot = SKILL_ROOTS.includes(parts.slice(0, -2).join('/'));
    const original = inRoot ? inRoots.get(name) : undefined;
    if (original) {
      original.copies.push(path);
      continue;
    }
    const skill = { path, name, copies: [] };
    if (inRoot) inRoots.set(name, skill);
    skills.push(skill);
  }
  return skills;
}

/** `jvmTest` → jvm, test; `integration-tests` → integration, tests. */
function isTestCode(folder: string): boolean {
  return folder
    .split(/[-_.\s]+|(?<=[a-z0-9])(?=[A-Z])/)
    .some((word) => TEST_WORDS.has(word.toLowerCase()));
}
