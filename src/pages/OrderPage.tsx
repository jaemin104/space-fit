import { Fragment, useEffect, useMemo, useState } from 'react'
import KakaoRouteMap, { type RouteStop } from '../components/KakaoRouteMap'
import KakaoLiveNavigationMap, { type NavigationRouteInfo } from '../components/KakaoLiveNavigationMap'
import PhotoPicker from '../components/PhotoPicker'
import { usePhotoPreview } from '../utils/usePhotoPreview'
import './pages.css'
import VoiceOrderPreferences from '../components/VoiceOrderPreferences'
import { driverOperation, mockOrders, nearestHub, resolveLocation, type CargoOrder, type DriverOperation } from '../data/mockOrders'
import { buildCandidateCombinations, type CandidateCombination, type CargoRisk as AiCargoRisk } from '../utils/cargoRecommendation'
import { recommendCargoCombinations, type OrderPreferences } from '../utils/fetchCargoAi'
import { useAppData } from '../context/useAppData'

type CargoRisk = 'safe' | 'caution' | 'danger'

interface RoutePoint {
  name: string
  lat: number
  lng: number
}

export interface RouteItem {
  id: string
  name: string
  pickup: RoutePoint
  dropoff: RoutePoint
  volume: number
  weight: number
  price: number
  risk: CargoRisk
  riskNote: string
  riskFlag?: string
}

export interface RecommendedCombination {
  id: string
  title: string
  aiRecommended: boolean
  extraDistanceKm: number
  extraTimeMin: number
  expectedNetProfit: number
  volumeLoadRate: number
  weightLoadRate: number
  orders: RouteItem[]
  aiReason?: string
  overallRisk?: AiCargoRisk
}

const VEHICLE_MAX_WEIGHT_KG = 1000

const designExamples: RecommendedCombination[] = [
  {
    id: 'combo-1',
    title: '성남 복귀 방면 조합',
    aiRecommended: true,
    extraDistanceKm: 4.2,
    extraTimeMin: 11,
    expectedNetProfit: 92000,
    volumeLoadRate: 67,
    weightLoadRate: 58,
    orders: [
      {
        id: 'order-1a',
        name: '생활가전 박스 8개',
        pickup: { name: '수원시 팔달구', lat: 37.2636, lng: 127.0286 },
        dropoff: { name: '성남시 분당구', lat: 37.3826, lng: 127.1189 },
        volume: 2.1,
        weight: 340,
        price: 54000,
        risk: 'safe',
        riskNote: '파손 위험이 낮은 일반 화물입니다.',
      },
      {
        id: 'order-1b',
        name: '원단 롤 12개',
        pickup: { name: '화성시 동탄', lat: 37.2007, lng: 127.0724 },
        dropoff: { name: '성남시 중원구', lat: 37.4292, lng: 127.1378 },
        volume: 1.6,
        weight: 210,
        price: 48000,
        risk: 'caution',
        riskNote: '눌림에 약해 다른 화물과 적재 순서 확인이 필요합니다.',
        riskFlag: '눌림 주의 · 상단 적재 지양',
      },
    ],
  },
  {
    id: 'combo-2',
    title: '분당·기흥 경유 조합',
    aiRecommended: true,
    extraDistanceKm: 9.8,
    extraTimeMin: 22,
    expectedNetProfit: 118000,
    volumeLoadRate: 91,
    weightLoadRate: 82,
    orders: [
      {
        id: 'order-2a',
        name: '냉동 식품 박스',
        pickup: { name: '강남구', lat: 37.4979, lng: 127.0276 },
        dropoff: { name: '수원시 팔달구', lat: 37.2636, lng: 127.0286 },
        volume: 1.8,
        weight: 260,
        price: 41000,
        risk: 'caution',
        riskNote: '온도에 민감해 화학제품과 혼적하지 마세요.',
        riskFlag: '온도 민감 · 화학제품과 분리',
      },
      {
        id: 'order-2b',
        name: '유리 제품 세트',
        pickup: { name: '용인시 수지구', lat: 37.322, lng: 127.098 },
        dropoff: { name: '화성시 동탄', lat: 37.2007, lng: 127.0724 },
        volume: 1.4,
        weight: 180,
        price: 36000,
        risk: 'danger',
        riskNote: '파손 위험이 높아 단독 적재를 권장합니다.',
        riskFlag: '파손 위험 · 최상단 적재 필요',
      },
      {
        id: 'order-2c',
        name: '잡화 박스 20개',
        pickup: { name: '성남시 분당구', lat: 37.3826, lng: 127.1189 },
        dropoff: { name: '용인시 기흥구', lat: 37.2758, lng: 127.1153 },
        volume: 2.0,
        weight: 300,
        price: 41000,
        risk: 'safe',
        riskNote: '파손 위험이 낮은 일반 화물입니다.',
      },
    ],
  },
]

