import { createContext, useContext, useCallback } from 'react'

const StatsContext = createContext(null)

export const useStats = () => {
  const context = useContext(StatsContext)
  if (!context) {
    throw new Error('useStats must be used within a StatsProvider')
  }
  return context
}

export const StatsProvider = ({ children, refreshStats, refreshJobStats }) => {
  const refresh = useCallback(() => {
    if (refreshStats) refreshStats()
    if (refreshJobStats) refreshJobStats()
  }, [refreshStats, refreshJobStats])

  return (
    <StatsContext.Provider value={{ refreshStats, refreshJobStats, refresh }}>
      {children}
    </StatsContext.Provider>
  )
}
