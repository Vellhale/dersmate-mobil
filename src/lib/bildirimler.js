import * as Application from 'expo-application'
import Constants from 'expo-constants'
import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo'
import { Linking, Platform } from 'react-native'
import { api, loadSession } from './api'
import { getHwidHash } from './hwid'
import { ONIZLEME, onizlemeBildirimIzni, onizlemeBildirimIzniIste } from './onizleme'
import { KEYS, secure } from './storage'

/*
  BİLDİRİM ÇEKİRDEĞİ — expo-notifications'a dokunan TEK modül.

  Sağlayıcı (BildirimSaglayici) ve ekranlar Notifications'ı DOĞRUDAN çağırmaz; her şey
  buradan geçer. Sebep üç ortam, üçünde de push API'leri farklı biçimde kırılıyor:

  • Expo Go: SDK 53'ten beri Android'de push yok; API'ler fırlatıyor, paketin kendisi de
    içe aktarılırken konsola uyarı basıyor.
  • Web (önizleme dahil): bazı API'ler UnavailabilityError veriyor; kendi kendine kayıt
    modülü içe aktarılır aktarılmaz uyarı yazıyor.
  • Bu tarihten ÖNCE derlenmiş kabuklar (geliştirme istemcisi, eski APK/.ipa): Metro yeni
    JS'i getiriyor ama pakette yerel modül YOK. expo-notifications modülleri
    requireNativeModule kullanıyor ve modül yoksa İÇE AKTARMA ANINDA fırlatıyor — kökte
    statik bir import, uygulamayı açılışta düşürürdü.

  Bu yüzden paket TEMBEL ve korumalı yükleniyor (aşağıda N). Yüklenemezse modülün her
  fonksiyonu "desteklenmiyor" durumunda sessizce no-op döner; uygulama bildirimsiz ama
  sorunsuz çalışır.

  Device.isDevice ŞARTI YOK: Expo, Google Play hizmetli Android emülatörde push'u
  destekliyor ve orası uçtan uca test için en ucuz ortam.

  ⚠️ GİZLİLİK SIRASI: Android'de Firebase otomatik başlatması kapalı
  (plugins/firebase-otomatik-baslatma.js). Firebase'e İLK bağlantı yalnızca burada,
  tokenAlVeKaydet içinde olur ve o da aydınlatma görülmeden (setAydinlatmaTamam) ÇALIŞMAZ.
  Yeni bir getExpoPushTokenAsync / getDevicePushTokenAsync çağrısı eklenirse aynı kapıdan
  geçmeli; aksi hâlde kullanıcı aydınlatılmadan Google'a ve Expo'ya veri gider.
*/

/* ─── Paket yükleme ────────────────────────────────────────────────────────── */

function yerelModuluYukle() {
  // Önizlemede (demo APK dahil) push bilerek kullanılmıyor; sahte izin onizleme.js'te.
  if (ONIZLEME || Platform.OS === 'web') return null
  try {
    if (isRunningInExpoGo()) return null
  } catch {
    return null
  }
  try {
    // Koşullu require: Metro paketi yine derler ama yukarıdaki ortamlarda HİÇ çalıştırmaz.
    return require('expo-notifications')
  } catch (hata) {
    console.warn(
      '[bildirimler] expo-notifications yüklenemedi; bu pakette push yok (kabuk yeniden derlenmeli).',
      hata?.message ?? hata,
    )
    return null
  }
}

const N = yerelModuluYukle()

/**
 * Bu ortamda push var mı? Yerel modül yüklendiyse evet. Önizlemede adres çubuğundaki
 * ?izin= seçimine göre (bkz. onizleme.js): ayarlar ekranının hâlleri web'de de görülsün.
 */
export function pushDesteklenirMi() {
  if (ONIZLEME) return onizlemeBildirimIzni() !== 'desteklenmiyor'
  return N !== null
}

/* ─── Kanallar ve türler ───────────────────────────────────────────────────── */

/*
  ANDROID KANALLARI — sunucudaki BildirimKanallari ile kimlikler BİREBİR aynı (sunucu her
  iletiye channelId yazıyor; eşleşmeyen kimlikte Android iletiyi "Diğer" kanalına atar).
  Dört kanal dört tercih kategorisiyle bire bir: kullanıcı telefon ayarlarından bir
  kanalı kapatırsa uygulama bunu görür ve sunucuya bildirir (kapaliKanallar).

  ⚠️ ÖNEM SONRADAN DEĞİŞTİRİLEMEZ: Android, oluşturulmuş bir kanalın önemini yalnızca
  kullanıcının değiştirmesine izin veriyor; setNotificationChannelAsync ikinci kez
  çağrıldığında ad ve açıklama güncellenir, önem DEĞİŞMEZ. Önemi değiştirmek gerekirse
  YENİ kimlikli bir kanal açılır (ve sunucu da o kimliğe geçer).

  lockscreenVisibility PRIVATE (dördü de): kilit ekranında yalnızca uygulama adı görünür,
  içerik gizli — telefonun kendi ayarı daha gevşekse o geçerli. 18 yaş altı kullanıcılar
  var; varsayılanın ölçülü olması bu yüzden önemli.

  `aciklama` ayarlar ekranındaki satır metniyle AYNI: tek kaynak burası.
*/
export const KANALLAR = [
  {
    kimlik: 'mesajlar',
    tercih: 'mesajlar',
    ad: 'Mesajlar',
    aciklama: 'Arkadaşların sana yazınca',
    onem: 'HIGH',
  },
  {
    kimlik: 'istekler',
    tercih: 'istekler',
    ad: 'Arkadaş istekleri',
    aciklama: 'Yeni istek, kabul ve düşmek üzere olan istekler (günde en fazla bir özet)',
    onem: 'DEFAULT',
  },
  {
    kimlik: 'ders-onayi',
    tercih: 'dersOnayi',
    ad: 'Ders onayları',
    aciklama: 'Dersin onayını beklerken ve otomatik onaydan önce',
    onem: 'HIGH',
  },
  {
    kimlik: 'ders-plani',
    tercih: 'dersPlani',
    ad: 'Ders planı ve hatırlatmalar',
    aciklama: 'Yeni ders, iptal ve dersten 1 saat / 10 dakika önce',
    onem: 'HIGH',
  },
]

