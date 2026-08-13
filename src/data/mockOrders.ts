export type CargoRiskTag = 'fragile' | 'moisture' | 'odor' | 'food' | 'chemical' | 'heavy' | 'soft' | 'cold' | 'hazardous' | 'highValue' | 'moving' | 'oversized'

export type LocationPoint = { name: string; latitude: number; longitude: number }

export type CargoOrder = {
  id: string
  pickup: LocationPoint
  dropoff: LocationPoint
  cargoType: string
  packaging: string
  volumeM3: number
  weightTon: number
  price: number
  orderTime: string
  availableFrom: string
  availableUntil: string
  loadingMinutes: number
  unloadingMinutes: number
  fragileGrade: string
  lifoOk: boolean
  allowMix: boolean
  riskTags: CargoRiskTag[]
}

export type DriverOperation = {
  currentLocation: LocationPoint
  returnDestination: LocationPoint
  selectedHub: LocationPoint
  departureTime: string
  vehicle: { name: string; maxWeightTon: number; maxVolumeM3: number; remainingWeightTon: number; remainingVolumeM3: number }
  currentLoad: { weightTon: number; volumeM3: number }
}

export const logisticsHubs: LocationPoint[] = [
  { name: '경기도 평택시', latitude: 36.9921, longitude: 127.1127 },
  { name: '경상남도 양산시', latitude: 35.3350, longitude: 129.0373 },
  { name: '경기도 화성시', latitude: 37.1996, longitude: 126.8312 },
  { name: '충청북도 음성군', latitude: 36.9403, longitude: 127.6905 },
  { name: '충청남도 당진시', latitude: 36.8897, longitude: 126.6459 },
  { name: '경상남도 김해시', latitude: 35.2285, longitude: 128.8894 },
  { name: '경기도 용인시 처인구', latitude: 37.2342, longitude: 127.2010 },
  { name: '경기도 안성시', latitude: 37.0079, longitude: 127.2797 },
  { name: '경기도 용인시 기흥구', latitude: 37.2750, longitude: 127.1150 },
  { name: '충청남도 아산시', latitude: 36.7898, longitude: 127.0018 },
]

const knownLocations: LocationPoint[] = [
  ...logisticsHubs,
  { name: '성남시 중원구', latitude: 37.4302, longitude: 127.1378 },
  { name: '성남시 분당구', latitude: 37.3827, longitude: 127.1189 },
  { name: '서울 관악구 신림동', latitude: 37.4842, longitude: 126.9297 },
]

export function resolveLocation(name: string, fallback = knownLocations[10]): LocationPoint {
  const normalized = name.replaceAll(' ', '')
  const match = knownLocations.find((location) => normalized.includes(location.name.replaceAll(' ', '')) || location.name.replaceAll(' ', '').includes(normalized))
  return match ? { ...match, name } : { ...fallback, name }
}

export function nearestHub(point: LocationPoint) {
  return logisticsHubs.reduce((nearest, hub) => squaredDistance(point, hub) < squaredDistance(point, nearest) ? hub : nearest)
}

function squaredDistance(a: LocationPoint, b: LocationPoint) {
  return (a.latitude - b.latitude) ** 2 + ((a.longitude - b.longitude) * Math.cos(a.latitude * Math.PI / 180)) ** 2
}

export const driverOperation: DriverOperation = {
  currentLocation: { name: '서울 관악구 신림동', latitude: 37.4842, longitude: 126.9297 },
  returnDestination: { name: '성남시 중원구', latitude: 37.4302, longitude: 127.1378 },
  selectedHub: logisticsHubs[8],
  departureTime: '09:00',
  vehicle: { name: '1톤 카고', maxWeightTon: 1, maxVolumeM3: 5.5, remainingWeightTon: 0.88, remainingVolumeM3: 4.8 },
  currentLoad: { weightTon: 0.12, volumeM3: 0.7 },
}

const order = (id: string, pickup: LocationPoint, dropoff: LocationPoint, cargoType: string, packaging: string, volumeM3: number, weightTon: number, price: number, riskTags: CargoRiskTag[], options: Partial<CargoOrder> = {}): CargoOrder => ({
  id, pickup, dropoff, cargoType, packaging, volumeM3, weightTon, price, riskTags,
  orderTime: '2026-08-12 18:00', availableFrom: '09:00', availableUntil: '18:00', loadingMinutes: 12, unloadingMinutes: 10,
  fragileGrade: riskTags.includes('fragile') ? '매우 취약(25~40G)' : riskTags.includes('heavy') ? '준취약(60~85G)' : '일반(85G 이상)',
  lifoOk: !riskTags.includes('fragile'), allowMix: !riskTags.some((tag) => ['hazardous', 'cold', 'highValue', 'moving', 'oversized'].includes(tag)), ...options,
})

const p = (name: string, latitude: number, longitude: number): LocationPoint => ({ name, latitude, longitude })

