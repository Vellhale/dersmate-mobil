import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Linking, Modal as RNModal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useTurCipasi } from '../lib/tur'
import { bekleyenIsleriTazele, useBekleyenIsler } from '../lib/bekleyenIsler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brand, ink, slate } from '../lib/theme'
import { useAuth } from '../state/AuthContext'
import { useInbox } from '../state/InboxContext'
import { Avatar } from './Avatar'
import { Logo } from './Logo'
import {
  AramaIkonu,
  BilgiIkonu,
  KalkanIkonu,
  KepIkonu,
  KisilerIkonu,
  KitapIkonu,
  InstagramIkonu,
  MenuIkonu,
  MesajIkonu,
  TiktokIkonu,
  ToplulukIkonu,
  XIkonu,
} from './Ikonlar'

/*
  ÇEKMECE MENÜSÜ — web'deki Layout.jsx çekmecesinin (satır 427-443) mobil karşılığı.

  ─── NEDEN expo-router'ın Drawer'I DEĞİL ────────────────────────────────────────
  expo-router `Drawer` layout'unu içinde taşıyor ama bu projede kullanmak ÜÇ bedel
  getiriyordu ve üçü de ölçüldü (2026-09-23):

  1. NATIVE BAĞIMLILIK. Drawer `react-native-drawer-layout` üzerinden çalışıyor ve o
     paketin sert peer bağımlılığı `react-native-gesture-handler`. Bu projede
     gesture-handler yalnızca expo-router'ın GEÇİŞLİ bağımlılığı — package.json'da
     beyan edilmiyor ve kökte `GestureHandlerRootView` HİÇ YOK. Doğru kurulum yeni bir
     paket + kök sarmalayıcı + YENİ BULUT DERLEMESİ demekti.

  2. RN MODAL'LARIN ALTINDA KALIRDI. Navigatör ağacının içinde çizilen bir çekmece,
     ayrı bir yerel pencere olan RNModal'ın üstüne çıkamaz. İlk açılıştaki ZORUNLU izin
     sayfası (IzinSayfasi, app/_layout.jsx'te kökte) bir Modal — hamburger onun
     arkasında kalırdı. Topluluk'un üç alt sayfası da aynı durumda.

  3. SEKME MAKİNESİNİ YIKARDI — bu gerekçe 2026-09-23'te GEÇERSİZ KALDI: sekme çubuğu
     zaten kaldırıldı (gezinmenin tek yolu bu çekmece). Kayıtta duruyor çünkü kararın
     o günkü maliyet hesabını açıklıyor; bugün Drawer'a geçmenin önündeki engel
     yalnızca 1 ve 2.

  Bu yüzden çekmece, uygulamanın zaten her yerde kullandığı RNModal ilkelinden kuruldu.
  Kazanç: yeni native bağımlılık yok, YENİDEN DERLEME YOK (saf JS — Metro üzerinden
  anında görünür).

  ─── GÖRSEL DİL WEB'DEN ─────────────────────────────────────────────────────────
  Zemin slate-900 (`ink`), vurgu `brand-300`. Bu seçim web'de ÖLÇÜLMÜŞ: brand-300 koyu
  zeminde 8.19:1; brand-500 seçilemiyor, brand-100 beyazdan yalnız 1.27:1 ayrışıyor —
  ikisi de denenip elenmiş (Layout.jsx:31-50). Aktif öğede ikon da KALINLAŞIYOR
  (kalinlik 2.4), çünkü vurgu yalnızca renge bırakılırsa renk körlüğünde kaybolur.

  ⚠️ Öğe yüksekliği min 44px — CLAUDE.md'nin koşulsuz dokunma kuralı.
*/

/* Web'deki NAV dizisinin (Layout.jsx:58-90) birebir sırası ve birebir etiketleri.
   Rota adları mobilde farklı ve bu FARK BİLİNÇLİ: /portfolio→/olustur,
   /arkadaslar→/eslesmeler (yeniden adlandırma CLAUDE.md'de yasak — tur çıpası ve
   derin bağlantı ona bağlı), /sohbet→/mesajlar, /topluluk→/ (ana ekran).

   ⚠️ SEKME ÇUBUĞU YOK (2026-09-23): gezinmenin TEK yolu burası. Listeden düşen bir
   hedef, uygulamada ulaşılamaz hâle gelir — web'de sol raydan düşürmekle aynı şey. */
