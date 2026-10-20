/** A skill found in a repository: its SKILL.md, its name and its copies. */
export type SkillFile = { path: string; name: string; copies: string[] };

/** Where agents keep a repository's own skills. */
export const SKILL_ROOTS = ['.agents/skills', '.claude/skills', '.github/skills', 'agent/skills'];

/** Path segments that mark test fixtures — SKILL.md files inside these are not real skills. */
const TEST_RESOURCE_MARKERS = ['/src/test/resources/', '/src/jvmTest/resources/', '/src/testFixtures/resources/'];

/**
 * Every file named exactly SKILL.md, named after its directory (a SKILL.md at the
 * root after the repository). When the same skill name appears under more than one
 * agent root, the first by path is kept and the rest are listed as copies.
 */
export function findSkills(paths: string[], repositoryName: string): SkillFile[] {
  const isTestFixture = (p: string) => TEST_RESOURCE_MARKERS.some((marker) => p.includes(marker));
  const all = paths
    .filter((path) => path.split('/').at(-1) === 'SKILL.md' && !isTestFixture(path))
    .sort()
    .map((path) => ({ path, name: path.split('/').at(-2) ?? repositoryName, copies: [] as string[] }));

  // Deduplicate skills with the same name that live under different agent roots.
  const agentRoot = (p: string) => SKILL_ROOTS.find((root) => p.startsWith(root + '/'));
  const kept = new Map<string, SkillFile>();
  const result: SkillFile[] = [];
  for (const file of all) {
    const root = agentRoot(file.path);
    if (root && kept.has(file.name)) {
      kept.get(file.name)!.copies.push(file.path);
    } else {
      if (root) kept.set(file.name, file);
      result.push(file);
    }
  }
  return result;
}
