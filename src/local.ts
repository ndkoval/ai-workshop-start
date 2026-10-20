import { readdir, readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AtlasError } from './core/errors.ts';
import { SKILL_ROOTS } from './core/find.ts';
import type { Source } from './core/scan.ts';

/** A local checkout as a repository: named after its directory, linked with file:// URLs. */
export async function openDirectory(input: string): Promise<Source> {
  const root = resolve(input);
  const name = basename(root);
  let paths: string[];
  try {
    paths = await walk(root, '');
  } catch {
    throw new AtlasError(`Not a GitHub URL or a readable directory: ${input}`);
  }
  return {
    repository: { id: name, organization: 'local', name, url: pathToFileURL(root).href, commit: '' },
    paths,
    warnings: [],
    read: (path) => readFile(join(root, path)).then((bytes) => new Uint8Array(bytes), () => undefined),
  };
}

/** Only visit supported roots and their immediate skill directories. Never follow symlinks. */
async function walk(root: string, directory: string, paths: string[] = []): Promise<string[]> {
  const entries = await readdir(join(root, directory), { withFileTypes: true });
  // A checked-out submodule has a .git file pointing at its separate Git directory.
  if (directory && entries.some((entry) => entry.name === '.git' && entry.isFile())) return paths;
  for (const entry of entries) {
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    const needed = SKILL_ROOTS.some((skillRoot) => skillRoot === path || skillRoot.startsWith(`${path}/`) || directory === skillRoot);
    if (entry.isDirectory() && needed) await walk(root, path, paths);
    else if (entry.isFile() && entry.name === 'SKILL.md') paths.push(path);
  }
  return paths;
}
