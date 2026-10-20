// The web view: one page, and the scan behind it as JSON. Scans on request; nothing is stored.
import { readFile } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { AtlasError } from './core/errors.ts';
import { skillLink } from './core/model.ts';
import { scan, type Source } from './core/scan.ts';

const PAGE = await readFile(new URL('./web.html', import.meta.url));

export type WebOptions = {
  /** Opens the repository the page asked for. */
  open(input: string): Promise<Source>;
};

/** `/`: the page. `/api/scan?repository=<URL>`: the repository, its skills and the warnings. */
export function createWebServer({ open }: WebOptions): Server {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method !== 'GET') return send(response, 405, { error: 'Only GET is supported' });
    if (url.pathname === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return response.end(PAGE);
    }
    if (url.pathname !== '/api/scan') return send(response, 404, { error: `Not found: ${url.pathname}` });
    const input = url.searchParams.get('repository')?.trim();
    if (!input) return send(response, 400, { error: 'Enter a GitHub repository URL' });
    try {
      const { repository, skills, warnings } = await scan(await open(input));
      const linked = skills.map((skill) => ({ ...skill, link: skillLink(repository, skill) }));
      send(response, 200, { repository, skills: linked, warnings });
    } catch (error) {
      if (error instanceof AtlasError) return send(response, 400, { error: error.message });
      send(response, 500, { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
}

/** Listens on localhost only; the URL of the page. */
export function listen(server: Server, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(error.code === 'EADDRINUSE' ? new AtlasError(`Port ${port} is in use; try ./skill-atlas serve <port>`) : error);
    });
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve(`http://localhost:${typeof address === 'object' && address ? address.port : port}`);
    });
  });
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}