/* `rozet`: satırdaki sayacın kaynağı (Cekmece içinde çözülüyor). Üç sayaç da AYNI dil —
   rose-600 hap, beyaz rakam (renk rolleri: sayaç = rose) — ve erişilebilir adda cümle
   olarak okunuyor; çıplak "2" bağlamsız kalırdı. */
const OGELER = [
  { yol: '/kesfet', etiket: 'Keşfet', Ikon: AramaIkonu },
  { yol: '/olustur', etiket: 'Ders Portföyü', Ikon: KitapIkonu },
  { yol: '/eslesmeler', etiket: 'Arkadaşlar', Ikon: KisilerIkonu, rozet: 'gelenIstek' },
  { yol: '/mesajlar', etiket: 'Sohbet', Ikon: MesajIkonu, rozet: 'okunmamis' },
  { yol: '/dersler', etiket: 'Derslerim', Ikon: KepIkonu, rozet: 'dersEylem' },
  /* Web sol rayının son satırı Topluluk (Layout.jsx:89) — çekmece artık o rayın
     BİREBİR karşılığı. Yol '/akis' değil '/': Topluluk aynı zamanda ana ekran, ayrı
     bir /topluluk adresine gitmek aynı ekranı yığına ikinci kez iterdi. */
  { yol: '/', etiket: 'Topluluk', Ikon: ToplulukIkonu },
]

/*
  SOSYAL HESAPLAR — web'deki SOSYAL dizisinin (Layout.jsx:121-125) birebir portu.

  ⚠️ KULLANICI ADI PLATFORM BAŞINA FARKLI: TikTok `dersmate`, Instagram ve X
  `dersmate_`. Web'de bir süre üçü de tek sabitten yazdırılıyordu ve TikTok
  bağlantısı VAR OLMAYAN bir hesaba gidiyordu. Ad href ile aynı satırda duruyor ki
  ikisi bir daha ayrışmasın: linki değiştiren, altındaki metni de görür.

  Satırlar yalnız ikon + kullanıcı adı gösteriyor; "Instagram sayfamız" gibi
  açıklama metni bilinçli olarak yok (web'deki tasarım isteri).
*/
const SOSYAL = [
  { ad: 'Instagram', kullanici: 'dersmate_', href: 'https://instagram.com/dersmate_', Ikon: InstagramIkonu },
  { ad: 'TikTok', kullanici: 'dersmate', href: 'https://tiktok.com/@dersmate', Ikon: TiktokIkonu },
  { ad: 'X', kullanici: 'dersmate_', href: 'https://x.com/dersmate_', Ikon: XIkonu },
]

/*
  SOSYAL SATIR — gezinme öğesinden BİLEREK daha sessiz: ikon 18px (menüde 22),
  renk slate-400 (menüde slate-200). Bunlar uygulamadan ÇIKARAN bağlantılar;
  menü öğeleriyle aynı ağırlıkta çizilselerdi gezinme gibi okunurlardı.

  Dokunma hedefi yine 44px (CLAUDE.md, koşulsuz) — küçülen şey görsel ağırlık,
  dokunulabilir alan değil.
*/
function SosyalSatir({ Ikon, ad, kullanici, href, onGit }) {
  return (
    <Pressable
      accessibilityRole="link"
      /* Ekran okuyucu "dersmate_" diye okusaydı hangi platform olduğu kaybolurdu;
         görsel ayrımı ikon taşıyor, erişilebilir adı bu etiket. */
      accessibilityLabel={`${ad}: ${kullanici}`}
      onPress={() => {
        onGit()
        /* Linking.openURL reddedilebilir (tarayıcı yok, adres desteklenmiyor).
           Yakalanmazsa bu, kullanıcıya hiçbir şey anlatmayan bir çökme olurdu. */
        Linking.openURL(href).catch(() => {})
      }}
      className="min-h-[44px] flex-row items-center gap-3 rounded-xl px-3 active:bg-white/5"
    >
      <Ikon renk={slate[400]} boy={18} kalinlik={1.8} />
      <Text className="text-sm text-slate-400">{kullanici}</Text>
    </Pressable>
  )
}