/*
  BİLDİRİM TÜRLERİ — sunucunun data.tur değerleri. `grup` ön planda alınan bildirimin
  neyi tazeleyeceğini söyler: mesaj → gelen kutusu, iliski → iliskiSurumu, ders →
  dersSurumu. Başlıklar sunucudaki sabit başlıklarla aynı; burada yalnızca yerel deneme
  bildiriminde kullanılıyor.
*/
const TURLER = {
  mesaj: { kanal: 'mesajlar', grup: 'mesaj', baslik: 'Yeni mesaj' },
  istek: { kanal: 'istekler', grup: 'iliski', baslik: 'Yeni arkadaş isteği' },
  istekKabul: { kanal: 'istekler', grup: 'iliski', baslik: 'Arkadaş isteğin kabul edildi' },
  istekDusecek: { kanal: 'istekler', grup: 'iliski', baslik: 'Yanıt bekleyen isteklerin var' },
  onay: { kanal: 'ders-onayi', grup: 'ders', baslik: 'Dersin onay bekliyor' },
  otoOnay: { kanal: 'ders-onayi', grup: 'ders', baslik: 'Dersin yakında otomatik onaylanacak' },
  dersPlan: { kanal: 'ders-plani', grup: 'ders', baslik: 'Yeni ders planlandı' },
  dersIptal: { kanal: 'ders-plani', grup: 'ders', baslik: 'Ders iptal edildi' },
  dersYaklasiyor: { kanal: 'ders-plani', grup: 'ders', baslik: 'Dersin yaklaşıyor' },
}

export const BILDIRIM_TURLERI = Object.keys(TURLER)

/** 'mesaj' | 'iliski' | 'ders' | null (bilinmeyen tür ya da deneme bildirimi). */
export function turGrubu(tur) {
  return TURLER[tur]?.grup ?? null
}

let kanalSozu = null

/**
 * Android kanallarını kurar. İdempotent, süreç başına bir kez; İZİN İSTEMİNDEN ÖNCE
 * çalışmalı: Android 13+ en az bir kanal yokken sistem istemini hiç göstermiyor.
 */
export function kanallariKur() {
  if (!N || Platform.OS !== 'android') return Promise.resolve()
  if (!kanalSozu) {
    kanalSozu = Promise.all(
      KANALLAR.map((k) =>
        N.setNotificationChannelAsync(k.kimlik, {
          name: k.ad,
          description: k.aciklama,
          importance: N.AndroidImportance[k.onem],
          lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
          showBadge: true,
          // sound VERİLMİYOR: anahtar yoksa kanal sistemin varsayılan bildirim sesini alır.
        }),
      ),
    ).then(
      () => {},
      (hata) => {
        kanalSozu = null // bir sonraki çağrı yeniden denesin
        console.warn('[bildirimler] kanallar kurulamadı', hata?.message ?? hata)
      },
    )
  }
  return kanalSozu
}

/**
 * Kanal başına durum: { mesajlar: 'acik' | 'kapali', ... }. Android dışında ve kanal henüz
 * yokken hepsi 'acik' (kapatılmış bir şey yok). Telefon ayarlarından kapatılan kanalın
 * önemi NONE olur.
 */
export async function kanalDurumlari() {
  const sonuc = Object.fromEntries(KANALLAR.map((k) => [k.kimlik, 'acik']))
  if (!N || Platform.OS !== 'android') return sonuc
  try {
    const liste = await N.getNotificationChannelsAsync()
    for (const kanal of liste ?? []) {
      if (kanal.id in sonuc && kanal.importance === N.AndroidImportance.NONE) sonuc[kanal.id] = 'kapali'
    }
  } catch {
    /* okunamadıysa hepsi açık varsayılır; sunucu tercihleri yine süzer */
  }
  return sonuc
}

/** Kapalı kanal kimlikleri, sıralı — PUT /push/devices gövdesindeki kapaliKanallar. */
export async function kapaliKanallar() {
  const durum = await kanalDurumlari()
  return KANALLAR.map((k) => k.kimlik).filter((kimlik) => durum[kimlik] === 'kapali')
}

/** Telefonun o kanala ait ayar sayfası (Android 8+); açılamazsa uygulama ayarları. */
export async function kanalAyarlariniAc(kanal) {
  if (Platform.OS === 'android' && N) {
    try {
      await Linking.sendIntent('android.settings.CHANNEL_NOTIFICATION_SETTINGS', [
        { key: 'android.provider.extra.APP_PACKAGE', value: Application.applicationId ?? 'com.dersmate.app' },
        { key: 'android.provider.extra.CHANNEL_ID', value: kanal },
      ])
      return
    } catch {
      /* bazı üreticiler bu niyeti karşılamıyor: genel ayarlara düş */
    }
  }
  await ayarlariAc()
}

/** Uygulamanın telefon ayarları (izin reddedildiyse tek geri dönüş yolu). */
export function ayarlariAc() {
  return Linking.openSettings().catch(() => {})
}

/* ─── İzin ─────────────────────────────────────────────────────────────────── */

const ESKI_ANDROID = Platform.OS === 'android' && Number(Platform.Version) < 33

const DESTEKSIZ = Object.freeze({
  destekleniyor: false,
  verildi: false,
  sorulabilir: false,
  belirsiz: false,
  eskiAndroid: ESKI_ANDROID,
})

function izinCevir(d) {
  // iOS'ta sessiz teslim (PROVISIONAL) `granted` false döner ama bildirim gidiyor: verildi.
  const verildi = Boolean(d?.granted) || d?.ios?.status === N?.IosAuthorizationStatus?.PROVISIONAL
  return {
    destekleniyor: true,
    verildi,
    sorulabilir: !verildi && d?.canAskAgain !== false,
    belirsiz: d?.status === 'undetermined',
    eskiAndroid: ESKI_ANDROID,
  }
}

function onizlemeIzni() {
  const izin = onizlemeBildirimIzni()
  if (izin === 'desteklenmiyor') return DESTEKSIZ
  return {
    destekleniyor: true,
    verildi: izin === 'verildi',
    sorulabilir: izin === 'belirsiz',
    belirsiz: izin === 'belirsiz',
    eskiAndroid: false,
  }
}

