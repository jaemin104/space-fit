import { useEffect, useRef, useState } from 'react'
import { loadKakaoMaps } from '../utils/loadKakaoMaps'
import { fetchDirections } from '../utils/fetchDirections'

export interface NavigationRouteInfo {
  distanceMeters: number
  durationSeconds: number
  nextGuidance: string
  nextRoadName: string
  nextGuidanceDistanceMeters: number
  arrived: boolean
}

interface NavigationDestination {
  lat: number
  lng: number
  name: string
}

interface KakaoLiveNavigationMapProps {
  destination: NavigationDestination
  onRouteInfoChange?: (info: NavigationRouteInfo | null) => void
  dimmed?: boolean
}

const ARRIVAL_THRESHOLD_METERS = 60
const MIN_REFETCH_DISTANCE_METERS = 25
const MIN_REFETCH_INTERVAL_MS = 6000

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadius = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

type Status = 'locating' | 'loading' | 'ready' | 'error'

function KakaoLiveNavigationMap({ destination, onRouteInfoChange, dimmed }: KakaoLiveNavigationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<kakao.maps.Map | null>(null)
  const kakaoSdkRef = useRef<typeof kakao | null>(null)
  const meOverlayRef = useRef<kakao.maps.CustomOverlay | null>(null)
  const polylineRef = useRef<kakao.maps.Polyline | null>(null)
  const lastFetchRef = useRef<{ position: { lat: number; lng: number } | null; time: number }>({ position: null, time: 0 })

  const geolocationSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const [status, setStatus] = useState<Status>(geolocationSupported ? 'locating' : 'error')
  const [errorMessage, setErrorMessage] = useState(geolocationSupported ? '' : '이 기기에서는 위치 정보를 사용할 수 없습니다.')
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [summary, setSummary] = useState<NavigationRouteInfo | null>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    loadKakaoMaps()
      .then((kakaoSdk) => {
        if (cancelled || !containerRef.current) return
        kakaoSdkRef.current = kakaoSdk

        const map = new kakaoSdk.maps.Map(containerRef.current, {
          center: new kakaoSdk.maps.LatLng(destination.lat, destination.lng),
          level: 5,
        })
        mapRef.current = map

        const destOverlay = new kakaoSdk.maps.CustomOverlay({
          position: new kakaoSdk.maps.LatLng(destination.lat, destination.lng),
          content: '<div class="live-nav-marker dest"><span>상차지</span></div>',
          yAnchor: 1.6,
        })
        destOverlay.setMap(map)
        setMapReady(true)
      })
      .catch((error) => {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : '지도를 불러오지 못했습니다.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [destination.lat, destination.lng])

  useEffect(() => {
    if (!('geolocation' in navigator)) return

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition({ lat: position.coords.latitude, lng: position.coords.longitude })
      },
      (geoError) => {
        setErrorMessage(
          geoError.code === geoError.PERMISSION_DENIED
            ? '위치 권한을 허용해주세요.'
            : '현재 위치를 가져오지 못했습니다.',
        )
        setStatus('error')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => {
    if (!currentPosition || !mapReady) return
    const kakaoSdk = kakaoSdkRef.current
    const map = mapRef.current
    if (!kakaoSdk || !map) return

    const position = new kakaoSdk.maps.LatLng(currentPosition.lat, currentPosition.lng)
    if (!meOverlayRef.current) {
      meOverlayRef.current = new kakaoSdk.maps.CustomOverlay({
        position,
        content: '<div class="live-nav-marker me"></div>',
        yAnchor: 0.5,
      })
      meOverlayRef.current.setMap(map)
    } else {
      meOverlayRef.current.setPosition(position)
    }

    const last = lastFetchRef.current
    if (last.position) {
      const moved = haversineMeters(last.position, currentPosition)
      const elapsed = Date.now() - last.time
      if (moved < MIN_REFETCH_DISTANCE_METERS && elapsed < MIN_REFETCH_INTERVAL_MS) {
        return
      }
    }

    lastFetchRef.current = { position: currentPosition, time: Date.now() }
    setStatus((current) => (current === 'ready' ? current : 'loading'))

    fetchDirections(currentPosition, { lat: destination.lat, lng: destination.lng })
      .then((directions) => {
        const path = directions.path.map((point) => new kakaoSdk.maps.LatLng(point.latitude, point.longitude))
        if (polylineRef.current) polylineRef.current.setMap(null)
        polylineRef.current = new kakaoSdk.maps.Polyline({
          path,
          strokeWeight: 6,
          strokeColor: '#2563eb',
          strokeOpacity: 0.9,
          strokeStyle: 'solid',
        })
        polylineRef.current.setMap(map)

        const bounds = new kakaoSdk.maps.LatLngBounds()
        bounds.extend(position)
        bounds.extend(new kakaoSdk.maps.LatLng(destination.lat, destination.lng))
        map.setBounds(bounds, 70, 40, 70, 40)

        const arrived = directions.distanceMeters <= ARRIVAL_THRESHOLD_METERS
        // Kakao guides[0] is always the "출발지"(current position) marker with distanceMeters 0;
        // guides[i].distanceMeters is the distance traveled *from* guides[i-1] *to* guides[i],
        // so the upcoming maneuver and its remaining distance both live on guides[1].
        const guides = directions.guides
        const upcomingGuide = guides[1] ?? guides[0]
        const roadNameGuide = guides.slice(1).find((guide) => guide.name)
        const info: NavigationRouteInfo = {
          distanceMeters: directions.distanceMeters,
          durationSeconds: directions.durationSeconds,
          nextGuidance: arrived ? '도착' : upcomingGuide?.guidance || '직진',
          nextRoadName: roadNameGuide?.name || destination.name,
          nextGuidanceDistanceMeters: Math.round(upcomingGuide?.distanceMeters ?? directions.distanceMeters),
          arrived,
        }
        setSummary(info)
        onRouteInfoChange?.(info)
        setStatus('ready')
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : '경로를 불러오지 못했습니다.')
        setStatus('error')
        onRouteInfoChange?.(null)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition, mapReady])

  return (
    <div className={`live-nav-map-wrap${dimmed ? ' dimmed' : ''}`}>
      <div ref={containerRef} className="live-nav-map-canvas" />
      {(status === 'locating' || status === 'loading') && (
        <div className="live-nav-map-status">
          {status === 'locating' ? '내 위치를 확인하는 중...' : '경로를 불러오는 중...'}
        </div>
      )}
      {status === 'error' && <div className="live-nav-map-status error">{errorMessage}</div>}
      {status === 'ready' && summary && (
        <div className="live-nav-map-chip">
          {destination.name}까지 {(summary.distanceMeters / 1000).toFixed(1)}km
        </div>
      )}
    </div>
  )
}

export default KakaoLiveNavigationMap
