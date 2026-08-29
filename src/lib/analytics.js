/**
 * Analitik — olay sözlüğü ve gönderim yüzeyi (web'deki lib/analytics.js'in mobil portu).
 *
 * TAŞIYICI YOK, YÜZEY AYNI. Web'de bu dosyanın asıl işi gtag.js'i sayfaya enjekte
 * etmekti; mobilde ne script etiketi ne çerez var ve bir ölçüm SDK'sı henüz kurulu
 * değil. Buna rağmen `trackEvent(name, params)` ve `AnalyticsEvents` sözlüğü web'deki
 * imzasıyla BİREBİR korunuyor: web sayfaları mobile çevrilirken çağrı satırları
 * değişmeden taşınsın ve taşıyıcı eklendiğinde çağrı yerlerine hiç dokunulmasın —
 * değişecek tek yer aşağıdaki `gonder()`.
 *
 * Bugünkü davranış: izin varsa __DEV__'de konsola yazar, üretimde no-op. Analitiğin
 * yokluğu asla bir akışı kırmamalı (web kararı) — bu yüzden hiçbir fonksiyon fırlatmaz.
 *
 * TEK KURAL DEĞİŞMEDİ: izin verilmeden hiçbir olay taşıyıcıya geçmez ve bu kararın tek
 * yeri izin katmanıdır (bkz. state/IzinContext.jsx → enableAnalytics/disableAnalytics).
 * Buradaki fonksiyonlar rıza durumunu KENDİLERİ sorgulamaz; iki yerde kontrol etmek,
 * birinin unutulması demektir.
 */

/*
  APPLE ATT / GOOGLE PLAY VERİ GÜVENLİĞİ — taşıyıcı eklenmeden ÖNCE yapılacaklar.
  Buraya not düşülüyor çünkü karar SDK seçilirken alınır, sonradan düzeltilmesi
  mağaza reddi demektir:

  • iOS — App Tracking Transparency: reklam kimliğini (IDFA) okuyan ya da veriyi başka
    şirketlerin verisiyle birleştiren bir SDK eklenirse ATT izni ŞARTTIR
    (expo-tracking-transparency + Info.plist NSUserTrackingUsageDescription). ATT
    bizim izin ekranımızdan BAĞIMSIZ ve ondan üstündür: taşıyıcı ancak İKİSİ de "evet"
    iken açılabilir. Yalnızca uygulama içi, kimliksiz ölçüm yapılacaksa ATT gerekmez —
    o hâlde SDK, IDFA okumayacak biçimde yapılandırılmalı, "kapatmayı unuttuk" hâli
    doğrudan takip anlamına gelir.

  • Android — Play Console "Veri güvenliği" formu: toplanan her alan (ör. "Uygulama
    etkileşimleri", "Cihaz kimlikleri") beyan edilir. Beyanla gerçek toplama uyuşmazsa
    uygulama reddedilir.

  • İki mağaza da beyanı SDK'NIN topladığına göre ister, bizim elle gönderdiğimiz
    alanlara göre değil: otomatik toplanan olaylar (ekran görüntüleme, reklam kimliği,
    kaba konum) kapatılmadan "yalnızca şunları topluyoruz" denemez.
*/

/**
 * Taşıyıcı kurulu mu? Web'de bu, ölçüm kimliğinin (VITE_GA4_MEASUREMENT_ID) varlığıydı;
 * mobilde henüz hiç taşıyıcı yok, o yüzden sabit false. Yüzey parite için duruyor:
 * ölçüm kimliği/SDK geldiğinde tek değişecek yer burasıdır.
 */
export const analyticsConfigured = false

/*
  Kapı durumu. Bu, web'deki `ga-disable-<ID>` bayrağının portu DEĞİL — o bayrağı GA
  kütüphanesinin kendisi okuyordu ve mobilde karşılığı yok. Bu yalnızca bizim kendi
  kapımız: izin gelmeden çağrılan bir trackEvent'in sızmasını yapısal olarak imkânsız
  kılar. Varsayılan KAPALI — "henüz bilmiyorum" durumu asla "izin var" sayılmaz.
*/
let acik = false

/**
 * Rıza verildiğinde çağrılır. Birden çok kez çağrılması zararsızdır.
 *
 * Taşıyıcı eklendiğinde SDK'nın toplamayı açan çağrısı (ör. Firebase'in
 * setAnalyticsCollectionEnabled(true)) buraya girer.
 */
export function enableAnalytics() {
  acik = true
}

/**
 * Rıza geri alındığında çağrılır.
 *
 * Web'de burası _ga/_gid çerezlerini de siliyordu; mobilde çerez yok, silinecek bir iz
 * de yok. Yine de fonksiyon KALIYOR ve çağrılıyor: mobil ölçüm SDK'ları toplama
 * bayrağını cihaza KALICI yazar (uygulama kapanıp açılınca eski hâlini geri yükler),
 * yani "kapalıyı" her açılışta yeniden uygulamak gerekir — web'de çerezler için geçerli
 * olan gerekçenin mobil karşılığı tam olarak budur.
 */
