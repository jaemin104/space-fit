import { createServer } from 'node:http'
import { analyzeRiskWithGemini, ApiError, recommendWithGemini } from './cargoAi.js'

const port = Number(process.env.SERVER_PORT ?? 3001)
const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  if (request.method === 'GET' && requestUrl.pathname === '/api/health') {
    return sendJson(response, 200, { ok: true, kakaoKeyConfigured: Boolean(kakaoRestApiKey) })
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/directions') {
    if (!kakaoRestApiKey) {
      return sendJson(response, 503, { message: '.env.server에 KAKAO_REST_API_KEY를 설정해 주세요.' })
    }

    const origin = parseCoordinate(requestUrl.searchParams.get('origin'))
    const destination = parseCoordinate(requestUrl.searchParams.get('destination'))
    const waypoints = parseWaypoints(requestUrl.searchParams.get('waypoints'))

    if (!origin || !destination || waypoints === null) {
      return sendJson(response, 400, { message: '출발지, 목적지, 경유지 좌표 형식을 확인해 주세요.' })
    }

    try {
      const kakaoUrl = new URL('https://apis-navi.kakaomobility.com/v1/directions')
      kakaoUrl.searchParams.set('origin', `${origin.longitude},${origin.latitude}`)
      kakaoUrl.searchParams.set('destination', `${destination.longitude},${destination.latitude}`)
      if (waypoints.length > 0) {
        kakaoUrl.searchParams.set('waypoints', waypoints.map((point) => `${point.longitude},${point.latitude}`).join('|'))
      }
      kakaoUrl.searchParams.set('priority', 'RECOMMEND')
      kakaoUrl.searchParams.set('summary', 'false')
      kakaoUrl.searchParams.set('alternatives', 'false')
      kakaoUrl.searchParams.set('road_details', 'false')

      const kakaoResponse = await fetch(kakaoUrl, {
        headers: {
          Authorization: `KakaoAK ${kakaoRestApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(12_000),
      })
      const kakaoResult = await kakaoResponse.json()

      if (!kakaoResponse.ok) {
        return sendJson(response, kakaoResponse.status, {
          message: kakaoResult.msg ?? kakaoResult.message ?? '카카오 길찾기 요청에 실패했습니다.',
        })
      }

      const route = kakaoResult.routes?.[0]
      if (!route || route.result_code !== 0) {
        return sendJson(response, 422, { message: route?.result_msg ?? '자동차 경로를 찾지 못했습니다.' })
      }

      return sendJson(response, 200, {
        distanceMeters: route.summary.distance,
        durationSeconds: route.summary.duration,
        path: extractPath(route.sections),
        guides: extractGuides(route.sections),
      })
    } catch (error) {
      const message = error instanceof Error && error.name === 'TimeoutError'
        ? '카카오 길찾기 응답 시간이 초과되었습니다.'
        : '길찾기 서버 요청 중 오류가 발생했습니다.'
      console.error('[directions]', error)
      return sendJson(response, 502, { message })
    }
  }

  if (request.method === 'POST' && ['/api/recommend-combinations', '/api/analyze-cargo-risk'].includes(requestUrl.pathname)) {
    try {
      const body = await readJson(request)
      const result = requestUrl.pathname === '/api/recommend-combinations'
        ? await recommendWithGemini(body)
        : await analyzeRiskWithGemini(body)
      return sendJson(response, 200, result)
    } catch (error) {
      console.error('[cargo-ai]', error)
      return sendJson(response, error instanceof ApiError ? error.statusCode : 500, { message: error instanceof Error ? error.message : 'AI 분석 중 오류가 발생했습니다.' })
    }
  }

  return sendJson(response, 404, { message: '요청한 API를 찾을 수 없습니다.' })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Directions server: http://localhost:${port}`)
})

function parseCoordinate(value) {
  if (!value) return null
  const [longitudeText, latitudeText] = value.split(',')
  const longitude = Number(longitudeText)
  const latitude = Number(latitudeText)
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null
  return { longitude, latitude }
}

function parseWaypoints(value) {
  if (!value) return []
  const points = value.split('|').map(parseCoordinate)
  if (points.length > 5 || points.some((point) => point === null)) return null
  return points
}

function extractPath(sections = []) {
  return sections.flatMap((section) =>
    (section.roads ?? []).flatMap((road) => {
      const points = []
      for (let index = 0; index < road.vertexes.length; index += 2) {
        points.push({ longitude: road.vertexes[index], latitude: road.vertexes[index + 1] })
      }
      return points
    }),
  )
}

function extractGuides(sections = []) {
  return sections.flatMap((section) =>
    (section.guides ?? []).map((guide) => ({
      name: guide.name,
      guidance: guide.guidance,
      distanceMeters: guide.distance,
      durationSeconds: guide.duration,
      longitude: guide.x,
      latitude: guide.y,
    })),
  )
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
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
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    throw new ApiError(400, 'JSON 요청 형식을 확인해 주세요.')
  }
}