/* Sayacın erişilebilir cümlesi — satırın neyi saydığı rakamla birlikte okunur. */
const ROZET_CUMLESI = {
  okunmamis: (n) => `${n} okunmamış`,
  gelenIstek: (n) => `${n} gelen istek`,
  dersEylem: (n) => `${n} ders işlem bekliyor`,
}

function Oge({ Ikon, etiket, aktif, rozet, rozetTuru = 'okunmamis', onPress }) {
  const renk = aktif ? brand[300] : slate[200]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rozet ? `${etiket}, ${ROZET_CUMLESI[rozetTuru](rozet)}` : etiket}
      onPress={onPress}
      className={`min-h-[48px] flex-row items-center gap-3 rounded-xl px-3 ${
        aktif ? 'bg-brand-300/10' : 'active:bg-white/5'
      }`}
    >
      <Ikon renk={renk} boy={22} kalinlik={aktif ? 2.4 : 2} />
      <Text
        numberOfLines={1}
        className={`min-w-0 flex-1 text-[15px] ${aktif ? 'font-bold text-brand-300' : 'text-slate-200'}`}
      >
        {etiket}
      </Text>
      {rozet ? (
        <View className="min-w-[22px] items-center rounded-full bg-rose-600 px-1.5 py-0.5">
          <Text className="text-xs font-bold text-white">{rozet > 99 ? '99+' : rozet}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

export function Cekmece({ acik, onKapat, aktifYol }) {
  const router = useRouter()
  const guvenli = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { session } = useAuth()
  const { unreadTotal } = useInbox()
  /*
    BEKLEYEN İŞ SAYAÇLARI (kullanıcı kararı, 2026-09-25) — Arkadaşlar'da yanıt bekleyen
    gelen istek, Derslerim'de kullanıcının kapatabileceği ders. Push'u REDDEDEN kullanıcıya
    14 günde düşen isteği ve 48 saatte otomatik onaylanan dersi haber veren tek yol bunlar.
    Veri ve tazeleme kuralları lib/bekleyenIsler.js'te (tek çekim, bütün tüketicilere aynı
    anlık görüntü); tanımlar Arkadaşlar'ın "Gelen" sekmesi ve Derslerim'in aksiyon
    grubuyla aynı, yani rozet ile liste ayrışamaz.
  */
  const bekleyen = useBekleyenIsler()
  const sayaclar = { okunmamis: unreadTotal, gelenIstek: bekleyen.gelenIstek, dersEylem: bekleyen.dersEylem }

  // Menü açılırken sayaçlar tazelenir: kullanıcı tam da onlara bakmak üzere.
  useEffect(() => {
    if (acik) bekleyenIsleriTazele()
  }, [acik])

  /* Panel genişliği: ekranın %82'si ama en fazla 320. Dar telefonda menü ekranı
     tamamen kaplamamalı — arkadaki içeriğin bir şeridi görünsün ki "üstte bir katman
     var, dışına dokunursam kapanır" anlaşılsın. */
  const genislik = Math.min(320, Math.round(width * 0.82))

  /*
    İKİ DURUM GEREKLİ: `acik` çağıranın niyeti, `icerde` Modal'ın gerçekten takılı olup
    olmadığı. Kapanışta panelin dışarı kayması için Modal, animasyon BİTENE KADAR takılı
    kalmalı — `visible={acik}` verilseydi panel anında yok olur, kapanış animasyonu hiç
    görünmezdi.
  */
  const [icerde, setIcerde] = useState(false)
  const ilerleme = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (acik) {
      setIcerde(true)
      Animated.timing(ilerleme, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    } else {
      Animated.timing(ilerleme, { toValue: 0, duration: 160, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setIcerde(false)
        },
      )
    }
  }, [acik, ilerleme])

  function git(yol) {
    onKapat()
    /* `navigate` TEK BAŞINA kopyayı engellemiyor: expo-router'ın StackRouter'ı mevcut
       rotayı yalnızca hedef O ANKİ rotayla aynıysa yeniden kullanıyor, yığında daha
       aşağıda duran bir ekrana basınca KOPYA itiyor. Kopyayı engelleyen şey kök
       yığındaki `dangerouslySingular` (app/_layout.jsx) — gerekçesi orada.
       Web'de de öğeye basınca çekmece kapanıyor (Layout.jsx:439). */
    router.navigate(yol)
  }

  return (
    <RNModal visible={icerde} transparent animationType="none" onRequestClose={onKapat}>
      <View className="flex-1 flex-row">
        {/* Panel — soldan kayar */}
        <Animated.View
          style={{
            width: genislik,
            paddingTop: guvenli.top,
            paddingBottom: guvenli.bottom,
            backgroundColor: ink,
            transform: [
              {
                translateX: ilerleme.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-genislik, 0],
                }),
              },
            ],
          }}
        >
          <ScrollView contentContainerClassName="gap-1 px-3 py-3">
            {/*
              MARKA KİLİDİ — çekmecenin tepesinde.

              Web'de logo üst barda, her sayfada görünür (Layout.jsx:304-313). Mobilde
              üst şerit sayfa adını taşıyor, yani markaya yer yok; Akış ekranı
              silinene kadar marka kilidi ORADA duruyordu (EkranBasligi'nin başlıksız
              dalı) ve onunla birlikte uygulamadan tamamen kayboldu.

              Çekmece web'in sol rayının karşılığı, logonun doğal yeri burası.
            */}
            <View className="px-3 pb-1 pt-1">
              <Logo boyut="lg" zemin="gece" />
            </View>

            <View className="mb-1 mt-2 h-px bg-white/10" />

            {/*
              KİMLİK SATIRI — web'de de yalnızca çekmecede var (Layout.jsx:430-437);
              masaüstü rayında yok çünkü orada avatar üst barda duruyor. Mobilde üst
              barda avatar olmadığı için burası profile giden tek kısa yol.
            */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profilim"
              onPress={() => git('/profil')}
              className="min-h-[56px] flex-row items-center gap-3 rounded-xl px-3 active:bg-white/5"
            >
              <Avatar userId={session?.userId} name={session?.displayName} size="sm" />
              <Text numberOfLines={1} className="min-w-0 flex-1 text-[15px] font-semibold text-white">
                {session?.displayName ?? 'Profilim'}
              </Text>
            </Pressable>

            <View className="my-2 h-px bg-white/10" />

            {OGELER.map(({ yol, etiket, Ikon, rozet }) => (
              <Oge
                key={yol}
                Ikon={Ikon}
                etiket={etiket}
                aktif={aktifYol === yol}
                rozet={rozet && sayaclar[rozet] > 0 ? sayaclar[rozet] : null}
                rozetTuru={rozet}
                onPress={() => git(yol)}
              />
            ))}

            {/* Yönetim YALNIZCA yetkili hesapta çizilir. Asıl kapı sunucuda (403);
                buradaki koşul, yetkisi olmayana çalışmayan bir satır göstermemek için. */}
            {session?.isAdmin ? (
              <Oge
                Ikon={KalkanIkonu}
                etiket="Yönetim"
                aktif={aktifYol === '/yonetim'}
                onPress={() => git('/yonetim')}
              />
            ) : null}

            <View className="my-2 h-px bg-white/10" />

            {/*
              ALT KÜME — web'deki AltKume'nin (Layout.jsx:621-657) portu: Hakkımızda
              ve altında sosyal hesaplar. Gezinme listesinin DIŞINDA ve ayırıcının
              altında: biri uygulama içi bir sayfa, diğerleri uygulamadan çıkarıyor.
            */}
            <Oge
              Ikon={BilgiIkonu}
              etiket="Hakkımızda"
              aktif={aktifYol === '/hakkimizda'}
              onPress={() => git('/hakkimizda')}
            />

            {SOSYAL.map((s) => (
              /* Çekmece kapanıyor: dönüşte menü açık kalsaydı kullanıcı uygulamaya
                 girdiğinde üstünde bir katmanla karşılaşırdı. */
              <SosyalSatir key={s.ad} {...s} onGit={onKapat} />
            ))}
          </ScrollView>
        </Animated.View>

        {/* Perde — dokununca kapanır. Web'de de aynı davranış (Layout.jsx:469-475).
            Panelin KARDEŞİ, çocuğu değil: panelin içine dokunuş perdeye ulaşmasın. */}
        <Animated.View className="flex-1" style={{ opacity: ilerleme }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Menüyü kapat"
            onPress={onKapat}
            className="flex-1 bg-slate-900/50"
          />
        </Animated.View>
      </View>
    </RNModal>
  )
}

