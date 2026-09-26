import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, Mask, Rect } from 'react-native-svg'
import { api } from '../lib/api'
import { brand, ink, slate } from '../lib/theme'
import { Button, Card } from './ui'
import { OGELER } from './Cekmece'
import { AyarlarIkonu } from './Ikonlar'
import {
  TUR_ADIMLARI,
  TUR_ADIM_SAYISI,
  turCipalariniDinle,
  turCipalariniTazele,
  turCipasiOku,
  turGecildiIsaretle,
  turGecildiMi,
  turYenidenBaslatmayiDinle,
} from '../lib/tur'
import { useIzin } from '../state/IzinContext'
// Tur, izin sayfası kapanırken üstüne binmesin (süre animasyona bağlı, orada tanımlı).
import { IZIN_KAPANMA_SURESI } from './IzinSayfasi'

/**
 * İnteraktif ürün rehberi — web'deki ProductTour.jsx'in mobil UYARLAMASI.
 *
 * NEDEN HAZIR KÜTÜPHANE DEĞİL (web kararı, mobilde de geçerli): dokuz adımlık bir spot
 * ışığı için yeni bir bağımlılık, bakım yükünü kazanılan koddan daha çok artırıyordu.
 * Karşılığında Türkçe metin ve 44px dokunma kuralı bizde.
 *
 * İLERLEME SUNUCUDA (api.myPreferences / api.saveOnboarding), cihazda değil: rehber
 * yalnızca giriş yapmış kullanıcıya gösteriliyor, dolayısıyla hesaba yazmak cihazlar
 * arası taşınır. lastStep / completed / suppressed sözleşmesi web ile birebir aynı,
 * ama ADIM DİZİLERİ farklı (mobil 9, web 8, sıra farklı): aynı lastStep iki platformda
 * başka adımı gösterir — bilinen, düşük etkili sınır (bkz. tur.js başlığı).
 *
 * ─── WEB MEKANİZMASININ HİÇBİRİ TAŞINMADI ────────────────────────────────────────
 *   querySelector + getBoundingClientRect → ölçüm defteri (src/lib/tur.js): çıpalar
 *     kendini measureInWindow ile kaydeder.
 *   scrollIntoView + scroll/resize dinleyicileri → YOK. Tur kaydırma YAPMAZ: 'menu'
 *     çıpası sabit başlıkta; 'gonderi-yaz' Topluluk'un liste başlığında ve liste
 *     kaydırılmışsa ekran dışında kalır — o zaman delik düşer, kart ortada çıkar
 *     (bkz. gorunurDelik). Ölçü tazeleme adım başına bir kez (turCipalariniTazele).
 *   box-shadow "delik" → react-native-svg maskesi. Dört kenar View'ı da olurdu ama
 *     ondalıklı ölçülerde komşu View'lar arasında saç teli kadar boşluk kalıyor;
 *     maske tek parça çizdiği için o dikiş hiç oluşmuyor.
 *   Escape tuşu → Android geri tuşu (BackHandler) + karttaki açık "Rehberi geç".
 *   CustomEvent → tur.js'teki dinleyici kümesi.
 *   sessionStorage → tur.js'teki bellek işareti (uygulama ömrü = oturum ömrü).
 *
 * RIZA KAPISI GEREKMİYOR ama SIRA GEREKİYOR. Web'de adım ilerlemesi fonksiyonel rızaya
 * tabiydi çünkü tarayıcıda saklanan bir kolaylık verisiydi. Mobilde ilerleme CİHAZA
 * DEĞİL kullanıcının kendi hesabına yazılıyor (api.saveOnboarding) — hizmetin kendisi,
 * ölçüm değil — ve cihazda kalan tek iz belleğe yazılan "geçildi" işareti. Yani
 * IZIN_KATEGORILERI'nin kapsadığı bir işleme yok, `kaydet` bir kapı istemiyor.
 *
 * Buna karşılık tur, izin sayfası ekrandayken AÇILMAZ (bkz. mutlakaSor): ikisi de kök
 * layout'a takılı iki tam ekran katman ve ilk açılışta üst üste biniyorlardı — izin
 * sayfası (zIndex 9999) turun (zIndex 60) üstünü örtüyor, tur arkada görünmeden
 * başlıyor ve ışık tuttuğu öğelere dokunulamıyordu.
 *
 * BİLEŞEN HİÇBİR EKRANI DEĞİŞTİRMEZ: kök layout'a tek satırla takılır, ekranlar
 * yalnızca isterlerse çıpa kaydeder. Çıpası olmayan adım ortada kart olarak çıkar.
 */

