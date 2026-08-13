import { createServer } from 'node:http'
import { analyzeRiskWithGemini, ApiError, extractOrderPreferencesWithGemini, recommendWithGemini } from './cargoAi.js'

const port = Number(process.env.SERVER_PORT ?? 3001)
const endpoints = new Map([
  ['/api/recommend-combinations', recommendWithGemini],
  ['/api/analyze-cargo-risk', analyzeRiskWithGemini],
  ['/api/extract-order-preferences', extractOrderPreferencesWithGemini],
])

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  if (request.method === 'GET' && requestUrl.pathname === '/api/health') {
    return sendJson(response, 200, { ok: true, geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY) })
  }

  const handler = endpoints.get(requestUrl.pathname)
  if (request.method === 'POST' && handler) {
    try {
      return sendJson(response, 200, await handler(await readJson(request)))
    } catch (error) {
      console.error('[cargo-ai]', error)
      return sendJson(response, error instanceof ApiError ? error.statusCode : 500, { message: error instanceof Error ? error.message : 'AI 분석 중 오류가 발생했습니다.' })
    }
  }

  return sendJson(response, 404, { message: '요청한 API를 찾을 수 없습니다.' })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Cargo AI server: http://localhost:${port}`)
})

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1_000_000) throw new ApiError(413, '요청 데이터가 너무 큽니다.')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') }
  catch { throw new ApiError(400, 'JSON 요청 형식을 확인해 주세요.') }
}
