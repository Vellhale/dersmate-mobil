import axios from 'axios'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { KEYS, secure } from './storage'
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
  hydrated = true
  return sessionCache
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

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      if (status === 401) {
        authExpiredListeners.forEach((l) => l())
      }
      // Kod arayüzde gösterilmiyor (bkz. ErrorBox); teşhis için konsolda kalıyor.
      if (data?.title) {
        console.warn(
          `[api] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${status} ${data.title}`,
        )
      }
      throw new ApiError(
        data?.detail ?? `Beklenmeyen hata (HTTP ${status}).`,
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
function authImageSource(path) {
  return { uri: `${API_BASE}${path}`, headers: { Authorization: `Bearer ${getToken()}` } }
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

function avatarPath(userId) {
  const v = avatarVersions.get(userId)
  return `/api/users/${userId}/avatar${v ? `?v=${v}` : ''}`
}

export const api = {
  // --- Kimlik ---
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  verifyEmail: (token) => request('/api/auth/verify-email', { method: 'POST', body: { token } }),

  /** Doğrulama bağlantısını yeniden gönderir. Yanıt, adres kayıtlı olsun olmasın aynıdır. */
  resendVerification: (email) =>
    request('/api/auth/resend-verification', { method: 'POST', body: { email } }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),

  // --- Katalog ---
  topics: () => request('/api/catalog/topics'),
  categories: () => request('/api/catalog/categories'),

  /** Gelişmiş arama (Modül 1). Boş/null filtreler sorgu dizesine hiç eklenmez. */
  searchOffers: (filters) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') continue
      params.set(key, String(value))
    }
    return request(`/api/discovery/offers?${params.toString()}`)
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
    return request(`/api/discovery/users?${params.toString()}`)
  },

  // --- Portföy & eşleştirme ---
  myPortfolio: () => request('/api/portfolio/entries'),
  addPortfolioEntry: (payload) =>
    request('/api/portfolio/entries', { method: 'POST', body: payload }),
  removePortfolioEntry: (id) => request(`/api/portfolio/entries/${id}`, { method: 'DELETE' }),
  suggestions: (limit = 20) => request(`/api/portfolio/suggestions?limit=${limit}`),

  myMatches: () => request('/api/matches'),
  // Konusuz (üniversite ağı) istekte requestedTopicId null gönderilebilir.
  createMatch: (payload) => request('/api/matches', { method: 'POST', body: payload }),
  respondMatch: (matchId, accept) =>
    request(`/api/matches/${matchId}/respond`, { method: 'POST', body: { accept } }),
  closeMatch: (matchId) => request(`/api/matches/${matchId}/close`, { method: 'POST' }),

  // --- Sohbet ---
  conversations: () => request('/api/conversations'),
  messages: (conversationId, page = 1, pageSize = 50) =>
    request(`/api/conversations/${conversationId}/messages?page=${page}&pageSize=${pageSize}`),
  sendMessage: (conversationId, content) =>
    request(`/api/conversations/${conversationId}/messages`, { method: 'POST', body: { content } }),
  markRead: (conversationId) => request(`/api/conversations/${conversationId}/read`, { method: 'POST' }),

  // --- Dersler ---
  /**
   * Derslerim. Aktif dersler HER ZAMAN tam döner; yalnızca geçmiş sayfalanır
   * (aksiyon bekleyen bir ders sayfanın altında kalmamalı). Mobilde geçmiş,
   * FlatList onEndReached ile 5'erli sayfalarla yüklenir (iş kuralı 4).
   */
  mySessions: (pastPage = 1, pastPageSize = 5) =>
    request(`/api/sessions?pastPage=${pastPage}&pastPageSize=${pastPageSize}`),
  sessionProofs: (sessionId) => request(`/api/sessions/${sessionId}/proofs`),

  /** Kanıt görseli için <Image source> nesnesi (uri + Authorization başlığı). */
  proofImageSource: (sessionId, proofId) =>
    authImageSource(`/api/sessions/${sessionId}/proofs/${proofId}/content`),
  bookSession: (payload) => request('/api/sessions', { method: 'POST', body: payload }),

  /**
   * Ders tamamlama + kanıt yükleme (iş kuralı 5).
   * @param file expo-image-picker sonucundan kurulan { uri, name, type } nesnesi —
   *   RN'in FormData'sı dosyayı bu üçlüyle multipart parçasına çevirir.
   */
  completeSession: (sessionId, verificationCode, file) => {
    const form = new FormData()
    form.append('verificationCode', verificationCode)
    form.append('proof', file)
    return request(`/api/sessions/${sessionId}/complete`, { method: 'POST', formData: form })
  },
  approveSession: (sessionId) => request(`/api/sessions/${sessionId}/approve`, { method: 'POST' }),
  cancelSession: (sessionId, reason) =>
    request(`/api/sessions/${sessionId}/cancel`, { method: 'POST', body: { reason } }),
  /**
   * Ders hakkında TEK YÖNLÜ şikayet. Şikayet edilen kişi bunu görmez, bildirilmez ve
   * yanıt veremez; kayıt doğrudan yönetim kuyruğuna düşer. Ders akışı etkilenmez.
   */
  reportSession: (sessionId, reason, description) =>
    request(`/api/sessions/${sessionId}/report`, { method: 'POST', body: { reason, description } }),

  // --- Cüzdan (puan/seviye kaynağı; harcama YOK — iş kuralı 1) ---
  wallet: () => request('/api/wallet'),
  statement: (page = 1, pageSize = 20) =>
    request(`/api/wallet/statement?page=${page}&pageSize=${pageSize}`),

  // --- Profil ve değerlendirmeler ---
  userProfile: (userId) => request(`/api/users/${userId}/profile`),

  /** Oturumdaki kullanıcının profili — çağıranların userId taşımasını gerektirmez. */
  myProfile: () => {
    const userId = loadSession()?.userId
    if (!userId) return Promise.resolve(null)
    return request(`/api/users/${userId}/profile`)
  },

  updateProfile: (payload) => request('/api/profile', { method: 'PUT', body: payload }),
  uploadAvatar: (formData) => request('/api/profile/avatar', { method: 'POST', formData }),
  /**
   * Öğrenci belgesi (PDF/görsel, en fazla 10 MB). Yeni belge, önceki doğrulama/ret
   * kararını sıfırlar ve beyanı yeniden kuyruğa sokar.
   */
  uploadTeacherDocument: (file) => {
    const form = new FormData()
    form.append('document', file)
    return request('/api/profile/teacher-candidate/document', { method: 'POST', formData: form })
  },

  declareTeacherCandidate: (payload) =>
    request('/api/profile/teacher-candidate', { method: 'PUT', body: payload }),

  /** Avatar için <Image source> nesnesi. Avatar yoksa sunucu 404 döner; Image onError
      ile baş harflere düşülür (bkz. components/Avatar). */
  avatarImageSource: (userId) => authImageSource(avatarPath(userId)),

  /** Yeni avatar yüklendikten sonra çağrılır — bir sonraki avatarImageSource yeni
      görseli indirir (web'deki forgetAvatar ile aynı sözleşme). */
  forgetAvatar: (userId) => {
    avatarVersions.set(userId, (avatarVersions.get(userId) ?? 0) + 1)
  },

  userReviews: (userId, page = 1, pageSize = 10) =>
    request(`/api/users/${userId}/reviews?page=${page}&pageSize=${pageSize}`),

  /**
   * Branş rozetleri + branş bazlı anlatım saatleri (iş kuralı 2).
   * Profil ucundan AYRI: rozet şeridi daha seyrek değişiyor ve gecikmeli yüklenebiliyor.
   */
  userSubjectBadges: (userId) => request(`/api/users/${userId}/subject-badges`),
  createReview: (sessionId, payload) =>
    request(`/api/sessions/${sessionId}/review`, { method: 'POST', body: payload }),

  // --- Tercihler ---
  myPreferences: () => request('/api/preferences'),
  saveOnboarding: (lastStep, completed, suppressed) =>
    request('/api/preferences/onboarding', {
      method: 'PUT',
      body: { lastStep, completed, suppressed },
    }),
}

/*
  ÖNİZLEME MODU: yüzey aynı kalır, uygulama sunucuya hiç gitmez — her metot
  src/lib/onizleme.js'teki temsili veriyle yanıtlanır. Bayrak build anında gömülür;
  normal geliştirmede bu blok ölü koddur (bkz. onizleme.js başlığı).
*/
if (ONIZLEME) {
  Object.assign(api, onizlemeApi)
}