export const mockOrders: CargoOrder[] = [
  order('order-001', p('용인시 기흥구', 37.2750, 127.1150), p('성남시 중원구', 37.4302, 127.1378), '생활잡화 박스', '골판지 박스', 0.65, 0.12, 39000, []),
  order('order-002', p('성남시 분당구', 37.3827, 127.1189), p('용인시 처인구', 37.2342, 127.2010), '산업용 부자재', '골판지 박스·포대', 0.8, 0.18, 47000, []),
  order('order-003', p('용인시 처인구', 37.2342, 127.2010), p('수원시 영통구', 37.2596, 127.0466), '의류·원단 롤', '박스·포대', 0.75, 0.13, 42000, ['soft', 'moisture']),
  order('order-004', p('수원시 영통구', 37.2596, 127.0466), p('성남시 분당구', 37.3827, 127.1189), '도서·인쇄물', '골판지 박스', 0.45, 0.20, 38000, []),
  order('order-005', p('용인시 기흥구', 37.2750, 127.1150), p('화성시 동탄', 37.2007, 127.0724), '농산물 포장재', '박스·포대', 0.7, 0.14, 36000, []),
  order('order-006', p('화성시 동탄', 37.2007, 127.0724), p('수원시 권선구', 37.2577, 126.9719), '중형 생활잡화', '골판지 박스', 0.9, 0.19, 44000, []),
  order('order-007', p('수원시 권선구', 37.2577, 126.9719), p('성남시 중원구', 37.4302, 127.1378), '신발 박스', '골판지 박스', 0.55, 0.10, 35000, ['soft']),
  order('order-008', p('용인시 기흥구', 37.2750, 127.1150), p('광주시 오포읍', 37.3662, 127.2288), '소형 가구부속', '골판지 박스', 0.9, 0.20, 51000, ['heavy'], { loadingMinutes: 18 }),
  order('order-009', p('광주시 오포읍', 37.3662, 127.2288), p('성남시 분당구', 37.3827, 127.1189), '일반 가전', '완충 박스', 0.8, 0.16, 53000, ['fragile'], { lifoOk: false, loadingMinutes: 16 }),
  order('order-010', p('용인시 처인구', 37.2342, 127.2010), p('성남시 중원구', 37.4302, 127.1378), '도자기·유리제품', '완충재 포함 박스', 0.45, 0.11, 59000, ['fragile'], { lifoOk: false }),
  order('order-011', p('안성시 공도읍', 36.9975, 127.1728), p('평택시 비전동', 36.9950, 127.1147), '포장 부자재', '골판지 박스', 0.85, 0.17, 40000, []),
  order('order-012', p('평택시 고덕동', 37.0400, 127.0520), p('화성시 향남읍', 37.1324, 126.9202), '생활용품', '골판지 박스', 0.7, 0.15, 43000, []),
  order('order-013', p('아산시 음봉면', 36.8490, 127.0160), p('평택시 포승읍', 36.9800, 126.8450), '자동차 경량 부자재', '골판지 박스', 0.95, 0.23, 61000, []),
  order('order-014', p('음성군 대소면', 36.9670, 127.4830), p('안성시 일죽면', 37.0900, 127.4800), '문구·카탈로그', '골판지 박스', 0.6, 0.21, 48000, []),
  order('order-015', p('당진시 송악읍', 36.9050, 126.6900), p('아산시 인주면', 36.8700, 126.8900), '산업용 포장재', '포대', 0.9, 0.16, 52000, []),
  order('order-016', p('양산시 물금읍', 35.3100, 128.9900), p('김해시 대동면', 35.2400, 128.9800), '섬유 원단', '포대', 0.8, 0.14, 45000, ['soft']),
  order('order-017', p('김해시 주촌면', 35.2350, 128.8300), p('양산시 상북면', 35.4200, 129.0600), '정밀 전자부품', '완충 박스', 0.4, 0.08, 67000, ['fragile'], { lifoOk: false }),
  order('order-018', p('성남시 수정구', 37.4502, 127.1456), p('용인시 기흥구', 37.2750, 127.1150), '냉장 식품', '냉장 박스', 0.6, 0.12, 55000, ['food', 'cold'], { allowMix: false }),
  order('order-019', p('용인시 처인구', 37.2342, 127.2010), p('수원시 팔달구', 37.2636, 127.0286), '인화성 세정제', '위험물 용기', 0.35, 0.09, 72000, ['chemical', 'hazardous'], { allowMix: false }),
  order('order-020', p('화성시 동탄', 37.2007, 127.0724), p('성남시 분당구', 37.3827, 127.1189), '고가 계측기', '보안 완충 박스', 0.3, 0.06, 88000, ['fragile', 'highValue'], { allowMix: false }),
  order('order-021', p('평택시 청북읍', 37.0200, 126.9200), p('안성시 공도읍', 36.9975, 127.1728), '가정 이사화물', '혼합 포장', 1.8, 0.35, 90000, ['moving'], { allowMix: false, loadingMinutes: 35, unloadingMinutes: 35 }),
  order('order-022', p('당진시 합덕읍', 36.8100, 126.7700), p('아산시 둔포면', 36.9300, 127.0400), '대형 기계설비', '목재 팔레트', 2.4, 1.2, 150000, ['heavy', 'oversized'], { allowMix: false, loadingMinutes: 40, unloadingMinutes: 40 }),
]
