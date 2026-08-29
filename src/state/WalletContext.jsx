import { createContext, useContext, useMemo } from 'react'
import { api } from '../lib/api'
import { useAsync } from './useAsync'

const WalletContext = createContext(null)

/**
 * Cüzdan ucu için TEK kaynak — web'deki WalletContext'in birebir portu.
 *
 * Bugün taşıdığı şey kazanılan puan ve ondan türeyen seviye
 * (totalEarnedCredits / level / nextLevelAt). Puan HARCANMAZ (iş kuralı 1) —
 * bu bir bakiye değil, profilde görünen bir unvan kaynağıdır.
 * Puanı değiştiren her işlem (ders onayı) refreshWallet() çağırır.
 */
export function WalletProvider({ children }) {
  const { data, error, loading, reload } = useAsync(() => api.wallet(), [])

  const value = useMemo(
    () => ({
      wallet: data,
      loading,
      error,
      refreshWallet: () => reload({ silent: true }),
    }),
    [data, loading, error, reload],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useWallet, WalletProvider içinde kullanılmalı.')
  return context
}
