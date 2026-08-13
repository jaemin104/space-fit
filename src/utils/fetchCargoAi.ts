import type { CargoOrder, DriverOperation } from '../data/mockOrders'
import type { CandidateCombination, CargoRisk } from './cargoRecommendation'

export type AiRecommendation = { orderIds: string[]; title: string; reason: string; risk: CargoRisk }
export type OrderPreferences = { maxMinutes: number | null; maxDistanceKm: number | null; minPrice: number | null; summary: string }

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message ?? 'AI 분석 요청에 실패했습니다.')
  return result
}

export const recommendCargoCombinations = (orders: CargoOrder[], operation: DriverOperation, candidates: CandidateCombination[]) =>
  post<{ recommendations: AiRecommendation[] }>('/api/recommend-combinations', { orders, operation, candidates })

export const extractOrderPreferences = (transcript: string) =>
  post<{ preferences: OrderPreferences }>('/api/extract-order-preferences', { transcript })