/**
 * { destekleniyor, verildi, sorulabilir, belirsiz, eskiAndroid }.
 * eskiAndroid: Android 7–12 — izin varsayılan AÇIK ve sistem istemi yok. Orada aydınlatma
 * ekranı izin istemi olmadan gösterilmeli (izin "verildi" görünse de aydınlatma yok).
 */
export async function izinDurumu() {
  if (ONIZLEME) return onizlemeIzni()
  if (!N) return DESTEKSIZ
  try {
    return izinCevir(await N.getPermissionsAsync())
  } catch {
    return { ...DESTEKSIZ, destekleniyor: true }
  }
}

/**
 * Sistem izin istemini açar (iOS'ta TEK SEFERLİK; reddedilirse yalnızca telefon ayarları).
 * Yalnızca aydınlatma ekranındaki "Aç/Devam"dan SONRA çağrılmalı. Android 13 altında
 * istem yok, mevcut durum döner.
 */
export async function izinIste() {
  if (ONIZLEME) {
    onizlemeBildirimIzniIste()
    return onizlemeIzni()
  }
  if (!N) return DESTEKSIZ
  await kanallariKur()
  try {
    return izinCevir(
      await N.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } }),
    )
  } catch {
    return izinDurumu()
  }
}

/* ─── Oturum durumu: alıcı etiketi, aktif sohbet, aydınlatma ───────────────── */

let aktifAlici = null
let aktifSohbet = null
let aydinlatmaTamam = false
const aliciBekleyenler = new Set()

const oturumSahibi = () => loadSession()?.userId ?? null
const kucuk = (deger) => (deger ? String(deger).toLowerCase() : null)

/*
  ALICI ETİKETİ — sunucunun bu hesap için ürettiği HMAC türevi (hesap kimliği değil).
  Bildirim verisi userId TAŞIMIYOR; "bu bildirim şu anki hesaba mı ait" sorusu etiketle
  cevaplanıyor. Aynı telefonda A çıkıp B girdiğinde, A'ya yazılmış ama geç teslim edilen
  bildirim B'nin ekranında gösterilmez ve dokunulursa gezinilmez.
  PUT /push/devices ve GET /push/preferences yanıtları getiriyor.
*/
export function setAktifAlici(alici) {
  aktifAlici = alici || null
  if (aktifAlici) {
    for (const bitir of [...aliciBekleyenler]) bitir(aktifAlici)
  }
}

export function aktifAliciyiAl() {
  return aktifAlici
}

/**
 * Etiket gelene kadar en fazla `ms` bekler; gelmezse null. Soğuk açılışta bildirime
 * dokunulduğunda etiket henüz yüklenmemiş olabiliyor.
 */
export function aliciBekle(ms = 3000) {
  if (aktifAlici) return Promise.resolve(aktifAlici)
  return new Promise((coz) => {
    const bitir = (alici) => {
      clearTimeout(zamanlayici)
      aliciBekleyenler.delete(bitir)
      coz(alici)
    }
    const zamanlayici = setTimeout(() => bitir(null), ms)
    aliciBekleyenler.add(bitir)
  })
}

/**
 * Ekranda açık sohbet (null: yok). Sohbet ekranı ODAKTA yazar, odağı kaybedince siler:
 * kurulumda yazmak yetmez, altına profil itildiğinde ekran kurulu kalıyor.
 * Harf büyüklüğü normalleştiriliyor: aynı GUID farklı kaynaklardan farklı yazımla
 * gelebiliyor (api.js → avatarAnahtar dersi).
 */
export function setAktifSohbet(conversationId) {
  aktifSohbet = kucuk(conversationId)
}

/**
 * Kullanıcı bildirim aydınlatmasını gördü mü (sunucudaki aydinlatmaAtUtc dolu mu, ya da
 * az önce "Aç/Devam"a mı bastı). false iken tokenAlVeKaydet Firebase'e HİÇ dokunmaz —
 * sunucu da aydınlatmasız kaydı reddediyor; bu, aynı güvencenin istemci yarısı.
 */
export function setAydinlatmaTamam(tamam) {
  aydinlatmaTamam = Boolean(tamam)
}

/* ─── Bildirim verisi ve rota ──────────────────────────────────────────────── */

/** Bildirimden { tur, url, alici } — alan yoksa ya da tipi yanlışsa null. */
export function bildirimVerisi(bildirim) {
  const data = bildirim?.request?.content?.data
  const d = data && typeof data === 'object' ? data : {}
  const metin = (deger) => (typeof deger === 'string' && deger ? deger : null)
  return { tur: metin(d.tur), url: metin(d.url), alici: metin(d.alici) }
}

/*
  ROTA BEYAZ LİSTESİ — bildirimden gelen adres YALNIZCA bunlardan biriyse gidilir.
  Veri sunucudan geliyor ama taşıyıcı üçüncü taraf (Expo, FCM, APNs) ve yerel bildirim
  API'si cihazdaki başka kodun da bildirim üretmesine izin veriyor. Serbest bir adres
  uygulamanın içinde herhangi bir ekrana (yönetim dahil) derin bağlantı demek olurdu.
*/
const GUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const ROTALAR = [
  new RegExp(`^/sohbet/${GUID}$`, 'i'),
  /^\/eslesmeler\?sekme=(incoming|active)$/,
  new RegExp(`^/dersler(\\?ders=${GUID})?$`, 'i'),
  /^\/bildirimler$/,
]

/** Güvenli rota ya da null. `veri`: bildirimVerisi çıktısı ya da ham data nesnesi. */
export function guvenliRota(veri) {
  const url = typeof veri?.url === 'string' ? veri.url : null
  return url && ROTALAR.some((desen) => desen.test(url)) ? url : null
}

/** Adresteki kayıt kimliği (sohbet ya da ders), küçük harfle; yoksa null. */
export function kayitKimligi(url) {
  if (typeof url !== 'string') return null
  const eslesme = new RegExp(`^/sohbet/(${GUID})$|[?&]ders=(${GUID})`, 'i').exec(url)
  return kucuk(eslesme?.[1] ?? eslesme?.[2])
}

/* ─── Ön plan gösterimi ────────────────────────────────────────────────────── */

