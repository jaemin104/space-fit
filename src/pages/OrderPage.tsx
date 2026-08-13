import { Fragment, useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './pages.css'
import VoiceOrderPreferences from '../components/VoiceOrderPreferences'
import { driverOperation, mockOrders, type CargoOrder } from '../data/mockOrders'
import { buildCandidateCombinations, type CandidateCombination, type CargoRisk as AiCargoRisk } from '../utils/cargoRecommendation'
import { analyzeCargoRisk, recommendCargoCombinations, type OrderPreferences } from '../utils/fetchCargoAi'

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

function toCombination(candidate: CandidateCombination, index: number, ai?: { title: string; reason: string; risk: AiCargoRisk }): RecommendedCombination {
  const risk = ai?.risk ?? candidate.risk
  const orders = candidate.orderIds.map((id) => ordersById.get(id)).filter((order): order is CargoOrder => Boolean(order))
  return {
    id: `candidate-${candidate.id}-${index}`,
    title: ai?.title ?? `${orders.at(-1)?.dropoff.name ?? '복귀'} 방면 추천 조합`,
    aiRecommended: Boolean(ai),
    extraDistanceKm: candidate.estimatedExtraKm,
    extraTimeMin: Math.max(5, Math.round(candidate.estimatedExtraKm * 2.6)),
    expectedNetProfit: candidate.totalPrice,
    volumeLoadRate: Math.round((driverOperation.currentLoad.volumeM3 + candidate.totalVolumeM3) / driverOperation.vehicle.maxVolumeM3 * 100),
    weightLoadRate: Math.round((driverOperation.currentLoad.weightTon + candidate.totalWeightTon) / driverOperation.vehicle.maxWeightTon * 100),
    orders: orders.map((order) => toRouteItem(order, risk)),
    aiReason: ai?.reason,
    overallRisk: risk,
  }
}

function filterCandidates(preferences: OrderPreferences) {
  return allCandidates.filter((candidate) => {
    const minutes = Math.max(5, Math.round(candidate.estimatedExtraKm * 2.6))
    return (preferences.maxMinutes === null || minutes <= preferences.maxMinutes)
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

function makePointIcon(label: string, tone: 'pickup' | 'dropoff') {
  return L.divIcon({
    className: `route-marker ${tone}`,
    html: `<span>${label}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

function RouteMap({ combination }: { combination: RecommendedCombination }) {
  const positions: [number, number][] = combination.orders.flatMap((order) => [
    [order.pickup.lat, order.pickup.lng],
    [order.dropoff.lat, order.dropoff.lng],
  ])

  return (
    <MapContainer
      className="route-map"
      bounds={positions}
      boundsOptions={{ padding: [28, 28] }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={positions} pathOptions={{ color: '#f5b301', weight: 4 }} />
      {combination.orders.map((order, index) => (
        <Fragment key={order.id}>
          <Marker position={[order.pickup.lat, order.pickup.lng]} icon={makePointIcon(`상${index + 1}`, 'pickup')}>
            <Popup>{index + 1}번 상차지 · {order.pickup.name}</Popup>
          </Marker>
          <Marker position={[order.dropoff.lat, order.dropoff.lng]} icon={makePointIcon(`하${index + 1}`, 'dropoff')}>
            <Popup>{index + 1}번 하차지 · {order.dropoff.name}</Popup>
          </Marker>
        </Fragment>
      ))}
    </MapContainer>
  )
}

function ComboCard({
  combo,
  onOpenRoute,
  onOpenDetail,
}: {
  combo: RecommendedCombination
  onOpenRoute: () => void
  onOpenDetail: () => void
}) {
  const destinations = [...new Set(combo.orders.map((order) => order.dropoff.name.split('시 ')[0].replace('시', '')))].join('·')
  const cargoNames = combo.orders.map((order) => order.name).join(' · ')
  return (
    <article className="combo-card">
      <header className="combo-card-head">
        <div>
          <span className="combo-kicker">{combo.title}</span>
          <h3>{destinations}</h3>
        </div>
        <strong className="combo-price">{combo.expectedNetProfit.toLocaleString()}원</strong>
      </header>
      <p className="combo-cargo-names">{cargoNames}</p>
      <div className="combo-load-summary"><span>적재율 {combo.weightLoadRate}%</span><span>우회 {combo.extraTimeMin}분</span></div>
      <div className="combo-progress"><span style={{ width: `${combo.weightLoadRate}%` }} /></div>
      <div className="combo-actions">
        <button type="button" className="combo-action-outline" onClick={onOpenRoute}>경로 보기</button>
        <button type="button" className="combo-action-solid" onClick={onOpenDetail}>상세보기</button>
      </div>
    </article>
  )
}

function ComboRouteView({ combo, onBack }: { combo: RecommendedCombination; onBack: () => void }) {
  return (
    <div className="screen order-detail-screen">
      <header className="detail-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="목록으로 돌아가기">←</button>
        <h1>{combo.title} 경로</h1>
      </header>
      <RouteMap combination={combo} />
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

function ComboDetail({ combo, onBack }: { combo: RecommendedCombination; onBack: () => void }) {
  const totalPrice = combo.orders.reduce((sum, order) => sum + order.price, 0)
  const totalWeight = combo.orders.reduce((sum, order) => sum + order.weight, 0)
  const loadRate = Math.round((totalWeight / VEHICLE_MAX_WEIGHT_KG) * 100)
  const topLoadOrder = combo.orders.find((order) => order.risk === 'danger')
  const orderedOrders = [...combo.orders].sort((a, b) => Number(a.risk === 'danger') - Number(b.risk === 'danger'))

  return (
    <div className="screen order-detail-screen">
      <header className="detail-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="목록으로 돌아가기">←</button>
        <h1>조합 상세</h1>
      </header>
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
        <button type="button" className="accept-button">이 조합 수락하기</button>
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

function OrderPage() {
  const [entry, setEntry] = useState<'voice' | 'recommendations'>('voice')
  const [view, setView] = useState<'loading' | 'list' | 'detail' | 'route'>('loading')
  const [combinations, setCombinations] = useState(fallbackCombinations)
  const [selectedId, setSelectedId] = useState(fallbackCombinations[0]?.id ?? '')
  const [preferences, setPreferences] = useState<OrderPreferences | null>(null)
  const [recommendationsReady, setRecommendationsReady] = useState(false)

  const selected = combinations.find((combo) => combo.id === selectedId) ?? combinations[0]

  useEffect(() => {
    if (!preferences || entry !== 'recommendations') return
    let active = true
    const candidates = filterCandidates(preferences)
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
      recommendCargoCombinations(mockOrders, driverOperation, candidates).then(({ recommendations }) => {
      if (!active) return
      const next = recommendations.map((ai, index) => {
        const key = [...ai.orderIds].sort().join('|')
        const candidate = candidates.find((item) => [...item.orderIds].sort().join('|') === key)
        return candidate ? toCombination(candidate, index, ai) : null
      }).filter((item): item is RecommendedCombination => Boolean(item))
      const resolved = next.length ? next : candidates.slice(0, 3).map((candidate, index) => toCombination(candidate, index))
      setCombinations(resolved)
      setSelectedId(resolved[0]?.id ?? '')
      setRecommendationsReady(true)
    }).catch(() => {
      if (!active) return
      const resolved = candidates.slice(0, 3).map((candidate, index) => toCombination(candidate, index))
      setCombinations(resolved)
      setSelectedId(resolved[0]?.id ?? '')
      setRecommendationsReady(true)
      })
    }
    void loadRecommendations()
    return () => { active = false }
  }, [entry, preferences])

  const openDetail = (combo: RecommendedCombination) => {
    setSelectedId(combo.id)
    setView('detail')
    const orders = combo.orders.map((route) => ordersById.get(route.id)).filter((order): order is CargoOrder => Boolean(order))
    void analyzeCargoRisk(orders, orders.map((order) => order.id)).then(({ risk }) => {
      setCombinations((current) => current.map((item) => item.id === combo.id ? { ...item, overallRisk: risk, orders: orders.map((order) => toRouteItem(order, risk)) } : item))
    }).catch(() => undefined)
  }

  if (entry === 'voice') {
    return <VoiceOrderPreferences onComplete={(nextPreferences) => {
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
    return <ComboDetail combo={selected} onBack={() => setView('list')} />
  }

  if (view === 'route') {
    if (!selected) return null
    return <ComboRouteView combo={selected} onBack={() => setView('list')} />
  }

  return (
    <div className="screen order-screen">
      <header className="recommendation-header"><button type="button" onClick={() => setEntry('voice')} aria-label="운행 목표로 돌아가기">‹</button><h1>추천 오더</h1></header>
      <h2 className="recommendation-count">추천 묶음 {combinations.length}개</h2>
      {!combinations.length && <div className="empty-combinations"><strong>조건에 맞는 조합이 없어요</strong><span>시간·거리·최소 운임 조건을 넓혀 다시 말해보세요.</span><button type="button" onClick={() => setEntry('voice')}>조건 다시 말하기</button></div>}
      <div className="combo-list">
        {combinations.map((combo) => (
          <ComboCard
            key={combo.id}
            combo={combo}
            onOpenRoute={() => { setSelectedId(combo.id); setView('route') }}
            onOpenDetail={() => openDetail(combo)}
          />
        ))}
      </div>
      {combinations.length > 0 && <div className="best-combo-action"><button type="button" onClick={() => openDetail(combinations[0])}>최적조합 상세보기</button></div>}
    </div>
  )
}

export default OrderPage
