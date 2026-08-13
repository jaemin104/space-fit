let kakaoMapsPromise: Promise<typeof kakao> | null = null

export function loadKakaoMaps(): Promise<typeof kakao> {
  if (typeof window !== 'undefined' && window.kakao?.maps) {
    return Promise.resolve(window.kakao)
  }

  if (kakaoMapsPromise) {
    return kakaoMapsPromise
  }

  kakaoMapsPromise = new Promise((resolve, reject) => {
    const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY

    if (!appKey) {
      kakaoMapsPromise = null
      reject(new Error('카카오 지도 앱 키(VITE_KAKAO_MAP_APP_KEY)가 설정되지 않았습니다.'))
      return
    }

    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.async = true
    script.onload = () => {
      window.kakao.maps.load(() => resolve(window.kakao))
    }
    script.onerror = () => {
      kakaoMapsPromise = null
      reject(new Error('카카오 지도 SDK를 불러오지 못했습니다.'))
    }
    document.head.appendChild(script)
  })

  return kakaoMapsPromise
}
