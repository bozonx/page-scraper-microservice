import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const htmlPath = join(__dirname, 'examples', 'test-page.html')
const htmlContent = readFileSync(htmlPath, 'utf-8')

export function startTestServer(port = 8080) {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(htmlContent)
  })
  
  server.listen(port)
  return server
}