export function disableAnalytics() {
  acik = false
}

/*
  KİŞİSEL VERİ NÖBETÇİSİ — yalnızca __DEV__.

  Web'de bu kural yalnızca bir yorumdu ve çağrı yerlerinde tek tek hatırlanıyordu
  (bkz. Portfolio.jsx'teki "topicId GÖNDERİLMEZ" notu). Taşıyıcı henüz yokken bu
  dosyanın yapabileceği en somut şey kuralı geliştirme anında görünür kılmak.

  UYARIR, AYIKLAMAZ: alanı sessizce düşürmek geliştirme ile üretimi ayrıştırır ve
  hatayı ölçümde saklardı. Düzeltme çağrı yerinde yapılır.
*/
const KISISEL_PARCALAR = [
  'mail',
  'name',
  'isim',
  'title',
  'baslik',
  'text',
  'metin',
  'descr',
  'aciklama',
  'hwid',
  'token',
  'phone',
  'telefon',
  'user',
  'kullanici',
]

function kisiselOlabilir(anahtar) {
  const k = String(anahtar).toLowerCase()
  // "…Id" ile biten her alan şüpheli: topicId, sessionId, matchId — tek başına ya da
  // birleştirilerek kişiyi işaret ederler.
  return k.endsWith('id') || KISISEL_PARCALAR.some((parca) => k.includes(parca))
}

function gonder(name, params) {
  if (!__DEV__) return
  console.log('[analitik]', name, params)
}

/**
 * Özel olay gönderir.
 *
 * KİŞİSEL VERİ GÖNDERİLMEZ. Parametreler bilinçli olarak kaba: süre, puan tutarı,
 * itiraz sebebi gibi sayılabilir ve kişiye bağlanamaz alanlar. GÖNDERİLMEYENLER:
 * kullanıcı kimliği, e-posta, karşı tarafın adı, ders/konu kimliği (topicId) ve her
 * türlü serbest metin (ilan başlığı, mesaj, şikâyet açıklaması) — bunlar tek başına ya
 * da birleştirilerek kişiyi işaret eder ve analitik rızası "kim ne yaptı"yı üçüncü
 * tarafa aktarma izni değildir.
 *
 * MOBİLDE EK OLARAK cihaz kimliği (HWID) de gönderilmez: HWID, banlanan hesabın yeni
 * hesapla dönmesini engellemek için üretilir, ölçüm için değil. Olaya girerse isimsiz
 * ölçüm kalıcı bir cihaz tanımlayıcısına bağlanır ve yaptığımız şey mağaza beyanında
 * "takip"e döner (bkz. yukarıdaki ATT notu).
 */
export function trackEvent(name, params = {}) {
  if (!acik) {
    // İzin yokken sessizce düşer. Geliştirmede yine de görünür olsun: kapının
    // çalıştığını doğrulamanın tek yolu bu, aksi halde "olay neden gelmiyor" sorusu
    // taşıyıcı hatasıyla karışır.
    if (__DEV__) console.log('[analitik] izin yok, olay atlandı:', name)
    return
  }

  if (__DEV__) {
    const supheli = Object.keys(params).filter(kisiselOlabilir)
    if (supheli.length) {
      console.warn(
        `[analitik] "${name}" olayında kişisel veri olabilecek alan(lar): ${supheli.join(', ')}. ` +
          'Olaylara kimlik ve serbest metin girmez (bkz. trackEvent notu).',
      )
    }
  }

  gonder(name, params)
}

/**
 * İzlenecek olaylar — isimler tek yerde, çağrı yerlerinde yazım hatası olmasın.
 * Sözlük web'le BİREBİR aynı: aynı olay iki platformda aynı adla ölçülmezse
 * karşılaştırma yapılamaz.
 *
 * CreditTransferred adı korunuyor ama mobilde bir HARCAMA değil basım işaretidir:
 * ders almak ücretsiz, puan yalnızca anlatana basılır (iş kuralı 1). Olay, ders onayı
 * anında basımın gerçekleştiğini bildirir.
 */
export const AnalyticsEvents = {
  LessonCreated: 'lesson_created',
  SessionRequested: 'session_requested',
  ProofUploaded: 'proof_uploaded',
  CreditTransferred: 'credit_transferred',
  DisputeOpened: 'dispute_opened',
}

/**
 * Ekran görüntüleme bildirir.
 *
 * Web'deki trackPageView(path)'in karşılığı; ADI ve PARAMETRESİ bilerek değişti.
 * Native uygulamada URL yolu yoktur, ölçüm birimi ekran adıdır ("dersler",
 * "profil") — eski imzayı takma adla korumak, çağıranın anlamsız bir yol değeri
 * göndermesine izin verirdi.
 *
 * Ekran adı SABİT bir isim olmalı; rota parametresi (userId, conversationId)
 * GEÇİRİLMEZ — kişiyi işaret eder (bkz. trackEvent kişisel veri notu).
 */
export function trackScreenView(ekranAdi) {
  if (!acik) return
  gonder('screen_view', { screen_name: ekranAdi })
}
