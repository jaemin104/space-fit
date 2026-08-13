import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { AppDataContext, type AppData, type Trip } from './appDataContext'

const initialTrips: Trip[] = [
  { id: 1, route: '성남 → 수원 → 인천 → 성남', date: '2026.08.13', price: 92000, type: '조합 운송', category: '일반' },
  { id: 2, route: '성남 → 용인 → 안양 → 성남', date: '2026.08.11', price: 118000, type: '조합 운송', category: '특수' },
  { id: 3, route: '성남 → 화성 → 수원 → 성남', date: '2026.08.08', price: 86000, type: '조합 운송', category: '장거리' },
]

const TRIP_STORAGE_KEY = 'space-fit-completed-trips'

function loadTrips() {
  try {
    const saved = window.localStorage.getItem(TRIP_STORAGE_KEY)
    const parsed = saved ? JSON.parse(saved) : null
    return Array.isArray(parsed) ? parsed as Trip[] : initialTrips
  } catch {
    return initialTrips
  }
}

function AppDataProvider({ children }: PropsWithChildren) {
  const [vehicle, updateVehicle] = useState({ name: '1톤 카고', maxVolume: 5.5 })
  const [driver, updateDriver] = useState({
    name: '김운송',
    returnDestination: '성남시 중원구',
    preferredAreas: ['성남', '분당', '수원'],
  })
  const [notifications, setNotifications] = useState({ order: true, settlement: true })
  const [trips, setTrips] = useState<Trip[]>(loadTrips)
  const grossEarnings = trips.reduce((sum, trip) => sum + trip.price, 0)

  useEffect(() => {
    window.localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(trips))
  }, [trips])

  const value = useMemo<AppData>(() => ({
    trips,
    grossEarnings,
    expenses: 56200,
    driver,
    vehicle,
    notifications,
    setVehicle: (name, maxVolume) => updateVehicle({ name, maxVolume }),
    setReturnDestination: (returnDestination) => updateDriver((current) => ({ ...current, returnDestination })),
    setPreferredAreas: (preferredAreas) => updateDriver((current) => ({ ...current, preferredAreas })),
    setNotification: (key, enabled) => setNotifications((current) => ({ ...current, [key]: enabled })),
    addCompletedTrip: (trip) => setTrips((current) => [{ ...trip, id: Date.now() }, ...current]),
  }), [driver, grossEarnings, notifications, trips, vehicle])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export default AppDataProvider
