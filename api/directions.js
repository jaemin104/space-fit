const KAKAO_DIRECTIONS_URL = 'https://apis-navi.kakaomobility.com/v1/directions'
const MAX_WAYPOINTS = 5
const TIMEOUT_MS = 12_000

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

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ message: 'GET 요청만 지원합니다.' })
  }

  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey) {
    return response.status(503).json({ message: '서버에 KAKAO_REST_API_KEY가 설정되어 있지 않습니다.' })
  }

  const url = new URL(request.url, 'https://localhost')
  const origin = parseCoordinate(url.searchParams.get('origin'))
  const destination = parseCoordinate(url.searchParams.get('destination'))
  const waypoints = parseWaypoints(url.searchParams.get('waypoints'))

  if (!origin || !destination || waypoints === null) {
    return response.status(400).json({
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
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const data = await kakaoResponse.json()

    if (!kakaoResponse.ok) {
      const message = data?.msg ?? data?.message ?? 'Kakao Directions 요청이 실패했습니다.'
      return response.status(kakaoResponse.status).json({ message })
    }

    const route = data?.routes?.[0]
    if (!route || route.result_code !== 0) {
      const message = route?.result_msg ?? '경로를 찾을 수 없습니다.'
      return response.status(422).json({ message })
    }

    return response.status(200).json(normalizeRoute(route))
  } catch (error) {
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    console.error('[api/directions]', isTimeout ? 'timeout' : (error?.message ?? error))
    return response.status(502).json({
      message: isTimeout
        ? 'Kakao Directions 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.'
        : '경로를 불러오는 중 오류가 발생했습니다.',
    })
  }
}