const GIZLE = Object.freeze({
  shouldShowBanner: false,
  shouldShowList: false,
  shouldPlaySound: false,
  shouldSetBadge: false,
})
const GOSTER = Object.freeze({
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: false, // rozet sayısını uygulama kendisi yazıyor (okunmamış toplamı)
})

/*
  Karar SENKRON ve yalnızca bellekteki duruma bakıyor: işleyici 3 sn içinde yanıt vermezse
  bildirim düşürülüyor, ağ ya da depolama beklemek burada yeri olmayan bir risk.

  Gizlenen durumlar:
  • oturum yok (çıkış yapılmış telefona önceki hesabın geç gelen bildirimi),
  • alıcı etiketi biliniyor ve bildirimdeki farklı (aynı telefonda başka hesap),
  • mesaj bildirimi ve o sohbet şu an ekranda açık (mesaj zaten canlı akışta görünüyor).
  Etiket henüz bilinmiyorsa gösterilir: açılışın ilk saniyelerinde gelen bildirimi
  kaybetmek, nadir bir hesap değişimi riskinden daha kötü.
*/
function sunumKarari(bildirim) {
  const veri = bildirimVerisi(bildirim)
  if (!oturumSahibi()) return GIZLE
  if (veri.alici && aktifAlici && veri.alici !== aktifAlici) return GIZLE
  if (veri.tur === 'mesaj' && aktifSohbet && kayitKimligi(veri.url) === aktifSohbet) return GIZLE
  return GOSTER
}

/*
  İşleyici MODÜL YÜKLENİRKEN kuruluyor (kök layout bu dosyayı yan etki için içe aktarıyor):
  işleyici yokken ön plandaki bildirim HİÇ gösterilmiyor (v57 belgesi) ve ilk bildirim
  herhangi bir bileşen kurulmadan gelebilir. Kalıcı; hiçbir yerde kaldırılmamalı.
*/
if (N) {
  N.setNotificationHandler({
    handleNotification: async (bildirim) => {
      try {
        return sunumKarari(bildirim)
      } catch {
        return GOSTER
      }
    },
  })
}

/* ─── Dinleyiciler (sağlayıcı için) ────────────────────────────────────────── */

const bosVazgec = () => {}

function dinle(kaydet, dinleyici) {
  if (!N) return bosVazgec
  try {
    const abonelik = kaydet(dinleyici)
    return () => abonelik.remove()
  } catch {
    return bosVazgec
  }
}

/** Bildirime dokunuldu (uygulama açıkken ya da arka plandan). @returns vazgeç */
export function yanitDinle(dinleyici) {
  return dinle((d) => N.addNotificationResponseReceivedListener(d), dinleyici)
}

/** Uygulama ön plandayken bildirim geldi. @returns vazgeç */
export function gelenDinle(dinleyici) {
  return dinle((d) => N.addNotificationReceivedListener(d), dinleyici)
}

/**
 * İşletim sistemi yeni bir cihaz token'ı verdi (FCM/APNs döndürdü). Dinleyici
 * tokenAlVeKaydet'i çağırmalı; Expo token'ı orada yeniden türetilir. YALNIZCA aydınlatma
 * görüldükten sonra kurulmalı. @returns vazgeç
 *
 * ⛔ OLAY SÜZÜLMEDEN DİNLEYİCİYE VERİLMEZ — yoksa kayıt kendini sonsuza kadar tetikler.
 * Yerel modül onDevicePushToken olayını yalnızca token DÖNÜNCE değil, HER
 * getDevicePushTokenAsync çağrısında yayıyor (Android PushTokenModule.kt: resolve'un hemen
 * ardından onNewToken; iOS PushTokenModule.swift: didRegister içinde resolve + sendEvent).
 * Kaydın kendisi o çağrıyı yapıyor: kayıt → olay → dinleyici → kayıt → olay … Uygulama
 * öndeyken saniyede birkaç tur exp.host + PUT /push/devices demekti (simülasyonda tek
 * kayıt 2 sn'de 34 PUT üretti). Expo'nun kendi otomatik kaydı da aynı olayı
 * hasDeviceTokenChangedAsync ile süzmek zorunda kalmış.
 *
 * Süzgeç: yalnızca bu süreçte GÖRÜLMEMİŞ bir token dinleyiciye gider. Henüz hiç token
 * okunmadıysa olay da yok sayılır — sıradaki kayıt güncel token'ı zaten okuyacak.
 * Kendi çağrımızın yankısı token'ı kaydetmemizden ÖNCE gelirse (olay ile sözün sırası
 * garanti değil) en fazla BİR fazladan tur olur: o turun yankısında token artık görülmüş.
 */
export function tokenDinle(dinleyici) {
  return dinle(
    (d) => N.addPushTokenListener(d),
    (olay) => {
      const yeni = typeof olay?.data === 'string' && olay.data ? olay.data : null
      if (!yeni || !sonCihazTokeni || yeni === sonCihazTokeni) return
      dinleyici(olay)
    },
  )
}

/** Uygulamayı AÇAN son dokunuş (soğuk açılış). Senkron biçim: Async olanı SDK 57'de eskidi. */
export function sonYanit() {
  if (!N) return null
  try {
    return N.getLastNotificationResponse()
  } catch {
    return null
  }
}

/** Soğuk açılış yanıtı işlendi: sonraki bir yeniden kurulumda tekrar gezinilmesin. */
export function sonYanitiTemizle() {
  try {
    N?.clearLastNotificationResponse()
  } catch {
    /* yut */
  }
}

const YANIT_OMRU_MS = 24 * 60 * 60 * 1000

/**
 * Dokunuşu gezinme kararına çevirir: { tur, url, alici, rota, kimlik } ya da null.
 * null: varsayılan eylem değil (ileride eklenecek düğmeler) ya da bildirim 24 saatten
 * eski — eski bir bildirimin götüreceği ekranın durumu çoktan değişmiştir.
 * `rota` beyaz listeden geçmemişse null (gezinilmez). Alıcı etiketi kontrolünü çağıran
 * yapar (aliciBekle ile).
 */
