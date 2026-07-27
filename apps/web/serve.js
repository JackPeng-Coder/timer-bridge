import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = 8080
const root = fileURLToPath(new URL('./dist', import.meta.url))

const MIME = {
  '.html': 'text/html',
  '.js':  'application/javascript',
  '.css': 'text/css',
}

createServer((req, res) => {
  let path = req.url === '/' ? `${root}/index.html` : `${root}${req.url}`
  if (!existsSync(path)) path = `${root}/index.html`
  const content = readFileSync(path)
  const ext = extname(path)
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' })
  res.end(content)
}).listen(PORT, () => {
  console.log(`Timer Bridge Web: http://localhost:${PORT}`)
})
