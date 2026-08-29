import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { disableAnalytics, enableAnalytics } from '../lib/analytics'
import { prefs } from '../lib/storage'
import { useAuth } from './AuthContext'

/*
  VERİ TOPLAMA İZNİ — web'deki lib/consent.js + state/ConsentContext.jsx'in mobil karşılığı.

  ADLANDIRMA BİLEREK DEĞİŞTİ: web'de bu katmanın adı "çerez tercihleri"ydi. Mobilde ÇEREZ
  YOKTUR — kullanıcıya çerez izni sormak, yapmadığımız bir şey için izin istemek, yani
  yanlış bilgi vermektir. İzin burada ne için isteniyorsa o adla anılıyor: analitik veri
  toplama. (Sunucu ucunun adı `cookie-consent` olarak kalıyor; o ad sunucuyla yapılmış bir
  sözleşme ve yeniden adlandırma iki projede birden yapılmalı — bkz. api.saveCookieConsent.)

  İKİ KATMANLI SAKLAMA, web'deki gerekçesiyle aynı:
    • Cihaz (AsyncStorage) — izin, giriş yapılmadan da sorulabilir; o anda kimlik yoktur,
      kaydedilecek tek yer cihazdır. Ayrıca her açılışta sunucuya sormadan okunur.
    • Sunucu (UserPreferences) — ispat yükümlülüğü veri sorumlusundadır; cihazdaki kayıt
      silinebilir, kanıt değeri yoktur. Ayrıca tercih cihazlar arasında taşınır.
  Giriş yapıldığında cihazdaki tercih sunucuya taşınır; sonrasında sunucu otoritedir.

  MOBİLE ÖZGÜ TEK YAPISAL FARK: AsyncStorage ASYNC. Web'de localStorage senkron okunduğu
  için ilk render'da cevap hazırdı. Burada `hazir` bayrağı var: false iken ne bildirim
  gösterilir ne de analitik açılır. "Henüz bilmiyorum" hâli KAPALI sayılır — tersi,
  cevabı okumadan ölçüm başlatmak olurdu.
*/

const IZIN_ANAHTARI = 'peerlearn.izin'

/**
 * Aydınlatma metninin sürümü. IZIN_KATEGORILERI DEĞİŞİRSE bu değer artırılmalıdır: eski
 * metne verilmiş onay, yeni işleme kapsamını meşrulaştırmaz ve izin yeniden sorulmalıdır.
 * Sürüm artınca kullanıcı bildirimi tekrar görür (bkz. gerekiyor).
 *
 * Metin ve sürüm bilerek AYNI DOSYADA: web'de ayrı dosyalara düşünce bir kez unutuldu
 * (yeni bir cihaz tercihi eklendi, metin ve sürüm güncellenmedi).
 */
export const IZIN_SURUMU = 'mobil-2026-08-29'

/** Web'in yürürlükteki sürümü (frontend/src/lib/consent.js → CONSENT_VERSION). */
const WEB_IZIN_SURUMU = '2026-08-24'

/**
 * Mobilde GEÇERLİ sayılan sürümler.
 *
 * Sunucudaki izin kaydı web ve mobil arasında ORTAKTIR; tek bir sürüm alanı taşır. İki
 * platform kendi metnini kendi sürümüyle yazsaydı, kullanıcı her platform değiştirdiğinde
 * aynı soruyu yeniden görürdü (ping-pong).
 *
 * Çözüm tek yönlü: web'in metni mobilinkini KAPSAR (çerezler + mobilde saklanan her şey),
 * bu yüzden web'de verilmiş onay mobilde geçerli sayılır. Tersi geçerli DEĞİLDİR — mobil
 * metni daha dardır, web kendi kapsamı için yeniden sorar. Kullanıcı mobilde başlarsa en
 * fazla iki kez sorulur ve durum orada durulur.
 *
 * ⚠️ Web'de CONSENT_VERSION artarsa WEB_IZIN_SURUMU da güncellenmeli (palet ve api yüzeyi
 * gibi, iki projede birden bakılan bir bağ). Güncellenmezse tek zararı, kullanıcının
 * bildirimi bir kez fazladan görmesidir.
 */
export const KAPSAYAN_SURUMLER = [IZIN_SURUMU, WEB_IZIN_SURUMU]

