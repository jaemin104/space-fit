import { useMemo, useState, type PropsWithChildren } from 'react'
import { AppDataContext, type AppData, type Trip } from './appDataContext'

const trips: Trip[] = [
  { id: 1, from: '성남', to: '수원', date: '2024.01.20', price: 32400, type: '일반 운송', category: '일반' },
  { id: 2, from: '강남구', to: '성남', date: '2024.01.08', price: 27300, type: '특수 운송', category: '특수' },
  { id: 3, from: '신림동', to: '울산', date: '2023.12.28', price: 72100, type: '장거리 운송', category: '장거리' },
]

function AppDataProvider({ children }: PropsWithChildren) {
  const [vehicle, updateVehicle] = useState({ name: '1톤 카고', maxVolume: 5.5 })
  const [driver, updateDriver] = useState({
    name: '김운송',
    returnDestination: '성남시 중원구',
    preferredAreas: ['성남', '분당', '수원'],
  })
  const [notifications, setNotifications] = useState({ order: true, settlement: true })

  const value = useMemo<AppData>(() => ({
    trips,
    grossEarnings: 188000,
    expenses: 56200,
    driver,
    vehicle,
    notifications,
    setVehicle: (name, maxVolume) => updateVehicle({ name, maxVolume }),
    setReturnDestination: (returnDestination) => updateDriver((current) => ({ ...current, returnDestination })),
    setPreferredAreas: (preferredAreas) => updateDriver((current) => ({ ...current, preferredAreas })),
    setNotification: (key, enabled) => setNotifications((current) => ({ ...current, [key]: enabled })),
  }), [driver, notifications, vehicle])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export default AppDataProvider
