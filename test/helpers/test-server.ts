import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const htmlPath = join(__dirname, '../e2e/examples', 'test-page.html')
const htmlContent = readFileSync(htmlPath, 'utf-8')
const rssContent = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Test</title><item><title>Hello</title></item></channel></rss>`

export function startTestServer(port = 0) {
  const server = createServer((req, res) => {
    const url = req.url ?? '/'
    if (url.startsWith('/redirect')) {
      res.writeHead(302, { Location: '/test-page' })
      res.end()
      return
    }

    if (url.startsWith('/rss')) {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' })
      res.end(rssContent)
      return
    }

    if (url.startsWith('/test-page') || url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(htmlContent)
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  })

  server.listen(port)
  return server
}