/**
 * İZNE TABİ CİHAZ SAKLAMASI — tek liste. ŞU AN BOŞ ve bu bilinçli.
 *
 * Web'de bu listede menü genişliği ve rehber tercihleri vardı; mobilde bu ekranların
 * hiçbiri yok, cihaza yazılan tek şey oturum anahtarı, HWID ve iznin kendisi — üçü de
 * zorunlu kategoride. Liste yine de duruyor, çünkü web'de tam olarak bu liste
 * unutulduğu için ısırmış bir hata var: menü tercihi kabuk yenilenirken eklendi, ne
 * kategorilere ne de temizliğe girdi; reddeden kullanıcının cihazına yine de yazılıyordu.
 *
 * YENİ BİR CİHAZ TERCİHİ EKLEYEN: anahtarı buraya ekle, IZIN_KATEGORILERI'ne karşılık
 * gelen bir kategori yaz ve IZIN_SURUMU'nü artır. Üçü birlikte yapılmazsa iki şeyden biri
 * olur — ya açıklanmamış bir saklama doğar, ya da anahtar burada olduğu için her açılışta
 * sessizce silinir (kullanıcıya hiç sorulmadığından `islevselIzinli` false kalır).
 */
export const ISLEVSEL_DEPOLAMA = []

/** İşlevsel izin yokken cihazda bunlardan hiçbiri kalmamalı. */
export function islevselDepolamayiTemizle() {
  for (const anahtar of ISLEVSEL_DEPOLAMA) {
    prefs.set(anahtar, null) // prefs kendi hatasını zaten yutuyor.
  }
}

/**
 * İzne tabi kategoriler ve kullanıcıya gösterilecek metin.
 *
 * "İşlevsel" kategorisi YOK: mobilde bu kategoriye giren tek bir saklama bile bulunmuyor
 * (bkz. ISLEVSEL_DEPOLAMA). Boş bir kategori için izin istemek, çerez izni istemekle aynı
 * kusuru taşır — olmayan bir işlemeyi varmış gibi göstermek. Sunucudaki `functional`
 * alanı yine de korunuyor (web onu kullanıyor); mobil onu okur ve DEĞİŞTİRMEDEN geçirir.
 */
export const IZIN_KATEGORILERI = [
  {
    anahtar: 'zorunlu',
    baslik: 'Zorunlu veriler',
    zorunlu: true,
    aciklama:
      'Girişin açık kalması ve hesap güvenliği için gerekir. Bunlar olmadan uygulama ' +
      'çalışmaz, bu yüzden kapatılamaz.',
    // Dürüstlük gereği HWID açıkça yazılıyor (web kararı): "sadece oturum bilgisi"
    // demek yanıltıcı olurdu. Reklam kimliği olmadığı da söyleniyor, çünkü "cihaz
    // kimliği" ifadesi mağaza diliyle karışıyor.
    maddeler: [
      'Oturum anahtarı — cihazın güvenli anahtar zincirinde saklanır (giriş yapmış kalman için)',
      'Cihaz kimliği (HWID) — banlanan hesabın yeni hesapla dönmesini engellemek için cihaz ' +
        'sinyallerinden üretilir; reklam kimliği DEĞİLDİR, pazarlamada kullanılmaz',
      'Bu izin tercihinin kendisi',
    ],
  },
  {
    anahtar: 'analitik',
    baslik: 'Analitik veri toplama',
    zorunlu: false,
    /*
      METİN, BUGÜNKÜ GERÇEĞİ SÖYLÜYOR. Mobil pakette ölçüm SDK'sı YOK (analytics.js
      yüzeyi korunuyor ama taşıyıcısı no-op) ve gizlilik metni §4/§6 bunu açıkça
      iddia ediyor. "Ekranları ölçüyoruz" demek o iki metni yalanlardı.

      Tercih yine de anlamlı: kayıt HESABA yazılıyor ve web sitesiyle ORTAK — web'de
      gerçek bir ölçüm var. Yani buradaki cevap orada bugün geçerli, burada ileride.
    */
    aciklama:
      'Mobil uygulama bugün hiçbir ölçüm yapmıyor. Bu tercih dersmate hesabına kaydedilir: ' +
      'web sitesinde şimdi, uygulamada ise ölçüm eklenirse geçerli olur.',
    maddeler: [
      'İzin verirsen: ekran görüntülemeleri ve kaba olay sayıları (ör. ders isteği gönderildi)',
      'Kimliğin, e-postan, mesajların, ders ve konu bilgin hiçbir durumda GÖNDERİLMEZ',
      'Kapatırsan ölçüm hiç başlamaz — sonradan da istediğin an değiştirebilirsin',
    ],
  },
]

/** Hiçbir şey seçilmemiş başlangıç durumu. */
export const BOS_IZIN = { analitik: false, islevsel: false, surum: null, guncellenmeUtc: null }

/** Bildirim gösterilmeli mi? Cevap hiç yoksa ya da metnin sürümü kapsam dışıysa evet. */
export function gerekiyor(izin) {
  return !izin || !KAPSAYAN_SURUMLER.includes(izin.surum)
}

