import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Modal as RNModal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useTurCipasi } from '../lib/tur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brand, ink, slate } from '../lib/theme'
import { useAuth } from '../state/AuthContext'
import { useInbox } from '../state/InboxContext'
import { Avatar } from './Avatar'
import {
  AramaIkonu,
  BilgiIkonu,
  EvIkonu,
  KalkanIkonu,
  KepIkonu,
  KisilerIkonu,
  KitapIkonu,
  MenuIkonu,
  MesajIkonu,
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

  3. SEKME MAKİNESİNİ YIKARDI. (tabs)/_layout.jsx'i Drawer'a çevirmek yüzen hapı,
     AktifIsik göstergesini, sekmeCubugu.js geometrisini ve DÖRT tur çıpasını birden
     götürürdü.

  Bu yüzden çekmece, uygulamanın zaten her yerde kullandığı RNModal ilkelinden kuruldu.
  Kazanç: yeni native bağımlılık yok, YENİDEN DERLEME YOK (saf JS — Metro üzerinden
  anında görünür) ve sekme çubuğu olduğu gibi kalıyor.

  ─── GÖRSEL DİL WEB'DEN ─────────────────────────────────────────────────────────
  Zemin slate-900 (`ink`), vurgu `brand-300`. Bu seçim web'de ÖLÇÜLMÜŞ: brand-300 koyu
  zeminde 8.19:1; brand-500 seçilemiyor, brand-100 beyazdan yalnız 1.27:1 ayrışıyor —
  ikisi de denenip elenmiş (Layout.jsx:31-50). Aktif öğede ikon da KALINLAŞIYOR
  (kalinlik 2.4), çünkü vurgu yalnızca renge bırakılırsa renk körlüğünde kaybolur.

  ⚠️ Öğe yüksekliği min 44px — CLAUDE.md'nin koşulsuz dokunma kuralı.
*/

/* Web'deki NAV dizisinin (Layout.jsx:58-90) birebir sırası. Rota adları mobilde
   farklı ve bu FARK BİLİNÇLİ: /portfolio→/olustur, /arkadaslar→/eslesmeler (yeniden
   adlandırma CLAUDE.md'de yasak — tur çıpası ve derin bağlantı ona bağlı),
   /sohbet→/mesajlar. Etiketler web'dekiyle aynı tutuldu. */
const OGELER = [
  { yol: '/kesfet', etiket: 'Keşfet', Ikon: AramaIkonu },
  { yol: '/olustur', etiket: 'Ders Portföyü', Ikon: KitapIkonu },
  { yol: '/eslesmeler', etiket: 'Arkadaşlar', Ikon: KisilerIkonu },
  { yol: '/mesajlar', etiket: 'Sohbet', Ikon: MesajIkonu, rozet: true },
  { yol: '/dersler', etiket: 'Derslerim', Ikon: KepIkonu },
  /* Topluluk ARTIK ANA SEKME ('/'), çekmecede ayrı satırı yok — sekme çubuğundan
     zaten bir dokunuş uzakta. Yerine Akış geldi: ana sekmeden indi ve tek girişi
     burası. */
  { yol: '/akis', etiket: 'Akış', Ikon: EvIkonu },
]

function Oge({ Ikon, etiket, aktif, rozet, onPress }) {
  const renk = aktif ? brand[300] : slate[200]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rozet ? `${etiket}, ${rozet} okunmamış` : etiket}
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
    /* push DEĞİL replace DEĞİL — navigate: aynı rotaya tekrar basınca yığına kopya
       eklemesin, zaten açık olan ekrana dönsün. Web'de de öğeye basınca çekmece
       kapanıyor (Layout.jsx:439). */
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
                rozet={rozet && unreadTotal > 0 ? unreadTotal : null}
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

            <Oge
              Ikon={BilgiIkonu}
              etiket="Hakkımızda"
              aktif={aktifYol === '/hakkimizda'}
              onPress={() => git('/hakkimizda')}
            />
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

  Beş sekme ekranının her birine ayrı `acik` durumu koymak, ekran değiştirince menünün
  kapanmasına ya da iki ekranda birden açık kalmasına yol açardı. Durum sekme kabuğunda
  ((tabs)/_layout.jsx) yaşıyor ve Modal da orada çiziliyor.

  ⚠️ Modal SEKME KABUĞUNDA çiziliyor, ekranların içinde değil: RNModal ayrı bir yerel
  pencere ve hangi ekranda açıldığından bağımsız olarak tam ekran kaplar. Ekran başına
  bir Modal olsaydı sekme geçişinde takılı kalan kopyalar doğardı.
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
  /* TUR ÇIPASI: 'eslesmeler' ve 'dersler' adımları eskiden Akış başlığındaki iki
     ikona ışık tutuyordu. O ikonlar kalktı (hedefleri çekmeceye taşındı), çıpa da
     buraya geldi. İki adım da aynı öğeyi gösteriyor ve bu doğru: ikisinin de yolu
     menüden geçiyor. */
  const cipa = useTurCipasi('menu')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Menüyü aç"
      onPress={ac}
      className="-ml-2 h-11 w-11 items-center justify-center rounded-lg active:bg-slate-100"
      {...cipa}
    >
      <MenuIkonu renk={slate[700]} boy={24} />
    </Pressable>
  )
}
