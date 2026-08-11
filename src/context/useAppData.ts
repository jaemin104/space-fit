import { useContext } from 'react'
import { AppDataContext } from './appDataContext'

export function useAppData() {
  const data = useContext(AppDataContext)

  if (!data) {
    throw new Error('useAppData must be used inside AppDataProvider')
  }

  return data
}
