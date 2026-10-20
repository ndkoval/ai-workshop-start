import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { CLI } from './helpers.ts';

const snapshots = fileURLToPath(new URL('./snapshots', import.meta.url));
const scopedWarning =
  'warning: the tree is too large to list at once; looked only in .agents/skills, .claude/skills, .github/skills, agent/skills, plugins/mcp-tools/resources (GITHUB_TOKEN searches everywhere)\n';

const repositories = [
  {
    name: 'MPS',
    commit: 'd7e4f5c1394535b05e90dde6e3e7e8a3f3e174a2',
    warning: scopedWarning,
  },
  {
    name: 'android',
    commit: '6c1bcc42a2cbb45c241fafea9fbd82d32ac4d765',
    warning: scopedWarning,
  },
  {
    name: 'koog',
    commit: '22e342e033c716f835312dd6cbe83193e1cbcf76',
    warning: '',
  },
];

test('real JetBrains repositories match their fixed-commit snapshots', async (t) => {
  assert.ok(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN is required for real-repository E2E tests');
  for (const repository of repositories) {
    await t.test(repository.name, () => {
      const input = `github.com/JetBrains/${repository.name}/tree/${repository.commit}`;
      const result = spawnSync(process.execPath, [CLI, 'scan', input], { encoding: 'utf8', timeout: 120_000 });
      assert.equal(result.status, 0, result.stderr || result.error?.message);
      assert.equal(result.stderr, repository.warning);

      const snapshot = `${snapshots}/${repository.name.toLowerCase()}.txt`;
      if (process.env.UPDATE_SNAPSHOTS === '1') {
        mkdirSync(snapshots, { recursive: true });
        writeFileSync(snapshot, result.stdout);
      } else {
        assert.equal(result.stdout, readFileSync(snapshot, 'utf8'));
      }
    });
  }
});
