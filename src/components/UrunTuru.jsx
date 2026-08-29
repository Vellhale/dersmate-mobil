import { useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, Mask, Rect } from 'react-native-svg'
import { api } from '../lib/api'
import { brand, ink } from '../lib/theme'
import { Button, Card } from './ui'
import {
  TUR_ADIMLARI,
  TUR_ADIM_SAYISI,
  turCipalariniDinle,
  turCipalariniTazele,
  turCipasiOku,
  turGecildiIsaretle,
  turGecildiMi,
  turYenidenBaslatmayiDinle,
  turuYenidenBaslat,
} from '../lib/tur'

/**
 * İnteraktif ürün rehberi — web'deki ProductTour.jsx'in mobil UYARLAMASI.
 *
 * NEDEN HAZIR KÜTÜPHANE DEĞİL (web kararı, mobilde de geçerli): altı adımlık bir spot
 * ışığı için yeni bir bağımlılık, bakım yükünü kazanılan koddan daha çok artırıyordu.
 * Karşılığında Türkçe metin ve 44px dokunma kuralı bizde.
 *
 * İLERLEME SUNUCUDA (api.myPreferences / api.saveOnboarding), cihazda değil: rehber
 * yalnızca giriş yapmış kullanıcıya gösteriliyor, dolayısıyla hesaba yazmak cihazlar
 * arası taşınır — kullanıcı turu telefonunda yarıda bırakıp webde tamamlayabilir.
 * lastStep / completed / suppressed sözleşmesi web ile birebir aynı.
 *
 * ─── WEB MEKANİZMASININ HİÇBİRİ TAŞINMADI ────────────────────────────────────────
 *   querySelector + getBoundingClientRect → ölçüm defteri (src/lib/tur.js): çıpalar
 *     kendini measureInWindow ile kaydeder.
 *   scrollIntoView + scroll/resize dinleyicileri → YOK. Web'de çıpalar uzun bir sol
 *     rayda ve sayfa kaydırmasına bağlıydı; mobilde tur, sekmeleri ve başlığı sabit
 *     olan Akış ekranında açılıyor — kaydırılacak bir şey yok. Ölçü tazeleme adım
 *     başına bir kez (turCipalariniTazele).
 *   box-shadow "delik" → react-native-svg maskesi. Dört kenar View'ı da olurdu ama
 *     ondalıklı ölçülerde komşu View'lar arasında saç teli kadar boşluk kalıyor;
 *     maske tek parça çizdiği için o dikiş hiç oluşmuyor.
 *   Escape tuşu → Android geri tuşu (BackHandler) + karttaki açık "Rehberi geç".
 *   CustomEvent → tur.js'teki dinleyici kümesi.
 *   sessionStorage → tur.js'teki bellek işareti (uygulama ömrü = oturum ömrü).
 *
 * ÇEREZ/RIZA KAPISI TAŞINMADI: web'de adım ilerlemesi fonksiyonel rızaya tabiydi
 * çünkü tarayıcıda saklanan bir kolaylık verisiydi ve banner bunu ayrıca sayıyordu.
 * Mobilde çerez banner'ı ve ConsentContext yok; kaydedilen tek şey kullanıcının kendi
 * hesabındaki rehber ilerlemesi. Rıza katmanı mobile gelirse `kaydet`in başına aynı
 * kapı konur — açık kararlar (tamamlandı/bir daha gösterme) o zaman da yazılmalı.
 *
 * BİLEŞEN HİÇBİR EKRANI DEĞİŞTİRMEZ: kök layout'a tek satırla takılır, ekranlar
 * yalnızca isterlerse çıpa kaydeder. Çıpası olmayan adım ortada kart olarak çıkar.
 */

/*
  Turun kendiliğinden açılacağı ekranlar.

  Web'de koşul "giriş sayfası"ydı ve gerekçesi şuydu: rehber, kullanıcının gitmek
  istediği yeri elinden alamaz — her ekranda başlatıp kullanıcıyı çıpaların olduğu
  sayfaya sürüklemek, turu "geç"en birinin her tıklamasında turu geri getiriyordu.

  Mobilde aynı kural ekran ADIYLA uygulanıyor: tur, Akış (kök) ya da Keşfet
  görünürken açılır; başka bir sekmedeyse SESSİZCE BEKLER. Yönlendirme yapmıyoruz —
  kullanıcıyı sekmesinden koparmak, web'de reddedilen davranışın aynısı.
*/
const ACILIS_EKRANLARI = ['/', '/kesfet']

/** Çıpanın etrafında bırakılan nefes payı (web'deki padding=8 ile aynı). */
const BOSLUK = 8

