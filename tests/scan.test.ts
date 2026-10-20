// The decisions in spec/analysis.md and spec/cli.md, checked on what the real command prints for
// ./fixture and for a small GitHub repository answered in tests/helpers.ts.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { openGitHub } from '../src/core/github.ts';
import { parseSkill } from '../src/core/parse.ts';
import { replay } from '../src/core/replay.ts';
import { scan } from '../src/core/scan.ts';
import { atlas, CLI, EXAMPLE_COMMIT, FIXTURE } from './helpers.ts';

const fixture = await atlas(['scan', FIXTURE]);
const example = await atlas(['scan', 'github.com/JetBrains/example']);

test('malformed front matter → the directory name, no description and a warning', () => {
  const parsed = parseSkill(readFileSync(join(FIXTURE, '.agents/skills/release-checklist/SKILL.md'), 'utf8'));
  assert.equal(parsed.name, undefined);
  assert.equal(parsed.description, '');
  assert.equal(
    parsed.warning,
    'malformed front matter: Nested mappings are not allowed in compact mappings at line 3, column 14; using the directory name',
  );
});

test('scan prints the repository, then each skill with its first sentence and pinned link', () => {
  assert.equal(example.code, 0, example.stderr);
  assert.equal(
    example.stdout,
    [
      'JetBrains/example · 1 skill',
      'commits — Write commit messages the way this repository does.',
      `  https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
    ].join('\n'),
  );
});

test('a /tree/<commit> URL scans exactly that commit', async () => {
  const commit = '3333333333333333333333333333333333333333';
  const github = replay({
    'https://api.github.com/repos/JetBrains/pinned': {
      status: 200,
      body: { full_name: 'JetBrains/pinned', default_branch: 'main' },
    },
    [`https://api.github.com/repos/JetBrains/pinned/commits/${commit}`]: { status: 200, body: { sha: commit } },
    [`https://api.github.com/repos/JetBrains/pinned/git/trees/${commit}?recursive=1`]: {
      status: 200,
      body: { truncated: false, tree: [] },
    },
  });

  const source = await openGitHub(`github.com/JetBrains/pinned/tree/${commit}`, { fetch: github, token: 'test' });
  assert.equal(source.repository.commit, commit);
});

test('./fixture: project skills include copies, unusual folders and product resources, but not test data', () => {
  const root = pathToFileURL(FIXTURE).href;
  assert.equal(fixture.code, 0);
  assert.equal(
    fixture.stdout,
    [
      'fixture · 6 skills',
      "code-style — Follow the project's code style.",
      `  ${root}/.github/skills/code-style/SKILL.md`,
      'commits — Write commit messages the way this repository does.',
      `  ${root}/.claude/skills/commits/SKILL.md`,
      'mps-aspect-generator — Generate an MPS aspect in the shipped plugin.',
      `  ${root}/plugins/mcp-tools/resources/skills/mps-aspect-generator/SKILL.md`,
      'mps-tests — Run the MPS test suite.',
      `  ${root}/.agents/skills/mps-tests/SKILL.md`,
      '  also in .claude/skills/mps-tests/SKILL.md, .github/skills/mps-tests/SKILL.md, agent/skills/mps-tests/SKILL.md',
      'release-checklist',
      `  ${root}/.agents/skills/release-checklist/SKILL.md`,
      'writing-lint-checks — Write lint checks for this repository.',
      `  ${root}/agent/skills/writing-lint-checks/SKILL.md`,
    ].join('\n'),
  );
  assert.match(fixture.stderr, /^warning: \.agents\/skills\/release-checklist\/SKILL\.md: malformed front matter: /);
});

test('.agents metadata wins across copies in all four agent roots', () => {
  assert.match(
    fixture.stdout,
    /mps-tests — Run the MPS test suite\.\n  .*\.agents\/skills\/mps-tests\/SKILL\.md\n  also in \.claude\/skills\/mps-tests\/SKILL\.md, \.github\/skills\/mps-tests\/SKILL\.md, agent\/skills\/mps-tests\/SKILL\.md/,
  );
  assert.doesNotMatch(fixture.stdout, /ignored-(?:claude|github|agent)-name|lower-priority/);
});

test('a skill in the unusual agent/skills folder is included', () => {
  assert.match(fixture.stdout, /agent\/skills\/writing-lint-checks\/SKILL\.md/);
});

test('a skill shipped in product resources is included', () => {
  assert.match(fixture.stdout, /plugins\/mcp-tools\/resources\/skills\/mps-aspect-generator\/SKILL\.md/);
});

test('a SKILL.md in test resources is not a project skill', () => {
  assert.doesNotMatch(fixture.stdout, /weather-retrieval/);
});