/*
  Turun kendiliğinden açılacağı ekranlar.

  Web'de koşul "giriş sayfası"ydı ve gerekçesi şuydu: rehber, kullanıcının gitmek
  istediği yeri elinden alamaz — her ekranda başlatıp kullanıcıyı çıpaların olduğu
  sayfaya sürüklemek, turu "geç"en birinin her tıklamasında turu geri getiriyordu.

  Mobilde aynı kural ekran ADIYLA uygulanıyor: tur, Topluluk (kök) ya da Keşfet
  görünürken açılır; başka bir ekrandaysa SESSİZCE BEKLER. Yönlendirme yapmıyoruz —
  kullanıcıyı bulunduğu ekrandan koparmak, web'de reddedilen davranışın aynısı.

  ⚠️ ADRESLER DÜZLEŞTİRMEDEN ETKİLENMEDİ: (tabs) bir grup klasörüydü ve URL
  üretmiyordu, yani '/' ve '/kesfet' aynen geçerli.
*/
const ACILIS_EKRANLARI = ['/', '/kesfet']

/** Çıpanın etrafında bırakılan nefes payı (web'deki padding=8 ile aynı). */
const BOSLUK = 8

/*
  ÇIPA EKRANI — adımın `cipaEkrani` alanı varsa çıpa YALNIZCA o adresteyken okunur
  (tur.js'teki kural; gerekçe orada: monte kalan alttaki ekranın ölçüsü öndekine yanlış
  delik açardı). Alan yoksa ada bakılır; bugün her çıpalı adımda alan var.
*/
function cipaEkrandaMi(adim, pathname) {
  if (!adim?.cipa) return false
  const ekran = adim.cipaEkrani
  if (!ekran) return true
  return Array.isArray(ekran) ? ekran.includes(pathname) : ekran === pathname
}

/*
  YER ÇİPİ — çıpasız adımda "bunu nerede bulacağım"ın görsel cevabı: menüdeki satırın
  küçük bir kopyası. Kaynak Cekmece.jsx → OGELER (menü yolu) ya da aşağıdaki EK_YERLER;
  bulunamazsa çip çizilmez (adım metni zaten yeri söylüyor) ve geliştirmede uyarı basılır.
*/
const EK_YERLER = {
  ayarlar: { onEk: 'Profilim’de', etiket: 'Ayarlar', tur: 'ayarlar' },
}

function yerBul(yer) {
  if (!yer) return null
  const oge = OGELER.find((o) => o.yol === yer)
  if (oge) return { onEk: 'Menüde', etiket: oge.etiket, Ikon: oge.Ikon, tur: 'menu' }
  return EK_YERLER[yer] ?? null
}

