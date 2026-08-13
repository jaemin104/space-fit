import { logisticsHubs, nearestHub, type CargoOrder, type DriverOperation, type LocationPoint } from '../data/mockOrders'

export type RiskLevel = 'low' | 'medium' | 'high' | 'prohibited'
export type CargoRisk = { level: RiskLevel; compatible: boolean; reason: string; warnings: string[] }
export type CandidateCombination = {
  id: number
  orderIds: string[]
  totalWeightTon: number
  totalVolumeM3: number
  totalPrice: number
  estimatedExtraKm: number
  estimatedTimeMin: number
  volumeUtilization: number
  weightUtilization: number
  hubNames: string[]
  score: number
  risk: CargoRisk
}

const radians = (degree: number) => degree * Math.PI / 180
export function straightDistanceKm(a: LocationPoint, b: LocationPoint) {
  const earth = 6371
  const latitude = radians(b.latitude - a.latitude)
  const longitude = radians(b.longitude - a.longitude)
  const value = Math.sin(latitude / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitude / 2) ** 2
  return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

const roadDistanceKm = (a: LocationPoint, b: LocationPoint) => straightDistanceKm(a, b) * 1.24
const mvpExcludedTags = new Set(['hazardous', 'cold', 'highValue', 'moving', 'oversized'])

export function assessCargoRisk(orders: CargoOrder[]): CargoRisk {
  const tags = new Set(orders.flatMap((order) => order.riskTags))
  const excluded = orders.find((order) => order.riskTags.some((tag) => mvpExcludedTags.has(tag)))
  if (excluded) return { level: 'prohibited', compatible: false, reason: `${excluded.cargoType}은(는) MVP 자동 매칭 제외 품목입니다.`, warnings: ['별도 차량·설비·신고 요건을 현장에서 검증하세요.'] }
  if (orders.some((order) => !order.allowMix)) return { level: 'prohibited', compatible: false, reason: '혼적을 허용하지 않는 오더가 포함되어 있어요.', warnings: ['단독 운송 여부를 별도로 확인하세요.'] }
  if (tags.has('food') && tags.has('chemical')) return { level: 'prohibited', compatible: false, reason: '식품과 화학·세제류는 오염 위험 때문에 함께 적재할 수 없어요.', warnings: ['서로 다른 차량으로 분리 운송하세요.'] }
  if (tags.has('fragile')) return { level: 'high', compatible: true, reason: '가전·도자기·유리·정밀기기는 파손 위험이 있어 조건부 혼적만 가능해요.', warnings: ['취약 화물을 최상단에 적재하고 압축하중을 피하세요.', '완충재와 고정 벨트를 확인하세요.'] }
  if (tags.has('heavy')) return { level: 'medium', compatible: true, reason: '소형 가구부속은 하단 고정이 필요한 준취약 화물이에요.', warnings: ['차량 하단에 고정하고 다른 화물의 압착 여부를 확인하세요.'] }
  if (tags.has('odor') || tags.has('moisture')) return { level: 'medium', compatible: true, reason: '냄새·습기에 민감한 화물이 포함돼 분리 포장이 필요해요.', warnings: ['방수·밀폐 포장 상태를 확인하세요.'] }
  return { level: 'low', compatible: true, reason: '상온·표준 포장의 저파손 화물로 혼적 위험이 낮아요.', warnings: [] }
}

function combinations(items: CargoOrder[], maximumSize: number, maximumWeight: number, maximumVolume: number) {
  const result: CargoOrder[][] = []
  const visit = (start: number, selected: CargoOrder[], weight: number, volume: number) => {
    if (selected.length >= 2) result.push([...selected])
    if (selected.length === maximumSize) return
    for (let index = start; index < items.length; index += 1) {
      const nextWeight = weight + items[index].weightTon
      const nextVolume = volume + items[index].volumeM3
      if (nextWeight <= maximumWeight && nextVolume <= maximumVolume) visit(index + 1, [...selected, items[index]], nextWeight, nextVolume)
    }
  }
  visit(0, [], 0, 0)
  return result
}

function routeMetrics(orders: CargoOrder[], operation: DriverOperation) {
  type RouteChoice = { order: CargoOrder; point: LocationPoint; type: 'pickup' | 'dropoff' }
  const pending = new Set(orders.map((order) => order.id))
  const onboard = new Set<string>()
  let current = operation.returnDestination
  let distance = 0
  const orderedIds: string[] = []

  while (pending.size || onboard.size) {
    const choices = orders.flatMap<RouteChoice>((order) => {
      if (pending.has(order.id)) return [{ order, point: order.pickup, type: 'pickup' }]
      if (onboard.has(order.id)) return [{ order, point: order.dropoff, type: 'dropoff' }]
      return []
    })
    const next = choices.reduce((best, choice) => roadDistanceKm(current, choice.point) < roadDistanceKm(current, best.point) ? choice : best)
    distance += roadDistanceKm(current, next.point)
    current = next.point
    if (next.type === 'pickup') {
      pending.delete(next.order.id)
      onboard.add(next.order.id)
      orderedIds.push(next.order.id)
    } else {
      onboard.delete(next.order.id)
    }
  }
  distance += roadDistanceKm(current, operation.returnDestination)
  const serviceMinutes = orders.reduce((sum, order) => sum + order.loadingMinutes + order.unloadingMinutes, 0)
  const driveMinutes = distance / 48 * 60
  return { distanceKm: distance, timeMin: Math.ceil(driveMinutes + serviceMinutes), orderedIds }
}

function hubsOnRoute(orders: CargoOrder[]) {
  const hubs = new Map<string, LocationPoint>()
  for (const order of orders) {
    for (const point of [order.pickup, order.dropoff]) {
      const hub = nearestHub(point)
      if (straightDistanceKm(point, hub) <= 35) hubs.set(hub.name, hub)
    }
  }
  return [...hubs.values()]
}

const clamp100 = (value: number) => Math.max(0, Math.min(100, value))

export function buildCandidateCombinations(orders: CargoOrder[], operation: DriverOperation): CandidateCombination[] {
  const availableWeight = operation.vehicle.remainingWeightTon
  const availableVolume = operation.vehicle.remainingVolumeM3
  const eligibleOrders = orders.filter((order) => order.allowMix
    && !order.riskTags.some((tag) => mvpExcludedTags.has(tag))
    && hubsOnRoute([order]).some((hub) => hub.name === operation.selectedHub.name))

  return combinations(eligibleOrders, 10, availableWeight, availableVolume).map((group, index) => {
    const totalWeightTon = group.reduce((sum, order) => sum + order.weightTon, 0)
    const totalVolumeM3 = group.reduce((sum, order) => sum + order.volumeM3, 0)
    const totalPrice = group.reduce((sum, order) => sum + order.price, 0)
    const risk = assessCargoRisk(group)
    const route = routeMetrics(group, operation)
    const hubs = hubsOnRoute(group)
    const volumeUtilization = totalVolumeM3 / availableVolume
    const weightUtilization = totalWeightTon / availableWeight
    const capacityFit = clamp100((1 - Math.abs(0.78 - (volumeUtilization + weightUtilization) / 2)) * 100)
    const distanceFit = clamp100(100 - route.distanceKm * 0.75)
    const profitFit = clamp100(totalPrice / 1600)
    const safetyFit = { low: 100, medium: 75, high: 48, prohibited: 0 }[risk.level]
    const routeFit = clamp100(100 - route.distanceKm / Math.max(group.length, 1))
    const score = Math.round(0.25 * distanceFit + 0.25 * capacityFit + 0.20 * profitFit + 0.20 * safetyFit + 0.10 * routeFit)
    return {
      id: index + 1,
      orderIds: route.orderedIds,
      totalWeightTon,
      totalVolumeM3,
      totalPrice,
      estimatedExtraKm: Number(route.distanceKm.toFixed(1)),
      estimatedTimeMin: route.timeMin,
      volumeUtilization: Number(volumeUtilization.toFixed(3)),
      weightUtilization: Number(weightUtilization.toFixed(3)),
      hubNames: hubs.map((hub) => hub.name),
      score,
      risk,
    }
  }).filter((candidate) => candidate.hubNames.includes(operation.selectedHub.name)
    && candidate.totalWeightTon <= availableWeight
    && candidate.totalVolumeM3 <= availableVolume
    && candidate.risk.level !== 'prohibited')
    .sort((a, b) => b.score - a.score || b.totalPrice - a.totalPrice || a.estimatedTimeMin - b.estimatedTimeMin)
    .slice(0, 30)
}

export const hubNames = logisticsHubs.map((hub) => hub.name)
