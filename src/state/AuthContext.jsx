import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, hydrateSession, loadSession, onAuthExpired, saveSession } from '../lib/api'
import { getHwidHash } from '../lib/hwid'

const AuthContext = createContext(null)

/*
  Web'deki AuthContext'in mobil karşılığı. Tek yapısal fark: HYDRATION.

  Web'de localStorage senkron okunuyordu ve ilk render'da oturum hazırdı. Mobilde
  SecureStore async — ilk render'da oturumun VAR MI YOK MU bilinmiyor. `hazir` bayrağı
  bunun için: false iken kök layout splash'i tutar ve hiçbir yönlendirme kararı
  verilmez. Bayraksız olsaydı her açılışta bir anlık giriş ekranı görünüp kaybolurdu
  (oturumlu kullanıcıda) — mobilde en çok göze batan hata sınıfı.
*/
export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession())
  const [hazir, setHazir] = useState(false)

  useEffect(() => {
    let mounted = true
    hydrateSession().then((restored) => {
      if (!mounted) return
      setSession(restored)
      setHazir(true)
    })
    return () => {
      mounted = false
    }
  }, [])

  // Token süresi dolduğunda (401) oturumu düşür — API katmanı bu olayı yayınlar.
  useEffect(() => {
    return onAuthExpired(() => {
      saveSession(null)
      setSession(null)
    })
  }, [])

  const login = useCallback(async (email, password) => {
    const hwidHash = await getHwidHash()
    const result = await api.login({ email, password, hwidHash })
    saveSession(result)
    setSession(result)
    return result
  }, [])

  const logout = useCallback(() => {
    saveSession(null)
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ session, hazir, isAuthenticated: Boolean(session?.accessToken), login, logout }),
    [session, hazir, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalı.')
  return context
}
