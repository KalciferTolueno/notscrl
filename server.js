/**
 * Zero-Dependency Local Static HTTP Server for NotSCRL
 * Uses native Node.js http, fs, and path modules (No npm install needed)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.zip': 'application/zip'
};

const GIPHY_KEY = process.env.GIPHY_API_KEY || '';

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

// Same-origin proxy for GIPHY so GIFs can be drawn to canvas and exported.
async function handleGiphy(pathname, parsedUrl, req, res) {
  try {
    if (pathname === '/api/giphy/media') {
      const id = parsedUrl.searchParams.get('id') || '';
      if (!/^[A-Za-z0-9]+$/.test(id)) return sendJson(res, 400, { error: 'invalid_id' });
      const upstream = await fetch(`https://i.giphy.com/${id}.gif`);
      if (!upstream.ok) return sendJson(res, upstream.status, { error: 'media_unavailable' });
      const body = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(200, {
        'Content-Type': upstream.headers.get('content-type') || 'image/gif',
        'Cache-Control': 'public, max-age=86400'
      });
      res.end(body);
      return;
    }

    const key = req.headers['x-giphy-key'] || GIPHY_KEY;
    if (!key) return sendJson(res, 400, { error: 'missing_key' });
    const query = (parsedUrl.searchParams.get('q') || '').trim();
    const endpoint = query ? 'search' : 'trending';
    const url = `https://api.giphy.com/v1/gifs/${endpoint}?api_key=${encodeURIComponent(key)}&limit=24&rating=pg-13${query ? `&q=${encodeURIComponent(query)}` : ''}`;
    const upstream = await fetch(url);
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return sendJson(res, upstream.status, { error: 'giphy_error' });
    sendJson(res, 200, {
      items: (data.data || []).map((gif) => ({
        id: gif.id,
        title: gif.title || 'GIF',
        width: Number(gif.images?.fixed_width?.width) || 200,
        height: Number(gif.images?.fixed_width?.height) || 200
      }))
    });
  } catch {
    sendJson(res, 502, { error: 'upstream_unavailable' });
  }
}

const server = http.createServer((req, res) => {
  // Normalize URL
  let parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  if (pathname === '/api/giphy/search' || pathname === '/api/giphy/media') {
    handleGiphy(pathname, parsedUrl, req, res);
    return;
  }

  if (pathname === '/') pathname = '/index.html';

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(BASE_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// Get local network IPv4 address
function getLocalIp() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '192.168.1.11';
}

const LOCAL_IP = getLocalIp();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 NotSCRL Web Studio is live!`);
  console.log(`💻 Local:   http://localhost:${PORT}`);
  console.log(`📱 Móvil:   http://${LOCAL_IP}:${PORT}`);
  console.log(`📁 Carpeta: ${BASE_DIR}`);
  console.log(`======================================================\n`);
});
