export interface DirectionsCoordinate {
  lat: number
  lng: number
}

export interface DirectionsLatLng {
  latitude: number
  longitude: number
}

export interface DirectionsGuide {
  name: string
  guidance: string
  distanceMeters: number
  durationSeconds: number
  longitude: number
  latitude: number
}

export interface DirectionsResponse {
  distanceMeters: number
  durationSeconds: number
  path: DirectionsLatLng[]
  guides: DirectionsGuide[]
}

const MAX_WAYPOINTS = 5

function toCoordParam(point: DirectionsCoordinate) {
  return `${point.lng},${point.lat}`
}

export async function fetchDirections(
  origin: DirectionsCoordinate,
  destination: DirectionsCoordinate,
  waypoints: DirectionsCoordinate[] = [],
): Promise<DirectionsResponse> {
  if (waypoints.length > MAX_WAYPOINTS) {
    throw new Error(`경유지는 최대 ${MAX_WAYPOINTS}개까지 가능합니다.`)
  }

  const params = new URLSearchParams({
    origin: toCoordParam(origin),
    destination: toCoordParam(destination),
  })

  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(toCoordParam).join('|'))
  }

  const response = await fetch(`/api/directions?${params.toString()}`)
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = data && typeof data.message === 'string' ? data.message : '경로를 불러오지 못했습니다.'
    throw new Error(message)
  }

  if (!data || !Array.isArray(data.path)) {
    throw new Error('경로 응답 형식이 올바르지 않습니다. (/api/directions 서버가 실행 중인지 확인해주세요)')
  }

  return data as DirectionsResponse
}