export function yanitCozumle(yanit, simdi = Date.now()) {
  if (!N || !yanit?.notification) return null
  if (yanit.actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER) return null
  const ham = yanit.notification.date
  if (typeof ham === 'number' && ham > 0) {
    // Android milisaniye, iOS SANİYE veriyor (NotificationRecords.swift: timeIntervalSince1970).
    const ms = ham < 1e11 ? ham * 1000 : ham
    if (simdi - ms > YANIT_OMRU_MS) return null
  }
  const veri = bildirimVerisi(yanit.notification)
  return { ...veri, rota: guvenliRota(veri), kimlik: yanit.notification.request?.identifier ?? null }
}

/* ─── Sunulmuş bildirimler ve rozet ───────────────────────────────────────── */

/** Bildirim merkezinde duranların verisi: [{ tur, url, alici, kimlik }]. */
export async function sunulanBildirimler() {
  if (!N) return []
  try {
    const liste = await N.getPresentedNotificationsAsync()
    return liste.map((b) => ({ ...bildirimVerisi(b), kimlik: b.request?.identifier ?? null }))
  } catch {
    return []
  }
}

/**
 * Eşleşen sunulmuş bildirimleri kaldırır; kaldırılan sayısını döner.
 * @param eslesme { grup?: 'mesaj'|'iliski'|'ders', turler?: string[], kayitId?: string }
 *   Verilen koşulların HEPSİ tutmalı. Koşulsuz çağrı hiçbir şeyi silmez: hepsi için
 *   tumBildirimleriKapat.
 */
export async function sunulanlariKapat({ grup, turler, kayitId } = {}) {
  if (!N || (!grup && !turler && !kayitId)) return 0
  const kume = turler ? new Set(turler) : null
  const hedef = kucuk(kayitId)
  const sunulan = await sunulanBildirimler()
  const silinecek = sunulan.filter(
    (b) =>
      b.kimlik &&
      (!grup || turGrubu(b.tur) === grup) &&
      (!kume || kume.has(b.tur)) &&
      (!hedef || kayitKimligi(b.url) === hedef),
  )
  await Promise.all(silinecek.map((b) => N.dismissNotificationAsync(b.kimlik).catch(() => {})))
  return silinecek.length
}

/** Bildirim merkezini boşaltır ve rozeti sıfırlar (çıkış). Asla fırlatmaz. */
export async function tumBildirimleriKapat() {
  if (!N) return
  await Promise.all([
    N.dismissAllNotificationsAsync().catch(() => {}),
    N.setBadgeCountAsync(0).catch(() => {}),
  ])
}

/** Uygulama ikonundaki sayı (okunmamış mesaj toplamı). Asla fırlatmaz. */
export function rozetAyarla(sayi) {
  if (!N) return Promise.resolve()
  return N.setBadgeCountAsync(Math.max(0, Number(sayi) || 0)).then(
    () => {},
    () => {},
  )
}

/* ─── Token ve cihaz kaydı ─────────────────────────────────────────────────── */

const PROJE_KIMLIGI = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
const ONIZLEME_TOKENI = 'ExponentPushToken[onizleme]'
const YENILEME_ARALIGI_MS = 30 * 60 * 1000
const IPTAL = Object.freeze({ kayitli: false, sebep: 'iptal' })

// Bu süreçte getExpoPushTokenAsync başarılı oldu mu: unutma işareti yazmanın bir koşulu
// (diğeri diskteki kayıt bayrağı, bkz. buKurulumdaKayitliMi).
let tokenAlindi = false

// Bu süreçte en son okunan CİHAZ token'ı (FCM/APNs). YALNIZCA tokenDinle'nin süzgeci ve
// kayitYenilenmeli için; sunucuya giden değer bu DEĞİL, diske de yazılmaz.
let sonCihazTokeni = null

/*
  Expo token'ı HER ÇAĞRIDA yeniden okunuyor ve saklanmıyor (ne bellekte ne diskte):
  işletim sistemi cihaz token'ını döndürebiliyor ve kapanışta tutulan eski değer, sunucuya
  yanlış cihaz adresi yazdırırdı. Aynı token için ağ maliyeti yok — Firebase/APNs
  önbelleğinden geliyor, Expo çağrısı idempotent.

  Cihaz token'ı AYRICA okunup getExpoPushTokenAsync'e veriliyor (paket aynısını içeride
  yapıyor): değerini bilmek, token dinleyicisinin kendi çağrımızın yankısını ayırt etmesi
  için gerekli (tokenDinle).
*/
async function expoTokeniAl() {
  const cihaz = await N.getDevicePushTokenAsync()
  if (typeof cihaz?.data === 'string' && cihaz.data) sonCihazTokeni = cihaz.data
  const { data } = await N.getExpoPushTokenAsync({ projectId: PROJE_KIMLIGI, devicePushToken: cihaz })
  tokenAlindi = true
  return data
}

let kayitUcusu = null
let kayitSirada = null // { istek, soz, coz } — uçuş bitince gönderilecek EN SON istek
let sonKayit = null // { sahip, zaman, kanallar, cihazTokeni } — son BAŞARILI (kayitli:true) kayıt
// Kayıt bayrağı (KEYS.pushKayitli) bu oturumda diske yazıldı mı: her 30 dakikalık
// yenilemede SecureStore'a yeniden yazılmasın. oturumKapandi sıfırlar.
let kayitBayragiYazildi = false

/**
 * Token'ı al ve PUT /push/devices ile oturumdaki hesaba bağla.
 *
 * TEK UÇUŞLU ve "EN SON KAZANIR": uçuş sürerken gelen çağrılar birikmez; yalnızca en
 * sonuncusu, uçuş bitince TEK istek olarak gider. Paralel iki PUT'ta eski token'lı olan
 * sona kalırsa cihaz sunucuda eski token'la kalır ve bir sonraki soğuk açılışa kadar
 * bildirim gelmezdi. Sırada bekleyen deneme, beklerken hesap değiştiyse ya da çıkış
 * yapıldıysa İPTAL edilir (sonuç { sebep: 'iptal' }).
 *
 * ASLA FIRLATMAZ. Dönüş: { kayitli, alici?, sebep? } — sebep: 'oturum-yok' |
 * 'desteklenmiyor' | 'aydinlatma' | 'izin' | 'iptal' | 'hata' | 'sunucu' (sunucu kaydı
 * almadı: aydınlatma damgası yok ya da bu cihazın en yeni oturumu aktif değil).
 *
 * @param secenekler.kapaliKanallar verilmezse telefon ayarlarından okunur.
 */
