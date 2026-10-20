import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { run } from '../src/commands.ts';
import { openGitHub } from '../src/core/github.ts';
import { replay, type Recording } from '../src/core/replay.ts';
import { scan, type Source } from '../src/core/scan.ts';
import { openDirectory } from '../src/local.ts';

const COMMIT = '632f14db9187594fa3510c70ac38925df63eddd3';
const REPOSITORY = 'workshop/example';
const API = `https://api.github.com/repos/${REPOSITORY}`;
const RAW = `https://raw.githubusercontent.com/${REPOSITORY}/${COMMIT}`;
const SKILL = '---\nname: review\ndescription: Review changes. Report problems.\n---\n';
const MALFORMED = '---\nname: [broken\n---\n';
type File = { path: string; text?: string; kind?: 'symlink' | 'submodule' };
type Expected = { path: string; name: string; description?: string; copies?: string[] };
type Case = { name: string; files: File[]; skills: Expected[]; warning?: RegExp };

const cases: Case[] = [
  ...['.agents/skills', '.claude/skills', '.github/skills', 'agent/skills'].map((root) => ({
    name: `recognizes ${root}`,
    files: [{ path: `${root}/review/SKILL.md`, text: SKILL }],
    skills: [{ path: `${root}/review/SKILL.md`, name: 'review', description: 'Review changes.' }],
  })),
  ...[
    'SKILL.md', '.agents/README.md', 'skills/review/SKILL.md', '.cursor/skills/review/SKILL.md',
    '.agents/skills/SKILL.md', '.agents/skills/group/review/SKILL.md',
    '.agents/skills/review/references/SKILL.md', 'tests/resources/.agents/skills/review/SKILL.md',
    'packages/app/.claude/skills/review/SKILL.md', 'node_modules/pkg/.agents/skills/review/SKILL.md',
    '.agents/skills/review/skill.md', '.Agents/skills/review/SKILL.md',
    'plugins/mcp-tools/resources/jetbrains/mps/agents/mcp/skills/mps-aspect-generator/SKILL.md',
    'integration-tests/src/jvmTest/resources/skills/weather-retrieval/SKILL.md',
  ].map((path) => ({
    name: `ignores ${path} without parsing it`, files: [{ path, text: MALFORMED }], skills: [],
  })),
  { name: 'empty repository', files: [], skills: [] },
  {
    name: 'MPS: identical copies count as one skill',
    files: ['.claude', '.agents'].map((root) => ({ path: `${root}/skills/mps-tests/SKILL.md`,
      text: '---\nname: mps-tests\ndescription: Run MPS tests.\n---\n' })),
    skills: [{ path: '.agents/skills/mps-tests/SKILL.md', name: 'mps-tests', description: 'Run MPS tests.',
      copies: ['.claude/skills/mps-tests/SKILL.md'] }],
  },
  {
    name: 'MPS: a valid product skill is excluded',
    files: [{ path: 'plugins/mcp-tools/resources/jetbrains/mps/agents/mcp/skills/mps-aspect-generator/SKILL.md',
      text: '---\nname: mps-aspect-generator\ndescription: Generate an MPS aspect.\n---\n' }],
    skills: [],
  },
  {
    name: 'Koog: a valid skill used as test data is excluded',
    files: [{ path: 'integration-tests/src/jvmTest/resources/skills/weather-retrieval/SKILL.md',
      text: '---\nname: weather-retrieval\ndescription: Get the weather.\n---\n' }],
    skills: [],
  },
  {
    name: 'Android: includes the unusual agent/skills root',
    files: [{ path: 'agent/skills/writing-lint-checks/SKILL.md', text: '---\nname: writing-lint-checks\n---\n' }],
    skills: [{ path: 'agent/skills/writing-lint-checks/SKILL.md', name: 'writing-lint-checks' }],
  },
  {
    name: 'canonical priority follows roots, not input or lexicographic order',
    files: ['agent', '.github'].map((root) => ({ path: `${root}/skills/x/SKILL.md`, text: `---\nname: ${root}\n---\n` })),
    skills: [{ path: '.github/skills/x/SKILL.md', name: '.github', copies: ['agent/skills/x/SKILL.md'] }],
  },
  {
    name: 'four copies have one canonical name and three sorted copy paths',
    files: ['agent', '.github', '.claude', '.agents'].map((root) => ({ path: `${root}/skills/x/SKILL.md`, text: `---\nname: ${root}\n---\n` })),
    skills: [{ path: '.agents/skills/x/SKILL.md', name: '.agents',
      copies: ['.claude/skills/x/SKILL.md', '.github/skills/x/SKILL.md', 'agent/skills/x/SKILL.md'] }],
  },
  {
    name: 'front-matter names do not change copy identity',
    files: [
      { path: '.agents/skills/x/SKILL.md', text: '---\nname: alpha\n---\n' },
      { path: '.claude/skills/x/SKILL.md', text: '---\nname: beta\n---\n' },
    ],
    skills: [{ path: '.agents/skills/x/SKILL.md', name: 'alpha', copies: ['.claude/skills/x/SKILL.md'] }],
  },
  {
    name: 'malformed canonical metadata is not replaced by a valid copy',
    files: [{ path: '.agents/skills/x/SKILL.md', text: MALFORMED }, { path: '.claude/skills/x/SKILL.md', text: SKILL }],
    skills: [{ path: '.agents/skills/x/SKILL.md', name: 'x', copies: ['.claude/skills/x/SKILL.md'] }],
    warning: /^warning: \.agents\/skills\/x\/SKILL\.md: malformed front matter: /,
  },
  {
    name: 'malformed metadata in a non-canonical copy does not affect the result',
    files: [{ path: '.agents/skills/x/SKILL.md', text: SKILL }, { path: '.claude/skills/x/SKILL.md', text: MALFORMED }],
    skills: [{ path: '.agents/skills/x/SKILL.md', name: 'review', description: 'Review changes.', copies: ['.claude/skills/x/SKILL.md'] }],
  },
  {
    name: 'different directories with identical contents stay distinct and tie-break by path',
    files: [{ path: '.claude/skills/y/SKILL.md', text: SKILL }, { path: '.agents/skills/x/SKILL.md', text: SKILL }],
    skills: [
      { path: '.agents/skills/x/SKILL.md', name: 'review', description: 'Review changes.' },
      { path: '.claude/skills/y/SKILL.md', name: 'review', description: 'Review changes.' },
    ],
  },
  {
    name: 'case-sensitive directory identity and name sorting',
    files: [
      { path: '.agents/skills/x/SKILL.md', text: '---\nname: x\n---\n' },
      { path: '.claude/skills/X/SKILL.md', text: '---\nname: X\n---\n' },
    ],
    skills: [{ path: '.claude/skills/X/SKILL.md', name: 'X' }, { path: '.agents/skills/x/SKILL.md', name: 'x' }],
  },
  {
    name: 'test data is not a copy of a project skill',
    files: [{ path: '.agents/skills/x/SKILL.md', text: SKILL }, { path: 'tests/.claude/skills/x/SKILL.md', text: MALFORMED }],
    skills: [{ path: '.agents/skills/x/SKILL.md', name: 'review', description: 'Review changes.' }],
  },
  ...[
    { text: '# No front matter', reason: 'no front matter' },
    { text: '---\nname: broken', reason: 'front matter without a closing ---' },
    { text: '---\n- list\n---\n', reason: 'front matter is not a mapping' },
  ].map(({ text, reason }) => ({
    name: `metadata fallback: ${reason}`, files: [{ path: '.agents/skills/fallback/SKILL.md', text }],
    skills: [{ path: '.agents/skills/fallback/SKILL.md', name: 'fallback' }],
    warning: new RegExp(`^warning: \\.agents/skills/fallback/SKILL\\.md: ${reason}; using the directory name$`),
  })),
  {
    name: 'missing name preserves the description, whitespace is collapsed for the CLI',
    files: [{ path: '.agents/skills/fallback/SKILL.md', text: '---\ndescription: |\n  First line\n  continues! Next sentence.\n---\n' }],
    skills: [{ path: '.agents/skills/fallback/SKILL.md', name: 'fallback', description: 'First line continues!' }],
  },
  {
    name: 'file URLs and GitHub links escape spaces and non-ASCII characters',
    files: [{ path: '.agents/skills/код review/SKILL.md', text: '---\nname: review\n---\n' }],
    skills: [{ path: '.agents/skills/код review/SKILL.md', name: 'review' }],
  },
  {
    name: 'a symlinked SKILL.md does not shadow the real copy',
    files: [
      { path: 'target.md', text: SKILL },
      { path: '.agents/skills/review/SKILL.md', kind: 'symlink', text: '../../../target.md' },
      { path: '.claude/skills/review/SKILL.md', text: SKILL },
    ],
    skills: [{ path: '.claude/skills/review/SKILL.md', name: 'review', description: 'Review changes.' }],
  },
  {
    name: 'does not follow a symlinked skill directory',
    files: [{ path: 'target/SKILL.md', text: SKILL }, { path: '.agents/skills/review', kind: 'symlink', text: '../../target' }],
    skills: [],
  },
  {
    name: 'does not follow a symlinked agent root',
    files: [{ path: 'target/skills/review/SKILL.md', text: SKILL }, { path: '.agents', kind: 'symlink', text: 'target' }],
    skills: [],
  },
  { name: 'does not scan a checked-out submodule', files: [{ path: '.agents/skills/external', kind: 'submodule' }], skills: [] },
];

