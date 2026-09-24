import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { AppState } from 'react-native'
import { router, usePathname, useRootNavigationState } from 'expo-router'
import { api, loadSession } from '../lib/api'
import {
  KANALLAR,
  aliciBekle,
  aktifAliciyiAl,
  bildirimVerisi,
  gelenDinle,
  izinDurumu,
  izinIste,
  kanalDurumlari,
  kanallariKur,
  kayitYenilenmeli,
  pushDesteklenirMi,
  rozetAyarla,
  setAktifAlici,
  setAktifSohbet,
  setAydinlatmaTamam,
  sonYanit,
  sonYanitiTemizle,
  sunulanBildirimler,
  tokenAlVeKaydet,
  tokenDinle,
  turGrubu,
  yanitCozumle,
  yanitDinle,
} from '../lib/bildirimler'
import { dersDegisti } from '../lib/dersSurumu'
import { iliskiDegisti } from '../lib/iliskiSurumu'
import { IZIN_KAPANMA_SURESI } from '../components/IzinSayfasi'
import { urunTuruAcikMi, urunTuruDinle } from '../components/UrunTuru'
import { useAuth } from './AuthContext'
import { useInbox } from './InboxContext'
import { useIzin } from './IzinContext'

/*
  BİLDİRİM SAĞLAYICISI — push'un oturumlu yarısı: kayıt, dokunuş yönlendirmesi, ön plan
  tazelemeleri, tercihler ve aydınlatma sorusunun durumu.

  YERİ: kök layout'ta, oturumlu dalda, InboxProvider'ın İÇİNDE. Oturumsuz dalda hiç
  kurulmaz: kaydedilecek hesap yok ve GET /push/preferences 401'e koşardı. Gelen kutusunun
  içinde, çünkü ön planda gelen mesaj bildirimi sohbet listesini tazeliyor ve uygulama
  ikonundaki rozet okunmamış toplamından yazılıyor.

  expo-notifications'a DOĞRUDAN dokunmaz; her şey src/lib/bildirimler.js üzerinden
  (paketin yüklenemediği ortamlarda orası no-op döner, bu dosya da sessizce çalışır).

  ─── AYDINLATMA KAPISI ─────────────────────────────────────────────────────────
  Token YALNIZCA iki koşul birlikteyken alınır: işletim sistemi izni VE sunucudaki
  aydınlatma damgası (aydinlatmaAtUtc). İkincisi olmadan Firebase'e ya da Expo'ya hiç
  gidilmez; Android 7-12'de izin varsayılan AÇIK olduğu için tek başına izne bakmak,
  kullanıcıyı hiçbir şey görmeden push'a kaydetmek olurdu (KVKK Aydınlatma Tebliği
  m.5/1(b): aydınlatma veri akışından ÖNCE). Damga sunucudan gelince
  setAydinlatmaTamam(true) çağrılıyor; bildirimler.js o bayrak yokken token istemiyor.

  ─── DOKUNUŞ YÖNLENDİRMESİ ─────────────────────────────────────────────────────
  Soğuk açılış (getLastNotificationResponse) ve sıcak dokunuş (dinleyici) TEK yoldan,
  isle()'den geçiyor ve İKİ YOL DA son yanıtı temizliyor. Yalnızca soğuk yolda
  temizlenseydi, çıkış-giriş sonrası sağlayıcı yeniden kurulunca kullanıcı eski bir
  dokunuşun ekranına yeniden götürülürdü (getLastNotificationResponse sıcak dokunuşu da
  döndürüyor).

  OTURUM YOKKEN yönlendirme BEKLETİLİR: sağlayıcı kurulu olmadığı için dinleyici yok ve
  yanıt yerel modülde "son yanıt" olarak duruyor. Giriş yapılınca sağlayıcı kurulur ve
  onu soğuk açılış gibi işler. Başka hesapla giriş yapıldıysa alıcı etiketi tutmaz ve
  gezinilmez; 24 saatten eski dokunuş zaten yok sayılır (yanitCozumle).

  router.navigate, push DEĞİL: hedef yığında varsa (sohbet, Arkadaşlar, Derslerim hepsi
  `dangerouslySingular`) aynı ekran EN ÜSTE taşınır. Aynı sohbetin ikinci ekranı açılsaydı
  sökülen kopya LeaveConversation ile ORTAK hub bağlantısını gruptan çıkarır ve kalan ekran
  "Canlı bağlantı" yazarken mesaj alamazdı (app/_layout.jsx'teki gerekçe).
*/

