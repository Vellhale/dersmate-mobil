import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  api,
  hydrateSession,
  loadSession,
  onAuthExpired,
  onOturumYenilendi,
  oturumuSonlandir,
  saveSession,
} from '../lib/api'
import { oturumKapandi, unutmaCalistir, unutmaIsaretle } from '../lib/bildirimler'
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
      /*
        ÇEVRİMDIŞI ÇIKIŞTAN KALAN PUSH KAYDI — oturum olsun olmasın, açılışta bir kez.
        Önceki çıkışın sunucu çağrısı ulaşmadıysa (logout → unutmaIsaretle) bu cihazın
        token'ı sunucuda eski hesaba bağlı kalmıştır ve telefona o hesabın bildirimleri
        gelmeye devam eder. İşaret yoksa ağa çıkılmaz; varsa token okunup
        POST /push/devices/forget çağrılır. Asla fırlatmaz; ulaşmazsa iş sonraki açılışa.
        Oturumluysa sağlayıcının kaydı da önce bunu bekliyor (sıra: unut → yeniden kaydet).
      */
      unutmaCalistir()
    })
    return () => {
      mounted = false
    }
  }, [])

  // Oturum bittiğinde (401 ve yenileme de olmadı) düşür — API katmanı bu olayı yayınlar.
  useEffect(() => {
    return onAuthExpired(() => {
      saveSession(null)
      setSession(null)
      /* Bildirim merkezi, rozet ve bellekteki alıcı etiketi de gider: kilit ekranında
         düşmüş oturumun bildirimleri kalmasın. Unutma işareti YAZILMAZ: sunucu bu oturumu
         zaten reddetti ve gönderim süzgeci "cihazın en yeni oturumu aktif mi" diye bakıyor. */
      oturumKapandi()
    })
  }, [])

  // Arka planda yenilenen oturum (rol ve isAdmin dahil) React durumuna da yansısın.
  useEffect(() => onOturumYenilendi(setSession), [])

  /*
    rememberMe AÇIKÇA true: mobilde "Beni hatırla" kutusu yok. Web'in gerekçesi ortak
    bilgisayar; telefon kişisel cihaz ve oturum SecureStore'da. Sunucu varsayılanı da
    true ama ona sessizce yaslanmak, varsayılan değişirse yenilemeyi fark ettirmeden
    kapatırdı: false giderse sunucu yenileme token'ı hiç üretmez, oturum 2 saate iner.
    Parametre web imzasıyla aynı kalsın diye var; mobilde onu dolduran kutu yok.
  */
  const login = useCallback(async (email, password, rememberMe = true) => {
    const hwidHash = await getHwidHash()
    const result = await api.login({ email, password, hwidHash, rememberMe })
    saveSession(result)
    setSession(result)
    return result
  }, [])

  /*
    ÇIKIŞ: önce YEREL, sonra sunucu — ve sunucu BEKLENMEZ.

    Sıra bilinçli. Yerel silme senkron ve kesin; kullanıcı düğmeye bastığı anda giriş
    ekranına düşer. Sunucu iptali beklenseydi, ağ yokken ya da sunucu yavaşken çıkış
    takılır ya da başarısız görünürdü — hâlbuki oturum cihazdan gitmiş olurdu.

    Token silinmeden ÖNCE okunuyor: saveSession(null) sonrası okumaya çalışsaydık iptal
    edilecek değer elimizde olmazdı ve çağrı sessizce boşa giderdi (api.js token yoksa
    hiç ağa çıkmıyor) — hatanın kendisi de görünmezdi.

    `onAuthExpired` yolunda BU ÇAĞRI YAPILMIYOR ve yapılmamalı: orada oturumu sunucu
    zaten reddetti, yenileme token'ı ölü. İptal isteği en iyi ihtimalle no-op, en
    kötüsünde başarısız bir istekten sonra yine aynı yere varırdı.

    PUSH: sunucu çıkışta bu cihazın push kaydını da siliyor (LogoutHandler); mobil ayrı
    bir silme isteği ATMAZ. Çıkış çağrısı ulaşmazsa (false) kayıt sunucuda kalır — o
    zaman "unutulacak" işareti yazılır ve bir sonraki açılış kaydı unutturur (yukarıdaki
    unutmaCalistir). Bildirim merkezi ve rozet ağı beklemeden, hemen temizlenir.
  */
  const logout = useCallback(() => {
    const refreshToken = loadSession()?.refreshToken
    saveSession(null)
    setSession(null)
    oturumKapandi()
    oturumuSonlandir(refreshToken).then((ulasti) => {
      if (!ulasti) unutmaIsaretle().catch(() => {})
    })
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