/*
  SAĞLAYICI — çekmece durumu tek yerde.

  Her ekrana ayrı `acik` durumu koymak, ekran değiştirince menünün kapanmasına ya da
  iki ekranda birden açık kalmasına yol açardı. Durum KÖKTE yaşıyor (app/_layout.jsx,
  InboxProvider'ın içinde) ve Modal da orada çiziliyor.

  ⚠️ Modal KÖK KABUKTA çiziliyor, ekranların içinde değil: RNModal ayrı bir yerel
  pencere ve hangi ekranda açıldığından bağımsız olarak tam ekran kaplar. Ekran başına
  bir Modal olsaydı geçişte takılı kalan kopyalar doğardı.
*/
const CekmeceBaglami = createContext(null)

export function CekmeceSaglayici({ children }) {
  const [acik, setAcik] = useState(false)
  const yol = usePathname()

  const ac = useCallback(() => setAcik(true), [])
  const kapat = useCallback(() => setAcik(false), [])
  const deger = useMemo(() => ({ ac, kapat, acik }), [ac, kapat, acik])

  return (
    <CekmeceBaglami.Provider value={deger}>
      {children}
      <Cekmece acik={acik} onKapat={kapat} aktifYol={yol} />
    </CekmeceBaglami.Provider>
  )
}