for (const mode of ['local', 'GitHub', 'GitHub with token'] as const) {
  for (const scenario of cases) {
    test(`${mode}: ${scenario.name}`, async (t) => {
      let source: Source;
      if (mode === 'local') {
        const root = await mkdtemp(join(tmpdir(), 'skill-atlas-edge-'));
        t.after(() => rm(root, { recursive: true, force: true }));
        for (const file of scenario.files) {
          const path = join(root, file.path);
          await mkdir(dirname(path), { recursive: true });
          if (file.kind === 'symlink') await symlink(file.text!, path);
          else if (file.kind === 'submodule') {
            await mkdir(path, { recursive: true });
            await writeFile(join(path, '.git'), 'gitdir: ../../../.git/modules/external\n');
            await writeFile(join(path, 'SKILL.md'), SKILL);
          } else await writeFile(path, file.text ?? SKILL);
        }
        source = await openDirectory(root);
        assert.equal(source.repository.url, pathToFileURL(root).href);
      } else {
        source = await openGitHub(`https://github.com/${REPOSITORY}`, {
          fetch: replay(recording(scenario.files)), token: mode === 'GitHub with token' ? 'test-token' : undefined,
        });
      }
      const result = await output(async () => source);
      const expected = [`${source.repository.id} · ${scenario.skills.length} ${scenario.skills.length === 1 ? 'skill' : 'skills'}`];
      for (const skill of scenario.skills) {
        expected.push(skill.description ? `${skill.name} — ${skill.description}` : skill.name);
        const path = skill.path.split('/').map(encodeURIComponent).join('/');
        expected.push(`  ${source.repository.url}${mode === 'local' ? '' : `/blob/${COMMIT}`}/${path}`);
        if (skill.copies) expected.push(`  also in ${skill.copies.join(', ')}`);
      }
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.stdout, expected.join('\n'));
      if (scenario.warning) assert.match(result.stderr, scenario.warning);
      else assert.equal(result.stderr, '');
    });
  }
}