const ordersById = new Map(mockOrders.map((order) => [order.id, order]))
const allCandidates = buildCandidateCombinations(mockOrders, driverOperation)

function toRouteItem(order: CargoOrder, overallRisk: AiCargoRisk): RouteItem {
  const isFragile = order.riskTags.includes('fragile')
  const needsCaution = order.riskTags.includes('food') || order.riskTags.includes('chemical') || order.riskTags.includes('odor')
  const tone: CargoRisk = isFragile && overallRisk.level === 'high' ? 'danger' : needsCaution && overallRisk.level !== 'low' ? 'caution' : 'safe'
  return {
    id: order.id,
    name: order.cargoType,
    pickup: { name: order.pickup.name, lat: order.pickup.latitude, lng: order.pickup.longitude },
    dropoff: { name: order.dropoff.name, lat: order.dropoff.latitude, lng: order.dropoff.longitude },
    volume: order.volumeM3,
    weight: Math.round(order.weightTon * 1000),
    price: order.price,
    risk: tone,
    riskNote: overallRisk.reason,
    riskFlag: tone === 'danger' ? '파손 위험 · 최상단 적재 필요' : tone === 'caution' ? overallRisk.warnings[0] : undefined,
  }
}

function toCombination(candidate: CandidateCombination, index: number, ai?: { title: string; reason: string; risk: AiCargoRisk }, operation: DriverOperation = driverOperation): RecommendedCombination {
  const risk = ai?.risk ?? candidate.risk
  const orders = candidate.orderIds.map((id) => ordersById.get(id)).filter((order): order is CargoOrder => Boolean(order))
  return {
    id: `candidate-${candidate.id}-${index}`,
    title: ai?.title ?? `${orders.at(-1)?.dropoff.name ?? '복귀'} 방면 추천 조합`,
    aiRecommended: index === 0,
    extraDistanceKm: candidate.estimatedExtraKm,
    extraTimeMin: candidate.estimatedTimeMin,
    expectedNetProfit: candidate.totalPrice,
    volumeLoadRate: Math.round((operation.currentLoad.volumeM3 + candidate.totalVolumeM3) / operation.vehicle.maxVolumeM3 * 100),
    weightLoadRate: Math.round((operation.currentLoad.weightTon + candidate.totalWeightTon) / operation.vehicle.maxWeightTon * 100),
    orders: orders.map((order) => toRouteItem(order, risk)),
    aiReason: ai?.reason,
    overallRisk: risk,
  }
}

function filterCandidates(candidates: CandidateCombination[], preferences: OrderPreferences) {
  return candidates.filter((candidate) => {
    return (preferences.maxMinutes === null || candidate.estimatedTimeMin <= preferences.maxMinutes)
      && (preferences.maxDistanceKm === null || candidate.estimatedExtraKm <= preferences.maxDistanceKm)
      && (preferences.minPrice === null || candidate.totalPrice >= preferences.minPrice)
  })
}

const generatedFallback = allCandidates.slice(0, 3).map((candidate, index) => toCombination(candidate, index))
const fallbackCombinations = generatedFallback.length ? generatedFallback : designExamples

