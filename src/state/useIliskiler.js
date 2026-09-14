import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { ILISKI, iliskiHaritasi, kimlikAnahtari, konuAnahtari, konuHaritasi } from '../lib/iliski'
import { useAsync } from './useAsync'
import { useOnePlanaGelince } from './useOnePlanaGelince'

/**
 * Oturum sahibinin arkadaşlık ilişkileri (bkz. lib/iliski.js).
 *
 * ODAKTA VE ÖN PLANA DÖNÜŞTE SESSİZ TAZELENİYOR: ilişki çoğu zaman BAŞKA ekranda ya da
 * cihaz dışında değişiyor (Arkadaşlar'da kabul, karşı tarafın kabulü). Kurulu kalan Keşfet
 * ve profil ekranı tazelenmezse kabul edilmiş isteğin kartında "İstek gönderildi" kalırdı
 * (CLAUDE.md → "Başka ekranda değişen veri ODAKTA tazelenir"). Liste sıfırlanmıyor,
 * yalnızca bu küçük yanıt yeniden çekiliyor. Kurulumla aynı anda gelen odak atlanıyor
 * (bkz. useOnePlanaGelince). Akış başlığının gelen istek sayacı da bu yanıttan okunuyor.
 *
 * İYİMSER İŞARET: istek gönderilince kart ağ yanıtı beklemeden "İstek gönderildi"ye
 * dönüyor. İşaret sunucudan YENİ bir yanıt geldiğinde siliniyor — sunucu otorite. Kalıcı
 * tutulsaydı karşı taraf reddettiğinde düğme uygulama yeniden başlayana kadar pasif kalırdı.
 *
 * KONU DURUMU (konuDurumu / konuIstendi): Akış ve YKS kartları kişiyi değil KONUYU soruyor,
 * çünkü ders istekleri konu başına (bkz. lib/iliski.js → konuHaritasi). Konu isteğinin
 * iyimser işareti de aynı kuralla yaşıyor, bir farkla: konuIstendi TAZELEME İSTEMİYOR.
 * createMatch başarıyla döndüyse konunun durumu zaten belli; ikinci bir myMatches isteği
 * karta yeni bir şey söylemez. İşaret bir sonraki odak ya da ön plan tazelemesinde sunucu
 * yanıtıyla yer değiştiriyor (karşı taraf o arada kabul ettiyse "aktif" olarak).
 *
 * @param aktif false iken istek atılmaz. Keşfet artık üç sekmede de açık: YKS ilan kartları
 *   da konu durumunu soruyor.
 */
export function useIliskiler(aktif = true) {
  const veri = useAsync(() => (aktif ? api.myMatches() : Promise.resolve(null)), [aktif])
  const [iyimser, setIyimser] = useState(() => new Map())
  const [konuIyimser, setKonuIyimser] = useState(() => new Map())

  const tazele = useRef(veri.reload)
  tazele.current = veri.reload
  useOnePlanaGelince(() => tazele.current({ silent: true }))

  // Sunucudan yeni yanıt = iyimser işaretler artık gereksiz (ya da yanlış).
  useEffect(() => {
    setIyimser((m) => (m.size ? new Map() : m))
    setKonuIyimser((m) => (m.size ? new Map() : m))
  }, [veri.data])

  const harita = useMemo(() => iliskiHaritasi(veri.data), [veri.data])

  const iliski = useCallback(
    (userId) => {
      const anahtar = kimlikAnahtari(userId)
      return harita.get(anahtar) ?? iyimser.get(anahtar) ?? null
    },
    [harita, iyimser],
  )

  const konuHarita = useMemo(() => konuHaritasi(veri.data), [veri.data])

  /** Kişiden bu konuyu almak için süren durum: `{ durum: 'aktif' | 'bekliyor', matchId }` ya da null. */
  const konuDurumu = useCallback(
    (userId, topicId) => {
      const anahtar = konuAnahtari(userId, topicId)
      return konuHarita.get(anahtar) ?? konuIyimser.get(anahtar) ?? null
    },
    [konuHarita, konuIyimser],
  )

  // matchId null: kart bekleyen istekte matchId okumuyor (eylemi yok), gerçeği tazeleme getirir.
  const konuIstendi = useCallback((userId, topicId) => {
    setKonuIyimser((m) => new Map(m).set(konuAnahtari(userId, topicId), { durum: 'bekliyor', matchId: null }))
  }, [])

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
    konuDurumu,
    konuIstendi,
    /** Yanıtlanmayı bekleyen gelen istekler. Yanıt yokken 0: sayaç "bilinmiyor"u rozet
        olarak çizmesin. */
    gelenIstekSayisi: veri.data?.incoming?.length ?? 0,
    yenile: useCallback(() => tazele.current(), []),
  }
}
