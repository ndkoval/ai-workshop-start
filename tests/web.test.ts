// The decisions in spec/web.md, checked on the real server: the page, and the scan behind it for
// the GitHub repository answered in tests/helpers.ts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { run } from '../src/commands.ts';
import { createWebServer, listen } from '../src/web.ts';
import { atlas, CLI, EXAMPLE_COMMIT, openExample } from './helpers.ts';

const server = createWebServer({ open: openExample });
const base = await listen(server, 0);
test.after(() => server.close());

const get = (path: string) => fetch(`${base}${path}`);
const scanned = (repository: string) => get(`/api/scan?repository=${encodeURIComponent(repository)}`);

test('the page: a field for a GitHub repository URL, the skills and their SKILL.md', async () => {
  const response = await get('/');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type')!, /^text\/html/);
  const page = await response.text();
  assert.match(page, /<input id="repository"[^>]*aria-label="GitHub repository URL"/);
  assert.match(page, /<nav id="skills"/);
  assert.match(page, /element\('pre', skill\.content\)/);
  // ?repository=<URL> scans at once.
  assert.match(page, /new URLSearchParams\(location\.search\)\.get\('repository'\)/);
});

test('the scan: the repository, each skill with its link and its whole SKILL.md, the warnings', async () => {
  const response = await scanned('https://github.com/JetBrains/example');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    repository: {
      id: 'JetBrains/example',
      organization: 'JetBrains',
      name: 'example',
      url: 'https://github.com/JetBrains/example',
      commit: EXAMPLE_COMMIT,
    },
    skills: [
      {
        id: 'JetBrains/example:.claude/skills/commits/SKILL.md',
        repository: 'JetBrains/example',
        path: '.claude/skills/commits/SKILL.md',
        name: 'commits',
        description: 'Write commit messages the way this repository does. Use for every commit.',
        commit: EXAMPLE_COMMIT,
        copies: [],
        content: '---\nname: commits\ndescription: Write commit messages the way this repository does. Use for every commit.\n---\n# Commits\n',
        link: `https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
      },
    ],
    warnings: [],
  });
});

test('no URL, not a GitHub URL, unreachable repository → status 400 and the CLI\'s message', async () => {
  const cases: [string, string][] = [
    ['/api/scan', 'Enter a GitHub repository URL'],
    ['/api/scan?repository=%20', 'Enter a GitHub repository URL'],
    [`/api/scan?repository=${encodeURIComponent('./fixture')}`, 'Not a GitHub repository URL: ./fixture'],
    [
      `/api/scan?repository=${encodeURIComponent('https://github.com/JetBrains/not-answered')}`,
      'Cannot reach GitHub: not recorded: https://api.github.com/repos/JetBrains/not-answered',
    ],
  ];
  for (const [path, error] of cases) {
    const response = await get(path);
    assert.equal(response.status, 400, path);
    assert.deepEqual(await response.json(), { error }, path);
  }
  assert.equal((await get('/elsewhere')).status, 404);
  assert.equal((await fetch(`${base}/api/scan`, { method: 'POST' })).status, 405);
});

test('serve: a wrong port, or a client without a server → usage and exit code 1', async () => {
  for (const args of [['serve', 'x'], ['serve', '70000'], ['serve', '1', '2']]) {
    const result = await atlas(args);
    assert.equal(result.code, 1);
    assert.equal(result.stderr, 'Usage: skill-atlas serve [port]');
  }
  const stderr: string[] = [];
  const code = await run(['serve'], { open: openExample, print: () => {}, error: (text) => stderr.push(text) });
  assert.equal(code, 1);
  assert.deepEqual(stderr, ['serve runs only in the command line: ./skill-atlas serve']);
});

test('a port in use → a clear message', async () => {
  const port = Number(new URL(base).port);
  await assert.rejects(listen(createWebServer({ open: openExample }), port), {
    message: `Port ${port} is in use; try ./skill-atlas serve <port>`,
  });
});

test('the CLI serves the page and stores nothing', async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'skill-atlas-'));
  const child = spawn(process.execPath, [CLI, 'serve', '0'], { cwd, stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(() => {
    child.kill();
    rmSync(cwd, { recursive: true, force: true });
  });
  const [line] = (await once(child.stdout, 'data')) as [Buffer];
  const url = /^Skill Atlas at (http:\/\/localhost:\d+)\n$/.exec(line.toString())?.[1];
  assert.ok(url, line.toString());
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<title>Skill Atlas<\/title>/);
  assert.deepEqual(readdirSync(cwd), []);
});
