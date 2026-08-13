export type CargoRiskTag = 'fragile' | 'moisture' | 'odor' | 'food' | 'chemical' | 'heavy' | 'soft'

export type CargoOrder = {
  id: string
  pickup: { name: string; latitude: number; longitude: number }
  dropoff: { name: string; latitude: number; longitude: number }
  cargoType: string
  volumeM3: number
  weightTon: number
  price: number
  riskTags: CargoRiskTag[]
}

export type DriverOperation = {
  currentLocation: { name: string; latitude: number; longitude: number }
  returnDestination: { name: string; latitude: number; longitude: number }
  vehicle: { name: string; maxWeightTon: number; maxVolumeM3: number }
  currentLoad: { weightTon: number; volumeM3: number }
}

export const driverOperation: DriverOperation = {
  currentLocation: { name: '서울 관악구 신림동', latitude: 37.4842, longitude: 126.9297 },
  returnDestination: { name: '성남시 중원구', latitude: 37.4302, longitude: 127.1378 },
  vehicle: { name: '1톤 카고', maxWeightTon: 1, maxVolumeM3: 5.5 },
  currentLoad: { weightTon: 0.12, volumeM3: 0.7 },
}

export const mockOrders: CargoOrder[] = [
  { id: 'order-001', pickup: { name: '성남시 중원구', latitude: 37.4201, longitude: 127.1265 }, dropoff: { name: '수원시 팔달구', latitude: 37.2636, longitude: 127.0286 }, cargoType: '소형 가구', volumeM3: 1.4, weightTon: 0.32, price: 55000, riskTags: ['heavy'] },
  { id: 'order-002', pickup: { name: '분당구 야탑동', latitude: 37.4113, longitude: 127.1287 }, dropoff: { name: '수원시 권선구', latitude: 37.2577, longitude: 126.9719 }, cargoType: '의류 박스', volumeM3: 1.1, weightTon: 0.21, price: 34000, riskTags: ['soft', 'moisture'] },
  { id: 'order-003', pickup: { name: '성남시 수정구', latitude: 37.4502, longitude: 127.1456 }, dropoff: { name: '안양시 동안구', latitude: 37.3943, longitude: 126.9568 }, cargoType: '유리 액자', volumeM3: 0.5, weightTon: 0.19, price: 31000, riskTags: ['fragile'] },
  { id: 'order-004', pickup: { name: '용인시 수지구', latitude: 37.3222, longitude: 127.0976 }, dropoff: { name: '수원시 영통구', latitude: 37.2596, longitude: 127.0466 }, cargoType: '생활 잡화', volumeM3: 0.8, weightTon: 0.18, price: 29000, riskTags: [] },
  { id: 'order-005', pickup: { name: '서울 송파구', latitude: 37.5145, longitude: 127.1059 }, dropoff: { name: '성남시 분당구', latitude: 37.3827, longitude: 127.1189 }, cargoType: '냉장 식품', volumeM3: 0.7, weightTon: 0.16, price: 42000, riskTags: ['food', 'odor'] },
  { id: 'order-006', pickup: { name: '광주시 오포읍', latitude: 37.3662, longitude: 127.2288 }, dropoff: { name: '용인시 기흥구', latitude: 37.2804, longitude: 127.1147 }, cargoType: '세제·청소용품', volumeM3: 0.6, weightTon: 0.14, price: 33000, riskTags: ['chemical', 'odor'] },
  { id: 'order-007', pickup: { name: '성남시 분당구', latitude: 37.3827, longitude: 127.1189 }, dropoff: { name: '수원시 장안구', latitude: 37.3039, longitude: 127.0101 }, cargoType: '전자제품', volumeM3: 0.9, weightTon: 0.17, price: 46000, riskTags: ['fragile', 'moisture'] },
  { id: 'order-008', pickup: { name: '안양시 만안구', latitude: 37.3867, longitude: 126.9324 }, dropoff: { name: '군포시 산본동', latitude: 37.3617, longitude: 126.9352 }, cargoType: '의류 행거', volumeM3: 1.3, weightTon: 0.15, price: 36000, riskTags: ['soft', 'moisture'] },
]
