import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { api } from '../lib/api'
import { ILISKI, iliskiHaritasi, kimlikAnahtari } from '../lib/iliski'
import { useAsync } from './useAsync'

/**
 * Oturum sahibinin arkadaşlık ilişkileri (bkz. lib/iliski.js).
 *
 * ODAKTA SESSİZ TAZELENİYOR: ilişki çoğu zaman BAŞKA ekranda değişiyor (Arkadaşlar'da
 * kabul, karşı tarafın kabulü). Kurulu kalan Keşfet ve profil ekranı tazelenmezse kabul
 * edilmiş isteğin kartında "İstek gönderildi" kalırdı (CLAUDE.md → "Başka ekranda değişen
 * veri ODAKTA tazelenir"). Liste sıfırlanmıyor, yalnızca bu küçük yanıt yeniden çekiliyor.
 * Kurulumla aynı anda gelen odak atlanıyor — ilk çekimi useAsync zaten yaptı
 * (ArkadaslarBolumu'ndaki kalıp).
 *
 * İYİMSER İŞARET: istek gönderilince kart ağ yanıtı beklemeden "İstek gönderildi"ye
 * dönüyor. İşaret sunucudan YENİ bir yanıt geldiğinde siliniyor — sunucu otorite. Kalıcı
 * tutulsaydı karşı taraf reddettiğinde düğme uygulama yeniden başlayana kadar pasif kalırdı.
 *
 * @param aktif false iken istek atılmaz (ör. Keşfet'in YKS sekmesi kişi göstermiyor).
 */
export function useIliskiler(aktif = true) {
  const veri = useAsync(() => (aktif ? api.myMatches() : Promise.resolve(null)), [aktif])
  const [iyimser, setIyimser] = useState(() => new Map())

  const tazele = useRef(veri.reload)
  tazele.current = veri.reload
  const kuruluyor = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (!kuruluyor.current) tazele.current({ silent: true })
    }, []),
  )
  useEffect(() => {
    kuruluyor.current = false
  }, [])

  // Sunucudan yeni yanıt = iyimser işaretler artık gereksiz (ya da yanlış).
  useEffect(() => {
    setIyimser((m) => (m.size ? new Map() : m))
  }, [veri.data])

  const harita = useMemo(() => iliskiHaritasi(veri.data), [veri.data])

  const iliski = useCallback(
    (userId) => {
      const anahtar = kimlikAnahtari(userId)
      return harita.get(anahtar) ?? iyimser.get(anahtar) ?? null
    },
    [harita, iyimser],
  )

  const istekGonderildi = useCallback((userId) => {
    setIyimser((m) => new Map(m).set(kimlikAnahtari(userId), { durum: ILISKI.giden }))
    tazele.current({ silent: true })
  }, [])

  return {
    /** İlk yanıt gelmeden ilişki bilinmiyor: çağıran eylemi pasif çizmeli, "yok" saymamalı. */
    yukleniyor: veri.loading && !veri.data,
    hata: veri.data ? null : veri.error,
    iliski,
    istekGonderildi,
    yenile: useCallback(() => tazele.current(), []),
  }
}
