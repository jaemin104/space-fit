import { useEffect, useRef, useState } from 'react'
import { loadKakaoMaps } from '../utils/loadKakaoMaps'
import { fetchDirections } from '../utils/fetchDirections'

export interface RouteStop {
  id: string
  name: string
  lat: number
  lng: number
  kind: 'pickup' | 'dropoff'
  label: string
}

interface KakaoRouteMapProps {
  stops: RouteStop[]
  initialFullscreen?: boolean
  onClose?: () => void
}

type LoadStatus = 'loading' | 'ready' | 'error'

function KakaoRouteMap({ stops, initialFullscreen = false, onClose }: KakaoRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<kakao.maps.Map | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [fullscreen, setFullscreen] = useState(initialFullscreen)
  const [routeSummary, setRouteSummary] = useState<{ distanceMeters: number; durationSeconds: number } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const kakaoSdk = await loadKakaoMaps()
        if (cancelled || !containerRef.current || stops.length === 0) return

        const map = new kakaoSdk.maps.Map(containerRef.current, {
          center: new kakaoSdk.maps.LatLng(stops[0].lat, stops[0].lng),
          level: 7,
        })
        mapRef.current = map
        map.addControl(new kakaoSdk.maps.ZoomControl(), kakaoSdk.maps.ControlPosition.RIGHT)

        const initialBounds = new kakaoSdk.maps.LatLngBounds()
        stops.forEach((stop) => {
          const position = new kakaoSdk.maps.LatLng(stop.lat, stop.lng)
          initialBounds.extend(position)
          const overlay = new kakaoSdk.maps.CustomOverlay({
            position,
            content: `<div class="kakao-route-marker ${stop.kind}">${stop.label}</div>`,
            yAnchor: 0.5,
          })
          overlay.setMap(map)
        })
        map.setBounds(initialBounds)

        const [origin, ...rest] = stops
        const destination = rest[rest.length - 1]
        const waypoints = rest.slice(0, -1)

        const directions = await fetchDirections(
          { lat: origin.lat, lng: origin.lng },
          { lat: destination.lat, lng: destination.lng },
          waypoints.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
        )

        if (cancelled) return

        if (directions.path.length > 0) {
          const path = directions.path.map((point) => new kakaoSdk.maps.LatLng(point.latitude, point.longitude))
          const polyline = new kakaoSdk.maps.Polyline({
            path,
            strokeWeight: 5,
            strokeColor: '#4d7bf3',
            strokeOpacity: 0.9,
            strokeStyle: 'solid',
          })
          polyline.setMap(map)

          const routeBounds = new kakaoSdk.maps.LatLngBounds()
          path.forEach((point) => routeBounds.extend(point))
          map.setBounds(routeBounds)
        }

        setRouteSummary({ distanceMeters: directions.distanceMeters, durationSeconds: directions.durationSeconds })
        setStatus('ready')
      } catch (error) {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : '지도를 불러오지 못했습니다.')
        setStatus('error')
      }
    }

    run()

    return () => {
      cancelled = true
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.map((stop) => stop.id).join(',')])

  useEffect(() => {
    if (!mapRef.current) return
    const timer = setTimeout(() => mapRef.current?.relayout(), 200)
    return () => clearTimeout(timer)
  }, [fullscreen])

  const handleToggle = () => {
    if (fullscreen && onClose) {
      onClose()
      return
    }
    setFullscreen((value) => !value)
  }

  return (
    <div className={`kakao-route-wrap${fullscreen ? ' fullscreen' : ''}`}>
      <div ref={containerRef} className="kakao-route-canvas" />

      {status === 'loading' && <div className="kakao-route-status">경로를 불러오는 중...</div>}
      {status === 'error' && <div className="kakao-route-status error">{errorMessage}</div>}
      {status === 'ready' && routeSummary && (
        <div className="kakao-route-summary">
          총 {(routeSummary.distanceMeters / 1000).toFixed(1)}km · 약 {Math.round(routeSummary.durationSeconds / 60)}분
        </div>
      )}

      <button type="button" className="kakao-route-toggle" onClick={handleToggle}>
        {fullscreen ? '× 지도 닫기' : '지도 전체보기'}
      </button>
    </div>
  )
}

export default KakaoRouteMap
