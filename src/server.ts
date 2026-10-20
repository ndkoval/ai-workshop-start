// The web client: one page where you paste a GitHub URL, and the JSON API it calls. Like the CLI,
// a thin client over the core; nothing is stored. Local directories are not served.
import { readFile } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { AtlasError } from './core/errors.ts';
import { openGitHub, parseGitHubUrl, type Fetch } from './core/github.ts';
import { skillLink } from './core/model.ts';
import { scan } from './core/scan.ts';

export type WebOptions = {
  fetch: Fetch;
  /** Code search and a higher rate limit, as for the CLI. */
  token?: string;
};

/** What `GET /api/scan?url=<GitHub URL>` answers. */
export type ScanAnswer = {
  repository: { id: string; url: string; commit: string };
  skills: { id: string; name: string; description: string; path: string; link: string; copies: string[] }[];
  warnings: string[];
};

const page = new URL('./web/index.html', import.meta.url);

export function createWebServer(options: WebOptions): Server {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, { error: 'Method not allowed' });
    if (url.pathname === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return response.end(await readFile(page));
    }
    if (url.pathname === '/api/scan') {
      const [status, body] = await scanAnswer(url.searchParams.get('url') ?? '', options);
      return send(response, status, body);
    }
    send(response, 404, { error: `Not found: ${url.pathname}` });
  });
}

/** 200 and the skills; 400 for input that is not a GitHub repository; 502 when GitHub cannot be scanned. */
async function scanAnswer(input: string, options: WebOptions): Promise<[number, ScanAnswer | { error: string }]> {
  if (!parseGitHubUrl(input)) return [400, { error: `Not a GitHub repository URL: ${input}` }];
  try {
    const { repository, skills, warnings } = await scan(await openGitHub(input, options));
    return [
      200,
      {
        repository: { id: repository.id, url: repository.url, commit: repository.commit },
        skills: skills.map((skill) => ({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          path: skill.path,
          link: skillLink(repository, skill),
          copies: skill.copies,
        })),
        warnings,
      },
    ];
  } catch (error) {
    if (error instanceof AtlasError) return [502, { error: error.message }];
    return [500, { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` }];
  }
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}