function withTopicParticle(word: string) {
  const lastChar = word.charCodeAt(word.length - 1)
  if (lastChar < 0xac00 || lastChar > 0xd7a3) return `${word}는`
  const hasBatchim = (lastChar - 0xac00) % 28 !== 0
  return `${word}${hasBatchim ? '은' : '는'}`
}

function buildRouteStops(combination: RecommendedCombination): RouteStop[] {
  return combination.orders.flatMap((order, index) => [
    {
      id: `${order.id}-pickup`,
      name: order.pickup.name,
      lat: order.pickup.lat,
      lng: order.pickup.lng,
      kind: 'pickup' as const,
      label: `상${index + 1}`,
    },
    {
      id: `${order.id}-dropoff`,
      name: order.dropoff.name,
      lat: order.dropoff.lat,
      lng: order.dropoff.lng,
      kind: 'dropoff' as const,
      label: `하${index + 1}`,
    },
  ])
}

function getRegionName(location: string) {
  return location.split(' ')[0].replace(/(특별시|광역시|특별자치시|시|군|구)$/u, '')
}

function getCombinationRouteTitle(combo: RecommendedCombination, returnDestination: string) {
  const home = getRegionName(returnDestination)
  const waypoints = [...new Set(combo.orders.flatMap((order) => [getRegionName(order.pickup.name), getRegionName(order.dropoff.name)]))].filter((region) => region !== home)
  return [home, ...waypoints, home].join(' → ')
}

function ComboCard({
  combo,
  routeTitle,
  onOpenRoute,
  onOpenDetail,
}: {
  combo: RecommendedCombination
  routeTitle: string
  onOpenRoute: () => void
  onOpenDetail: () => void
}) {
  return (
    <article className="combo-card">
      <header className="combo-card-head">
        <div>
          <h3>{routeTitle}</h3>
        </div>
        {combo.aiRecommended && <span className="ai-badge">AI 추천</span>}
      </header>
      <div className="combo-metrics">
        <div><span>추가 거리</span><strong>+{combo.extraDistanceKm}km</strong></div>
        <div><span>추가 시간</span><strong>+{combo.extraTimeMin}분</strong></div>
        <div><span>예상 순수익</span><strong className="profit">{combo.expectedNetProfit.toLocaleString()}원</strong></div>
      </div>
      <div className="combo-load-rates">
        <div className="load-rate">
          <span>부피</span>
          <div className="load-bar"><div style={{ width: `${combo.volumeLoadRate}%` }} /></div>
          <strong>{combo.volumeLoadRate}%</strong>
        </div>
        <div className="load-rate">
          <span>중량</span>
          <div className="load-bar"><div style={{ width: `${combo.weightLoadRate}%` }} /></div>
          <strong>{combo.weightLoadRate}%</strong>
        </div>
      </div>
      <div className="combo-actions">
        <button type="button" className="combo-action-outline" onClick={onOpenRoute}>경로 보기</button>
        <button type="button" className="combo-action-solid" onClick={onOpenDetail}>상세보기</button>
      </div>
    </article>
  )
}

function ComboRouteView({ combo, routeTitle, onBack }: { combo: RecommendedCombination; routeTitle: string; onBack: () => void }) {
  return (
    <div className="screen order-detail-screen">
      <header className="detail-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="목록으로 돌아가기">←</button>
        <h1>{routeTitle}</h1>
      </header>
      <KakaoRouteMap key={combo.id} stops={buildRouteStops(combo)} />
      <section className="combo-detail-summary">
        <div className="combo-metrics">
          <div><span>추가 거리</span><strong>+{combo.extraDistanceKm}km</strong></div>
          <div><span>추가 시간</span><strong>+{combo.extraTimeMin}분</strong></div>
          <div><span>예상 순수익</span><strong className="profit">{combo.expectedNetProfit.toLocaleString()}원</strong></div>
        </div>
      </section>
    </div>
  )
}