/*
  Çip BASILABİLİR DEĞİL ve DEKORATİF: ekran okuyucudan gizli (yer adı gövde cümlesinde
  zaten geçiyor) ve 44 kuralı dışında — dokunulabilir görünmemeli, o yüzden gölgesiz,
  basınç rengi yok.

  • Menü çipi çekmecenin AKTİF satırını taklit ediyor: ink zemin + brand-300/10 kaplama,
    kalın (2.4) brand-300 ikon ve kalın etiket. brand-300'ün ink üstünde 8.19:1 olduğu
    web'de ölçülmüş (Cekmece.jsx başlığı). Kullanıcı menüyü açınca AYNI görüntüyü arıyor.
  • Ayarlar çipi Profilim başlığındaki dişliyi gösteriyor (AyarlarDugmesi, app/profil/
    index.jsx): açık zeminde slate-700 dişli, yanında düğmenin erişilebilir adı "Ayarlar".
*/
function YerCipi({ yer }) {
  const bilgi = yerBul(yer)
  const bulunamadi = Boolean(yer) && !bilgi

  useEffect(() => {
    if (bulunamadi && __DEV__) {
      console.warn(`[UrunTuru] Rehber yeri bulunamadı: "${yer}" — OGELER ya da EK_YERLER'e bak.`)
    }
  }, [yer, bulunamadi])

  if (!bilgi) return null

  return (
    <View
      className="mt-3 flex-row items-center gap-2"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text className="text-[12px] leading-[16px] text-slate-500">{bilgi.onEk}</Text>

      {bilgi.tur === 'menu' ? (
        <View className="overflow-hidden rounded-xl" style={{ backgroundColor: ink }}>
          <View className="flex-row items-center gap-2 bg-brand-300/10 px-3 py-2">
            <bilgi.Ikon renk={brand[300]} boy={20} kalinlik={2.4} />
            <Text numberOfLines={1} className="text-sm font-bold text-brand-300">
              {bilgi.etiket}
            </Text>
          </View>
        </View>
      ) : (
        <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3">
          <View className="h-[28px] w-[28px] items-center justify-center rounded-full bg-slate-100">
            <AyarlarIkonu renk={slate[700]} boy={18} />
          </View>
          <Text numberOfLines={1} className="text-sm font-semibold text-slate-700">
            {bilgi.etiket}
          </Text>
        </View>
      )}
    </View>
  )
}

/*
  TUR AÇIK MI — bildirim aydınlatma sorusu (state/BildirimSaglayici) tur ekrandayken
  kendiliğinden AÇILMAZ. İkisi de kök layout'ta tam ekran katman: soru bir RN Modal ve
  turun üstüne binseydi kullanıcı ışık tutulan öğeyi göremez, turun altında kalsaydı hiç
  görünmezdi (izin sayfasıyla yaşanan çakışmanın aynısı, bkz. mutlakaSor).

  Modül düzeyinde, bağlam değil: sağlayıcı turun ATASI (tur onun çocuğu olarak çiziliyor),
  yani turun durumunu bağlamdan okuyamaz. useSyncExternalStore ile dinleniyor.
*/
let turAcik = false
const turAcikDinleyicileri = new Set()

function turAcikYaz(deger) {
  if (turAcik === deger) return
  turAcik = deger
  for (const dinleyici of [...turAcikDinleyicileri]) dinleyici()
}

/** Ürün turu şu an açık mı (izin sayfasının arkasında bekliyor olsa da). */
export function urunTuruAcikMi() {
  return turAcik
}

/** @returns vazgeç fonksiyonu */
export function urunTuruDinle(dinleyici) {
  turAcikDinleyicileri.add(dinleyici)
  return () => turAcikDinleyicileri.delete(dinleyici)
}

