const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); res.end('網址格式有誤'); return; }
  const filename = path.resolve(root, '.' + (url === '/' ? '/index.html' : url));
  if (!filename.startsWith(root + path.sep) || url.split('/').some(part => part.startsWith('.'))) { res.writeHead(403); res.end('無法存取'); return; }
  fs.readFile(filename, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('找不到此頁面'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`預覽網址：http://127.0.0.1:${port}`));