function ComboDetail({ combo, onBack, onAccept }: { combo: RecommendedCombination; onBack: () => void; onAccept: () => void }) {
  const totalPrice = combo.orders.reduce((sum, order) => sum + order.price, 0)
  const totalWeight = combo.orders.reduce((sum, order) => sum + order.weight, 0)
  const loadRate = Math.round((totalWeight / VEHICLE_MAX_WEIGHT_KG) * 100)
  const topLoadOrder = combo.orders.find((order) => order.risk === 'danger')
  const orderedOrders = [...combo.orders].sort((a, b) => Number(a.risk === 'danger') - Number(b.risk === 'danger'))
  const [showMap, setShowMap] = useState(false)

  return (
    <div className="screen order-detail-screen">
      <header className="detail-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="목록으로 돌아가기">←</button>
        <h1>조합 상세</h1>
        <button type="button" className="map-preview-button" onClick={() => setShowMap(true)}>지도 전체보기</button>
      </header>
      {showMap && (
        <KakaoRouteMap stops={buildRouteStops(combo)} initialFullscreen onClose={() => setShowMap(false)} />
      )}
      <section className="detail-hero">
        <span>{combo.orders.length}건 묶음 운송</span>
        <strong>{totalPrice.toLocaleString()}원</strong>
        <div className="detail-hero-row">
          <span>적재 {totalWeight}kg / {VEHICLE_MAX_WEIGHT_KG}kg</span>
          <span>적재율 {loadRate}%</span>
        </div>
      </section>
      <section className="combo-detail-orders">
        <h2>조합에 포함된 오더</h2>
        {orderedOrders.map((order, index) => (
          <article key={order.id} className={`detail-order-card risk-${order.risk}`}>
            <div className="detail-order-head">
              <span className={`order-letter risk-${order.risk}`}>{String.fromCharCode(65 + index)}</span>
              <strong>{order.name}</strong>
              <span className="detail-order-price">{order.price.toLocaleString()}원</span>
            </div>
            <p className="detail-order-route">목적지 · {order.dropoff.name}</p>
            <p className="detail-order-meta">중량 {order.weight}kg · 부피 {order.volume}m³</p>
            {order.risk !== 'safe' && (
              <div className="detail-order-flags">
                <span className={`flag-ai risk-${order.risk}`}>◆ 혼적판단 AI</span>
                <span className={`flag-note risk-${order.risk}`}>{order.riskFlag}</span>
              </div>
            )}
          </article>
        ))}
      </section>
      {topLoadOrder && (
        <section className="load-order-section">
          <h2>적재 순서</h2>
          <div className="load-order-box">
            <span className="load-order-hint">먼저 싣는 순서 → 가장 먼저 내리는 순서</span>
            <div className="load-order-steps">
              {orderedOrders.map((order, index) => (
                <Fragment key={order.id}>
                  {index > 0 && <span className="load-order-arrow">→</span>}
                  <div className={`load-order-step${order.id === topLoadOrder.id ? ' top' : ''}`}>
                    <span className="step-letter">{String.fromCharCode(65 + index)}</span>
                    <span>{order.name}</span>
                    {order.id === topLoadOrder.id && <em>최상단</em>}
                  </div>
                </Fragment>
              ))}
            </div>
            <p className="load-order-note">{withTopicParticle(topLoadOrder.name)} 파손 방지를 위해 다른 화물 위, 최상단에 적재해 주세요.</p>
          </div>
        </section>
      )}
      <div className="detail-accept-bar">
        <button type="button" className="accept-button" onClick={onAccept}>이 조합 수락하기</button>
      </div>
    </div>
  )
}

const loadingSteps = [
  { title: '운행 목표를 조건으로 정리 완료', note: '거리 · 목표 운임 · 운행 시간 기준' },
  { title: '혼적 적합성 확인 중', note: '남은 350kg과 주의 화물을 함께 검토' },
  { title: '목표에 맞는 조합 계산', note: '우회 거리와 예상 순수익을 비교' },
]

function LoadingScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step >= loadingSteps.length && ready) {
      const finish = setTimeout(onDone, 500)
      return () => clearTimeout(finish)
    }
    if (step >= loadingSteps.length) return
    const advance = setTimeout(() => setStep((current) => current + 1), 700)
    return () => clearTimeout(advance)
  }, [step, ready, onDone])

  return (
    <div className="screen order-loading-screen">
      <h1>추천 오더 계산 중</h1>
      <div className="loading-orb"><span>✦</span></div>
      <h2>AI가 운행 목표에 맞춰 조합을 찾고 있어요</h2>
      <p className="loading-sub">잠시만 기다려 주세요</p>
      <ul className="loading-steps">
        {loadingSteps.map((item, index) => (
          <li key={item.title} className={index < step ? 'done' : index === step ? 'active' : ''}>
            <span className="step-icon">{index < step ? '✓' : null}</span>
            <div>
              <strong>{item.title}</strong>
              <span>{item.note}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function arrowForGuidance(guidance: string) {
  if (guidance.includes('우회전')) return '↱'
  if (guidance.includes('좌회전')) return '↰'
  if (guidance.includes('유턴')) return '↩'
  if (guidance.includes('도착')) return '●'
  return '↑'
}

function formatToday() {
  const today = new Date()
  return `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`
}

function PickupNavigationView({
  combo,
  order,
  orderIndex,
  totalOrders,
  onBack,
  onPickupComplete,
}: {
  combo: RecommendedCombination
  order: RouteItem
  orderIndex: number
  totalOrders: number
  onBack: () => void
  onPickupComplete: () => void
}) {
  const [routeInfo, setRouteInfo] = useState<NavigationRouteInfo | null>(null)
  const [arrived, setArrived] = useState(false)
  const [pickupPhoto, setPickupPhoto] = useState<File | null>(null)
  const photoPreviewUrl = usePhotoPreview(pickupPhoto)

  return (
    <div className="screen live-nav-screen">
      <header className="live-nav-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="목록으로 돌아가기">←</button>
        <div className="live-nav-header-text">
          <span className="live-nav-badge">● GPS 실시간 운행 중</span>
          <h1>묶음 운송 {orderIndex + 1}/{totalOrders}</h1>
        </div>
        {routeInfo && (
          <div className="live-nav-eta">
            <strong>{(routeInfo.distanceMeters / 1000).toFixed(1)}km</strong>
            <span>약 {Math.max(1, Math.round(routeInfo.durationSeconds / 60))}분</span>
          </div>
        )}
      </header>

      <div className="live-nav-progress">
        <span>전체 운송 진행</span>
        <span>{orderIndex}/{totalOrders}건 배송 완료</span>
      </div>
      <div className="live-nav-progress-bar"><div style={{ width: `${Math.round((orderIndex / totalOrders) * 100)}%` }} /></div>

      <div className={`live-nav-instruction${arrived ? ' arrived' : ''}`}>
        <span className="live-nav-instruction-icon">
          {arrived ? (pickupPhoto ? '✓' : '📍') : arrowForGuidance(routeInfo?.nextGuidance ?? '')}
        </span>
        <div>
          {arrived ? (
            <strong>{pickupPhoto ? '상차 사진이 확인되었어요' : '정차 후 상차 사진을 촬영해 주세요'}</strong>
          ) : routeInfo ? (
            <strong>{routeInfo.nextGuidanceDistanceMeters}m 앞 {routeInfo.nextGuidance}</strong>
          ) : (
            <strong>다음 목적지 · {order.name} 상차</strong>
          )}
          {!arrived && <span>{routeInfo?.nextRoadName ?? order.pickup.name}</span>}
        </div>
      </div>

      <div className="live-nav-map-frame">
        <KakaoLiveNavigationMap
          destination={{ lat: order.pickup.lat, lng: order.pickup.lng, name: order.pickup.name, kind: 'pickup' }}
          onRouteInfoChange={setRouteInfo}
          dimmed={arrived}
        />
        {arrived && (
          <div className="live-nav-arrival-card">
            {pickupPhoto && photoPreviewUrl ? (
              <>
                <img src={photoPreviewUrl} alt="상차 사진 미리보기" />
                <div>
                  <strong>상차 정보 등록됐어요</strong>
                  <span>사진을 확인한 뒤 하단의 상차 완료를 눌러 주세요.</span>
                </div>
              </>
            ) : (
              <div>
                <strong>상차지에 도착했어요</strong>
                <span>안전한 곳에 정차 후 다음 단계로 진행하세요.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {!arrived && (
        <section className="live-nav-sequence">
          <h2>이후 운송 순서</h2>
          <div className="live-nav-sequence-chips">
            {combo.orders.map((item, index) => (
              <span
                key={item.id}
                className={index === orderIndex ? 'active' : index < orderIndex ? 'done' : ''}
              >
                {index < orderIndex ? '완료' : index === orderIndex ? '진행' : '대기'} · {item.name}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="live-nav-bottom">
        {!arrived ? (
          <button type="button" className="live-nav-confirm-button" onClick={() => setArrived(true)}>
            상차지 도착 확인
          </button>
        ) : !pickupPhoto ? (
          <PhotoPicker label="상차 사진 촬영" onSelect={setPickupPhoto} />
        ) : (
          <button type="button" className="live-nav-confirm-button" onClick={onPickupComplete}>
            {order.name} 상차 완료
          </button>
        )}
      </div>
    </div>
  )
}

function DropoffProgressView({
  order,
  orderIndex,
  totalOrders,
  onBack,
  onDropoffComplete,
}: {
  order: RouteItem
  orderIndex: number
  totalOrders: number
  onBack: () => void
  onDropoffComplete: () => void
}) {
  const [routeInfo, setRouteInfo] = useState<NavigationRouteInfo | null>(null)
  const [manualArrived, setManualArrived] = useState(false)
  const [dropoffPhoto, setDropoffPhoto] = useState<File | null>(null)
  const photoPreviewUrl = usePhotoPreview(dropoffPhoto)
  const arrived = manualArrived || (routeInfo?.arrived ?? false)
  const isLastOrder = orderIndex + 1 >= totalOrders

  return (
    <div className="screen live-nav-screen">
      <header className="transport-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="목록으로 돌아가기">←</button>
        <h1>운송 진행</h1>
        <span className="transport-date">{formatToday()}</span>
      </header>

      <section className="transport-current-card">
        <div className="transport-current-head">
          <span>현재 운송</span>
          <span className="transport-current-badge">진행 중</span>
        </div>
        <h2>{order.pickup.name} 상차지 → {order.dropoff.name} 하차지</h2>
        <p>
          {arrived
            ? '하차지에 도착했어요'
            : routeInfo
              ? `${(routeInfo.distanceMeters / 1000).toFixed(1)}km · 약 ${Math.max(1, Math.round(routeInfo.durationSeconds / 60))}분`
              : '하차지 경로 계산 중'}
        </p>
      </section>

      <div className="live-nav-map-frame">
        <KakaoLiveNavigationMap
          destination={{ lat: order.dropoff.lat, lng: order.dropoff.lng, name: order.dropoff.name, kind: 'dropoff' }}
          onRouteInfoChange={setRouteInfo}
          dimmed={arrived}
        />
        {arrived && (
          <div className="live-nav-arrival-card">
            {dropoffPhoto && photoPreviewUrl ? (
              <>
                <img src={photoPreviewUrl} alt="하차 사진 미리보기" />
                <div>
                  <strong>하차 정보 등록됐어요</strong>
                  <span>사진을 확인한 뒤 하단의 하차 완료를 눌러 주세요.</span>
                </div>
              </>
            ) : (
              <div>
                <strong>하차지에 도착했어요</strong>
                <span>안전한 곳에 정차 후 다음 단계로 진행하세요.</span>
              </div>
            )}
          </div>
        )}
      </div>

      <ul className="transport-steps">
        <li className="done"><span className="step-icon">✓</span><div><strong>접수 완료</strong></div></li>
        <li className="done"><span className="step-icon">✓</span><div><strong>상차 확인</strong></div></li>
        <li className={arrived ? 'done' : 'active'}>
          <span className="step-icon">{arrived ? '✓' : null}</span>
          <div><strong>하차 확인</strong>{!arrived && <span>목적지 도착 확인 중</span>}</div>
        </li>
        <li>
          <span className="step-icon" />
          <div><strong>운송 완료</strong></div>
        </li>
      </ul>

      <div className="live-nav-bottom">
        {!arrived ? (
          <button type="button" className="live-nav-confirm-button" onClick={() => setManualArrived(true)}>
            하차지 도착 확인
          </button>
        ) : !dropoffPhoto ? (
          <PhotoPicker label="하차 사진 촬영" onSelect={setDropoffPhoto} />
        ) : (
          <button type="button" className="live-nav-confirm-button" onClick={onDropoffComplete}>
            {isLastOrder ? '하차 완료 · 운송 종료' : '하차 완료 · 다음 화물로 이동'}
          </button>
        )}
      </div>
    </div>
  )
}

function TransportFlow({
  combo,
  onBack,
  onAllComplete,
}: {
  combo: RecommendedCombination
  onBack: () => void
  onAllComplete: () => void
}) {
  const [orderIndex, setOrderIndex] = useState(0)
  const [stage, setStage] = useState<'pickup' | 'dropoff'>('pickup')

  const order = combo.orders[orderIndex]
  const totalOrders = combo.orders.length

  if (stage === 'pickup') {
    return (
      <PickupNavigationView
        combo={combo}
        order={order}
        orderIndex={orderIndex}
        totalOrders={totalOrders}
        onBack={onBack}
        onPickupComplete={() => setStage('dropoff')}
      />
    )
  }

  return (
    <DropoffProgressView
      order={order}
      orderIndex={orderIndex}
      totalOrders={totalOrders}
      onBack={onBack}
      onDropoffComplete={() => {
        if (orderIndex + 1 < totalOrders) {
          setOrderIndex((index) => index + 1)
          setStage('pickup')
        } else {
          onAllComplete()
        }
      }}
    />
  )
}

function TransportCompleteView({ combo, onDone }: { combo: RecommendedCombination; onDone: () => void }) {
  const totalPrice = combo.orders.reduce((sum, order) => sum + order.price, 0)

  return (
    <div className="screen transport-complete-screen">
      <div className="transport-complete-icon">✓</div>
      <h1>운송 완료</h1>
      <p>{combo.orders.length}건 화물 운송을 모두 마쳤어요.</p>
      <div className="transport-complete-summary">
        <span>정산 예정 금액</span>
        <strong>{totalPrice.toLocaleString()}원</strong>
      </div>
      <button type="button" className="live-nav-confirm-button" onClick={onDone}>확인</button>
    </div>
  )
}

function OrderPage({ onBackToHome }: { onBackToHome: () => void }) {
  const { driver } = useAppData()
  const operation = useMemo<DriverOperation>(() => {
    const returnDestination = resolveLocation(driver.returnDestination, driverOperation.returnDestination)
    return { ...driverOperation, returnDestination, selectedHub: nearestHub(returnDestination) }
  }, [driver.returnDestination])
  const candidatesForOperation = useMemo(() => buildCandidateCombinations(mockOrders, operation), [operation])
  const [entry, setEntry] = useState<'voice' | 'recommendations'>('voice')
  const [view, setView] = useState<'loading' | 'list' | 'detail' | 'route' | 'navigation' | 'completed'>('loading')
  const [combinations, setCombinations] = useState(fallbackCombinations)
  const [selectedId, setSelectedId] = useState(fallbackCombinations[0]?.id ?? '')
  const [preferences, setPreferences] = useState<OrderPreferences | null>(null)
  const [recommendationsReady, setRecommendationsReady] = useState(false)

  const selected = combinations.find((combo) => combo.id === selectedId) ?? combinations[0]
  const selectedRouteTitle = selected ? getCombinationRouteTitle(selected, driver.returnDestination) : ''

  useEffect(() => {
    if (!preferences || entry !== 'recommendations') return
    let active = true
    const candidates = filterCandidates(candidatesForOperation, preferences)
    const loadRecommendations = async () => {
      await Promise.resolve()
      if (!active) return
      if (!candidates.length) {
        setCombinations([])
        setRecommendationsReady(true)
        return
      }
      setRecommendationsReady(false)
      setView('loading')
      recommendCargoCombinations(mockOrders, operation, candidates).then(({ recommendations }) => {
      if (!active) return
      const next = recommendations.map((ai) => {
        const key = [...ai.orderIds].sort().join('|')
        const candidate = candidates.find((item) => [...item.orderIds].sort().join('|') === key)
        return candidate ? { ai, candidate } : null
      }).filter((item): item is { ai: (typeof recommendations)[number]; candidate: CandidateCombination } => Boolean(item))
        .sort((a, b) => b.candidate.score - a.candidate.score)
        .map(({ ai, candidate }, index) => toCombination(candidate, index, ai, operation))
      const resolved = next.length ? next : candidates.slice(0, 3).map((candidate, index) => toCombination(candidate, index, undefined, operation))
      setCombinations(resolved)
      setSelectedId(resolved[0]?.id ?? '')
      setRecommendationsReady(true)
    }).catch(() => {
      if (!active) return
      const resolved = candidates.slice(0, 3).map((candidate, index) => toCombination(candidate, index, undefined, operation))
      setCombinations(resolved)
      setSelectedId(resolved[0]?.id ?? '')
      setRecommendationsReady(true)
      })
    }
    void loadRecommendations()
    return () => { active = false }
  }, [candidatesForOperation, entry, operation, preferences])

  const openDetail = (combo: RecommendedCombination) => {
    setSelectedId(combo.id)
    setView('detail')
  }

  if (entry === 'voice') {
    return <VoiceOrderPreferences onBack={onBackToHome} onComplete={(nextPreferences) => {
      setPreferences(nextPreferences)
      setRecommendationsReady(false)
      setEntry('recommendations')
    }}/>
  }

  if (view === 'loading') {
    return <LoadingScreen ready={recommendationsReady} onDone={() => setView('list')} />
  }

  if (view === 'detail') {
    if (!selected) return null
    return <ComboDetail combo={selected} onBack={() => setView('list')} onAccept={() => setView('navigation')} />
  }

  if (view === 'route') {
    if (!selected) return null
    return <ComboRouteView combo={selected} routeTitle={selectedRouteTitle} onBack={() => setView('list')} />
  }

  if (view === 'navigation') {
    if (!selected) return null
    return <TransportFlow combo={selected} onBack={() => setView('detail')} onAllComplete={() => setView('completed')} />
  }

  if (view === 'completed') {
    if (!selected) return null
    return <TransportCompleteView combo={selected} onDone={() => setView('list')} />
  }

  return (
    <div className="screen order-screen">
      <header className="plain-title order-legacy-title"><button className="order-back-button" type="button" onClick={() => setEntry('voice')} aria-label="AI 운행 조건 화면으로 돌아가기">‹</button><h1>오늘의 추천 오더</h1></header>
      {!combinations.length && <div className="empty-combinations"><strong>조건에 맞는 조합이 없어요</strong><span>시간·거리·최소 운임 조건을 넓혀 다시 말해보세요.</span><button type="button" onClick={() => setEntry('voice')}>조건 다시 말하기</button></div>}
      <div className="combo-list">
        {combinations.map((combo) => (
          <ComboCard
            key={combo.id}
            combo={combo}
            routeTitle={getCombinationRouteTitle(combo, driver.returnDestination)}
            onOpenRoute={() => { setSelectedId(combo.id); setView('route') }}
            onOpenDetail={() => openDetail(combo)}
          />
        ))}
      </div>
    </div>
  )
}

export default OrderPage
