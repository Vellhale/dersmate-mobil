import { useEffect, useRef, useState } from 'react'
import { Animated, Platform, Pressable, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { Tabs, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTurCipasi } from '../../src/lib/tur'
import { CUBUK_BOSLUGU, CUBUK_YUKSEKLIGI } from '../../src/lib/sekmeCubugu'
import { brand, beyaz, gece, ink, rose, slate, zemin } from '../../src/lib/theme'
import { AramaIkonu, ArtiDaireIkonu, EvIkonu, KisiIkonu, MesajIkonu } from '../../src/components/Ikonlar'
import { useInbox } from '../../src/state/InboxContext'

/*
  ANA KABUK — Instagram düzeni: beş sekmeli alt bar. Web'deki Layout.jsx'in (sol ray)
  mobil karşılığı.

  SAĞLAYICILAR ARTIK BURADA DEĞİL, KÖKTE (app/_layout.jsx): sohbet ve profil yığın
  ekranları (tabs) grubunun dışında yaşıyor ve Inbox/Wallet'a onların da erişmesi
  gerekiyor. Buradaki useInbox köktekini okur — ikinci bağlantı yok.

  • Mesajlar rozeti unreadTotal'dan: web'de üst bardaki rozetin karşılığı burada
    tabBarBadge.

  SEKME DÜZENİ (Instagram konvansiyonu):
    Akış · Keşfet · ➕ Oluştur · Mesajlar · Profil

  Etiket YOK (ikon-only): Instagram dilinin imzası. Erişilebilirlik adı her sekmede AÇIKÇA
  veriliyor (tabBarAccessibilityLabel): React Navigation title'dan adı yalnızca iOS'ta
  kuruyor, Android'de beş sekme de adsızdı — TalkBack yalnızca "sekme" okuyordu, Mesajlar'da
  bağlamsız rozet rakamı. Aktif sekme, web'deki ray gibi
  KALIN çizgi + marka rengiyle ayrışır; pasif sekme slate-400 ince çizgi.

  ORTA SEKME DOLGULU DAİRE: "ilan oluştur" gezinme değil EYLEM — görsel dili de
  farklı olmalı (Instagram'ın + kutusu gibi). Dolgu brand-600: beyaz artı 4.90:1,
  brand-500 zeminde 3.89:1 kalırdı (web'deki buton kuralıyla aynı gerekçe).
*/

/*
  TUR ÇIPALI SEKME DÜĞMESİ.

  Ürün turu bir adımı "şuraya bak" diye gösterebilmek için öğenin ekrandaki ölçüsünü
  bilmek zorunda (bkz. lib/tur.js). Sekme düğmelerini React Navigation çiziyor, yani
  ölçüm defterine kaydolabilmelerinin tek yolu tabBarButton'ı sarmalamak.

  Sarmalayıcı düğmenin İŞİNİ değiştirmiyor: gelen props (onPress, erişilebilirlik
  durumu, çocuklar) olduğu gibi Pressable'a geçiyor. Çıpa kaydı başarısız olursa tur
  yalnızca spot ışığını kaybeder — adım ortada kart olarak yine çıkar (lib/tur.js'in
  yedek davranışı), sekme çubuğu etkilenmez.

  ⚠️ WEB'DE TAM SAYFA YENİLEME: React Navigation düğmeye `href` veriyor ve web'de düz
  Pressable bir <a> olarak çiziliyor. Tıklama hem onPress'i (uygulama içi geçiş) hem
  tarayıcının varsayılan bağlantı takibini çalıştırıyordu → her sekme değişiminde sayfa
  baştan yükleniyor, çubuk 200 ms kayboluyor, kayan gösterge de sıfırlanıyordu
  (ölçüldü; Akış sekmesinde yoktu çünkü onun tabBarButton'ı özelleştirilmemiş).
  React Navigation'ın kendi PlatformPressable'ının yaptığı şey burada tekrarlanıyor:
  değiştirici tuşsuz sol tık → varsayılanı engelle, onPress'i çağır. Ctrl/orta tık
  yeni sekmede açmaya devam eder. Native'de olay nesnesi bu alanları taşımaz, dal
  hiç çalışmaz.
*/
function turluDugme(cipaAdi) {
  function TurluTabDugmesi({ children, style, onPress, href, ...props }) {
    const cipa = useTurCipasi(cipaAdi)
    const bas = (e) => {
      if (Platform.OS === 'web' && href != null && e) {
        const degistirici = e.metaKey || e.altKey || e.ctrlKey || e.shiftKey
        const solTik = e.button == null || e.button === 0
        if (degistirici || !solTik) return
        e.preventDefault?.()
      }
      onPress?.(e)
    }
    return (
      <Pressable {...props} href={href} onPress={bas} style={style} {...cipa}>
        {children}
      </Pressable>
    )
  }
  return TurluTabDugmesi
}

/*
  KAYAN GÖSTERGE + IŞIMA.

  Sekme sırası (SEKME_YOLLARI) ve hapın iç genişliği (onLayout) biliniyor; her yuva
  eşit genişlikte olduğu için aktif yuvanın solu = 12 + yuva × indeks. Konum yayla
  hedefe kayıyor — ikonlar yerinde durur, ışık onların altında dolaşır.

  Yol eşleşmezse (kökteki yığın ekranı, ör. sohbet) son konum korunur: sekmelere
  dönüldüğünde ışık zaten doğru yerde olur, sıçrama olmaz.

  ⚠️ SON KONUM MODÜL DÜZEYİNDE (sonX): web'de sekme değişince React Navigation çubuğu
  ~200 ms söküp yeniden kuruyor (ölçüldü, bu değişiklikten önce de öyleydi). Konum
  bileşende yaşasaydı her geçişte sıfırdan (ilk yuvadan) kayardı. Hatırlanan şey HEDEF
  değil, animasyonun O ANKİ değeri (listener): sökülen örnek yeni hedefe doğru yola
  çıkmışken sökülüyor; hedef saklansaydı yeni örnek doğrudan hedefte doğar ve kayma
  hiç görünmezdi (ölçüldü). İlk kuruluşta animasyon yok — gösterge doğrudan hedefe
  konur, açılışta soldan süzülmesin.

  Koni: göstergeden çıkan, aşağı doğru genişleyen ve dikeyde sönen 8 iç içe Path
  (katman i: üstte 14+3i, altta 28+12i px; opaklık içten dışa 0.42→0.07). Tek path'in
  kenarı jilet gibi keskin kalıyor, dikdörtgen kutu ve elips referansa uymadı.
*/
const SEKME_YOLLARI = ['/', '/kesfet', '/olustur', '/mesajlar', '/profil']
const KONI_KATMANLARI = Array.from({ length: 8 }, (_, i) => ({
  ust: 7 + i * 1.5,
  alt: 14 + i * 6,
  opaklik: +(0.42 - i * 0.05).toFixed(2),
})).reverse()

let sonX = null

function AktifIsik() {
  const yol = usePathname()
  const [icGenislik, setIcGenislik] = useState(0)
  const indeks = useRef(0)
  const x = useRef(new Animated.Value(sonX ?? 0)).current

  const bulunan = SEKME_YOLLARI.indexOf(yol)
  if (bulunan >= 0) indeks.current = bulunan

  const yuva = icGenislik / SEKME_YOLLARI.length
  const hedef = 12 + yuva * indeks.current + (yuva - 64) / 2

  useEffect(() => {
    const dinleyici = x.addListener(({ value }) => {
      sonX = value
    })
    return () => {
      // Sökülürken yay DURDURULUYOR: yoksa görünmeyen eski örnek çubuk yokken hedefe
      // varır ve yeni örnek doğrudan hedefte doğar — kayma yine görünmezdi.
      x.stopAnimation()
      x.removeListener(dinleyici)
    }
  }, [x])

  useEffect(() => {
    if (!icGenislik) return
    if (sonX === null) {
      x.setValue(hedef)
      return
    }
    Animated.spring(x, { toValue: hedef, friction: 9, tension: 90, useNativeDriver: true }).start()
  }, [hedef, icGenislik, x])

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      onLayout={(e) => setIcGenislik(e.nativeEvent.layout.width - 24)}
    >
      {icGenislik > 0 && (
        <Animated.View style={{ position: 'absolute', top: 0, width: 64, height: 64, alignItems: 'center', transform: [{ translateX: x }] }}>
          <Svg width={128} height={64} style={{ position: 'absolute', top: 0, left: -32 }}>
            <Defs>
              <LinearGradient id="koni" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={brand[500]} stopOpacity="0.6" />
                <Stop offset="0.5" stopColor={brand[500]} stopOpacity="0.17" />
                <Stop offset="1" stopColor={brand[500]} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {KONI_KATMANLARI.map(({ ust, alt, opaklik }, i) => (
              <Path
                key={i}
                d={`M${64 - ust} 0 H${64 + ust} L${64 + alt} 64 H${64 - alt} Z`}
                fill="url(#koni)"
                fillOpacity={opaklik}
              />
            ))}
          </Svg>
          <View className="h-[4px] w-7 rounded-b-full bg-brand-400" />
        </Animated.View>
      )}
    </View>
  )
}

