import { createContext } from 'react'

export type TripCategory = '일반' | '특수' | '장거리'

export interface Trip {
  id: number
  from: string
  to: string
  date: string
  price: number
  type: string
  category: TripCategory
}

export interface AppData {
  trips: Trip[]
  grossEarnings: number
  expenses: number
  driver: {
    name: string
    returnDestination: string
    preferredAreas: string[]
  }
  vehicle: { name: string; maxVolume: number }
  notifications: { order: boolean; settlement: boolean }
  setVehicle: (name: string, maxVolume: number) => void
  setReturnDestination: (destination: string) => void
  setPreferredAreas: (areas: string[]) => void
  setNotification: (key: 'order' | 'settlement', value: boolean) => void
}

export const AppDataContext = createContext<AppData | null>(null)