test('a tokenless truncated GitHub tree still finds product resource skills', async () => {
  const commit = '1111111111111111111111111111111111111111';
  const github = replay({
    'https://api.github.com/repos/JetBrains/truncated': {
      status: 200,
      body: { full_name: 'JetBrains/truncated', default_branch: 'main' },
    },
    'https://api.github.com/repos/JetBrains/truncated/commits/main': { status: 200, body: { sha: commit } },
    [`https://api.github.com/repos/JetBrains/truncated/git/trees/${commit}?recursive=1`]: {
      status: 200,
      body: { truncated: true, tree: [] },
    },
    [`https://api.github.com/repos/JetBrains/truncated/git/trees/${commit}`]: {
      status: 200,
      body: { truncated: false, tree: [{ path: 'plugins', mode: '040000', type: 'tree', sha: 'plugins-tree' }] },
    },
    'https://api.github.com/repos/JetBrains/truncated/git/trees/plugins-tree': {
      status: 200,
      body: { truncated: false, tree: [{ path: 'mcp-tools', mode: '040000', type: 'tree', sha: 'mcp-tools-tree' }] },
    },
    'https://api.github.com/repos/JetBrains/truncated/git/trees/mcp-tools-tree': {
      status: 200,
      body: { truncated: false, tree: [{ path: 'resources', mode: '040000', type: 'tree', sha: 'resources-tree' }] },
    },
    'https://api.github.com/repos/JetBrains/truncated/git/trees/resources-tree?recursive=1': {
      status: 200,
      body: {
        truncated: false,
        tree: [{ path: 'skills/product/SKILL.md', mode: '100644', type: 'blob', sha: 'skill-blob' }],
      },
    },
    [`https://raw.githubusercontent.com/JetBrains/truncated/${commit}/plugins/mcp-tools/resources/skills/product/SKILL.md`]: {
      status: 200,
      body: '---\nname: product\ndescription: A skill shipped with the product.\n---\n',
    },
  });

  const result = await scan(await openGitHub('https://github.com/JetBrains/truncated', { fetch: github }));
  assert.deepEqual(result.skills.map(({ name, path }) => ({ name, path })), [
    { name: 'product', path: 'plugins/mcp-tools/resources/skills/product/SKILL.md' },
  ]);
  assert.match(result.warnings[0], /looked only in .*plugins\/mcp-tools\/resources/);
});

test('GitHub code search warns when more than 1,000 files match', async () => {
  const commit = '2222222222222222222222222222222222222222';
  const github = replay({
    'https://api.github.com/repos/JetBrains/capped': {
      status: 200,
      body: { full_name: 'JetBrains/capped', default_branch: 'main' },
    },
    'https://api.github.com/repos/JetBrains/capped/commits/main': { status: 200, body: { sha: commit } },
    'https://api.github.com/search/code?q=filename:SKILL.md+repo:JetBrains/capped&per_page=100&page=1': {
      status: 200,
      body: { total_count: 1001, items: [] },
    },
  });

  const source = await openGitHub('https://github.com/JetBrains/capped', { fetch: github, token: 'test' });
  assert.deepEqual(source.warnings, ['GitHub code search found over 1,000 files; only the first 1,000 were scanned']);
});

test('the CLI prints the result at once and stores nothing', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'skill-atlas-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const scanned = spawnSync(process.execPath, [CLI, 'scan', FIXTURE], { cwd, encoding: 'utf8' });
  assert.equal(scanned.status, 0, scanned.stderr);
  assert.equal(scanned.stdout, `${fixture.stdout}\n`);
  assert.deepEqual(readdirSync(cwd), []);
});

test('unreachable repository → a clear message, exit code 1', async () => {
  const missing = spawnSync(process.execPath, [CLI, 'scan', join(FIXTURE, 'no-such-directory')], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /^Not a GitHub URL or a readable directory: .*no-such-directory\n$/);

  // What GitHub answers for a repository that does not exist.
  const notFound = replay({ 'https://api.github.com/repos/JetBrains/no-such-repository': { status: 404, body: { message: 'Not Found' } } });
  await assert.rejects(openGitHub('https://github.com/JetBrains/no-such-repository', { fetch: notFound }), {
    message: 'Repository not found: https://github.com/JetBrains/no-such-repository',
  });

  const offline = await atlas(['scan', 'https://github.com/JetBrains/not-answered']);
  assert.equal(offline.code, 1);
  assert.match(offline.stderr, /^Cannot reach GitHub: not recorded: https:\/\/api\.github\.com\/repos\/JetBrains\/not-answered$/);
});

test('rate limit → a message that asks for GITHUB_TOKEN', async () => {
  const limited = replay({
    'https://api.github.com/repos/JetBrains/MPS': {
      status: 403,
      body: { message: 'API rate limit exceeded for 192.0.2.1. (But here is the good news: ...)' },
    },
  });
  await assert.rejects(openGitHub('https://github.com/JetBrains/MPS', { fetch: limited }), {
    message: 'GitHub rate limit reached; set GITHUB_TOKEN',
  });
});
