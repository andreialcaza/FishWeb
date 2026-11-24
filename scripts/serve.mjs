import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist', import.meta.url));
const types = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
};

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }

  const file = resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(`${dist}${sep}`)) {
    response.writeHead(404).end();
    return;
  }

  const info = await stat(file).catch(() => undefined);
  if (!info?.isFile()) {
    response.writeHead(404).end('File not found. Run npm run build to generate the game.');
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': info.size,
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  await pipeline(createReadStream(file), response).catch(() => response.destroy());
});

server.listen(Number(process.env.PORT ?? 4173), '127.0.0.1', () => {
  console.log(`Insane Aquarium Web is running at http://127.0.0.1:${server.address().port}/`);
});