export function useCekmece() {
  const b = useContext(CekmeceBaglami)
  if (!b) throw new Error('useCekmece, CekmeceSaglayici içinde kullanılmalı.')
  return b
}

/**
 * Hamburger düğmesi — `EkranBasligi`nin `sol` yuvasına verilir.
 *
 * 44x44: dokunulabilir her öğe min 44px (CLAUDE.md, koşulsuz). -ml-2 ile sola taşıyor
 * çünkü ikonun görsel ağırlığı 24px ve düğme kutusu onu 10px boşlukla sarıyor; negatif
 * kenar boşluğu olmadan logo/başlık optik olarak sağa kaymış görünüyordu.
 */
export function HamburgerDugmesi() {
  const { ac } = useCekmece()
  const { unreadTotal } = useInbox()
  /* TUR ÇIPASI: 'matches' ve 'sessions' adımları eskiden Akış başlığındaki iki ikona
     ışık tutuyordu. O ikonlar kalktı (hedefleri çekmeceye taşındı), çıpa da buraya
     geldi. İki adım da aynı öğeyi gösteriyor ve bu doğru: ikisinin de yolu menüden
     geçiyor.

     ⚠️ AYNI ÇIPA ADI BEŞ EKRANDA BİRDEN kayıtlı: bu düğme her kabuk ekranında ayrı
     bir örnek ve kök yığın alttakini monte tutuyor. tur.js'in defteri bu yüzden
     sayaçlı — biri sökülünce çıpa ölmesin (gerekçe turCipasiSil'de). */
  const cipa = useTurCipasi('menu')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unreadTotal > 0 ? `Menüyü aç, ${unreadTotal} okunmamış mesaj` : 'Menüyü aç'}
      onPress={ac}
      className="-ml-2 h-11 w-11 items-center justify-center rounded-lg active:bg-slate-100"
      {...cipa}
    >
      <MenuIkonu renk={slate[700]} boy={24} />
      {/*
        OKUNMAMIŞ ROZETİ — sekme çubuğundaki tabBarBadge'in yerini alıyor (2026-09-23).
        Çubuk kalkınca okunmamış sayısı YALNIZCA çekmece açılınca görünür olacaktı:
        kullanıcı yeni mesajı olduğunu fark edemezdi. Hamburger artık her kabuk
        ekranında duran tek kalıcı gezinme işareti, rozetin yeri burası.

        Rakam rozetin içinde ama erişilebilir ad cümleyi taşıyor (yukarıda): çıplak
        bir sayı ekran okuyucuda bağlamsız kalırdı — sekme çubuğundaki kuralın aynısı.
      */}
      {unreadTotal > 0 ? (
        <View className="absolute right-0.5 top-0.5 min-w-[18px] items-center rounded-full bg-rose-600 px-1 py-px">
          <Text className="text-[10px] font-bold text-white">
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}