test('identity uses the repository and canonical path, repeated listings do not create extra copies', async () => {
  const source = await openGitHub(`https://github.com/${REPOSITORY}`, { fetch: replay(recording([
    { path: '.claude/skills/x/SKILL.md', text: SKILL }, { path: '.agents/skills/x/SKILL.md', text: SKILL },
  ])) });
  source.paths.push(...source.paths);
  const result = await scan(source);
  assert.equal(result.skills.length, 1);
  assert.equal(result.skills[0].id, `${REPOSITORY}:.agents/skills/x/SKILL.md`);
  assert.equal(result.skills[0].commit, COMMIT);
  assert.deepEqual(result.skills[0].copies, ['.claude/skills/x/SKILL.md']);
  const other = await scan({ ...source, repository: { ...source.repository, id: 'other/repo' } });
  assert.notEqual(other.skills[0].id, result.skills[0].id);
});

test('GitHub: directories differing only in case in the same root remain distinct', async () => {
  const source = await openGitHub(`https://github.com/${REPOSITORY}`, { fetch: replay(recording([
    { path: '.agents/skills/x/SKILL.md', text: SKILL }, { path: '.agents/skills/X/SKILL.md', text: SKILL },
  ])) });
  const { skills } = await scan(source);
  assert.deepEqual(skills.map((skill) => skill.path), ['.agents/skills/X/SKILL.md', '.agents/skills/x/SKILL.md']);
});

for (const sha of [COMMIT, 'tree-.agents', 'tree-.agents/skills', 'tree-.agents/skills/x']) {
  test(`GitHub rejects incomplete listings at ${sha} instead of reporting partial success`, async () => {
    const responses = recording([{ path: '.agents/skills/x/SKILL.md', text: SKILL }]);
    responses[`${API}/git/trees/${sha}`] = { status: 200, body: { truncated: true, tree: [] } };
    const result = await output(() => openGitHub(`https://github.com/${REPOSITORY}`, { fetch: replay(responses) }));
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /incomplete directory listing.*scan a local checkout instead/);
  });
}