export function tokenAlVeKaydet(secenekler = {}) {
  const istek = { sahip: oturumSahibi(), kapaliKanallar: secenekler.kapaliKanallar }
  if (!kayitUcusu) return kayitBaslat(istek)
  if (kayitSirada) {
    kayitSirada.istek = istek
    return kayitSirada.soz
  }
  let coz
  const soz = new Promise((c) => {
    coz = c
  })
  kayitSirada = { istek, soz, coz }
  return soz
}

/*
  İptal edilen uçuş token okumuş olabilir ve getExpoPushTokenAsync Expo'nun otomatik
  kaydını her çağrıda yeniden AÇIYOR (bkz. otomatikKaydiKapat). Çıkış o sırada
  kapatmışsa, oturumsuz kalan telefonda yeniden açık kalmasın. Arada başka hesap girdiyse
  dokunulmaz: onun kaydı açık olmasını istiyor.
*/
function iptalEt() {
  if (!oturumSahibi()) otomatikKaydiKapat()
  return IPTAL
}

function kayitBaslat(istek) {
  kayitUcusu = kaydet(istek).finally(() => {
    kayitUcusu = null
    const sira = kayitSirada
    kayitSirada = null
    if (!sira) return
    if (sira.istek.sahip !== oturumSahibi()) {
      sira.coz(IPTAL)
      return
    }
    kayitBaslat(sira.istek).then(sira.coz)
  })
  return kayitUcusu
}

async function kaydet({ sahip, kapaliKanallar: verilen }) {
  try {
    if (!sahip) return { kayitli: false, sebep: 'oturum-yok' }
    if (!pushDesteklenirMi()) return { kayitli: false, sebep: 'desteklenmiyor' }
    if (!aydinlatmaTamam) return { kayitli: false, sebep: 'aydinlatma' }
    if (!(await izinDurumu()).verildi) return { kayitli: false, sebep: 'izin' }

    // Çevrimdışı çıkıştan kalan unutma işi varsa ÖNCE o: sıra "unut → yeniden kaydet"
    // olmalı, tersi yeni hesabın az önce yazılan kaydını silerdi.
    if (!ONIZLEME) await unutmaCalistir()

    const token = ONIZLEME ? ONIZLEME_TOKENI : await expoTokeniAl()
    const kanallar = [...(verilen ?? (await kapaliKanallar()))].sort()
    const hwidHash = ONIZLEME ? 'onizleme-hwid' : await getHwidHash()
    if (sahip !== oturumSahibi()) return iptalEt()

    const yanit = await api.registerPushDevice({
      token,
      platform: Platform.OS === 'ios' ? 'Ios' : 'Android',
      hwidHash,
      kapaliKanallar: kanallar,
    })
    // Yanıt beklenirken çıkış ya da hesap değişimi: etiket de başarı da artık başkasının.
    if (sahip !== oturumSahibi()) return iptalEt()

    if (typeof yanit?.alici === 'string') setAktifAlici(yanit.alici)
    const kayitli = yanit?.kayitli === true
    if (kayitli) {
      sonKayit = { sahip, zaman: Date.now(), kanallar: kanallar.join(','), cihazTokeni: sonCihazTokeni }
      if (!ONIZLEME) {
        // Başarılı kayıt token satırını bu hesaba TAŞIDI: bekleyen unutma artık gereksiz
        // (ve yapılırsa bu kaydı silerdi).
        await secure.set(KEYS.pushUnutulacak, null)
        if (!kayitBayragiYazildi) {
          await secure.set(KEYS.pushKayitli, String(Date.now()))
          kayitBayragiYazildi = true
        }
      }
    }
    return { kayitli, alici: yanit?.alici ?? null, sebep: kayitli ? null : 'sunucu' }
  } catch (hata) {
    // Firebase dosyası yok, ağ yok, Expo erişilemez, sunucu uçları henüz yok… Hepsi
    // "bildirimsiz ama çalışan uygulama" demek; bir sonraki öne gelişte yeniden denenir.
    return { kayitli: false, sebep: 'hata', hata }
  }
}

/**
 * Kayıt yenilenmeli mi? Uygulama öne gelince sağlayıcı sorar: bu hesap için hiç başarılı
 * kayıt yoksa, son başarılı kayıttan 30 dk geçtiyse ya da kapalı kanal listesi
 * değiştiyse evet. İdempotent upsert; kişi başı genel hız sınırının çok altında kalır.
 * Askı bitişi, token taşınması ya da DeviceNotRegistered sonrası "oturum canlı, satır
 * yok" durumunu da bu kapatıyor.
 */
export function kayitYenilenmeli(kapaliKanallarListesi = []) {
  if (!sonKayit || sonKayit.sahip !== oturumSahibi()) return true
  if (Date.now() - sonKayit.zaman >= YENILEME_ARALIGI_MS) return true
  // Son başarılı kayıttan sonra yeni bir cihaz token'ı görüldü ama kaydı tamamlanamadı:
  // token dinleyicisi aynı token'ı bir daha tetiklemez (süzgeç), yenilemeyi bu yakalar.
  if (sonCihazTokeni && sonKayit.cihazTokeni !== sonCihazTokeni) return true
  return [...kapaliKanallarListesi].sort().join(',') !== sonKayit.kanallar
}

/* ─── Çevrimdışı çıkış: "unutulacak" işareti ───────────────────────────────── */