const GUN_MS = 24 * 60 * 60 * 1000
// Tercihler öne her gelişte değil, en fazla bu sıklıkta yeniden okunur (başka cihazda
// verilen aydınlatma ya da değiştirilen anahtar buradan da görünsün, ama istek yağmasın).
const TERCIH_TAZELEME_MS = 5 * 60 * 1000

/*
  GERİ ÇEKİLME — kendiliğinden gösterilen soru (modal ya da satır içi kart) kaç kez
  "şimdi değil" dendikten sonra ne kadar bekler. Sayaç ve damga SUNUCUDA
  (soruErtelemeSayisi, soruErtelendiAtUtc): cihazda tutulsaydı her yeni değer bir izin
  kategorisi ve IZIN_SURUMU artışı demekti (IzinContext → ISLEVSEL_DEPOLAMA) ve telefon
  değişince soru baştan başlardı.
    0 erteleme → serbest · 1 → 14 gün · 2 → 60 gün · 3 ve üstü → bir daha kendiliğinden
    sorulmaz; yalnızca Bildirim ayarları ekranındaki düğme kalır.
*/
const GERI_CEKILME_GUN = { 1: 14, 2: 60 }

function geriCekilmeIzinVeriyor(tercihler, simdi = Date.now()) {
  const sayi = Number(tercihler?.soruErtelemeSayisi) || 0
  if (sayi <= 0) return true
  const gun = GERI_CEKILME_GUN[sayi]
  if (!gun) return false
  const son = Date.parse(tercihler?.soruErtelendiAtUtc ?? '')
  // Damga okunamıyorsa sayıya güvenilir ama süre bilinmez: sormak, susmaktan iyidir.
  return !Number.isFinite(son) || simdi - son >= gun * GUN_MS
}

/**
 * Aydınlatma sorusuna ihtiyaç var mı? İki durum:
 *  • izin verilmemiş ve sorulabilir (iOS'ta hiç sorulmamış; Android 13+'ta ilk retten
 *    sonra da `canAskAgain` true kalıyor — ikinci ve son hak),
 *  • izin VERİLMİŞ ama aydınlatma yok: Android 7-12'de izin varsayılan açık, telefon
 *    ayarlarından açan da buraya düşer. Bu grup soru görmezse hiç aydınlatılmaz.
 * Tercihler okunamadıysa (sunucu uçları yok, ağ yok) HAYIR: kararı kaydedecek yer yok.
 */
function aydinlatmaGerekli(izin, tercihler) {
  if (!pushDesteklenirMi() || !izin?.destekleniyor || !tercihler) return false
  if (!izin.verildi) return Boolean(izin.sorulabilir)
  return !tercihler.aydinlatmaAtUtc
}

const kapaliListe = (kanallar) =>
  KANALLAR.map((k) => k.kimlik).filter((kimlik) => kanallar?.[kimlik] === 'kapali')

const TUM_KANALLAR_ACIK = Object.freeze(Object.fromEntries(KANALLAR.map((k) => [k.kimlik, 'acik'])))

// Tercih yolundaki ad (ders-onayi) → GET yanıtındaki alan (dersOnayi). Tek kaynak KANALLAR.
const TERCIH_ALANI = Object.fromEntries(KANALLAR.map((k) => [k.kimlik, k.tercih]))

const bekle = (ms) => new Promise((coz) => setTimeout(coz, ms))

const BildirimBaglami = createContext(null)

