export {}

declare global {
  namespace kakao.maps {
    class LatLng {
      constructor(lat: number, lng: number)
      getLat(): number
      getLng(): number
    }

    class LatLngBounds {
      constructor()
      extend(latlng: LatLng): LatLngBounds
    }

    interface MapOptions {
      center: LatLng
      level?: number
    }

    class Map {
      constructor(container: HTMLElement, options: MapOptions)
      setBounds(bounds: LatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void
      setCenter(latlng: LatLng): void
      getLevel(): number
      setLevel(level: number): void
      relayout(): void
      addControl(control: ZoomControl, position: number): void
    }

    class ZoomControl {
      constructor()
    }

    const ControlPosition: {
      TOP: number
      TOPLEFT: number
      TOPRIGHT: number
      LEFT: number
      RIGHT: number
      BOTTOMLEFT: number
      BOTTOM: number
      BOTTOMRIGHT: number
    }

    interface PolylineOptions {
      path: LatLng[]
      strokeWeight?: number
      strokeColor?: string
      strokeOpacity?: number
      strokeStyle?: string
    }

    class Polyline {
      constructor(options: PolylineOptions)
      setMap(map: Map | null): void
    }

    interface CustomOverlayOptions {
      position: LatLng
      content: string | HTMLElement
      xAnchor?: number
      yAnchor?: number
      zIndex?: number
    }

    class CustomOverlay {
      constructor(options: CustomOverlayOptions)
      setMap(map: Map | null): void
      setPosition(position: LatLng): void
    }

    function load(callback: () => void): void
  }

  interface Window {
    kakao: typeof kakao
  }

  const kakao: {
    maps: typeof kakao.maps
  }
}