/*
  Çıkışta sunucu (LogoutHandler) bu cihazın push kaydını siliyor. Çıkış isteği ağa
  ulaşmazsa kayıt sunucuda kalır ve telefona önceki hesabın bildirimleri gelmeye devam
  eder. Bu bölüm o boşluğu kapatıyor: çıkış ulaşmadıysa işaret yazılır, sonraki açılışta
  (oturumlu ya da oturumsuz) token yeniden okunup POST /push/devices/forget çağrılır.

  Mobil AYRI bir silme isteği atmaz; normal yolda silmeyi sunucunun çıkışı yapıyor.

  İKİ ANAHTAR, İKİ SORU (ikisi de SecureStore, "zorunlu" kategori, gizlilik §4):
  • KEYS.pushKayitli    — "bu kurulum push'a kaydoldu": ilk başarılı kayıtta yazılır,
                          kayıt sunucudan silinince (ulaşan çıkış, başarılı forget) gider.
  • KEYS.pushUnutulacak — "çıkış ulaşmadı, kaydı unuttur": yalnızca çevrimdışı çıkışta.

  Birincisi neden var (2026-09-25 düzeltmesi): işaret eskiden yalnızca BU SÜREÇTE token
  alındıysa yazılıyordu. Uygulama çevrimdışı AÇILIP çevrimdışı çıkış yapılınca token hiç
  alınamamış oluyor, işaret yazılmıyor, kayıt sunucuda bağlı kalıyordu (çıkış hiç ulaşmadığı
  için en yeni oturum aktif) ve çıkış yapılmış telefonun kilit ekranına 60 güne kadar
  önceki hesabın mesaj bildirimleri gidiyordu — gizlilik §5 ise "bir sonraki açılışta
  silinir" diyordu. Süreç bayrağı tek başına bu yüzden yetmiyor.
  Bayrak aynı zamanda AYDINLATMANIN KANITI: unutmak için token istemek Firebase'e/APNs'e ve
  Expo'ya gitmek demek; bu kurulumda kayıt yapılmışsa o akışa aydınlatmayla çoktan
  girilmiştir. Kayıt hiç yapılmamışsa sunucuda unutulacak bir satır da yoktur.

  ⚠️ KALAN SINIR: çevrimdışı çıkıştan sonra uygulama bir daha hiç (internetle) açılmazsa
  kayıt, en yeni oturumun ömrü dolana kadar (60 gün) bağlı kalır — gizlilik §5'te yazılı.
*/

/** İşaret var mı? */
export async function unutmaBekliyorMu() {
  if (ONIZLEME) return false
  return Boolean(await secure.get(KEYS.pushUnutulacak))
}

/*
  Kayıt bayrağı BU KURULUMA mı ait? iOS Keychain uygulama silinip kurulsa da YAŞIYOR:
  önceki kurulumun bayrağıyla işaret yazılsaydı, sonraki açılıştaki unutma bu kurulumda
  aydınlatma görülmeden APNs'e ve Expo'ya giderdi (unutmaCalistir'daki kurulum denetimi
  işaretin kendi zamanına bakıyor ve o yeni işaret onu geçerdi). Bayat bayrak silinir.
*/
async function buKurulumdaKayitliMi() {
  const zaman = Number(await secure.get(KEYS.pushKayitli))
  if (!zaman) return false
  try {
    const kurulum = await Application.getInstallationTimeAsync()
    if (kurulum && kurulum.getTime() > zaman) {
      await secure.set(KEYS.pushKayitli, null)
      return false
    }
  } catch {
    /* kurulum zamanı okunamadı: bayrağa güvenilir (unutmaCalistir'la aynı tercih) */
  }
  return true
}

/**
 * Çıkışın sunucu çağrısı ulaşmadıysa (oturumuSonlandir → false) çağrılır. İşareti
 * yalnızca bu kurulumda kayıt yapıldıysa (diskteki bayrak) ya da bu süreçte token
 * alındıysa yazar. @returns yazıldı mı
 */
export async function unutmaIsaretle() {
  if (!N) return false
  if (!tokenAlindi && !(await buKurulumdaKayitliMi())) return false
  await secure.set(KEYS.pushUnutulacak, String(Date.now()))
  return true
}

/**
 * Çıkışın sunucu çağrısı sonuçlanınca (AuthContext.logout) çağrılır. Asla fırlatmaz.
 * @param ulasti oturumuSonlandir'ın sonucu
 * @param cikisAni çıkışa basıldığı an (ms) — o andan SONRA yazılmış kayıt bayrağı, arada
 *   giriş yapıp kaydolan başka bir oturuma ait; silinmez.
 */
export async function cikisSonuclandi(ulasti, cikisAni) {
  if (!N) return
  try {
    if (!ulasti) {
      await unutmaIsaretle()
      return
    }
    // Sunucu çıkışta bu cihazın satırını sildi: "kaydoldu" bayrağının da işi bitti.
    const zaman = Number(await secure.get(KEYS.pushKayitli))
    if (zaman && zaman <= cikisAni) await secure.set(KEYS.pushKayitli, null)
  } catch {
    /* depolama yazılamadı: en kötü ihtimalle bir sonraki çevrimdışı çıkışta fazladan bir forget */
  }
}

let unutmaSozu = null

/**
 * İşaret varsa token'ı sunucuya unutturur ve işareti siler. Tek uçuşlu, asla fırlatmaz.
 * Açılışta (oturum olsun olmasın) bir kez çağrılmalı; tokenAlVeKaydet de kayıttan önce
 * kendisi çağırıyor. @returns işaret kalmadı mı (hata olursa false: iş sonraki açılışa)
 */
export function unutmaCalistir() {
  if (unutmaSozu) return unutmaSozu
  unutmaSozu = (async () => {
    if (ONIZLEME) return true
    const isaret = await secure.get(KEYS.pushUnutulacak)
    if (!isaret) return true
    // Bu pakette push yoksa işaret anlamsız (token alınamaz, dolayısıyla unutulamaz).
    if (!N) {
      await secure.set(KEYS.pushUnutulacak, null)
      return true
    }
    /*
      YENİDEN KURULUM: iOS Keychain uygulama silinip kurulsa da YAŞIYOR, işaret de onunla.
      Yeni kurulumda token değişmiş olur (eski kayıt zaten DeviceNotRegistered ile düşer)
      ve unutmak için token istemek, bu kurulumda aydınlatma görülmeden APNs'e ve Expo'ya
      gitmek demek. Kurulum işaretten SONRAYSA işaret sessizce atılır.
    */
    try {
      const kurulum = await Application.getInstallationTimeAsync()
      if (kurulum && kurulum.getTime() > Number(isaret)) {
        await secure.set(KEYS.pushUnutulacak, null)
        return true
      }
    } catch {
      /* kurulum zamanı okunamadı: normal yoldan devam */
    }
    try {
      await api.forgetPushDevice(await expoTokeniAl())
      await secure.set(KEYS.pushUnutulacak, null)
      // Satır silindi; kayıt bayrağı da gider. Oturumluysak sıradaki kayıt yeniden yazar.
      await secure.set(KEYS.pushKayitli, null)
      kayitBayragiYazildi = false
      return true
    } catch {
      return false
    } finally {
      // Token okuma Expo'nun otomatik kaydını yeniden açtı (otomatikKaydiKapat). Oturum
      // yoksa kapatılır; varsa sıradaki kayıt zaten açık istiyor.
      if (!oturumSahibi()) await otomatikKaydiKapat()
    }
  })().finally(() => {
    unutmaSozu = null
  })
  return unutmaSozu
}