export function UrunTuru() {
  const pathname = usePathname()
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const [durum, setDurum] = useState({ yukleniyor: true, aktif: false, adim: 0 })
  const [cipa, setCipa] = useState(null)

  // Sunucu "bu kullanıcıya gösterilebilir" dedi mi? Ekran koşulundan AYRI tutuluyor:
  // biri veriden, diğeri o anki gezinmeden geliyor.
  const gosterilebilir = useRef(false)
  // Kendiliğinden açılma uygulama ömrü boyunca BİR KEZ: kullanıcı sekmeler arasında
  // gezindikçe tur her Akış dönüşünde yeniden açılamaz.
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

  // Veri hazır + doğru ekran = aç. İki koşul ayrı efektlerde birleşiyor çünkü hangisinin
  // önce geleceği belli değil: tercihler ağdan, ekran adı gezinmeden gelir.
  useEffect(() => {
    if (durum.yukleniyor || durum.aktif) return
    if (!gosterilebilir.current || kendiliginenAcildi.current) return
    if (!ACILIS_EKRANLARI.includes(pathname)) return

    kendiliginenAcildi.current = true
    setDurum((s) => ({ ...s, aktif: true }))
  }, [pathname, durum.yukleniyor, durum.aktif])

  const adim = TUR_ADIMLARI[durum.adim]

  // Adımın çıpasını defterden izle. Çıpa sonradan kaydolabilir (ekran henüz
  // yerleşmemiş olabilir), o yüzden tek seferlik okuma yetmez.
  useEffect(() => {
    if (!durum.aktif || !adim) {
      setCipa(null)
      return
    }

    const oku = () => setCipa(turCipasiOku(adim.cipa))
    oku()
    turCipalariniTazele()
    return turCipalariniDinle(oku)
  }, [durum.aktif, adim])

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
    if (!durum.aktif) return
    const abone = BackHandler.addEventListener('hardwareBackPress', () => {
      bitir()
      return true
    })
    return () => abone.remove()
  }, [durum.aktif, bitir])

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

  if (durum.yukleniyor || !durum.aktif || !adim) return null

  const sonAdim = durum.adim === TUR_ADIM_SAYISI - 1

  const delik = cipa
    ? {
        x: cipa.x - BOSLUK,
        y: cipa.y - BOSLUK,
        w: cipa.width + BOSLUK * 2,
        h: cipa.height + BOSLUK * 2,
      }
    : null

  /*
    Kart yerleşimi: çıpa alt yarıdaysa kart üstte, üst yarıdaysa altta; çıpa yoksa
    ortada (web'deki yedek davranış).

    Web'de kartın YÜKSEKLİĞİ ölçülüp "altına sığar mı" hesaplanıyordu. Burada gerek
    yok: kart tam genişlik ve tek sütun, hizalamayı flexbox yapıyor — metin uzayınca
    kimsenin bir sayıyı güncellemesi gerekmiyor.
  */
  const yerlesim = !delik ? 'center' : delik.y + delik.h / 2 > height / 2 ? 'flex-start' : 'flex-end'

  return (
    <View
      // zIndex + elevation birlikte: iOS'ta kardeş sırası yeter, Android'de yükseltilmiş
      // (elevation'lı) gezinme yüzeyleri sıradan kardeşin üstüne çıkabiliyor.
      style={[StyleSheet.absoluteFill, { zIndex: 60, elevation: 60 }]}
      accessibilityViewIsModal
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
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <Card>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-xs font-medium text-brand-600">
              Adım {durum.adim + 1} / {TUR_ADIM_SAYISI}
            </Text>

            {/* İlerleme çubukları görsel tekrar: sayıyı zaten yazdık, ekran okuyucuya
                ikinci kez okutmuyoruz. */}
            <View
              className="flex-row gap-1"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {TUR_ADIMLARI.map((a, i) => (
                <View
                  key={a.id}
                  className={`h-1.5 w-6 rounded-full ${i <= durum.adim ? 'bg-brand-500' : 'bg-slate-200'}`}
                />
              ))}
            </View>
          </View>

          <Text className="mt-2 text-lg font-semibold text-slate-900">{adim.title}</Text>

          {/* Tek cümlelik özet biraz daha koyu (slate-700): maddelerden önce okunması
              gereken satır o. Ayrıntı maddelerde ve bir ton açık — hiyerarşi puntoyla
              değil renkle kuruluyor (web kararı). */}
          <Text className="mt-1.5 text-sm leading-relaxed text-slate-700">{adim.body}</Text>

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
              tekrar önerilebilir, ama açıkça istemeyene hiç sorulmamalı. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => bitir({ susturuldu: true })}
            className="mt-1 min-h-[44px] justify-center self-start"
          >
            <Text className="text-xs text-slate-400 underline">Bir daha gösterme</Text>
          </Pressable>
        </Card>
      </View>
    </View>
  )
}

/**
 * "Rehberi tekrar izle" bağlantısı (web'deki RestartTourLink). Profil gibi bir
 * ayarlar yüzeyine konur.
 *
 * Kendiliğinden açılırken yönlendirme YAPILMIYOR ama burada yapılıyor: niyet
 * kullanıcının kendisinden geliyor ve çıpaların yaşadığı ekran Akış. navigate (push
 * değil): sekme değiştiriyoruz, yığına ikinci bir Akış koymuyoruz.
 */
export function RehberiTekrarIzle({ className = '' }) {
  const router = useRouter()

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        router.navigate('/')
        turuYenidenBaslat()
      }}
      className={`min-h-[44px] justify-center ${className}`}
    >
      <Text className="text-xs text-slate-500 underline">Rehberi tekrar izle</Text>
    </Pressable>
  )
}
