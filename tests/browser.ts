// The page in spec/web.md, in a real headless Chromium: what a user sees after pasting a GitHub
// URL. GitHub answers from recordings. `npx playwright install chromium-headless-shell` once;
// CHROMIUM_PATH points at another Chromium build instead.
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';
import { chromium } from 'playwright';
import { replay } from '../src/core/replay.ts';
import { createWebServer } from '../src/server.ts';
import { EXAMPLE_COMMIT, github } from './helpers.ts';

const commit = '6666666666666666666666666666666666666666';
const raw = `https://raw.githubusercontent.com/JetBrains/web/${commit}`;
const paths = ['.agents/skills/tests/SKILL.md', '.claude/skills/tests/SKILL.md', 'docs/broken/SKILL.md', 'docs/html/SKILL.md'];

/** JetBrains/web: a skill with a copy, one with a warning, one whose description looks like HTML; then EXAMPLE. */
const web = replay(
  {
    'https://api.github.com/repos/JetBrains/web': { status: 200, body: { full_name: 'JetBrains/web', default_branch: 'main' } },
    'https://api.github.com/repos/JetBrains/web/commits/main': { status: 200, body: { sha: commit } },
    'https://api.github.com/search/code?q=filename:SKILL.md+repo:JetBrains/web&per_page=100&page=1': {
      status: 200,
      body: { total_count: paths.length, items: paths.map((path) => ({ path })) },
    },
    [`${raw}/.agents/skills/tests/SKILL.md`]: { status: 200, body: '---\nname: tests\ndescription: Run the tests.\n---\n' },
    [`${raw}/docs/broken/SKILL.md`]: { status: 200, body: 'no front matter' },
    [`${raw}/docs/html/SKILL.md`]: {
      status: 200,
      body: '---\nname: html\ndescription: <img src=x onerror="document.title=\'pwned\'"> is text.\n---\n',
    },
  },
  github,
);

// With a token, through code search, as both recordings answer it.
const server = createWebServer({ fetch: web, token: 'test' });
await new Promise<void>((resolve) => server.listen(0, resolve));
const base = `http://localhost:${(server.address() as AddressInfo).port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
after(async () => {
  await browser.close();
  server.close();
});

async function open(path = '/') {
  const page = await browser.newPage();
  await page.goto(`${base}${path}`);
  return page;
}

async function scan(url: string) {
  const page = await open();
  await page.fill('input[name=url]', url);
  await page.click('button[type=submit]');
  await page.locator('#status:not(:has-text("Scanning"))').waitFor();
  return page;
}

test('paste a GitHub URL, press Scan: the repository, then each skill linked at the scanned commit', async () => {
  const page = await scan('https://github.com/JetBrains/example');
  assert.equal(await page.textContent('#status'), `JetBrains/example · 1 skill at ${EXAMPLE_COMMIT.slice(0, 7)}`);
  assert.equal(await page.getAttribute('#status a', 'href'), 'https://github.com/JetBrains/example');
  const skill = page.locator('#skills li');
  assert.equal(await skill.count(), 1);
  assert.equal(await skill.locator('h2').textContent(), 'commits');
  assert.equal(
    await skill.locator('h2 a').getAttribute('href'),
    `https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
  );
  assert.equal(await skill.locator('p').textContent(), 'Write commit messages the way this repository does. Use for every commit.');
  assert.equal(await skill.locator('.path').textContent(), '.claude/skills/commits/SKILL.md');
  await page.close();
});

test('copies show as "also in", warnings after the skills, sorted by name', async () => {
  const page = await scan('github.com/JetBrains/web');
  assert.equal(await page.textContent('#status'), `JetBrains/web · 3 skills at ${commit.slice(0, 7)}`);
  assert.deepEqual(await page.locator('#skills h2').allTextContents(), ['broken', 'html', 'tests']);
  assert.equal(await page.locator('#skills li', { hasText: 'tests' }).locator('.copies').textContent(), 'also in .claude/skills/tests/SKILL.md');
  assert.deepEqual(await page.locator('#warnings li').allTextContents(), [
    'warning: docs/broken/SKILL.md: no front matter; using the directory name',
  ]);
  await page.close();
});

test('a description that looks like HTML is shown as text, never run', async () => {
  const page = await scan('github.com/JetBrains/web');
  assert.equal(
    await page.locator('#skills li', { hasText: 'html' }).locator('p').textContent(),
    `<img src=x onerror="document.title='pwned'"> is text.`,
  );
  assert.equal(await page.locator('#skills img').count(), 0);
  assert.equal(await page.title(), 'Skill Atlas');
  await page.close();
});

test('the scanned URL goes into the address bar, and opening that address scans at once', async () => {
  const scanned = await scan('https://github.com/JetBrains/example');
  const address = scanned.url();
  assert.equal(new URL(address).searchParams.get('url'), 'https://github.com/JetBrains/example');
  await scanned.close();

  const page = await open(`/${new URL(address).search}`);
  await page.locator('#skills li').first().waitFor();
  assert.equal(await page.inputValue('input[name=url]'), 'https://github.com/JetBrains/example');
  assert.equal(await page.locator('#skills h2').textContent(), 'commits');
  await page.close();
});

test('a local directory or a repository GitHub cannot scan → the message, in red, and no skills', async () => {
  for (const [input, message] of [
    ['/etc', 'Not a GitHub repository URL: /etc'],
    ['https://github.com/JetBrains/not-answered', 'Cannot reach GitHub: not recorded: https://api.github.com/repos/JetBrains/not-answered'],
  ]) {
    const page = await scan(input);
    assert.equal(await page.textContent('#status'), message);
    assert.equal(await page.getAttribute('#status', 'class'), 'error');
    assert.equal(await page.locator('#skills li').count(), 0);
    await page.close();
  }
});
