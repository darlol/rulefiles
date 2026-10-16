import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './lib/util.mjs';

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

/**
 * Maps a request URL to a file inside `dist`.
 * @returns {{status: 200, file: string} | {status: 400 | 403 | 404, file?: string}}
 */
export function resolveRequest(dist, rawUrl) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(rawUrl, 'http://localhost').pathname);
  } catch {
    return { status: 400 };
  }
  if (urlPath.includes('\0')) return { status: 400 };
  const root = path.resolve(dist);
  let file = path.resolve(root, '.' + path.sep + urlPath.replace(/^\/+/, ''));
  const rel = path.relative(root, file);
  // A sibling such as "dist-other" starts with the same characters as "dist", so compare path segments.
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return { status: 403 };
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return { status: 404 };
  return { status: 200, file };
}

export function createServer(dist) {
  return http.createServer((req, res) => {
    const r = resolveRequest(dist, req.url);
    if (r.status === 400) { res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Bad request'); }
    if (r.status === 403) { res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Forbidden'); }
    if (r.status === 404) {
      const page = path.join(dist, '404.html');
      res.writeHead(404, { 'content-type': types['.html'] });
      return res.end(fs.existsSync(page) ? fs.readFileSync(page) : 'Not found');
    }
    res.writeHead(200, { 'content-type': types[path.extname(r.file)] || 'application/octet-stream' });
    fs.createReadStream(r.file).pipe(res);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = path.join(ROOT, 'dist');
  const port = Number(process.env.PORT || 4173);
  createServer(dist).listen(port, '127.0.0.1', () => console.log(`Preview at http://127.0.0.1:${port}/ (serving ${dist}, local only)`));
}