export default function TabsLayout() {
  const { unreadTotal } = useInbox()
  const guvenli = useSafeAreaInsets()

  /*
    AKTİF SEKME — referans tasarım birebir, renkler bize ait: vurgu renkli ikon, hapın
    üst kenarına oturan gösterge çizgisi ve o çizgiden aşağı genişleyerek sönen koni
    ışıma. Üçü birlikte gerekli: renk tek başına renk körlüğünde kayboluyor, çizgi tek
    başına küçük, ışıma tek başına koyu zeminde zayıf.

    ⚠️ TON KOYU ZEMİNDE TERSİNE DÖNÜYOR: brand-600 (açık zemindeki aktif rengimiz)
    slate-900 üzerinde 3.65:1'e düşüyor; brand-300/400 6.5:1'in üstünde (ölçüldü).

    GEÇİŞ ANİMASYONU: gösterge + ışıma sekme başına DEĞİL, çubuğun arka planında TEK
    parça olarak çiziliyor (tabBarBackground) ve aktif yuvaya kayıyor. Sekme başına
    çizilseydi biri sönüp öteki yanardı — kayma ancak tek bir öğe hareket edince olur.
    İkon ise kendi yuvasında kalıyor; seçilince kısa bir "zıplama" yapıyor.
  */

  // translateY 13: React Navigation ikon yuvasını çubuğun üst yarısına koyuyor (etiket
  // alanı boş dursa da) ve sarmalayıcı hapın 13px üstünden başlıyor (ölçüldü). Kaydırma
  // ikonu tam ortaya getiriyor; hapın overflow:hidden'ı dışarı taşanı keser.
  const ikon = (Ikon) => {
    const Bilesen = ({ focused }) => {
      const olcek = useRef(new Animated.Value(1)).current
      useEffect(() => {
        if (!focused) return
        // Seçilince hafif zıplama: 0.86'dan yayla 1'e (biraz taşıp oturur); tween'den daha canlı.
        olcek.setValue(0.86)
        Animated.spring(olcek, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start()
      }, [focused, olcek])
      return (
        <Animated.View
          className="h-16 w-16 items-center justify-center"
          style={{ transform: [{ translateY: 13 }, { scale: olcek }] }}
        >
          <Ikon renk={focused ? brand[300] : slate[300]} boy={22} kalinlik={focused ? 2 : 1.6} />
        </Animated.View>
      )
    }
    return Bilesen
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        // Geniş ekranda (tablet/masaüstü web) React Navigation ikonu etiketin YANINA alıp
        // yuvayı 13px daha aşağı kaydırıyor; ikonlar hapta ortalanmıyordu (ölçüldü: 45 vs 32).
        // Etiket gizli olsa da konumu sabitlemek düzeni her genişlikte aynı tutuyor.
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: brand[400],
        tabBarInactiveTintColor: slate[300],

        /*
          YÜZEN HAP ÇUBUK — kenara yapışmıyor, ekranın üstünde duruyor.

          `position: absolute` şart: normal akışta çubuk sahneyi kısaltır ve yuvarlak
          köşelerin altından sayfa zemini görünür, "yüzme" hissi kaybolurdu. Bunun
          bedeli, içeriğin çubuğun ALTINDAN geçmesi — beş sekme ekranı da alt dolgusunu
          src/lib/sekmeCubugu.js'ten alıyor (ayrıntı orada).

          Güvenli alan elle ekleniyor: absolute konumda React Navigation'ın kendi
          çentik/gesture-bar payı devreye girmiyor.
        */
        tabBarStyle: {
          position: 'absolute',
          left: CUBUK_BOSLUGU,
          right: CUBUK_BOSLUGU,
          bottom: CUBUK_BOSLUGU + guvenli.bottom,
          height: CUBUK_YUKSEKLIGI,
          // Referans hap neredeyse siyah; lacivert (slate-900) fazla renkli kalıyordu.
          // Değer theme.js'te: renk DEĞERİ gereken yerler hex'i elle yazmıyor (CLAUDE.md).
          backgroundColor: gece,
          borderTopWidth: 0,
          borderRadius: CUBUK_YUKSEKLIGI / 2,
          overflow: 'hidden',
          paddingHorizontal: 12,
          // Yükselti: hapın yüzdüğünü söyleyen tek işaret. Gölgesiz hâli, koyu bir
          // şeridin sayfaya yapıştırılmış gibi durmasına yol açıyordu.
          elevation: 12,
          shadowColor: ink,
          shadowOpacity: 0.28,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        },
        tabBarItemStyle: { height: CUBUK_YUKSEKLIGI, paddingVertical: 0, justifyContent: 'center' },
        tabBarBackground: () => <AktifIsik />,
        sceneStyle: { backgroundColor: zemin },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Akış', tabBarAccessibilityLabel: 'Akış', tabBarIcon: ikon(EvIkonu) }}
      />
      <Tabs.Screen
        name="kesfet"
        options={{
          title: 'Keşfet',
          tabBarAccessibilityLabel: 'Keşfet',
          tabBarIcon: ikon(AramaIkonu),
          tabBarButton: turluDugme('kesfet'),
        }}
      />
      <Tabs.Screen
        name="olustur"
        options={{
          title: 'Ders İlanı Oluştur',
          tabBarAccessibilityLabel: 'Ders ilanı oluştur',
          tabBarIcon: ikon(ArtiDaireIkonu),
          tabBarButton: turluDugme('portfoy'),
        }}
      />
      <Tabs.Screen
        name="mesajlar"
        options={{
          title: 'Mesajlar',
          // Okunmamış sayısı adın içinde: rozetteki çıplak rakam tek başına okunmasın.
          tabBarAccessibilityLabel: unreadTotal > 0 ? `Mesajlar, ${unreadTotal} okunmamış` : 'Mesajlar',
          tabBarIcon: ikon(MesajIkonu),
          // Okunmamış toplamı: web'deki üst bar rozetinin karşılığı. 0 ise rozet hiç
          // çizilmez — boş kırmızı nokta "bir şey var" yalanı söylerdi.
          tabBarBadge: unreadTotal > 0 ? (unreadTotal > 99 ? '99+' : unreadTotal) : undefined,
          // top 14: ikon sarmalayıcısı 13px aşağı kaydırıldı (bkz. ikon), rozet de onunla insin.
          tabBarBadgeStyle: { backgroundColor: rose[600], color: beyaz, fontSize: 11, top: 14 },
          tabBarButton: turluDugme('sohbet'),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarAccessibilityLabel: 'Profil',
          tabBarIcon: ikon(KisiIkonu),
          tabBarButton: turluDugme('rutbe'),
        }}
      />
    </Tabs>
  )
}