test('GitHub reads only canonical content, pins requests to the commit and caches shared trees', async () => {
  const responses = recording([
    { path: '.agents/skills/x/SKILL.md', text: SKILL },
    { path: '.claude/skills/x/SKILL.md', text: SKILL },
    { path: 'tests/SKILL.md', text: MALFORMED },
  ]);
  responses[`${RAW}/.claude/skills/x/SKILL.md`] = { status: 403, body: 'must not read copies' };
  const requests: string[] = [];
  const recorded = replay(responses);
  const source = await openGitHub(`https://github.com/${REPOSITORY}`, {
    token: 'test-token',
    fetch: async (url, init) => {
      requests.push(url);
      if (url.startsWith(API)) assert.equal(init?.headers?.Authorization, 'Bearer test-token');
      return recorded(url, init);
    },
  });
  const result = await output(async () => source);
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(requests.filter((url) => url.startsWith(RAW)), [`${RAW}/.agents/skills/x/SKILL.md`]);
  assert.equal(requests.filter((url) => url === `${API}/git/trees/${COMMIT}`).length, 1);
  assert.ok(requests.every((url) => !url.includes('search/code') && !url.includes('recursive=')));
});

test('a listed file missing at the scanned commit is skipped with a warning', async () => {
  const responses = recording([{ path: '.agents/skills/x/SKILL.md', text: SKILL }]);
  responses[`${RAW}/.agents/skills/x/SKILL.md`] = { status: 404, body: 'Not Found' };
  const result = await output(() => openGitHub(`https://github.com/${REPOSITORY}`, { fetch: replay(responses) }));
  assert.equal(result.code, 0);
  assert.equal(result.stdout, `${REPOSITORY} · 0 skills`);
  assert.match(result.stderr, /^warning: \.agents\/skills\/x\/SKILL.md: listed, but not found at the scanned commit; skipped$/);
});

for (const { status, body, message } of [
  { status: 401, body: { message: 'Bad credentials' }, message: /GitHub rejected the token/ },
  { status: 429, body: { message: 'API rate limit exceeded' }, message: /GitHub rate limit reached; try again in a minute/ },
  { status: 403, body: { message: 'Forbidden' }, message: /GitHub answered 403.*Forbidden/ },
  { status: 502, body: 'Bad Gateway', message: /GitHub answered 502/ },
]) {
  test(`GitHub API failure ${status} produces a clear CLI error and no partial output`, async () => {
    const result = await output(() => openGitHub(`https://github.com/${REPOSITORY}`, {
      fetch: replay({ [API]: { status, body } }), token: 'test-token',
    }));
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, message);
    assert.ok(!result.stderr.includes('test-token'));
  });
}

test('GitHub content download failure is fatal, not an empty successful scan', async () => {
  const responses = recording([{ path: '.agents/skills/x/SKILL.md', text: SKILL }]);
  responses[`${RAW}/.agents/skills/x/SKILL.md`] = { status: 503, body: 'Unavailable' };
  const result = await output(() => openGitHub(`https://github.com/${REPOSITORY}`, { fetch: replay(responses) }));
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /GitHub answered 503/);
});

async function output(open: () => Promise<Source>) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await run(['scan', 'repository'], {
    open, print: (line) => stdout.push(line), error: (line) => stderr.push(line),
  });
  return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}

/** A synthetic GitHub repository with non-recursive Git Trees responses. Unrecorded requests fail. */
function recording(files: File[]): Recording {
  type Entry = { path: string; mode: string; type: string; sha: string };
  const entries = new Map<string, Entry>();
  for (const file of files) {
    const segments = file.path.split('/');
    for (let length = 1; length < segments.length; length++) {
      const path = segments.slice(0, length).join('/');
      entries.set(path, { path, type: 'tree', mode: '040000', sha: `tree-${path}` });
    }
    entries.set(file.path, { path: file.path, mode: file.kind === 'symlink' ? '120000' : file.kind === 'submodule' ? '160000' : '100644',
      type: file.kind === 'submodule' ? 'commit' : 'blob', sha: `file-${file.path}` });
  }
  const result: Recording = {
    [API]: { status: 200, body: { full_name: REPOSITORY, default_branch: 'main' } },
    [`${API}/commits/main`]: { status: 200, body: { sha: COMMIT } },
  };
  for (const directory of ['', ...[...entries.values()].filter((entry) => entry.type === 'tree').map((entry) => entry.path)]) {
    const prefix = directory ? `${directory}/` : '';
    const sha = directory ? `tree-${directory}` : COMMIT;
    const descendants = [...entries.values()].filter((entry) => entry.path.startsWith(prefix))
      .map((entry) => ({ ...entry, path: entry.path.slice(prefix.length) }));
    result[`${API}/git/trees/${sha}`] = { status: 200, body: { truncated: false, tree: descendants.filter((entry) => !entry.path.includes('/')) } };
  }
  for (const file of files) {
    result[`${RAW}/${file.path.split('/').map(encodeURIComponent).join('/')}`] = { status: 200, body: file.text ?? SKILL };
  }
  return result;
}
