#!/usr/bin/env node
// The Node client: a GitHub repository through the GitHub API, or a local directory; stdout and
// stderr. Nothing is stored.
import type { AddressInfo } from 'node:net';
import { run } from './commands.ts';
import { AtlasError } from './core/errors.ts';
import { openGitHub, parseGitHubUrl } from './core/github.ts';
import { openDirectory } from './local.ts';
import { createWebServer } from './server.ts';

const token = process.env.GITHUB_TOKEN || undefined;

process.exitCode = await run(process.argv.slice(2), {
  open: (input) => (parseGitHubUrl(input) ? openGitHub(input, { fetch, token }) : openDirectory(input)),
  print: (text) => console.log(text),
  error: (text) => console.error(text),
  serve: (port) =>
    new Promise((resolve, reject) => {
      const server = createWebServer({ fetch, token });
      server.once('error', (error) => reject(new AtlasError(`Cannot serve on port ${port}: ${error.message}`)));
      server.listen(port, () => resolve(`Skill Atlas on http://localhost:${(server.address() as AddressInfo).port}`));
    }),
});