async function izniOku() {
  try {
    const ham = await prefs.get(IZIN_ANAHTARI)
    if (!ham) return null

    const cozulen = JSON.parse(ham)
    if (typeof cozulen !== 'object' || cozulen === null) return null

    return {
      analitik: Boolean(cozulen.analitik),
      islevsel: Boolean(cozulen.islevsel),
      surum: cozulen.surum ?? null,
      guncellenmeUtc: cozulen.guncellenmeUtc ?? null,
    }
  } catch {
    // Bozuk kayıt izni VAR saymamalı: null dönmek bildirimi gösterir, yani analitik
    // varsayılan olarak KAPALI kalır.
    return null
  }
}

function izniYaz(izin) {
  // Beklenmiyor: bellekteki değer zaten güncel, yazma arka planda tamamlanır ve
  // prefs.set hatayı kendisi yutuyor (yazılamazsa bir dahaki açılışta yeniden sorulur).
  prefs.set(IZIN_ANAHTARI, JSON.stringify(izin))
}

const IzinContext = createContext(null)

export function IzinProvider({ children }) {
  const { session, isAuthenticated } = useAuth()
  const [izin, setIzin] = useState(null)
  const [hazir, setHazir] = useState(false)
  const [ayarlarAcik, setAyarlarAcik] = useState(false)

  // Cihazdaki cevap açılışta BİR KEZ okunur; sonrası bellekte.
  useEffect(() => {
    let takili = true
    izniOku().then((kayit) => {
      if (!takili) return
      setIzin(kayit)
      setHazir(true)
    })
    return () => {
      takili = false
    }
  }, [])

  /*
    Giriş yapıldığında sunucu kaydıyla uzlaş.

    `hazir` BEKLENMESİ ŞART (web'de olmayan mobil kuralı): cihaz okuması async, sunucu
    yanıtı ondan önce dönebilir. Beklemeseydik sunucudan gelen değer yazılır, hemen
    ardından geç kalan cihaz okuması onu ezerdi.
  */
  useEffect(() => {
    if (!hazir || !isAuthenticated) return

    let iptal = false

    api
      .myPreferences()
      .then((tercihler) => {
        if (iptal) return

        /*
          Web burada `!== 'NotAsked'` diye bakıyordu. Mobilde alanın HİÇ GELMEMESİ de
          mümkün (önizleme modu boş nesne döndürür, eski sunucu alanı taşımayabilir) ve
          undefined !== 'NotAsked' doğru çıkıp "cevaplanmış" yanılgısı üretirdi.
        */
        const cevaplanmis =
          (tercihler?.analyticsConsent && tercihler.analyticsConsent !== 'NotAsked') ||
          (tercihler?.functionalConsent && tercihler.functionalConsent !== 'NotAsked')

        if (cevaplanmis && KAPSAYAN_SURUMLER.includes(tercihler.consentVersion)) {
          // Sunucu geçerli bir izin taşıyor: otorite odur, cihaza da yazılır.
          const sunucudan = {
            analitik: tercihler.analyticsConsent === 'Granted',
            islevsel: tercihler.functionalConsent === 'Granted',
            surum: tercihler.consentVersion,
            guncellenmeUtc: tercihler.consentUpdatedAtUtc ?? null,
          }
          setIzin(sunucudan)
          izniYaz(sunucudan)
          return
        }

        // Sunucuda geçerli kayıt yok ama cihazda var: girişten önce verilmiş izni hesaba
        // TAŞI. Aksi halde kullanıcı giriş yapar yapmaz aynı soruyu yeniden görürdü.
        // Cihazdan yeniden okunuyor (web de öyle yapıyor): state üzerinden bakmak bu
        // efekti izin değerine bağımlı kılar ve her kaydetmede sunucuya koşardı.
        izniOku().then((yerel) => {
          if (iptal || !yerel || gerekiyor(yerel)) return
          // Sürüm olarak IZIN_SURUMU değil KAYITLI sürüm gönderiliyor: kullanıcı hangi
          // metne onay verdiyse sunucuya yazılan da o olmalı (kayıt web'de verilmiş ve
          // mobilde kapsayıcı sayılmış olabilir).
          api.saveCookieConsent(yerel.analitik, yerel.islevsel, yerel.surum).catch(() => {
            /* Taşıma başarısızsa cihazdaki tercih geçerli kalır; bir dahaki girişte yeniden denenir. */
          })
        })
      })
      .catch(() => {
        // Tercihler okunamazsa cihazdaki değerle devam edilir — akış bozulmasın.
      })

    return () => {
      iptal = true
    }
  }, [hazir, isAuthenticated, session?.userId])

  const analitikIzinli = Boolean(izin?.analitik)
  const islevselIzinli = Boolean(izin?.islevsel)

  /*
    ANALİTİK KAPISI — web'deki AnalyticsGate'in karşılığı, ayrı bileşen olarak DEĞİL.

    Web'de ayrı bir bileşendi çünkü aynı yerde rota değişimlerini de dinliyordu
    (useLocation → trackPageView). Mobilde ekran görüntüleme bildirimi rotaya bağlanmadığı
    için geriye tek bir efekt kalıyordu; boş bir bileşen kabuğu, kararı bir dosya daha
    uzağa taşımaktan başka bir şey yapmazdı. Karar yine TEK yerde.

    İzin yoksa HER değişimde kapatma uygulanır, yalnızca "izin geri çekildiği an" değil.
    Web'de bunun gerekçesi bırakılmış çerezlerdi; mobilde gerekçe daha da güçlü: ölçüm
    SDK'ları toplama bayrağını cihaza kalıcı yazar ve uygulama yeniden açıldığında onu
    geri yükler. Yalnızca geçişi dinleseydik, izni reddedip uygulamayı kapatan kullanıcıda
    açılışta hiç geçiş yaşanmaz ve SDK kendi eski "açık" bayrağıyla başlardı.

    Kapatma idempotenttir; `hazir` beklenmez çünkü kapalı zaten doğru başlangıç.
  */
  useEffect(() => {
    if (analitikIzinli) enableAnalytics()
    else disableAnalytics()
  }, [analitikIzinli])

  /*
    İŞLEVSEL SAKLAMA KAPISI. Saklamayı durdurmak yetmez, saklanmış olanı da kaldırmak
    gerekir: rıza alıp uygulamamak, hiç sormamaktan daha kötü bir konumdur. Bugün liste
    boş (bkz. ISLEVSEL_DEPOLAMA) ama kural listeyle birlikte büyür.
  */
  useEffect(() => {
    if (hazir && !islevselIzinli) islevselDepolamayiTemizle()
  }, [hazir, islevselIzinli])

  const kaydet = useCallback(
    async ({ analitik, islevsel }) => {
      const sonraki = {
        analitik: Boolean(analitik),
        /*
          `islevsel` VERİLMEZSE mevcut değer korunur, false'a düşürülmez.

          Mobil ekranı bu kategoriyi sormuyor (mobilde karşılığı olan bir saklama yok).
          Varsayılanı false yapsaydık, web'de işlevsel izni VERMİŞ bir kullanıcı mobilde
          "analitiğe hayır" dediği anda web tercihini de sessizce iptal etmiş olurdu —
          kayıt ortak. Kullanıcının söylemediği bir şey kaydedilmez.
        */
        islevsel: islevsel === undefined ? Boolean(izin?.islevsel) : Boolean(islevsel),
        surum: IZIN_SURUMU,
        guncellenmeUtc: new Date().toISOString(),
      }

      // Önce cihaz: kullanıcı "Kaydet"e bastığı anda arayüz kararlı olmalı, ağ beklenmemeli.
      setIzin(sonraki)
      izniYaz(sonraki)
      setAyarlarAcik(false)

      if (isAuthenticated) {
        try {
          await api.saveCookieConsent(sonraki.analitik, sonraki.islevsel, IZIN_SURUMU)
        } catch {
          // Sunucuya yazılamadıysa cihazdaki tercih yine geçerli; bir sonraki girişte taşınır.
        }
      }
    },
    [isAuthenticated, izin?.islevsel],
  )

  const ayarlariAc = useCallback(() => setAyarlarAcik(true), [])
  const ayarlariKapat = useCallback(() => setAyarlarAcik(false), [])

  const value = useMemo(
    () => ({
      izin,
      /** Cihazdaki cevap okundu mu? Okunmadan hiçbir izin kararı verilmez. */
      hazir,
      /** Bildirim gösterilecek mi? `hazir` olmadan asla true — açılışta yanıp sönmesin. */
      mutlakaSor: hazir && gerekiyor(izin),
      /** Analitik yalnızca bu true iken toplanır (bkz. lib/analytics.js). */
      analitikIzinli,
      /*
        Bugün mobilde hiçbir şeyi kapılamıyor; sunucudan gelen değeri taşımak ve ileride
        eklenecek cihaz tercihleri için duruyor. Web'de bu değer bir süre TOPLANIP hiç
        KULLANILMAMIŞTI: kullanıcı reddetse de davranış aynı kalıyordu. Buraya bir tercih
        eklenirken bu bayrağa bakılması ŞART.
      */
      islevselIzinli,
      ayarlarAcik,
      ayarlariAc,
      ayarlariKapat,
      kaydet,
    }),
    [izin, hazir, analitikIzinli, islevselIzinli, ayarlarAcik, ayarlariAc, ayarlariKapat, kaydet],
  )

  return <IzinContext.Provider value={value}>{children}</IzinContext.Provider>
}

export function useIzin() {
  const context = useContext(IzinContext)
  if (!context) throw new Error('useIzin, IzinProvider içinde kullanılmalı.')
  return context
}