/* ─── Expo'nun otomatik sunucu kaydı ───────────────────────────────────────── */

/*
  expo-notifications'ın KENDİ kayıt mekanizması: getExpoPushTokenAsync her çağrıda onu
  kalıcı olarak AÇIYOR (build/getExpoPushTokenAsync.js → setAutoServerRegistrationEnabledAsync
  (true)) ve açık kaldıkça paket, içe aktarıldığı HER AÇILIŞTA (DevicePushTokenAutoRegistration
  .fx.js) oturuma bakmadan cihaz token'ını FCM/APNs'ten istiyor, token değişince ya da
  7 günde bir exp.host/--/api/v2/push/updateDeviceToken'a kurulum numarasıyla POST ediyor.

  Bizim kaydımız ona muhtaç değil: her kayıt getExpoPushTokenAsync'ten geçiyor ve Expo'daki
  eşlemeyi o çağrı güncelliyor. Ama kapatılmazsa çıkıştan sonra da, aynı kurulumda
  aydınlatmayı REDDEDEN ikinci bir hesap açıkken de cihaz Google/Apple ve Expo ile
  konuşmaya devam ederdi — "akış yalnızca Aç/Devam'dan sonra" ilkesinin ve gizlilik §7'deki
  "çıkış yapman yeterli" cümlesinin tersi. Oturum kapanınca kapatılıyor; bir sonraki
  başarılı kayıt kendiliğinden yeniden açar.

  ⚠️ iOS'TA PAKETİN KENDİ KAPATMASI ÇALIŞMIYOR: setAutoServerRegistrationEnabledAsync(false)
  yerel modüle null geçiriyor, iOS'taki imza ise opsiyonel olmayan String
  (ServerRegistrationModule.swift → setRegistrationInfoAsync) ve Expo Modules null'ı
  reddediyor (DynamicStringType). Hata olursa aynı yerel modüle "kapalı" kaydı doğrudan
  yazılıyor: DevicePushTokenAutoRegistration.fx.js isEnabled false'u "kapalı" sayıyor.
  Kapatma, sakladığı son cihaz token'ını da siliyor; kurulum numarası ayrı kayıtta, kalıyor.

  ⛔ Kayıt AÇIK DEĞİLSE hiçbir şey yazılmaz: iOS yolu Anahtar Zinciri'ne bir öğe
  yazıyor ve bildirimleri hiç açmamış kullanıcının her çıkışında bu öğe doğardı — gizlilik
  §4 bileşenin kayıtlarını "yalnızca bildirimleri açtıysan" diye anlatıyor.
*/
export async function otomatikKaydiKapat() {
  if (!N) return
  let modul = null
  try {
    modul = requireOptionalNativeModule('NotificationsServerRegistrationModule')
    const kayit = JSON.parse((await modul?.getRegistrationInfoAsync?.()) ?? 'null')
    if (!kayit?.isEnabled) return
  } catch {
    /* okunamadı ya da bozuk: kapatmayı yine de dene */
  }
  try {
    await N.setAutoServerRegistrationEnabledAsync(false)
    return
  } catch {
    /* iOS: null geçilemiyor — aşağıdaki yola düş */
  }
  try {
    await modul?.setRegistrationInfoAsync(JSON.stringify({ isEnabled: false }))
  } catch {
    /* yut: bir sonraki oturum kapanışında yeniden denenir */
  }
}

/* ─── Oturum kapanışı ──────────────────────────────────────────────────────── */

/**
 * Çıkışta ve onAuthExpired'da çağrılır: yerel durumu sıfırlar, sıradaki kaydı iptal
 * eder, Expo'nun otomatik kaydını kapatır, bildirim merkezini boşaltır ve rozeti
 * sıfırlar. Kilit ekranında önceki hesabın bildirimleri kalmasın. Ateşle-unut:
 * beklenmez, asla fırlatmaz.
 */
export function oturumKapandi() {
  setAktifAlici(null)
  setAktifSohbet(null)
  aydinlatmaTamam = false
  sonKayit = null
  kayitBayragiYazildi = false
  if (kayitSirada) {
    const sira = kayitSirada
    kayitSirada = null
    sira.coz(IPTAL)
  }
  otomatikKaydiKapat()
  tumBildirimleriKapat()
}

/* ─── Geliştirme: yerel deneme bildirimi ───────────────────────────────────── */

function ornekRota(tur, kayitId) {
  const id = kucuk(kayitId)
  switch (tur) {
    case 'mesaj':
    case 'istekKabul':
      return id ? `/sohbet/${id}` : '/bildirimler'
    case 'istek':
    case 'istekDusecek':
      return '/eslesmeler?sekme=incoming'
    default:
      return id ? `/dersler?ders=${id}` : '/dersler'
  }
}

/**
 * YALNIZCA __DEV__: 5 sn sonra, sunucudakiyle aynı veri biçiminde yerel bildirim üretir.
 * Uygulamayı kapatıp bildirime dokunarak soğuk açılış yönlendirmesi sunucusuz sınanır.
 * @param kayitId gerçek bir sohbet/ders kimliği (verilmezse liste ekranına gider).
 * @returns zamanlandı mı
 */
export async function yerelTestBildirimi(tur, kayitId = null) {
  if (!__DEV__ || !N || !TURLER[tur]) return false
  const { kanal, baslik } = TURLER[tur]
  try {
    await kanallariKur()
    await N.scheduleNotificationAsync({
      content: {
        title: baslik,
        body: 'Yerel deneme bildirimi — sunucudan gelmedi.',
        data: { tur, url: ornekRota(tur, kayitId), alici: aktifAlici },
        sound: 'default',
      },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: kanal },
    })
    return true
  } catch {
    return false
  }
}
