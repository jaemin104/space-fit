import { createServer } from 'node:http'
import { ApiError, extractOrderPreferencesWithGemini, recommendWithGemini } from './cargoAi.js'

const port = Number(process.env.SERVER_PORT ?? 3001)
const endpoints = new Map([
  ['/api/recommend-combinations', recommendWithGemini],
  ['/api/extract-order-preferences', extractOrderPreferencesWithGemini],
])

const KAKAO_DIRECTIONS_URL = 'https://apis-navi.kakaomobility.com/v1/directions'
const MAX_WAYPOINTS = 5
const DIRECTIONS_TIMEOUT_MS = 12_000

function parseCoordinate(value) {
  if (!value) return null
  const parts = value.split(',')
  if (parts.length !== 2) return null

  const lng = Number(parts[0])
  const lat = Number(parts[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  if (lng < -180 || lng > 180) return null
  if (lat < -90 || lat > 90) return null

  return { lng, lat }
}

function parseWaypoints(value) {
  if (!value) return []

  const parts = value.split('|')
  if (parts.length > MAX_WAYPOINTS) return null

  const points = []
  for (const part of parts) {
    const point = parseCoordinate(part)
    if (!point) return null
    points.push(point)
  }
  return points
}

function toCoordString(point) {
  return `${point.lng},${point.lat}`
}

function normalizeVertexes(vertexes) {
  const path = []
  for (let index = 0; index + 1 < vertexes.length; index += 2) {
    path.push({ longitude: vertexes[index], latitude: vertexes[index + 1] })
  }
  return path
}

function normalizeRoute(route) {
  const path = []
  const guides = []
  const sections = route.sections ?? []

  for (const section of sections) {
    const roads = section.roads ?? []
    for (const road of roads) {
      path.push(...normalizeVertexes(road.vertexes ?? []))
    }

    const sectionGuides = section.guides ?? []
    for (const guide of sectionGuides) {
      guides.push({
        name: guide.name ?? '',
        guidance: guide.guidance ?? '',
        distanceMeters: guide.distance ?? 0,
        durationSeconds: guide.duration ?? 0,
        longitude: guide.x,
        latitude: guide.y,
      })
    }
  }

  return {
    distanceMeters: route.summary?.distance ?? 0,
    durationSeconds: route.summary?.duration ?? 0,
    path,
    guides,
  }
}

async function handleDirections(request, response, url) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return sendJson(response, 405, { message: 'GET 요청만 지원합니다.' })
  }

  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey) {
    return sendJson(response, 503, { message: '서버에 KAKAO_REST_API_KEY가 설정되어 있지 않습니다.' })
  }

  const origin = parseCoordinate(url.searchParams.get('origin'))
  const destination = parseCoordinate(url.searchParams.get('destination'))
  const waypoints = parseWaypoints(url.searchParams.get('waypoints'))

  if (!origin || !destination || waypoints === null) {
    return sendJson(response, 400, {
      message: '출발지·목적지·경유지 좌표를 확인해주세요. (경도,위도 형식, 경유지 최대 5개)',
    })
  }

  const kakaoUrl = new URL(KAKAO_DIRECTIONS_URL)
  kakaoUrl.searchParams.set('origin', toCoordString(origin))
  kakaoUrl.searchParams.set('destination', toCoordString(destination))
  if (waypoints.length > 0) {
    kakaoUrl.searchParams.set('waypoints', waypoints.map(toCoordString).join('|'))
  }
  kakaoUrl.searchParams.set('priority', 'RECOMMEND')
  kakaoUrl.searchParams.set('summary', 'false')
  kakaoUrl.searchParams.set('alternatives', 'false')
  kakaoUrl.searchParams.set('road_details', 'false')

  try {
    const kakaoResponse = await fetch(kakaoUrl, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(DIRECTIONS_TIMEOUT_MS),
    })

    const data = await kakaoResponse.json()

    if (!kakaoResponse.ok) {
      const message = data?.msg ?? data?.message ?? 'Kakao Directions 요청이 실패했습니다.'
      return sendJson(response, kakaoResponse.status, { message })
    }

    const route = data?.routes?.[0]
    if (!route || route.result_code !== 0) {
      const message = route?.result_msg ?? '경로를 찾을 수 없습니다.'
      return sendJson(response, 422, { message })
    }

    return sendJson(response, 200, normalizeRoute(route))
  } catch (error) {
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    console.error('[server/directions]', isTimeout ? 'timeout' : (error?.message ?? error))
    return sendJson(response, 502, {
      message: isTimeout
        ? 'Kakao Directions 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.'
        : '경로를 불러오는 중 오류가 발생했습니다.',
    })
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  if (request.method === 'GET' && requestUrl.pathname === '/api/health') {
    return sendJson(response, 200, {
      ok: true,
      geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      kakaoKeyConfigured: Boolean(process.env.KAKAO_REST_API_KEY),
    })
  }

  if (requestUrl.pathname === '/api/directions') {
    return handleDirections(request, response, requestUrl)
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
  console.log(`Cargo AI + Directions server: http://localhost:${port}`)
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
