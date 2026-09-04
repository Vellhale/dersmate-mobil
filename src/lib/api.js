import axios from 'axios'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { KEYS, prefs, secure } from './storage'
import { ONIZLEME, ONIZLEME_OTURUMU, onizlemeApi } from './onizleme'

/*
  API KATMANI — web'deki src/lib/api.js'in mobil karşılığı. Yüzey (api.*) bilinçli
  olarak AYNI tutuldu: web sayfaları mobile çevrilirken çağrılar değişmeden taşınsın.

  İki temel fark var:

  1. fetch → axios (istek üzerine). ProblemDetails eşlemesi interceptor'da tek yerde.
  2. localStorage (senkron) → SecureStore (async). Oturum açılışta BİR KEZ okunup
     bellekte tutuluyor; getToken() senkron kalıyor ki interceptor ve SignalR
     accessTokenFactory beklemeden çalışsın.
*/

/*
  API ADRESİ — mobilde "localhost" CİHAZIN KENDİSİDİR, geliştirme makinesi değil.

  Çözüm sırası:
  1. EXPO_PUBLIC_API_URL (.env) — fiziksel cihaz / staging / üretim için tek doğru yol.
  2. Expo Go geliştirmede: Metro'nun hostUri'sinden geliştirme makinesinin LAN IP'si
     türetilir (ör. "192.168.1.5:8081" → "http://192.168.1.5:5000"). Telefon ve
     bilgisayar aynı ağdaysa ekstra ayar gerekmez.
  3. Emülatör yedekleri: Android emülatörü ana makineyi 10.0.2.2 olarak görür,
     iOS simülatörü localhost'u paylaşır.

  ⚠️ Backend'in CORS listesi tarayıcı içindir; native istekte Origin başlığı olmadığı
  için CORS engeli yok. Ancak API'nin LAN'dan erişilebilir dinlemesi gerekir
  (launchSettings'te http://0.0.0.0:5000 ya da --urls ile).
*/
function resolveApiBase() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri) {
    const host = hostUri.split(':')[0]
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:5000`
    }
  }

  /*
    GELİŞTİRME YEDEĞİ — ve YALNIZCA geliştirmede geçerli.

    Bağımsız derlemede (APK/IPA) Metro yoktur, yani hostUri null gelir ve buradaki
    emülatör adresi devreye girerdi: kullanıcının telefonu 10.0.2.2'ye istek atar,
    her çağrı sessizce "sunucuya ulaşılamadı"ya düşer. Sessiz yanlış adres yerine
    gürültülü bir uyarı: __DEV__ kapalıyken adres BOŞ kalır ve istekler açık bir
    yapılandırma hatası verir. (Web tarafı aynı kararı import.meta.env.DEV ile aldı.)
  */
  if (!__DEV__) {
    console.error(
      '[api] EXPO_PUBLIC_API_URL tanımlı değil. Üretim derlemesinde API adresi ' +
        'derleme anında gömülmeli (bkz. eas.json build profilleri).',
    )
    return ''
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000'
}

export const API_BASE = resolveApiBase()

/**
 * Backend'in ProblemDetails yanıtı: { status, title = HATA_KODU, detail = Türkçe mesaj }.
 * SignalR tarafında aynı bilgi "KOD|mesaj" formatında gelir (bkz. useChatHub).
 */
export class ApiError extends Error {
  constructor(message, code, status) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/* ---------- Oturum: bellekte senkron, kalıcılığı SecureStore'da ---------- */

let sessionCache = null
let hydrated = false

/** Uygulama açılışında BİR KEZ çağrılır (AuthContext). Sonrası bellekten okunur. */
export async function hydrateSession() {
  if (hydrated) return sessionCache
  // Önizleme modunda oturum açık başlar — tüm ekranlar backend'siz gezilebilsin.
  if (ONIZLEME) {
    sessionCache = { ...ONIZLEME_OTURUMU }
    hydrated = true
    return sessionCache
  }
  const raw = await secure.get(KEYS.session)
  try {
    sessionCache = raw ? JSON.parse(raw) : null
  } catch {
    sessionCache = null
  }

  await avatarSurumleriniYukle()

  hydrated = true
  return sessionCache
}

/*
  Avatar sayaçlarını diskten geri yükler. Oturum hidrasyonuna bağlanmasının sebebi
  sırayla ilgili: ilk çizimden ÖNCE tamamlanmalı, yoksa o çizim temel URI'yi kullanıp
  Fresco'ya eski görseli sordurur ve önbellek bir daha kırılmaz.
*/
async function avatarSurumleriniYukle() {
  const ham = await prefs.get(KEYS.avatarSurumleri)
  if (!ham) return
  try {
    for (const [anahtar, surum] of Object.entries(JSON.parse(ham))) {
      if (Number.isFinite(surum)) avatarVersions.set(anahtar, surum)
    }
  } catch {
    // Bozuk kayıt: sayaçsız devam. En kötü ihtimalle bir kez eski görsel görünür.
  }
}

export function loadSession() {
  return sessionCache
}

export function saveSession(session) {
  sessionCache = session
  hydrated = true
  // Kalıcılık arka planda; bellek zaten güncel olduğu için beklenmesi gerekmiyor.
  secure.set(KEYS.session, session ? JSON.stringify(session) : null)
}

export function getToken() {
  return sessionCache?.accessToken ?? null
}

/*
  401 alındığında oturumu düşürmek için AuthContext bunu dinler.
  Web'de window CustomEvent'ti; RN'de window yok — küçük bir abone listesi yetiyor.
*/
const authExpiredListeners = new Set()

export function onAuthExpired(listener) {
  authExpiredListeners.add(listener)
  return () => authExpiredListeners.delete(listener)
}

/* ---------- Axios istemcisi ---------- */

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
})

client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/**
 * Sunucu GÖVDESİZ bir hata döndürdüğünde gösterilecek metin.
 *
 * ⚠️ 403 BURADA ÖZEL OLARAK ELE ALINIYOR ve sebebi web'de ölçüldü: ASP.NET'in yetki
 * politikası (RequireRole) reddettiğinde **gövdesi tamamen boş** bir 403 dönüyor —
 * AppException'daki gibi Türkçe bir `detail` yok. Eski yedek metin "Beklenmeyen hata
 * (HTTP 403)" idi ve kullanıcıya hiçbir şey anlatmıyordu: yetkisinin olmadığını mı,
 * bir arıza mı olduğunu, ne yapması gerektiğini bilemiyordu.
 *
 * İki gerçek durum bu yanıtı üretiyor ve metin ikisini de karşılıyor:
 *   • Moderatör, yalnızca Admin'e açık bir işlemi denedi (doğru davranış).
 *   • Rolü giriş yaptıktan SONRA değişti. JWT durumsuz ve 2 saat geçerli; yönetim
 *     ekranının kapısı da oturumdaki `isAdmin` değerine bakıyor (app/yonetim.jsx).
 *     İkisi de eski kalıyor, yani ekran açılıyor ama her istek reddediliyor. Çare
 *     çıkış/giriş — metin de tam olarak bunu söylüyor.
 */
function varsayilanHataMetni(status) {
  if (status === 403) {
    return (
      'Bu işlem için yetkin yok. Yetkilerin yakın zamanda değiştiyse ' +
      'çıkış yapıp tekrar giriş yapman gerekebilir.'
    )
  }

  if (status === 404) return 'Aradığın kayıt bulunamadı.'
  if (status >= 500) return 'Sunucuda bir hata oluştu. Biraz sonra tekrar dene.'

  return `Beklenmeyen hata (HTTP ${status}).`
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response

      /*
        401 HER ZAMAN "oturum bitti" DEMEK DEĞİL.

        Bazı uçlarda 401, gövdedeki PAROLANIN yanlış olduğunu söylüyor — oturumun
        geçersizliğini değil. Koşulsuz oturum düşürmek burada gerçek bir hataya yol
        açıyordu: "Hesabımı sil" ekranında parolayı yanlış yazan kullanıcı hata mesajını
        HİÇ göremiyor, modal ve tüm sekmeler kayboluyor, uygulama giriş ekranına düşüyor
        ve SecureStore'daki oturum siliniyordu. Hesap silinmemiş oluyor ama kullanıcı ne
        olduğunu anlamıyor.

        Ayrım kod üzerinden: INVALID_CREDENTIALS "yazdığın parola yanlış" demek, jetonun
        süresi dolduğunda sunucu bu kodu döndürmüyor (gövdesiz 401 geliyor).
      */
      const parolaHatasi = data?.title === 'INVALID_CREDENTIALS'
      if (status === 401 && !parolaHatasi) {
        authExpiredListeners.forEach((l) => l())
      }
      // Kod arayüzde gösterilmiyor (bkz. ErrorBox); teşhis için konsolda kalıyor.
      if (data?.title) {
        console.warn(
          `[api] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${status} ${data.title}`,
        )
      }
      throw new ApiError(
        data?.detail ?? varsayilanHataMetni(status),
        data?.title ?? 'UNKNOWN',
        status,
      )
    }
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') throw error
    throw new ApiError(
      'Sunucuya ulaşılamadı. API çalışıyor mu ve telefonla aynı ağda mı?',
      'NETWORK_ERROR',
      0,
    )
  },
)

async function request(path, { method = 'GET', body, formData, signal, headers } = {}) {
  const response = await client.request({
    url: path,
    method,
    data: formData ?? body,
    signal,
    headers,
    // Yüklemelerde (kanıt görseli, 10 MB'a kadar öğrenci belgesi) global 30 sn sınırı
    // KALKAR: yavaş mobil ağda 8 MB'lık kanıt 30 sn'yi rahat aşar ve kesilen yükleme
    // yanıltıcı bir "sunucuya ulaşılamadı" hatasına dönerdi — üstelik sunucu isteği
    // işlemiş olabilir ve tekrar deneme "ders zaten tamamlandı" ile karşılaşırdı.
    // Web'de fetch'in timeout'u zaten yoktu; parite de bunu istiyor.
    ...(formData ? { timeout: 0 } : null),
  })
  // Web'deki 204 → null davranışı korunuyor.
  return response.status === 204 ? null : response.data
}

/*
  YETKİLİ GÖRSEL KAYNAĞI — web'deki fetchProofBlob / avatarObjectUrl'ün mobil karşılığı.

  Web'de <img src> Authorization başlığı taşıyamadığı için görsel fetch + object URL ile
  alınıyordu. RN'de URL.createObjectURL YOK ama <Image> zaten header taşıyabiliyor:
  source={{ uri, headers }}. Yani mobilde blob dolambacına gerek kalmadı — bileşen bu
  nesneyi doğrudan Image'a verir. Önbellekleme RN Image'ın kendi cache'ine kalıyor
  (uri sabit olduğu için kullanıcı başına tek indirme davranışı korunur).

  Token her ÇAĞRIDA okunur (render anında): oturum yenilendiğinde eski token'lı
  donmuş bir kaynak nesnesi kalmasın.
*/
/*
  ⛔ KULLANILMIYOR — RN Image bu başlıkları GÖNDERMİYOR (ölçüldü, aşağıya bakın).
  Yalnızca kararın geçmişi görünsün diye duruyor; yeni kod authedImageDataUri kullanır.
*/
function authImageSource(path) {
  return { uri: `${API_BASE}${path}`, headers: { Authorization: `Bearer ${getToken()}` } }
}

/*
  YETKİLİ GÖRSEL — baytlar İSTEKLE indirilip data URI olarak veriliyor.

  NEDEN: <Image source={{uri, headers}}> Android'de (newArchEnabled) Authorization
  başlığını GÖNDERMİYOR. Telefonun kendi istekleri köprü günlüğünde ölçüldü:

    GET /api/v1/users/<id>/profile      → 200  jetonlu     (axios)
    GET /api/v1/users/<id>/avatar?v=1   → 401  JETONSUZ    (RN Image)

  Aynı oturumda, aynı saniyede. Bu yüzden kimlik isteyen HER görsel sessizce 401
  alıyordu: avatarlar, ders kanıtı ekran görüntüleri ve yönetimdeki kanıt incelemesi.
  Belirtisi "fotoğraf güncellenmiyor"du; 401'i middleware controller'dan önce
  reddettiği için sunucu günlüğünde sorgu bile görünmüyordu.

  Çözüm web'in yaptığının aynısı (orada blob + object URL): baytları axios ile —
  başlığı doğru gönderen tek yol — indirip Image'a hazır veri olarak veriyoruz.

  Önbellek YOL ile anahtarlanıyor; yol ?v=N taşıdığı için yeni yükleme kendiliğinden
  yeni bir anahtar üretiyor ve eski görsel düşüyor.
*/
const gorselOnbellegi = new Map()

export async function authedImageDataUri(path) {
  const hazir = gorselOnbellegi.get(path)
  if (hazir) return hazir

  const yanit = await client.get(path, { responseType: 'blob' })

  const dataUri = await new Promise((coz, red) => {
    const okuyucu = new FileReader()
    okuyucu.onload = () => coz(okuyucu.result)
    okuyucu.onerror = () => red(okuyucu.error ?? new Error('Görsel okunamadı.'))
    okuyucu.readAsDataURL(yanit.data)
  })

  gorselOnbellegi.set(path, dataUri)
  return dataUri
}

/*
  AVATAR ÖNBELLEĞİNİ KIRMA — web'deki forgetAvatar'ın mobil karşılığı.

  RN Image (Android'de Fresco) disk önbelleğini URI ile anahtarlar ve HTTP yeniden
  doğrulaması yapmaz: kullanıcı yeni avatar yükledikten sonra /avatar URI'si
  değişmediği için ESKİ görsel sunulmaya devam ederdi (web bu hatayı yaşayıp
  forgetAvatar ile çözmüştü — Profile.jsx yükleme sonrası çağırıyor).

  Çözüm sürüm sayacı: forgetAvatar(userId) sayacı artırır, avatarImageSource URI'ye
  ?v=N ekler — Fresco için yeni anahtar, sunucu için zararsız bir sorgu parametresi.
  Sayaç bellekte: uygulama yeniden açıldığında sıfırlanır ve temel URI'ye dönülür;
  o anda önbellekte ne varsa zaten en son yüklenen görseldir.
*/
const avatarVersions = new Map()

/*
  YEREL ÖNİZLEME — yükleme biter bitmez gösterilecek dosya.

  NEDEN VAR: yükleme sunucuda başarılı olduğu hâlde kullanıcı eski görüntüyü görmeye
  devam ediyordu; sunucu günlüğünde yüklemeden SONRA hiç avatar isteği yoktu, yani
  RN Image uzaktaki görseli yeniden istemeye hiç kalkışmamıştı. Cihaza erişimim
  olmadığı için hangi halkanın koptuğunu kesinleştiremedim — bu yüzden çözüm o halkayı
  ONARMAK değil, ONA BAĞIMLILIĞI KALDIRMAK: yüklenen dosya zaten telefonda duruyor,
  doğrudan onu gösteriyoruz. Uzak görsel de arka planda tazeleniyor (sürüm sayacı),
  ama artık kullanıcının gördüğü şey ona bağlı değil.

  Bellekte: uygulama yeniden açıldığında sunucudaki görsele dönülür.
*/
const yerelAvatarlar = new Map()

/*
  ANAHTAR NORMALLEŞTİRME. forgetAvatar'ı çağıran ekran kimliği OTURUMDAN, avatarı çizen
  bileşen ise PROFİL YANITINDAN alıyor. İkisi aynı GUID ama farklı yerlerden geldiği için
  harf büyüklüğü ya da tür (string/undefined) farkı Map aramasını ıskalar; ıskalarsa
  ?v= hiç eklenmez ve önbellek kırılmaz. Tek noktadan normalleştirmek bu sınıfı kapatıyor.
*/
function avatarAnahtar(userId) {
  return String(userId ?? '').toLowerCase()
}

function avatarPath(userId) {
  const v = avatarVersions.get(avatarAnahtar(userId))
  return `/api/v1/users/${userId}/avatar${v ? `?v=${v}` : ''}`
}

export const api = {
  // --- Kimlik ---
  register: (payload) => request('/api/v1/auth/register', { method: 'POST', body: payload }),
  /**
   * E-postayı 6 haneli KODLA doğrular (bağlantı yerine — 2026-09-02).
   *
   * E-POSTA DA GÖNDERİLİYOR: 6 hane kullanıcıya özgü değil, aynı anda yüzlerce hesapta
   * aynı kod olabilir. Kod tek başına kabul edilseydi rastgele kod deneyen biri er ya
   * da geç BİRİNİN hesabını doğrulardı.
   */
  verifyEmail: (email, code) =>
    request('/api/v1/auth/verify-email', { method: 'POST', body: { email, code } }),

  /** Yeni doğrulama kodu gönderir. Yanıt, adres kayıtlı olsun olmasın aynıdır. */
  resendVerification: (email) =>
    request('/api/v1/auth/resend-verification', { method: 'POST', body: { email } }),
  login: (payload) => request('/api/v1/auth/login', { method: 'POST', body: payload }),

  /** Parola sıfırlama bağlantısı ister. Yanıt, adres kayıtlı olsun olmasın AYNI (204) —
      farklı yanıt vermek "bu e-posta kayıtlı mı" sorusunu herkese yanıtlardı. */
  forgotPassword: (email) =>
    request('/api/v1/auth/forgot-password', { method: 'POST', body: { email } }),

  /** Bağlantıdaki token'la yeni parolayı yazar. Token tek kullanımlık, 1 saat geçerli. */
  resetPassword: (token, newPassword) =>
    request('/api/v1/auth/reset-password', { method: 'POST', body: { token, newPassword } }),

  // --- Katalog ---
  topics: () => request('/api/v1/catalog/topics'),
  categories: () => request('/api/v1/catalog/categories'),

  /** Gelişmiş arama (Modül 1). Boş/null filtreler sorgu dizesine hiç eklenmez. */
  searchOffers: (filters) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') continue
      params.set(key, String(value))
    }
    return request(`/api/v1/discovery/offers?${params.toString()}`)
  },

  /** Üniversite ağı araması. searchOffers ile aynı kural: boş/null filtreler sorguya eklenmez. */
  searchUniversityPeers: (filters) => {
    const params = new URLSearchParams()
    // Yalnızca ucun tanıdığı dört alan geçsin; ekrandaki diğer durum sorguya sızmasın.
    const { university, department, page, pageSize } = filters
    for (const [key, value] of Object.entries({ university, department, page, pageSize })) {
      if (value === null || value === undefined || value === '') continue
      params.set(key, String(value))
    }
    return request(`/api/v1/discovery/users?${params.toString()}`)
  },

  // --- Portföy & eşleştirme ---
  myPortfolio: () => request('/api/v1/portfolio/entries'),
  addPortfolioEntry: (payload) =>
    request('/api/v1/portfolio/entries', { method: 'POST', body: payload }),
  removePortfolioEntry: (id) => request(`/api/v1/portfolio/entries/${id}`, { method: 'DELETE' }),
  suggestions: (limit = 20) => request(`/api/v1/portfolio/suggestions?limit=${limit}`),

  myMatches: () => request('/api/v1/matches'),
  // Konusuz (üniversite ağı) istekte requestedTopicId null gönderilebilir.
  createMatch: (payload) => request('/api/v1/matches', { method: 'POST', body: payload }),
  respondMatch: (matchId, accept) =>
    request(`/api/v1/matches/${matchId}/respond`, { method: 'POST', body: { accept } }),
  closeMatch: (matchId) => request(`/api/v1/matches/${matchId}/close`, { method: 'POST' }),

  // --- Sohbet ---
  conversations: () => request('/api/v1/conversations'),
  messages: (conversationId, page = 1, pageSize = 50) =>
    request(`/api/v1/conversations/${conversationId}/messages?page=${page}&pageSize=${pageSize}`),
  sendMessage: (conversationId, content) =>
    request(`/api/v1/conversations/${conversationId}/messages`, { method: 'POST', body: { content } }),
  markRead: (conversationId) => request(`/api/v1/conversations/${conversationId}/read`, { method: 'POST' }),

  // --- Dersler ---
  /**
   * Derslerim. Aktif dersler HER ZAMAN tam döner; yalnızca geçmiş sayfalanır
   * (aksiyon bekleyen bir ders sayfanın altında kalmamalı). Mobilde geçmiş,
   * FlatList onEndReached ile 5'erli sayfalarla yüklenir (iş kuralı 4).
   */
  mySessions: (pastPage = 1, pastPageSize = 5) =>
    request(`/api/v1/sessions?pastPage=${pastPage}&pastPageSize=${pastPageSize}`),
  sessionProofs: (sessionId) => request(`/api/v1/sessions/${sessionId}/proofs`),

  /** Kanıt görseli için <Image source> nesnesi (uri + Authorization başlığı). */
  proofImageSource: (sessionId, proofId) =>
    ({ yol: `/api/v1/sessions/${sessionId}/proofs/${proofId}/content` }),
  bookSession: (payload) => request('/api/v1/sessions', { method: 'POST', body: payload }),

  /**
   * Ders tamamlama + kanıt yükleme (iş kuralı 5).
   * @param file expo-image-picker sonucundan kurulan { uri, name, type } nesnesi —
   *   RN'in FormData'sı dosyayı bu üçlüyle multipart parçasına çevirir.
   */
  completeSession: (sessionId, verificationCode, file) => {
    const form = new FormData()
    form.append('verificationCode', verificationCode)
    form.append('proof', file)
    return request(`/api/v1/sessions/${sessionId}/complete`, { method: 'POST', formData: form })
  },
  approveSession: (sessionId) => request(`/api/v1/sessions/${sessionId}/approve`, { method: 'POST' }),
  cancelSession: (sessionId, reason) =>
    request(`/api/v1/sessions/${sessionId}/cancel`, { method: 'POST', body: { reason } }),
  /**
   * Ders hakkında TEK YÖNLÜ şikayet. Şikayet edilen kişi bunu görmez, bildirilmez ve
   * yanıt veremez; kayıt doğrudan yönetim kuyruğuna düşer. Ders akışı etkilenmez.
   */
  reportSession: (sessionId, reason, description) =>
    request(`/api/v1/sessions/${sessionId}/report`, { method: 'POST', body: { reason, description } }),

  /**
   * İTİRAZ — şikayetten FARKLI ve daha ağır: "ders yapılmadı" ya da "kanıt sahte".
   *
   * Ders Disputed'a geçer, puan basımı DONAR ve konu yönetim hakemliğine düşer. Şikayet
   * ise dersin akışını hiç etkilemiyor (bkz. reportSession) — ikisi ayrı mekanizma ve
   * arayüzde de ayrı sunuluyor.
   *
   * Yalnızca öğrenci ve yalnızca onay bekleyen derste açılabilir; kural sunucuda
   * (SessionRules.EnsureCanDispute). Açıklama 10-2000 karakter.
   */
  disputeSession: (sessionId, reason, description) =>
    request(`/api/v1/sessions/${sessionId}/dispute`, { method: 'POST', body: { reason, description } }),

  // --- Cüzdan (puan/seviye kaynağı; harcama YOK — iş kuralı 1) ---
  wallet: () => request('/api/v1/wallet'),
  statement: (page = 1, pageSize = 20) =>
    request(`/api/v1/wallet/statement?page=${page}&pageSize=${pageSize}`),

  // --- Profil ve değerlendirmeler ---
  userProfile: (userId) => request(`/api/v1/users/${userId}/profile`),

  /** Oturumdaki kullanıcının profili — çağıranların userId taşımasını gerektirmez. */
  myProfile: () => {
    const userId = loadSession()?.userId
    if (!userId) return Promise.resolve(null)
    return request(`/api/v1/users/${userId}/profile`)
  },

  updateProfile: (payload) => request('/api/v1/profile', { method: 'PUT', body: payload }),

  /**
   * HESABI SİL — geri alınamaz.
   *
   * Google Play, hesap açtıran uygulamalarda silmeyi UYGULAMA İÇİNDE zorunlu tutuyor;
   * KVKK/GDPR'ın silme hakkı da aynı şeyi istiyor. Sunucu kişisel alanları temizleyip
   * kaydı anonimleştiriyor: ders geçmişi, puanlar ve değerlendirmeler KARŞI TARAFA ait
   * olduğu için silinmiyor, orada "Silinmiş kullanıcı" olarak görünüyor.
   *
   * VERB POST, DELETE DEĞİL: parola gövdede gidiyor ve gövdeli DELETE isteklerini bazı
   * vekiller kırpıyor — istek sunucuya parolasız ulaşıp 401'e düşerdi.
   */
  deleteAccount: (password) =>
    request('/api/v1/profile/delete', { method: 'POST', body: { password } }),
  uploadAvatar: (formData) => request('/api/v1/profile/avatar', { method: 'POST', formData }),
  /**
   * Öğrenci belgesi (PDF/görsel, en fazla 10 MB). Yeni belge, önceki doğrulama/ret
   * kararını sıfırlar ve beyanı yeniden kuyruğa sokar.
   *
   * Uç 2026-09-01'de AÇILDI (ProfileController). Öncesinde backend'de yalnızca komut ve
   * handler vardı, rota yoktu; bu metot da sessiz 404 yerine sebebini söyleyerek
   * reddediyordu. Artık gerçek çağrı yapıyor.
   *
   * ⚠️ Yönetim ekranı belgeyi GÖSTERMİYOR (hakem görüntüleyicisi henüz bağlanmadı).
   * Belge yüklenip okunabiliyor, ama doğrulama akışı tamamlanana kadar hakem kararı
   * hâlâ sistem dışı kanıta dayanıyor.
   */
  uploadTeacherDocument: (file) => {
    const form = new FormData()
    form.append('document', file)
    return request('/api/v1/profile/teacher-candidate/document', { method: 'POST', formData: form })
  },

  /** Kendi yüklediğin belgeyi geri okur (yetki sunucuda: başkasınınki 403). */
  teacherDocumentSource: (profileId) => ({
    yol: `/api/v1/profile/teacher-candidate/${profileId}/document`,
  }),

  declareTeacherCandidate: (payload) =>
    request('/api/v1/profile/teacher-candidate', { method: 'PUT', body: payload }),

  /** Avatar için <Image source> nesnesi. Avatar yoksa sunucu 404 döner; Image onError
      ile baş harflere düşülür (bkz. components/Avatar). */
  /**
   * Avatarın nereden okunacağını söyler:
   *   { yerel }  → az önce yüklenen, cihazdaki dosya (istek gerekmez)
   *   { yol }    → sunucudaki adres; baytları authedImageDataUri indirir
   */
  avatarImageSource: (userId) => {
    const yerel = yerelAvatarlar.get(avatarAnahtar(userId))
    return yerel ? { yerel } : { yol: avatarPath(userId) }
  },

  /** Yeni avatar yüklendikten sonra çağrılır — bir sonraki avatarImageSource yeni
      görseli indirir (web'deki forgetAvatar ile aynı sözleşme). */
  forgetAvatar: (userId) => {
    const anahtar = avatarAnahtar(userId)
    avatarVersions.set(anahtar, (avatarVersions.get(anahtar) ?? 0) + 1)
    // Diske yaz: açılışta geri okunmazsa adres temel URI'ye döner ve Fresco eski
    // görseli ağa hiç çıkmadan sunar (bkz. KEYS.avatarSurumleri).
    prefs.set(KEYS.avatarSurumleri, JSON.stringify(Object.fromEntries(avatarVersions)))
  },

  /**
   * Yeni yüklenen fotoğrafın CİHAZDAKİ yolunu hatırlar; avatarImageSource bundan sonra
   * uzak adres yerine onu döndürür (bkz. yerelAvatarlar).
   *
   * MOBİLE ÖZGÜ — web'de karşılığı YOK ve olması da gerekmiyor: web, yükleme sonrası
   * object URL'i zaten elinde tutuyor. Buradaki eşitsizlik bilinçli (CLAUDE.md'deki
   * proofImageSource/avatarImageSource sapmalarıyla aynı gerekçe).
   */
  rememberLocalAvatar: (userId, uri) => {
    if (uri) yerelAvatarlar.set(avatarAnahtar(userId), uri)
  },

  userReviews: (userId, page = 1, pageSize = 10) =>
    request(`/api/v1/users/${userId}/reviews?page=${page}&pageSize=${pageSize}`),

  /**
   * Branş rozetleri + branş bazlı anlatım saatleri (iş kuralı 2).
   * Profil ucundan AYRI: rozet şeridi daha seyrek değişiyor ve gecikmeli yüklenebiliyor.
   */
  userSubjectBadges: (userId) => request(`/api/v1/users/${userId}/subject-badges`),

  /*
    KULLANICI ŞİKAYETİ — ders bağlamı olmadan.

    Şikayet açmanın tek yolu bir ders üzerindenken, sohbette taciz eden ama henüz
    tamamlanmış dersi olmayan biri hiçbir şekilde bildirilemiyordu. Aynı moderasyon
    kuyruğuna düşer (moderation.Reports).
  */
  reportUser: (userId, reason, description) =>
    request(`/api/v1/users/${userId}/report`, { method: 'POST', body: { reason, description } }),

  createReview: (sessionId, payload) =>
    request(`/api/v1/sessions/${sessionId}/review`, { method: 'POST', body: payload }),

  /*
    ─── TOPLULUK (FORUM) ──────────────────────────────────────────────────────

    SIRALAMA, TARİH PENCERESİ VE ETİKET FİLTRESİ SUNUCUDA uygulanıyor — istemcide
    yapılsaydı sayfalama anlamsız olurdu (ikinci sayfayı verebilmek için tüm
    gönderileri indirmek gerekirdi).

    sort / range / tag SUNUCU ENUM ADLARI ile gider ("Newest", "Day", "ExamStress");
    Türkçe arayüz anahtarlarından çeviri ekran tarafında tek tabloda durur ki kablo
    sözleşmesi tek anlamlı kalsın.
  */
  forumFeed: ({ sort = 'Newest', range = 'All', tag = null, page = 1, pageSize = 20 } = {}, signal) => {
    const q = new URLSearchParams({ sort, range, page: String(page), pageSize: String(pageSize) })
    // Etiket yoksa parametre HİÇ gönderilmez: boş bir `tag=` değeri sunucuda geçersiz
    // enum olarak bağlanır ve akış 400 döner.
    if (tag) q.set('tag', tag)
    return request(`/api/v1/community/posts?${q}`, { signal })
  },

  createForumPost: (tag, title, body) =>
    request('/api/v1/community/posts', { method: 'POST', body: { tag, title, body } }),

  forumComments: (postId, signal) => request(`/api/v1/community/posts/${postId}/comments`, { signal }),

  createForumComment: (postId, body) =>
    request(`/api/v1/community/posts/${postId}/comments`, { method: 'POST', body: { body } }),

  /**
   * Oy. value yalnızca 1 ya da -1; SIFIR GÖNDERİLMEZ — geri almak, aynı yöne ikinci kez
   * oy vermektir (sunucu satırı siler). Ayrı bir "oyu kaldır" ucu yok çünkü kullanıcı
   * için de tek bir jest: aynı oka tekrar basmak.
   *
   * Dönen değer sunucunun SON sayaçları: { upvoteCount, downvoteCount, myVote }.
   * İstemci optimistik gösterip bu yanıtla düzeltir.
   */
  voteForumPost: (postId, value) =>
    request(`/api/v1/community/posts/${postId}/vote`, { method: 'POST', body: { value } }),
  voteForumComment: (commentId, value) =>
    request(`/api/v1/community/comments/${commentId}/vote`, { method: 'POST', body: { value } }),

  /**
   * Şikayet aynı moderasyon kuyruğuna düşer — ders, sohbet ve forum şikayetleri
   * moderatör için tek yerde. reason: ReportReason enum adı. Açıklama sunucuda en az
   * 15 karakter; arayüz aynı sınırı uygular ki kullanıcı gönderdikten sonra 400 görmesin.
   */
  reportForumPost: (postId, reason, description) =>
    request(`/api/v1/community/posts/${postId}/report`, {
      method: 'POST',
      body: { reason, description },
    }),
  reportForumComment: (commentId, reason, description) =>
    request(`/api/v1/community/comments/${commentId}/report`, {
      method: 'POST',
      body: { reason, description },
    }),

  // --- Tercihler ---
  myPreferences: () => request('/api/v1/preferences'),

  /*
    Uç adı "cookie-consent" ama MOBİLDE ÇEREZ YOK: taşıdığı şey analitik ve işlevsel
    veri toplama izni. Ad sunucuyla sözleşme olduğu için korunuyor (yeniden adlandırma,
    karşılığı olan bir uç değişikliğiyle birlikte yapılmalı).
  */
  saveCookieConsent: (analytics, functional, consentVersion) =>
    request('/api/v1/preferences/cookie-consent', {
      method: 'PUT',
      body: { analytics, functional, consentVersion },
    }),

  saveOnboarding: (lastStep, completed, suppressed) =>
    request('/api/v1/preferences/onboarding', {
      method: 'PUT',
      body: { lastStep, completed, suppressed },
    }),

  /*
    ─── YÖNETİM ───────────────────────────────────────────────────────────────
    Yetki kontrolü SUNUCUDA (403). Arayüz bu ayrımı taklit etmez — yetki kontrolünü
    iki yerde tutmak, birinin unutulduğu gün sessizce açık bırakır.
  */
  disputes: () => request('/api/v1/admin/disputes'),
  disputeDetail: (disputeId) => request(`/api/v1/admin/disputes/${disputeId}`),
  resolveDispute: (disputeId, resolution, note) =>
    request(`/api/v1/admin/disputes/${disputeId}/resolve`, { method: 'POST', body: { resolution, note } }),

  /** Açık şikayet kuyruğu (yalnızca yönetim). */
  reports: (onlyOpen = true) => request(`/api/v1/admin/reports?onlyOpen=${onlyOpen}`),
  resolveReport: (reportId, actionTaken, note) =>
    request(`/api/v1/admin/reports/${reportId}/resolve`, { method: 'POST', body: { actionTaken, note } }),

  /**
   * Forum içeriğini kaldırır (remove=true) ya da geri getirir (remove=false).
   *
   * ŞİKAYETİ KAPATMAKTAN AYRI: resolveReport yalnızca kuyruktaki kaydı kapatır,
   * içeriğe dokunmaz. Bu uç olmadan üç şikayet alıp otomatik perdelenen bir gönderi
   * sonsuza kadar perdeli kalırdı. Gerekçe zorunlu (en az 10 karakter), denetim izine yazılır.
   */
  moderateForumContent: ({ postId = null, commentId = null, remove, reason }) =>
    request('/api/v1/admin/community/moderate', {
      method: 'POST',
      body: { postId, commentId, remove, reason },
    }),

  adminSessionProofs: (sessionId) => request(`/api/v1/admin/sessions/${sessionId}/proofs`),
  /** Yönetici, katılımcı olmadığı derslerin kanıtını kendi ucundan görür. */
  adminProofImageSource: (sessionId, proofId) =>
    ({ yol: `/api/v1/admin/sessions/${sessionId}/proofs/${proofId}/content` }),

  banUser: (userId, reason) =>
    request(`/api/v1/admin/users/${userId}/ban`, { method: 'POST', body: { reason } }),
  unbanUser: (userId, reason) =>
    request(`/api/v1/admin/users/${userId}/unban`, { method: 'POST', body: { reason } }),

  /** @param type 'Warning' | 'TemporaryBan' — durationHours yalnızca TemporaryBan'de anlamlı. */
  sanctionUser: (userId, type, reason, durationHours = null) =>
    request(`/api/v1/admin/users/${userId}/sanction`, {
      method: 'POST',
      body: { type, reason, durationHours },
    }),

  /**
   * Adayın öğrenci belgesi (hakem gözüyle). Yetki sunucuda: bu uç AdminOnly.
   * Baytlar authedImageDataUri ile indiriliyor — RN Image başlık taşımıyor
   * (bkz. YetkiliGorsel).
   */
  adminTeacherDocumentSource: (profileId) => ({
    yol: `/api/v1/admin/teacher-candidates/${profileId}/document`,
  }),

  teacherCandidates: (status = 'Pending', page = 1, pageSize = 25) =>
    request(`/api/v1/admin/teacher-candidates?status=${status}&page=${page}&pageSize=${pageSize}`),
  /** decision: Verify | Reject | Revert. Gerekçe zorunlu (sunucu da doğruluyor). */
  reviewTeacherCandidate: (profileId, decision, note) =>
    request(`/api/v1/admin/teacher-candidates/${profileId}/review`, {
      method: 'POST',
      body: { decision, note },
    }),

  economyMetrics: () => request('/api/v1/admin/metrics'),

  /**
   * Yönetim eliyle puan tanımlama/düzeltme. Pozitif ekler, negatif düşer; gerekçe zorunlu.
   *
   * idempotencyKey ZORUNLU ve ÇAĞIRANIN sorumluluğunda: aynı düzeltmenin TEKRAR
   * DENEMELERİ aynı anahtarla gitmeli, yeni bir düzeltme yeni anahtar almalı. Burada
   * üretilseydi her çağrı yeni anahtar alır ve koruma hiçbir şey yapmazdı — tam olarak
   * ağ hatasından sonraki tekrar denemede korunması gereken durumda.
   */
  adjustCredits: (userId, amount, reason, idempotencyKey) =>
    request(`/api/v1/admin/users/${userId}/credits`, {
      method: 'POST',
      body: { amount, reason },
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  auditLog: (page = 1, pageSize = 25) =>
    request(`/api/v1/admin/audit-log?page=${page}&pageSize=${pageSize}`),
}

/*
  ÖNİZLEME MODU: yüzey aynı kalır, uygulama sunucuya hiç gitmez — her metot
  src/lib/onizleme.js'teki temsili veriyle yanıtlanır. Bayrak build anında gömülür;
  normal geliştirmede bu blok ölü koddur (bkz. onizleme.js başlığı).
*/
if (ONIZLEME) {
  Object.assign(api, onizlemeApi)
}