export function UrunTuru() {
  const { mutlakaSor } = useIzin()
  const pathname = usePathname()
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const [durum, setDurum] = useState({ yukleniyor: true, aktif: false, adim: 0 })
  const [cipa, setCipa] = useState(null)

  // Bildirim sorusu için aktiflik bayrağı (yukarıda). Sökülünce (çıkış) kapalı.
  useEffect(() => {
    turAcikYaz(durum.aktif)
  }, [durum.aktif])
  useEffect(() => () => turAcikYaz(false), [])

  // Sunucu "bu kullanıcıya gösterilebilir" dedi mi? Ekran koşulundan AYRI tutuluyor:
  // biri veriden, diğeri o anki gezinmeden geliyor.
  const gosterilebilir = useRef(false)
  // Kendiliğinden açılma uygulama ömrü boyunca BİR KEZ: kullanıcı ekranlar arasında
  // gezindikçe tur her ana ekran dönüşünde yeniden açılamaz.
  const kendiliginenAcildi = useRef(false)
  // Bitiş geri alınamaz bir yazma (saveOnboarding) tetikler; state bir sonraki
  // render'a kadar eski değeri gösterdiği için kilit ref'te.
  const bitisKilidi = useRef(false)

  // Açılışta sunucudaki duruma bak. Tamamlamış ya da "bir daha gösterme" demişse
  // hiç başlama.
  useEffect(() => {
    if (turGecildiMi()) {
      setDurum({ yukleniyor: false, aktif: false, adim: 0 })
      return
    }

    let iptal = false

    api
      .myPreferences()
      .then((prefs) => {
        if (iptal) return
        gosterilebilir.current = !prefs.onboardingCompleted && !prefs.onboardingSuppressed
        setDurum({
          yukleniyor: false,
          aktif: false,
          // Yarıda bırakmışsa kaldığı yerden devam.
          adim: Math.min(prefs.onboardingLastStep ?? 0, TUR_ADIM_SAYISI - 1),
        })
      })
      .catch(() => {
        // Tercihler okunamazsa tur BAŞLATILMAZ: yanlışlıkla her açılışta tur
        // göstermek, hiç göstermemekten daha rahatsız edici.
        if (!iptal) setDurum({ yukleniyor: false, aktif: false, adim: 0 })
      })

    return () => {
      iptal = true
    }
    // Yalnızca ilk montajda; ekran değiştikçe tercihler yeniden okunmaz.
  }, [])

  // İzin sayfası bu açılışta gerçekten göründü mü? Göründüyse tur, sayfanın kapanma
  // animasyonu bitene kadar bekler; hiç görünmediyse (izin çoktan verilmiş) beklemez.
  const izinBekletti = useRef(false)
  useEffect(() => {
    if (mutlakaSor) izinBekletti.current = true
  }, [mutlakaSor])

  /*
    Veri hazır + doğru ekran + izin sorusu kapanmış = aç. Koşullar ayrı efektlerde
    birleşiyor çünkü hangisinin önce geleceği belli değil: tercihler ağdan, ekran adı
    gezinmeden, izin cevabı cihazdan (AsyncStorage, async) gelir.

    `mutlakaSor` GEÇİCİ olarak da true kalabilir: kullanıcı izin sayfasından "Gizlilik
    metnini oku" ile ayrıldığında sayfa gizlenir ama cevap hâlâ verilmemiştir. Koşul
    sayfanın GÖRÜNÜRLÜĞÜNE değil cevabın verilmiş olmasına bakıyor — yoksa tur, metin
    okunurken arkadan açılırdı.
  */
  useEffect(() => {
    if (durum.yukleniyor || durum.aktif) return
    if (mutlakaSor) return
    if (!gosterilebilir.current || kendiliginenAcildi.current) return
    if (!ACILIS_EKRANLARI.includes(pathname)) return

    // Kilit ZAMANLAYICIDAN ÖNCE: efekt yeniden koşarsa ikinci bir zamanlayıcı kurulmasın.
    kendiliginenAcildi.current = true
    let acildi = false

    const zamanlayici = setTimeout(
      () => {
        acildi = true
        setDurum((s) => ({ ...s, aktif: true }))
      },
      izinBekletti.current ? IZIN_KAPANMA_SURESI : 0,
    )

    return () => {
      clearTimeout(zamanlayici)
      // Zamanlayıcı çalışmadan temizlendiyse kilit geri veriliyor; aksi hâlde tur bu
      // açılışta bir daha hiç açılmazdı.
      if (!acildi) kendiliginenAcildi.current = false
    }
  }, [pathname, durum.yukleniyor, durum.aktif, mutlakaSor])

  const adim = TUR_ADIMLARI[durum.adim]
  // Çıpa bu ekranda okunabilir mi (tur.js → cipaEkrani). Adres değişince efekt yeniden
  // koşar: tur açıkken bildirime dokunulup başka ekrana geçilirse delik kalkar.
  const cipaOkunur = cipaEkrandaMi(adim, pathname)

  // Adımın çıpasını defterden izle. Çıpa sonradan kaydolabilir (ekran henüz
  // yerleşmemiş olabilir), o yüzden tek seferlik okuma yetmez.
  useEffect(() => {
    if (!durum.aktif || !adim || !cipaOkunur) {
      setCipa(null)
      return
    }

    const oku = () => setCipa(turCipasiOku(adim.cipa))
    oku()
    turCipalariniTazele()
    /* İkinci ölçüm geçiş BİTTİKTEN sonra: "Rehberi tekrar izle" Ayarlar'dan Topluluk'a
       geçerken turu hemen başlatıyor ve ilk ölçüm kayan ekrandan alınabilir. Ölçü
       değişmediyse defter kimseyi uyandırmıyor, yani fazladan çizim yok. */
    const gecisSonrasi = setTimeout(turCipalariniTazele, IZIN_KAPANMA_SURESI)
    const vazgec = turCipalariniDinle(oku)
    return () => {
      clearTimeout(gecisSonrasi)
      vazgec()
    }
  }, [durum.aktif, adim, cipaOkunur])

  /*
    ADIM DUYURUSU — ekran okuyucu yeni adımın başlığını okur. Duyuru olmadan odak "Devam"
    düğmesinde kalıyordu ve kart değiştiği hâlde yeni adım hiç okunmuyordu. Açılışta da
    duyuruluyor (ilk adım da bir "değişim"). İzin sayfası öndeyken tur çizilmediği için
    orada duyurulmaz; sayfa kapanınca aynı adım duyurulur.
  */
  const cizili = durum.aktif && !durum.yukleniyor && !mutlakaSor
  useEffect(() => {
    if (cizili && adim?.title) AccessibilityInfo.announceForAccessibility(adim.title)
  }, [cizili, adim])

  const kaydet = useCallback((adimNo, tamamlandi, susturuldu) => {
    // Ateşle-unut: turun akışı ağ yanıtını beklemez. Kaydedilemezse en fazla tur bir
    // kez daha görünür — akışı bloklamaktan iyidir.
    api.saveOnboarding(adimNo, tamamlandi, susturuldu).catch(() => {})
  }, [])

  const bitir = useCallback(
    ({ susturuldu = false, tamamlandi = false } = {}) => {
      if (bitisKilidi.current) return
      bitisKilidi.current = true

      setDurum((s) => ({ ...s, aktif: false }))
      kaydet(durum.adim, tamamlandi, susturuldu)

      // Tamamlanmadan kapatıldıysa uygulama açık kaldığı sürece geri gelmesin.
      if (!tamamlandi && !susturuldu) turGecildiIsaretle(true)
    },
    [durum.adim, kaydet],
  )

  const ileri = useCallback(() => {
    if (durum.adim >= TUR_ADIM_SAYISI - 1) {
      bitir({ tamamlandi: true })
      return
    }
    const adimNo = durum.adim + 1
    setDurum((s) => ({ ...s, adim: adimNo }))
    kaydet(adimNo, false, false)
  }, [durum.adim, bitir, kaydet])

  const geri = useCallback(() => {
    setDurum((s) => ({ ...s, adim: Math.max(0, s.adim - 1) }))
  }, [])

  // Android geri tuşu = "Rehberi geç" (web'deki Escape'in karşılığı). true dönmek
  // olayı yutar: geri tuşu turu kapatırken ekranı da geri almasın.
  useEffect(() => {
    // İzin sayfası öndeyse geri tuşu ONUN olayıdır (o da yutuyor); tur görünmezken
    // sessizce "Rehberi geç" saymak, kullanıcının görmediği turu bitirmek olurdu.
    if (!durum.aktif || mutlakaSor) return
    const abone = BackHandler.addEventListener('hardwareBackPress', () => {
      bitir()
      return true
    })
    return () => abone.remove()
  }, [durum.aktif, mutlakaSor, bitir])

  // "Rehberi tekrar izle" sinyali. Elle başlatılan rehber oturum susturmasını da
  // kaldırır: kullanıcı açıkça yeniden istedi.
  useEffect(
    () =>
      turYenidenBaslatmayiDinle(() => {
        turGecildiIsaretle(false)
        bitisKilidi.current = false
        // Elle açıldı; ayrıca kendiliğinden bir kez daha açılmasına gerek yok.
        kendiliginenAcildi.current = true
        setDurum({ yukleniyor: false, aktif: true, adim: 0 })
        kaydet(0, false, false)
      }),
    [kaydet],
  )

  /*
    İzin sayfası öndeyken tur ÇİZİLMEZ. Yalnızca açılış koşulunu kısıtlamak yetmiyor:
    IZIN_SURUMU artarsa `mutlakaSor` tur AÇIKKEN de true olabilir ve iki katman yine
    üst üste binerdi. Tur durumu korunuyor — cevap verilince kaldığı yerden görünür.
  */
  if (durum.yukleniyor || !durum.aktif || !adim || mutlakaSor) return null

  const sonAdim = durum.adim === TUR_ADIM_SAYISI - 1

  /*
    Görünür delik: merkezi ekranın dikey sınırları [0, height] DIŞINDA kalan çıpa yok
    sayılır. 'gonderi-yaz' liste başlığında; tur açılmadan liste kaydırıldıysa ölçü
    negatif y ile gelir. Koşul olmasaydı ekranda delik görünmez ama yerleşim onu "üst
    yarıda" sayar ve kartı boş bir yere doğru iterdi.
  */
  const gorunurDelik =
    cipa && cipa.y + cipa.height / 2 >= 0 && cipa.y + cipa.height / 2 <= height ? cipa : null

  const delik = gorunurDelik
    ? {
        x: gorunurDelik.x - BOSLUK,
        y: gorunurDelik.y - BOSLUK,
        w: gorunurDelik.width + BOSLUK * 2,
        h: gorunurDelik.height + BOSLUK * 2,
      }
    : null

  /*
    Kart yerleşimi: çıpa alt yarıdaysa kart üstte, üst yarıdaysa altta; çıpa yoksa
    ortada (web'deki yedek davranış).

    Web'de kartın YÜKSEKLİĞİ ölçülüp "altına sığar mı" hesaplanıyordu. Burada gerek
    yok: kart tam genişlik ve tek sütun, hizalamayı flexbox yapıyor — metin uzayınca
    kimsenin bir sayıyı güncellemesi gerekmiyor.

    KART DELİĞİN ÜSTÜNE BİNMEZ (2026-09-26): yerleşim yalnızca hizalamaydı ve kart
    uzunsa deliği örtüyordu — 320×568'de Topluluk adımının kartı (yer çipiyle) yazma
    kutusunun üstüne çıktı (ölçüldü). Kartın durduğu bölge artık deliğin karşı tarafıyla
    sınırlı; sığmazsa kart küçülür ve metin kısmı kendi içinde kayar (aşağıda). Sayaç ve
    düğmeler her zaman görünür kalır.
  */
  const yerlesim = !delik ? 'center' : delik.y + delik.h / 2 > height / 2 ? 'flex-start' : 'flex-end'
  const ustBosluk = Math.max(
    insets.top + 12,
    yerlesim === 'flex-end' ? delik.y + delik.h + 12 : 0,
  )
  const altBosluk = Math.max(
    insets.bottom + 12,
    yerlesim === 'flex-start' ? height - delik.y + 12 : 0,
  )

  return (
    <View
      // zIndex + elevation birlikte: iOS'ta kardeş sırası yeter, Android'de yükseltilmiş
      // (elevation'lı) gezinme yüzeyleri sıradan kardeşin üstüne çıkabiliyor.
      style={[StyleSheet.absoluteFill, { zIndex: 60, elevation: 60 }]}
      accessibilityViewIsModal
      // Web'deki aria-label'ın karşılığı. `accessible` VERİLMEDİ: kök tek bir durak olursa
      // içindeki düğmelere ekran okuyucuyla ulaşılamazdı; ad yalnızca kapsayıcıyı adlandırır.
      accessibilityLabel="Ürün rehberi"
    >
      {/*
        DOKUNMAYI YUTAN KATMAN. RN'de arkaplansız bir View dokunmayı geçirir; tur
        açıkken altındaki ekrana basılabilmesi, kullanıcının turu görmeden uygulamayı
        kullanmaya başlamasına yol açardı.

        Karartmaya dokunmak KAPATMAZ (ui.jsx'teki alt sayfanın aksine): kullanıcı
        büyük ihtimalle ışık tutulan öğeye basmaya çalışıyor ve yanlışlıkla turdan
        düşmemeli. Çıkış yolları açık: "Rehberi geç", "Bir daha gösterme", geri tuşu.
      */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} accessible={false} />

      {delik ? (
        <Svg
          width={width}
          height={height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            {/* Maskede beyaz = çizilir, siyah = delinir. */}
            <Mask id="turDeligi">
              <Rect x={0} y={0} width={width} height={height} fill="#FFFFFF" />
              <Rect x={delik.x} y={delik.y} width={delik.w} height={delik.h} rx={12} fill="#000000" />
            </Mask>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={ink}
            fillOpacity={0.6}
            mask="url(#turDeligi)"
          />
          {/* Deliğin kenarı: marka halkası — web'deki ring-brand-400. */}
          <Rect
            x={delik.x}
            y={delik.y}
            width={delik.w}
            height={delik.h}
            rx={12}
            fill="none"
            stroke={brand[400]}
            strokeWidth={2}
          />
        </Svg>
      ) : (
        // Renk DEĞERİ paletten; rgba'yı elle yazmak yerine opacity kullanılıyor.
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: ink, opacity: 0.6 }]}
        />
      )}

      <View
        className="absolute inset-0 px-4"
        // box-none: kart dışındaki boşluk dokunmayı alttaki yutucu katmana bırakır.
        pointerEvents="box-none"
        style={{
          justifyContent: yerlesim,
          paddingTop: ustBosluk,
          paddingBottom: altBosluk,
        }}
      >
        {/* shrink: bölge kartın doğal boyundan kısaysa kart küçülür (bkz. yerleşim). */}
        <Card className="shrink">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="shrink-0 text-xs font-medium text-brand-600">
              Adım {durum.adim + 1} / {TUR_ADIM_SAYISI}
            </Text>

            {/* İlerleme çubukları görsel tekrar: sayıyı zaten yazdık, ekran okuyucuya
                ikinci kez okutmuyoruz.

                ESNEK (2026-09-26): dokuz sabit çubuk (w-6 = cihazda 21dp, gap 3.5dp →
                ~217dp) 320dp telefonda sayaç metniyle birlikte kartın iç genişliğini
                aşıyordu. Çubuklar kalan yeri paylaşıyor, en fazla 24px; sayaç küçülmüyor
                (shrink-0). Web aynı düzeltmeyi aldı (max-w-6 flex-1). */}
            <View
              className="min-w-0 flex-1 flex-row justify-end gap-1"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {TUR_ADIMLARI.map((a, i) => (
                <View
                  key={a.id}
                  className={`h-1.5 max-w-[24px] flex-1 rounded-full ${i <= durum.adim ? 'bg-brand-500' : 'bg-slate-200'}`}
                />
              ))}
            </View>
          </View>

          {/* Metin kısmı KAYABİLİR: kart deliğin karşısındaki bölgeye sığmadığında (küçük
              ekran, büyük yazı) küçülen yalnızca bu kısım. flexGrow 0: sığdığında kart
              doğal boyunda kalır, boş alan doğmaz. Adım değişince key ile tepeden açılır. */}
          <ScrollView
            key={adim.id}
            style={{ flexGrow: 0, flexShrink: 1 }}
            bounces={false}
          >
            <Text accessibilityRole="header" className="mt-2 text-lg font-semibold text-slate-900">
              {adim.title}
            </Text>

            {/* Tek cümlelik özet biraz daha koyu (slate-700): maddelerden önce okunması
                gereken satır o. Ayrıntı maddelerde ve bir ton açık — hiyerarşi puntoyla
                değil renkle kuruluyor (web kararı). */}
            <Text className="mt-1.5 text-sm leading-relaxed text-slate-700">{adim.body}</Text>

            {/* Yer çipi gövde cümlesiyle maddeler arasında: önce "ne", sonra "nerede"
                (görsel), sonra ayrıntı. Çıpalı adımlarda da duruyor (Topluluk): delik
                ekran dışındaysa çip tek yön gösteren şey olur. */}
            <YerCipi yer={adim.yer} />

            {adim.points?.length > 0 && (
              <View className="mt-3 gap-1.5">
                {adim.points.map((madde) => (
                  /* Madde imi sabit boyutlu bir nokta ve üstten hizalı: iki satıra taşan
                     maddede imin metnin ortasına kaymaması için (web kararı). */
                  <View key={madde} className="flex-row items-start gap-2">
                    <View className="mt-[7px] h-1 w-1 rounded-full bg-brand-400" />
                    <Text className="flex-1 text-sm leading-relaxed text-slate-600">{madde}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View className="mt-4 flex-row items-center justify-between gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={() => bitir()}
              className="min-h-[44px] justify-center"
            >
              <Text className="text-sm text-slate-500 underline">Rehberi geç</Text>
            </Pressable>

            <View className="flex-row gap-2">
              {durum.adim > 0 && (
                <Button variant="secondary" onPress={geri}>
                  Geri
                </Button>
              )}
              <Button onPress={ileri}>{sonAdim ? 'Bitir' : 'Devam'}</Button>
            </View>
          </View>

          {/* "Bir daha gösterme", "geç"ten AYRI: geçen kullanıcıya bir dahaki girişte
              tekrar önerilebilir, ama açıkça istemeyene hiç sorulmamalı. Sönük ama okunur:
              slate-400 2.56:1'di, slate-500 4.76:1; ikincilliği punto ve alt çizgi taşıyor. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => bitir({ susturuldu: true })}
            className="mt-1 min-h-[44px] justify-center self-start"
          >
            <Text className="text-xs text-slate-500 underline">Bir daha gösterme</Text>
          </Pressable>
        </Card>
      </View>
    </View>
  )
}

/*
  "REHBERİ TEKRAR İZLE" — tek girişi Ayarlar ekranındaki satır (app/ayarlar.jsx →
  rehberiBaslat). Web'deki RestartTourLink'in karşılığı olan bağlantı bileşeni burada
  duruyordu; tek kullanıcısı Profil'in eski alt bilgisiydi ve Ayarlar ekranı gelince
  (2026-09-26) silindi.

  Kendiliğinden açılırken yönlendirme YAPILMIYOR ama elle başlatmada yapılıyor: niyet
  kullanıcının kendisinden geliyor ve rehberin ilk adımı Topluluk'ta ('/'). Ayarlar önce
  kendini yığından çıkarır (back), sonra navigate('/') + turuYenidenBaslat(): geri tuşu
  turdan sonra Ayarlar'a değil Profil'e döner. navigate (push değil) + kök yığındaki
  `dangerouslySingular`: yığına ikinci bir Topluluk konmuyor, açık olan en üste taşınıyor.
*/
