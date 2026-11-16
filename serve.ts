// Tiny static server for playing TIDEWARDEN locally: serves game/ on
// http://localhost:8080. Dev convenience only — the entry itself is the
// static files under game/, which any static server can host.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./game/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    if (!path.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(8080, () => {
  console.log('TIDEWARDEN at http://localhost:8080');
});
