import type { CargoOrder, DriverOperation } from '../data/mockOrders'

export type RiskLevel = 'low' | 'medium' | 'high' | 'prohibited'
export type CargoRisk = { level: RiskLevel; compatible: boolean; reason: string; warnings: string[] }
export type CandidateCombination = {
  id: number
  orderIds: string[]
  totalWeightTon: number
  totalVolumeM3: number
  totalPrice: number
  estimatedExtraKm: number
  score: number
  risk: CargoRisk
}

const radians = (degree: number) => degree * Math.PI / 180
function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earth = 6371
  const latitude = radians(b.latitude - a.latitude)
  const longitude = radians(b.longitude - a.longitude)
  const value = Math.sin(latitude / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitude / 2) ** 2
  return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

export function assessCargoRisk(orders: CargoOrder[]): CargoRisk {
  const tags = new Set(orders.flatMap((order) => order.riskTags))
  if (tags.has('food') && tags.has('chemical')) return { level: 'prohibited', compatible: false, reason: '식품과 화학·세제류는 오염 위험 때문에 함께 적재할 수 없어요.', warnings: ['서로 다른 차량으로 분리 운송하세요.'] }
  if (tags.has('fragile') && (tags.has('heavy') || tags.has('soft'))) return { level: 'high', compatible: true, reason: '유리·전자제품이 다른 화물의 압력이나 이동으로 파손될 위험이 있어요.', warnings: ['파손 화물을 마지막에 싣고 최상단에 고정하세요.', '완충재와 고정 벨트를 사용하세요.'] }
  if (tags.has('odor') || (tags.has('moisture') && tags.has('fragile'))) return { level: 'medium', compatible: true, reason: '냄새·습기 또는 충격에 민감한 화물이 포함돼 분리 포장이 필요해요.', warnings: ['방수·밀폐 포장 상태를 확인하세요.'] }
  return { level: 'low', compatible: true, reason: '화물 특성이 유사하고 명확한 혼적 위험이 낮아요.', warnings: [] }
}

function combinations<T>(items: T[], maximumSize = 3) {
  const result: T[][] = []
  const visit = (start: number, selected: T[]) => {
    if (selected.length >= 2) result.push([...selected])
    if (selected.length === maximumSize) return
    for (let index = start; index < items.length; index += 1) visit(index + 1, [...selected, items[index]])
  }
  visit(0, [])
  return result
}

export function buildCandidateCombinations(orders: CargoOrder[], operation: DriverOperation): CandidateCombination[] {
  const availableWeight = operation.vehicle.maxWeightTon - operation.currentLoad.weightTon
  const availableVolume = operation.vehicle.maxVolumeM3 - operation.currentLoad.volumeM3
  return combinations(orders).map((group, index) => {
    const totalWeightTon = group.reduce((sum, order) => sum + order.weightTon, 0)
    const totalVolumeM3 = group.reduce((sum, order) => sum + order.volumeM3, 0)
    const totalPrice = group.reduce((sum, order) => sum + order.price, 0)
    const estimatedExtraKm = group.reduce((sum, order) => sum + distanceKm(operation.currentLocation, order.pickup) + distanceKm(order.pickup, order.dropoff), 0) / group.length
    const risk = assessCargoRisk(group)
    const utilization = ((totalWeightTon / availableWeight) + (totalVolumeM3 / availableVolume)) / 2
    const revenuePerKm = totalPrice / Math.max(estimatedExtraKm, 1)
    const riskPenalty = { low: 0, medium: 8, high: 24, prohibited: 100 }[risk.level]
    const score = Math.round(revenuePerKm / 100 + utilization * 45 - estimatedExtraKm * 0.8 - riskPenalty)
    return { id: index + 1, orderIds: group.map((order) => order.id), totalWeightTon, totalVolumeM3, totalPrice, estimatedExtraKm: Number(estimatedExtraKm.toFixed(1)), score, risk }
  }).filter((candidate) => candidate.totalWeightTon <= availableWeight && candidate.totalVolumeM3 <= availableVolume && candidate.risk.level !== 'prohibited').sort((a, b) => b.score - a.score).slice(0, 20)
}