export function BildirimSaglayici({ children }) {
  const { session } = useAuth()
  const sahip = session?.userId ?? null
  const { unreadTotal, loading: kutuYukleniyor, error: kutuHatasi, reloadConversations } = useInbox()
  const { mutlakaSor, ayarlarAcik } = useIzin()
  const turAcik = useSyncExternalStore(urunTuruDinle, urunTuruAcikMi, urunTuruAcikMi)
  const yol = usePathname()
  const navHazir = Boolean(useRootNavigationState()?.key)

  const [izin, setIzin] = useState(null)
  const [tercihler, setTercihler] = useState(null)
  const [tercihHatasi, setTercihHatasi] = useState(null)
  const [kanallar, setKanallar] = useState(TUM_KANALLAR_ACIK)
  const [alici, setAlici] = useState(null)
  // Kök modalın durumu. kip: 'otomatik' (bir eylemden sonra kendiliğinden; kapatmak
  // erteleme sayılır) | 'elle' (ayarlar ekranındaki düğme; kapatmak bir şey saymaz).
  const [soru, setSoru] = useState({ acik: false, kip: null, sebep: null })
  /*
    BU OTURUMDA HANGİ YÜZEY SORDU: null | 'modal' | kartın kimliği. Kendiliğinden soru
    oturum başına BİR YÜZEYDE çıkar: modalı kapatan kullanıcı başka ekranda aynı soruyu
    kart olarak görmesin, kartı görmezden gelen de her ekranda yeni bir kartla
    karşılaşmasın. Kartı sahiplenen ekran onu göstermeyi sürdürür.
    Sağlayıcı her girişte yeniden kurulduğu için "oturum" = bu giriş.
  */
  const [oturumYuzeyi, setOturumYuzeyi] = useState(null)
  // Bu oturumda bir kez "şimdi değil" dendiyse bir daha kendiliğinden sorulmaz — PUT
  // ulaşmasa bile (sunucudaki sayaç eski kalırsa geri çekilme onu göremezdi).
  const [oturumdaErtelendi, setOturumdaErtelendi] = useState(false)

  /* ── Ref aynaları: dinleyiciler ve zamanlayıcılar bayat kapanış okumasın ── */
  const izinRef = useRef(izin)
  izinRef.current = izin
  const tercihRef = useRef(tercihler)
  tercihRef.current = tercihler
  const soruRef = useRef(soru)
  soruRef.current = soru
  const reloadRef = useRef(reloadConversations)
  reloadRef.current = reloadConversations
  const oturumYuzeyiRef = useRef(oturumYuzeyi)
  oturumYuzeyiRef.current = oturumYuzeyi
  const navHazirRef = useRef(navHazir)
  navHazirRef.current = navHazir

  // Sağlayıcı hâlâ bu hesabın mı: çıkışta sökülür, arada hesap değişmiş olabilir.
  const canli = useRef(true)
  const guncel = useCallback(() => canli.current && (loadSession()?.userId ?? null) === sahip, [sahip])

  const sonTercihOkuma = useRef(0)
  // 'Acildi' kararı sunucuya ulaşmadıysa burada bekler; kayıttan ÖNCE yeniden gönderilir
  // (damga yokken sunucu kaydı kabul etmiyor: kayitli:false).
  const bekleyenAcildi = useRef(false)
  // Kullanıcı bu oturumda "Aç/Devam"a bastı mı. Karar PUT'u uçuştayken dönen eski bir GET
  // yanıtı (damga henüz yok) yerel aydınlatmayı silmesin; aksi hâlde kayıt atlanır ve
  // soru aynı oturumda yeniden belirirdi.
  const yerelAcildi = useRef(false)
  // Bildirim merkezinde görülmüş bildirimler: öne her gelişte aynı bildirim sayacı
  // yeniden artırmasın.
  const gorulenler = useRef(new Set())
  const islenenYanitlar = useRef(new Set())
  const bekleyenYanitlar = useRef([])
  const soruPlani = useRef(null)

  /* ── Tercih kuyruğu (tercihDegistir) ── */
  // Sunucunun ONAYLADIĞI son değerler: hata olursa ekran buna döner (dokunuştan önceki
  // değere değil — arada başka bir yazım onaylanmış olabilir).
  const onayli = useRef({})
  const bekleyenTercihler = useRef(new Map())
  const tercihUcusu = useRef(false)

  /* ─── Tercihleri oku ─────────────────────────────────────────────────────── */

  const tercihleriYukle = useCallback(async () => {
    try {
      const t = await api.pushPreferences()
      if (!guncel()) return null
      sonTercihOkuma.current = Date.now()
      onayli.current = Object.fromEntries(KANALLAR.map((k) => [k.tercih, Boolean(t?.[k.tercih])]))
      // Sunucuya henüz ulaşmamış yerel kararlar yanıtın üstüne biner: kuyruktaki anahtar
      // ve gönderilemeyen aydınlatma kararı, eski sunucu değeriyle ezilmesin.
      const yerel = {}
      for (const [kategori, acik] of bekleyenTercihler.current) yerel[TERCIH_ALANI[kategori]] = acik
      const birlesik = {
        ...t,
        ...yerel,
        aydinlatmaAtUtc:
          t?.aydinlatmaAtUtc ?? (yerelAcildi.current ? tercihRef.current?.aydinlatmaAtUtc ?? null : null),
      }
      // Ref HEMEN: çağıran (kurulum, öne geliş) bir sonraki satırda kaydiDene'yi çağırıyor
      // ve render beklenirse eski (null) tercihi görüp kaydı sessizce atlardı.
      tercihRef.current = birlesik
      setTercihler(birlesik)
      setTercihHatasi(null)
      if (typeof t?.alici === 'string') {
        setAktifAlici(t.alici)
        setAlici(t.alici)
      }
      setAydinlatmaTamam(Boolean(birlesik.aydinlatmaAtUtc))
      return birlesik
    } catch (hata) {
      if (guncel()) setTercihHatasi(hata)
      return null
    }
  }, [guncel])

  /* ─── Aydınlatma kararı ──────────────────────────────────────────────────── */

  /** PUT /push/prompt. Asla fırlatmaz; ulaştı mı döner. */
  const kararGonder = useCallback(async (karar) => {
    try {
      await api.pushPromptDecision(karar)
      if (karar === 'Acildi') bekleyenAcildi.current = false
      return true
    } catch {
      if (karar === 'Acildi') bekleyenAcildi.current = true
      return false
    }
  }, [])

  /* ─── Kayıt ──────────────────────────────────────────────────────────────── */

  /*
    İzin + aydınlatma varsa token'ı al ve bu hesaba bağla. Tek uçuş ve "en son kazanır"
    kuralı bildirimler.js → tokenAlVeKaydet'te; burası yalnızca kapıyı ve bekleyen
    aydınlatma kararını yönetiyor. Asla fırlatmaz.
  */
  const kaydiDene = useCallback(
    async (kanalDurumu) => {
      if (!pushDesteklenirMi() || !guncel()) return null
      if (!izinRef.current?.verildi || !tercihRef.current?.aydinlatmaAtUtc) return null
      if (bekleyenAcildi.current && !(await kararGonder('Acildi'))) return null
      const kapali = kapaliListe(kanalDurumu ?? (await kanalDurumlari()))
      const sonuc = await tokenAlVeKaydet({ kapaliKanallar: kapali })
      if (guncel() && sonuc?.alici) setAlici(sonuc.alici)
      return sonuc
    },
    [guncel, kararGonder],
  )
  const kaydiDeneRef = useRef(kaydiDene)
  kaydiDeneRef.current = kaydiDene

  /* ─── Sunulmuş bildirimler → sürüm sayaçları ─────────────────────────────── */

  /*
    Arka planda (uygulama kapalıyken ya da askıdayken) gelen bildirim için ön plan
    dinleyicisi ÇALIŞMIYOR. Öne gelişte bildirim merkezine bakılıyor: yeni bir ders ya da
    istek bildirimi varsa ilgili sayaç artar ve ekranda duran Derslerim/Arkadaşlar anında
    tazelenir (kilitli telefona gelen "Dersin onay bekliyor"dan sonra ikondan dönen
    kullanıcı onay kartını görsün). `sadeceIsaretle`: açılışta var olanlar sayılmaz,
    ekranlar zaten taze veriyle kuruluyor.
  */
  const sunulanlariSay = useCallback(
    async (sadeceIsaretle = false) => {
      const liste = await sunulanBildirimler()
      if (!guncel()) return
      const benim = aktifAliciyiAl()
      let ders = false
      let iliski = false
      for (const b of liste) {
        if (!b.kimlik || gorulenler.current.has(b.kimlik)) continue
        gorulenler.current.add(b.kimlik)
        if (sadeceIsaretle) continue
        // Başka hesabın geç gelmiş bildirimi bu hesabın ekranlarını tazelemez.
        if (b.alici && benim && b.alici !== benim) continue
        const grup = turGrubu(b.tur)
        if (grup === 'ders') ders = true
        else if (grup === 'iliski') iliski = true
      }
      if (ders) dersDegisti()
      if (iliski) iliskiDegisti()
    },
    [guncel],
  )

  /* ─── Kurulum: oturum açıldı ─────────────────────────────────────────────── */

  useEffect(() => {
    canli.current = true
    // Önceki hesabın etiketi bu hesabın bildirimlerini süzmesin; yenisi GET ile gelir.
    setAktifAlici(null)
    let iptal = false
    ;(async () => {
      // İzin isteminden ÖNCE kanallar: Android 13+ kanal yokken istemi hiç göstermiyor.
      await kanallariKur()
      const [iz, kanal] = await Promise.all([izinDurumu(), kanalDurumlari()])
      if (iptal || !guncel()) return
      izinRef.current = iz
      setIzin(iz)
      setKanallar(kanal)
      await sunulanlariSay(true)
      await tercihleriYukle()
      if (iptal) return
      kaydiDeneRef.current(kanal)
    })()
    return () => {
      iptal = true
      canli.current = false
      if (soruPlani.current) clearTimeout(soruPlani.current)
      soruPlani.current = null
    }
    // Hesap değişince (çıkış-giriş sağlayıcıyı zaten yeniden kurar) baştan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sahip])

  /* ─── Öne geliş ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    const abonelik = AppState.addEventListener('change', async (durum) => {
      if (durum !== 'active' || !guncel()) return
      // İzin ve kanallar telefon ayarlarında değişmiş olabilir ("Ayarları aç"tan dönüş).
      const [iz, kanal] = await Promise.all([izinDurumu(), kanalDurumlari()])
      if (!guncel()) return
      izinRef.current = iz
      setIzin(iz)
      setKanallar(kanal)
      if (!tercihRef.current || Date.now() - sonTercihOkuma.current >= TERCIH_TAZELEME_MS) {
        await tercihleriYukle()
        if (!guncel()) return
      }
      /*
        Kayıt YİNELENİR: son başarıdan 30 dk geçtiyse ya da kapalı kanal listesi değiştiyse
        (kayitYenilenmeli). Askı bitişi, token taşınması ya da DeviceNotRegistered sonrası
        "oturum canlı, satır yok" durumunu da bu kapatıyor; idempotent upsert.
      */
      if (bekleyenAcildi.current || kayitYenilenmeli(kapaliListe(kanal))) kaydiDeneRef.current(kanal)
      sunulanlariSay()
    })
    return () => abonelik.remove()
  }, [guncel, tercihleriYukle, sunulanlariSay])

  /* ─── Ön planda gelen bildirim ───────────────────────────────────────────── */

  useEffect(
    () =>
      gelenDinle((bildirim) => {
        const veri = bildirimVerisi(bildirim)
        const benim = aktifAliciyiAl()
        if (veri.alici && benim && veri.alici !== benim) return
        const kimlik = bildirim?.request?.identifier
        // Öne dönüşte bildirim merkezinde bulunursa ikinci kez sayılmasın.
        if (kimlik) gorulenler.current.add(kimlik)
        switch (turGrubu(veri.tur)) {
          case 'mesaj':
            // Hub bağlıyken ConversationUpdated zaten tazeliyor; bağlantı kopukken tek
            // haber bu. İkisi çakışırsa useAsync'in nesil sayacı eskiyi atar.
            reloadRef.current()
            break
          case 'iliski':
            iliskiDegisti()
            break
          case 'ders':
            dersDegisti()
            break
          default:
        }
      }),
    [],
  )

  /* ─── Dokunuş: soğuk açılış + sıcak dokunuş ──────────────────────────────── */

  const isle = useCallback(
    async (yanit) => {
      const karar = yanitCozumle(yanit)
      // İKİ YOLDA DA temizlenir (dosya başındaki gerekçe) — karar null olsa bile.
      sonYanitiTemizle()
      if (!karar) return
      // Soğuk açılışta aynı dokunuş hem "son yanıt" hem dinleyici olarak gelebiliyor.
      const anahtar = `${karar.kimlik ?? ''}|${yanit?.notification?.date ?? ''}`
      if (islenenYanitlar.current.has(anahtar)) return
      islenenYanitlar.current.add(anahtar)

      if (karar.alici) {
        // Etiket GET /push/preferences ile geliyor; soğuk açılışta henüz yok olabilir.
        // 3 sn içinde gelmezse yine de gidilir: hedef ekranın verisini sunucu zaten
        // yetkiye göre veriyor, başka hesabın sohbeti açılamaz.
        const benim = await aliciBekle(3000)
        if (!guncel()) return
        if (benim && benim !== karar.alici) return
      }
      // Hedef ekran yığında zaten kuruluysa (kök yığın ekranları sökmüyor) tazelensin.
      const grup = turGrubu(karar.tur)
      if (grup === 'ders') dersDegisti()
      else if (grup === 'iliski') iliskiDegisti()
      else if (grup === 'mesaj') reloadRef.current()
      if (!karar.rota) return
      // Bir tur bekle: girişin hemen ardından gelindiyse kök yığının guard geçişi
      // (giriş → korunan dal) aynı karede sürüyor olabilir.
      await bekle(0)
      if (guncel()) router.navigate(karar.rota)
    },
    [guncel],
  )
  const isleRef = useRef(isle)
  isleRef.current = isle

  // Dinleyici hemen kuruluyor; navigasyon ağacı hazır değilse dokunuş sıraya alınır.
  useEffect(
    () =>
      yanitDinle((yanit) => {
        if (navHazirRef.current) isleRef.current(yanit)
        else bekleyenYanitlar.current.push(yanit)
      }),
    [],
  )

  useEffect(() => {
    if (!navHazir) return
    const sira = bekleyenYanitlar.current
    bekleyenYanitlar.current = []
    // Soğuk açılış: uygulamayı açan dokunuş (ya da oturum yokken bekletilmiş olan).
    const ilk = sonYanit()
    if (ilk) isleRef.current(ilk)
    for (const yanit of sira) isleRef.current(yanit)
  }, [navHazir])

  /* ─── Yeni cihaz token'ı (FCM/APNs döndürdü) ─────────────────────────────── */

  const aydinlatildi = Boolean(tercihler?.aydinlatmaAtUtc)
  useEffect(() => {
    // YALNIZCA aydınlatmadan sonra: dinleyici token üretmez ama kayıt yolunu açar.
    if (!aydinlatildi) return undefined
    return tokenDinle(() => kaydiDeneRef.current())
  }, [aydinlatildi])

  /* ─── Açık sohbet (ön plan gösterim kararı için) ─────────────────────────── */

  /*
    Sohbet ekranı açıkken o sohbetin mesaj bildirimi ön planda GÖSTERİLMEZ (mesaj zaten
    canlı akışta). "Açık sohbet" adresten okunuyor: adres ODAKTAKİ rotanın adresi, yani
    sohbetin üstüne profil itilince kendiliğinden düşüyor ve uygulama öne dönünce yine
    doğru. Sohbet ekranının kendi odak olayına bağlansaydı bu dosyayla iki ayrı doğruluk
    kaynağı olurdu.
  */
  useEffect(() => {
    const eslesme = /^\/sohbet\/([^/?#]+)$/.exec(yol ?? '')
    setAktifSohbet(eslesme ? eslesme[1] : null)
  }, [yol])
  useEffect(() => () => setAktifSohbet(null), [])

  /* ─── Uygulama ikonundaki rozet ──────────────────────────────────────────── */

  useEffect(() => {
    // Liste yüklenmeden ya da hata varken 0 yazmak, gerçek sayıyı silmek olurdu.
    if (kutuYukleniyor || kutuHatasi) return
    rozetAyarla(unreadTotal)
  }, [unreadTotal, kutuYukleniyor, kutuHatasi])

  /* ─── Aydınlatma sorusu ──────────────────────────────────────────────────── */

  const gerekli = aydinlatmaGerekli(izin, tercihler)
  /*
    KENDİLİĞİNDEN gösterilebilir mi (modal ve kart için ortak): ihtiyaç var, geri
    çekilme izin veriyor, bu oturumda ertelenmedi, izin sayfası kapalı ve ürün turu
    açık değil. Tur ve izin sayfası kök layout'ta tam ekran katmanlar; soru onların
    üstüne ya da altına binseydi (iOS'ta aynı anda iki Modal) biri görünmeden kaybolurdu.
  */
  const otomatikMumkun =
    gerekli &&
    !oturumdaErtelendi &&
    !(mutlakaSor || ayarlarAcik) &&
    !turAcik &&
    geriCekilmeIzinVeriyor(tercihler)

  const otomatikMumkunRef = useRef(otomatikMumkun)
  otomatikMumkunRef.current = otomatikMumkun

  /**
   * Bir eylemden sonra modalı kendiliğinden aç. `gecikme`: eylemi yapan alt sayfa
   * kapanırken açılmasın — iOS'ta kapanan RN Modal'la aynı karede açılan ikinci Modal
   * hiç görünmeyebiliyor (IzinSayfasi → IZIN_KAPANMA_SURESI). Kaynak modal yoksa 0.
   * @returns planlandı mı
   */
  const soruGoster = useCallback((sebep, { gecikme = IZIN_KAPANMA_SURESI } = {}) => {
    const uygun = () => otomatikMumkunRef.current && !oturumYuzeyiRef.current && !soruRef.current.acik
    if (soruPlani.current || !uygun()) return false
    soruPlani.current = setTimeout(() => {
      soruPlani.current = null
      // Beklerken durum değişmiş olabilir (tur açıldı, başka bir yüzey sordu).
      if (!canli.current || !uygun()) return
      setSoru({ acik: true, kip: 'otomatik', sebep })
    }, gecikme)
    return true
  }, [])

  /** Bildirim ayarları ekranındaki düğme: koşulsuz açar, kapatmak erteleme sayılmaz. */
  const soruAc = useCallback((sebep = 'ayarlar') => {
    setSoru({ acik: true, kip: 'elle', sebep })
  }, [])

  /*
    "Gösterildi" işareti Modal'ın onShow anında konuyor, açma kararında değil: kararı
    verilip hiç görünmeyen bir soru (iOS'ta üst üste binen Modal) bu oturumun hakkını
    sessizce yemesin.
  */
  const soruGosterildi = useCallback(() => {
    setOturumYuzeyi((y) => y ?? 'modal')
  }, [])

  /** Kart kendini gösterdiği ilk anda bu oturumun soru yüzeyi olur. */
  const kartiSahiplen = useCallback((kimlik) => {
    setOturumYuzeyi((y) => y ?? kimlik)
  }, [])

  const kartGorunur = useCallback(
    (kimlik) => otomatikMumkun && !soru.acik && (oturumYuzeyi === null || oturumYuzeyi === kimlik),
    [otomatikMumkun, soru.acik, oturumYuzeyi],
  )

  /** "Şimdi değil", karartma, geri tuşu, "Gizle": erteleme (sunucu sayacı +1). */
  const ertele = useCallback(() => {
    setOturumdaErtelendi(true)
    setTercihler((t) =>
      t
        ? {
            ...t,
            soruErtelemeSayisi: (Number(t.soruErtelemeSayisi) || 0) + 1,
            soruErtelendiAtUtc: new Date().toISOString(),
          }
        : t,
    )
    // Ateşle-unut: ulaşmazsa bu oturum yine susuyor (oturumdaErtelendi), sayaç bir
    // sonraki kararda artar.
    kararGonder('Ertelendi')
  }, [kararGonder])

  /**
   * Modal kapandı. Kendiliğinden açılmış sorunun HER kapanış yolu erteleme sayılır:
   * yalnızca "Şimdi değil"e bağlansaydı karartmaya dokunarak kapatan kullanıcı her
   * oturumda, her istekte soruyu yeniden görürdü. Elle açılanda bir şey sayılmaz.
   */
  const soruKapat = useCallback(() => {
    const { kip, acik } = soruRef.current
    if (!acik) return
    setSoru((s) => ({ ...s, acik: false }))
    if (kip === 'otomatik') ertele()
  }, [ertele])

  const onayUcusu = useRef(null)

  /**
   * "Bildirimleri aç" / iOS'ta "Devam". Sıra:
   *   karar sunucuya (Acildi) → modal kapanır → 350 ms → izin yoksa sistem istemi →
   *   izin verildiyse kayıt.
   * Android 13 altında sistem istemi yok; izin zaten açık, doğrudan kayıt.
   *
   * Karar PUT'u BEKLENMEDEN ilerleniyor (sistem istemi o sırada açık kalıyor); ulaşmazsa
   * kayıttan önce yeniden gönderilir (bekleyenAcildi). Kullanıcı metni gördü; yerel
   * aydınlatma bayrağı bu yüzden hemen açılıyor.
   *
   * Sistem isteminde REDDEDİLİRSE erteleme sayılır: Android 13+'ta ilk retten sonra izin
   * yeniden sorulabiliyor ve geri çekilme olmadan soru her oturumda dönerdi.
   *
   * @param secenekler.modalKapat modaldan mı çağrıldı (kapanış beklenir)
   * @returns 'acildi' | 'reddedildi' | 'desteklenmiyor' | null (oturum değişti)
   */
  const aydinlatmayiOnayla = useCallback(
    ({ modalKapat = false } = {}) => {
      if (onayUcusu.current) return onayUcusu.current
      onayUcusu.current = (async () => {
        yerelAcildi.current = true
        const kararSozu = kararGonder('Acildi')
        setAydinlatmaTamam(true)
        setTercihler((t) => (t ? { ...t, aydinlatmaAtUtc: t.aydinlatmaAtUtc ?? new Date().toISOString() } : t))
        tercihRef.current = tercihRef.current && {
          ...tercihRef.current,
          aydinlatmaAtUtc: tercihRef.current.aydinlatmaAtUtc ?? new Date().toISOString(),
        }
        if (modalKapat) {
          setSoru((s) => ({ ...s, acik: false }))
          await bekle(IZIN_KAPANMA_SURESI)
        }
        let iz = izinRef.current ?? (await izinDurumu())
        if (!iz.destekleniyor) return 'desteklenmiyor'
        if (!iz.verildi && iz.sorulabilir) iz = await izinIste()
        if (!guncel()) return null
        izinRef.current = iz
        setIzin(iz)
        if (!iz.verildi) {
          ertele()
          return 'reddedildi'
        }
        await kararSozu
        await kaydiDeneRef.current()
        return 'acildi'
      })().finally(() => {
        onayUcusu.current = null
      })
      return onayUcusu.current
    },
    [ertele, guncel, kararGonder],
  )

  /* ─── Tercihler (Bildirim ayarları ekranı) ───────────────────────────────── */

  /*
    TEK UÇUŞLU KUYRUK: aynı anda tek PUT. Uçuş sürerken gelen dokunuşlar birikmez;
    kategori başına yalnızca SON istenen durum tutulur ve uçuş bitince gönderilir.
    Paralel iki PUT'ta eskisi sona kalırsa ekran "kapalı" derken sunucu açık kalırdı.
    Hata olursa ekran son ONAYLANMIŞ sunucu değerine döner.
  */
  const tercihPompala = useCallback(async () => {
    if (tercihUcusu.current) return
    tercihUcusu.current = true
    try {
      while (bekleyenTercihler.current.size > 0 && guncel()) {
        const [kategori, acik] = bekleyenTercihler.current.entries().next().value
        bekleyenTercihler.current.delete(kategori)
        const alan = TERCIH_ALANI[kategori]
        if (onayli.current[alan] === acik) continue
        try {
          await api.setPushPreference(kategori, acik)
          onayli.current = { ...onayli.current, [alan]: acik }
        } catch (hata) {
          if (!guncel()) return
          setTercihHatasi(hata)
          // Arada aynı anahtara yeni bir dokunuş geldiyse o kazanır; gelmediyse geri dön.
          if (!bekleyenTercihler.current.has(kategori)) {
            setTercihler((t) => (t ? { ...t, [alan]: onayli.current[alan] ?? t[alan] } : t))
          }
        }
      }
    } finally {
      tercihUcusu.current = false
    }
  }, [guncel])

  /** @param kategori KANALLAR[].kimlik ('mesajlar' | 'istekler' | 'ders-onayi' | 'ders-plani') */
  const tercihDegistir = useCallback(
    (kategori, acik) => {
      const alan = TERCIH_ALANI[kategori]
      if (!alan) return
      setTercihHatasi(null)
      setTercihler((t) => (t ? { ...t, [alan]: Boolean(acik) } : t))
      bekleyenTercihler.current.set(kategori, Boolean(acik))
      tercihPompala()
    },
    [tercihPompala],
  )

  /** İzin ve kanal durumunu yeniden oku (ayarlar ekranı odakta). */
  const durumuTazele = useCallback(async () => {
    const [iz, kanal] = await Promise.all([izinDurumu(), kanalDurumlari()])
    if (!guncel()) return
    izinRef.current = iz
    setIzin(iz)
    setKanallar(kanal)
  }, [guncel])

  const deger = useMemo(
    () => ({
      destekleniyor: pushDesteklenirMi(),
      izin,
      tercihler,
      tercihHatasi,
      kanallar,
      alici,
      aydinlatmaGerekli: gerekli,
      soru,
      soruGoster,
      soruAc,
      soruKapat,
      soruGosterildi,
      kartGorunur,
      kartiSahiplen,
      ertele,
      aydinlatmayiOnayla,
      tercihDegistir,
      tercihleriTazele: tercihleriYukle,
      durumuTazele,
    }),
    [
      izin,
      tercihler,
      tercihHatasi,
      kanallar,
      alici,
      gerekli,
      soru,
      soruGoster,
      soruAc,
      soruKapat,
      soruGosterildi,
      kartGorunur,
      kartiSahiplen,
      ertele,
      aydinlatmayiOnayla,
      tercihDegistir,
      tercihleriYukle,
      durumuTazele,
    ],
  )

  return <BildirimBaglami.Provider value={deger}>{children}</BildirimBaglami.Provider>
}

/*
  Sağlayıcı DIŞINDA (oturumsuz dal) bu nesne döner: push isteğe bağlı bir katman ve bir
  ekranın sağlayıcı dışında çizilmesi istek göndermeyi ya da ekranı düşürmemeli.
  Diğer bağlamların (useAuth, useInbox) fırlatan kalıbından bilerek ayrılıyor.
*/
const BOS = Object.freeze({
  destekleniyor: false,
  izin: null,
  tercihler: null,
  tercihHatasi: null,
  kanallar: TUM_KANALLAR_ACIK,
  alici: null,
  aydinlatmaGerekli: false,
  soru: { acik: false, kip: null, sebep: null },
  soruGoster: () => false,
  soruAc: () => {},
  soruKapat: () => {},
  soruGosterildi: () => {},
  kartGorunur: () => false,
  kartiSahiplen: () => {},
  ertele: () => {},
  aydinlatmayiOnayla: () => Promise.resolve(null),
  tercihDegistir: () => {},
  tercihleriTazele: () => Promise.resolve(null),
  durumuTazele: () => Promise.resolve(),
})

/**
 * Bildirim bağlamı:
 *  destekleniyor, izin, tercihler, tercihHatasi, kanallar ({ kimlik: 'acik'|'kapali' }),
 *  alici, aydinlatmaGerekli,
 *  soruGoster(sebep, { gecikme? }) — eylemden sonra kendiliğinden modal (koşullar içeride),
 *  soruAc(sebep?) — ayarlar ekranından elle,
 *  kartGorunur(kimlik) / kartiSahiplen(kimlik) — satır içi kart (BildirimIzniKarti),
 *  aydinlatmayiOnayla({ modalKapat? }), ertele(),
 *  tercihDegistir(kategori, acik), tercihleriTazele(), durumuTazele().
 */
export function useBildirim() {
  return useContext(BildirimBaglami) ?? BOS
}
