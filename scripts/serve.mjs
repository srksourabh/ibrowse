import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs')
const demoDir = path.join(root, 'demo')
const zipFile = path.join(root, '.output', 'ibrowse-0.2.0-chrome.zip')
const port = Number(process.env.PORT || 3000)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.vtt': 'text/vtt; charset=utf-8',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
  '.zip': 'application/zip',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

const HOME_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>iBrowse v0.2.0 — Download & Demo</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; line-height: 1.6; }
  main { max-width: 820px; margin: 0 auto; padding: 48px 24px; }
  h1 { font-size: 2.4rem; margin: 0 0 8px; }
  .tag { color: #94a3b8; font-size: 1.1rem; margin: 0 0 32px; }
  .actions { display: flex; flex-wrap: wrap; gap: 14px; margin: 24px 0 36px; }
  a.btn { display: inline-block; padding: 14px 22px; border-radius: 10px; text-decoration: none; font-weight: 700; }
  a.primary { background: #38bdf8; color: #082f49; }
  a.secondary { background: #1e293b; color: #f8fafc; border: 1px solid #334155; }
  a.btn:focus-visible { outline: 3px solid #fde047; outline-offset: 3px; }
  section { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 24px; margin-bottom: 20px; }
  h2 { margin-top: 0; font-size: 1.3rem; }
  code { background: #0f172a; padding: 2px 6px; border-radius: 4px; }
  ul, ol { padding-left: 20px; }
  li { margin: 6px 0; }
  a { color: #7dd3fc; }
</style>
</head>
<body>
<main>
  <h1>iBrowse v0.2.0</h1>
  <p class="tag">Hear any website. Explore it by mouse, touch, keyboard, and voice — built for blind and low-vision users.</p>

  <div class="actions">
    <a class="btn primary" href="/download/ibrowse-0.2.0-chrome.zip">Download Extension (.zip)</a>
    <a class="btn secondary" href="/presentation/">Open Presentation</a>
    <a class="btn secondary" href="/demo/">Try Browser Demo</a>
    <a class="btn secondary" href="/USER_GUIDE.md">User Guide</a>
  </div>

  <section aria-labelledby="install-heading">
    <h2 id="install-heading">Quick Install (Chrome, Edge, Brave — Windows &amp; macOS)</h2>
    <ol>
      <li>Download <a href="/download/ibrowse-0.2.0-chrome.zip"><code>ibrowse-0.2.0-chrome.zip</code></a> and unzip it to a folder.</li>
      <li>Open <code>chrome://extensions</code> (or <code>edge://extensions</code> / <code>brave://extensions</code>).</li>
      <li>Enable <strong>Developer mode</strong>, click <strong>Load unpacked</strong>, and select the unzipped folder.</li>
      <li>A spoken page opens and asks <em>"Do you use a screen reader?"</em> (<code>Y</code> for Companion/NVDA/VoiceOver, <code>N</code> for Standalone).</li>
      <li>Press <strong><code>Alt+I</code></strong> (or click the toolbar button) on any website to turn on Explore Mode.</li>
    </ol>
  </section>

  <section aria-labelledby="links-heading">
    <h2 id="links-heading">Documentation &amp; Resources</h2>
    <ul>
      <li><a href="/presentation/">Interactive 13-Slide Presentation</a> &middot; <a href="/presentation/iBrowse-presentation.pdf">Download PDF</a></li>
      <li><a href="/media/ibrowse-demo.mp4">Demo Video (MP4 with audio)</a></li>
      <li><a href="/USER_GUIDE.md">Installation &amp; Multi-Platform User Guide</a></li>
      <li><a href="/FEATURES.md">Complete Feature List</a></li>
      <li><a href="https://github.com/srksourabh/ibrowse">GitHub Repository</a> &middot; <a href="https://github.com/srksourabh/ibrowse/releases/tag/v0.2.0">GitHub Release v0.2.0</a></li>
    </ul>
  </section>
</main>
</body>
</html>`

function safeResolve(baseDir, relPath) {
  const full = path.resolve(baseDir, relPath)
  return full.startsWith(baseDir + path.sep) || full === baseDir ? full : null
}

function serveFile(req, res, filePath, extraHeaders = {}) {
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
  }
  let target = filePath
  let stat = statSync(target)
  if (stat.isDirectory()) {
    target = path.join(target, 'index.html')
    if (!existsSync(target)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
    stat = statSync(target)
  }

  const ext = path.extname(target).toLowerCase()
  const contentType = MIME[ext] || 'application/octet-stream'
  const range = req.headers.range

  if (range && ext === '.mp4') {
    const match = /bytes=(\d*)-(\d*)/.exec(range)
    const start = match?.[1] ? Number(match[1]) : 0
    const end = match?.[2] ? Number(match[2]) : stat.size - 1
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': contentType,
      ...extraHeaders,
    })
    createReadStream(target, { start, end }).pipe(res)
    return
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Accept-Ranges': 'bytes',
    ...extraHeaders,
  })
  createReadStream(target).pipe(res)
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const pathname = decodeURIComponent(url.pathname)

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', version: '0.2.0' }))
    return
  }

  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(HOME_HTML)
    return
  }

  if (pathname === '/download/ibrowse-0.2.0-chrome.zip' || pathname === '/download') {
    serveFile(req, res, zipFile, {
      'Content-Disposition': 'attachment; filename="ibrowse-0.2.0-chrome.zip"',
    })
    return
  }

  if (pathname === '/demo' || pathname === '/presentation') {
    res.writeHead(301, { Location: `${pathname}/` })
    res.end()
    return
  }

  if (pathname.startsWith('/demo/')) {
    const rel = pathname.replace(/^\/demo\/?/, '')
    serveFile(req, res, safeResolve(demoDir, rel))
    return
  }

  const rel = pathname.replace(/^\/+/, '')
  serveFile(req, res, safeResolve(docsDir, rel))
})

server.listen(port, '0.0.0.0', () => {
  console.log(`iBrowse server listening on http://0.0.0.0:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
