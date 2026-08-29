import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ILETISIM_EPOSTA } from '../lib/yasalMetinler'
import { Logo } from './Logo'
import { Notice } from './ui'

/*
  UZUN METİN SAYFALARININ ORTAK KABUĞU — web'deki pages/MetinSayfasi.jsx'in portu.

  ⚠️ OTURUM GEREKTİRMEZ, GEREKTİRMEMELİ. İki sebep:
  • Kayıt formundaki onay kutusu bu metinlere bağlanıyor; henüz hesabı olmayan biri
    okuyamıyorsa "okudum ve kabul ediyorum" kutusunu işaretlemesi anlamsız olur.
  • Mağaza incelemesi gizlilik metnine erişim ister (Apple App Review 5.1.1 / Google
    Play Data safety). Uygulama içinde giriş duvarının arkasında kalan bir gizlilik
    metni bu şartı karşılamaz.
  Bunun teknik karşılığı app/_layout.jsx'te: bu rotalar Stack.Protected bloklarının
  DIŞINDA kalır (dosya keşfiyle gelen rotalar guard'lardan etkilenmez).

  WEB'DEN SAPMALAR:
  • "Girişe dön" bağlantısı → GERİ DÜĞMESİ. Web'de bu sayfalara tek yol giriş ekranıydı;
    mobilde hem oturumsuz (kayıt formu) hem oturumlu (profil kısayolu) gelinebiliyor —
    sabit bir hedefe göndermek, gelen kullanıcının yarısını yanlış yere atardı. Yığında
    geçmiş yoksa (derin bağlantı, mağaza incelemesi) köke düşülür; kök zaten oturum
    durumuna göre doğru ekranı seçer.
  • Okunur satır uzunluğu için içerik 640px'te sabitlenip ortalanır. Telefonda etkisi
    yok; geniş Android tabletlerde satır 90+ karaktere uzayıp okunmaz hâle geliyordu.
  • Cümle içi bağlantılar satır dışına alındı (MetinBaglantisi): 15px'lik bir metnin
    içindeki bağlantı 44px dokunma hedefi taşıyamaz. Bkz. bileşenin kendi yorumu.
*/
export function MetinSayfasi({ baslik, ozet, sonGuncelleme, taslak = true, children }) {
  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <MetinUstSeridi />

      <ScrollView contentContainerClassName="px-5 pb-16 pt-6">
        <View className="w-full max-w-[640px] self-center">
          <Text accessibilityRole="header" className="text-2xl font-bold tracking-tight text-slate-900">
            {baslik}
          </Text>

          {ozet ? (
            <Text className="mt-3 text-[15px] leading-relaxed text-slate-600">{ozet}</Text>
          ) : null}

          {sonGuncelleme ? (
            <Text className="mt-4 text-xs text-slate-500">Son güncelleme: {sonGuncelleme}</Text>
          ) : null}

          {/*
            ⚠️ BU UYARI KALDIRILMADAN YAYINA ÇIKILMAMALI ya da metinler bir hukukçuya
            okutulup uyarı bilinçli olarak kaldırılmalı. Metinler ürünün KODUNU okuyarak
            yazıldı — hangi verinin gerçekten toplandığı, nerede saklandığı ve ne kadar
            durduğu doğru. Ama "doğru" ile "yeterli" aynı şey değil: KVKK'nın biçimsel
            gerekleri (veri sorumlusu kimlik bilgileri, VERBİS kaydı, açık rıza
            metinlerinin ayrıştırılması) hukuk işidir ve burada üretilemez.

            taslak={false} YALNIZCA yasal olmayan sayfalar (Hakkımızda) içindir; bir
            yasal metinde kapatmak, uyarıyı gizlemek olur.
          */}
          {taslak && (
            <View className="mt-6">
              <Notice tone="warning">
                <Text className="font-semibold">Taslak metin. </Text>
                Bu metin, platformun gerçekte ne yaptığı incelenerek hazırlanmış bir taslaktır
                ve yayına alınmadan önce bir hukukçu tarafından gözden geçirilmelidir.
              </Notice>
            </View>
          )}

          <View className="mt-8 gap-8">{children}</View>

          <View className="mt-12 border-t border-slate-200 pt-4">
            <Text className="text-sm text-slate-600">Sorular ve talepler için:</Text>
            <MetinBaglantisi
              etiket={ILETISIM_EPOSTA}
              onPress={() => Linking.openURL(`mailto:${ILETISIM_EPOSTA}`)}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

/**
 * Üst şerit: geri + marka kilidi. Yasal metinler ve Hakkımızda aynı şeridi paylaşır —
 * ikisi de tab çubuğunun dışında, kendi başına duran yığın ekranları.
 */
export function MetinUstSeridi() {
  const router = useRouter()

  return (
    <View className="flex-row items-center gap-2 border-b border-slate-200 bg-white px-2 py-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Geri"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        className="h-11 w-11 items-center justify-center rounded-lg active:bg-slate-100"
      >
        <Text className="text-xl text-slate-500">←</Text>
      </Pressable>
      <Logo boyut="sm" />
    </View>
  )
}

/** Numaralı bölüm başlığı + gövde. Metinlere sonradan atıf yapılabilmeli ("§4"). */
export function Bolum({ no, baslik, children }) {
  return (
    <View>
      <Text accessibilityRole="header" className="text-base font-semibold text-slate-900">
        <Text className="text-slate-400">{no}.</Text> {baslik}
      </Text>
      <View className="mt-3 gap-3">{children}</View>
    </View>
  )
}

/** Gövde paragrafı. RN'de çıplak metin olamaz; web'deki <p>'nin karşılığı. */
export function Paragraf({ children }) {
  return <Text className="text-[15px] leading-relaxed text-slate-700">{children}</Text>
}

/** Paragraf içi vurgu (<strong>). Renk ve punto ÜST metinden miras kalır: kendi rengini
    dayatsaydı, madde içinde ve paragraf içinde farklı tonlarda görünürdü. */
export function Kalin({ children }) {
  return <Text className="font-semibold">{children}</Text>
}

/** Madde listesi kabı. */
export function Maddeler({ children }) {
  return <View className="gap-2">{children}</View>
}

/**
 * Tek madde. RN'de list-style yok — işaret elle çiziliyor ve METİN DEĞİL View:
 * ekran okuyucu her maddenin başında "madde işareti" diye bir şey okumasın.
 * mt-[9px] işareti ilk satırın optik ortasına oturtur (15px punto, 1.6 satır yüksekliği).
 */
export function Madde({ children }) {
  return (
    <View className="flex-row gap-2.5">
      <View className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
      <Text className="flex-1 text-[15px] leading-relaxed text-slate-700">{children}</Text>
    </View>
  )
}

/**
 * Metin içinden çıkarılmış bağlantı.
 *
 * WEB'DE CÜMLE İÇİNDEYDİ ("… talebini iletisim@dersmate.com adresine ilettiğinde…").
 * Mobilde cümle içi bağlantı iki kuralı birden çiğniyor: 15px'lik bir kelime 44px
 * dokunma hedefi taşıyamaz ve hitSlop komşu satırlarla çakışır. Bağlantı satır dışına
 * alındı — cümle bağlantının ne yaptığını anlatmaya devam ediyor, dokunulacak şey ise
 * tam boy bir satır.
 */
export function MetinBaglantisi({ etiket, onPress }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      /* self-start: RN'de esnek çocuk varsayılan olarak satırı doldurur; bağlantı tüm
         satır genişliğinde bir hedefe dönüşünce, etiketin sağındaki boşluğa dokunmak
         da e-posta açardı. Yükseklik 44'te kalır, genişlik etiketi sarar. */
      className="min-h-[44px] flex-row items-center gap-1.5 self-start active:opacity-60"
    >
      <Text className="text-[15px] font-medium text-brand-700 underline">{etiket}</Text>
      {/* Ok dekoratif: etiketin kendisi zaten hedefi söylüyor. */}
      <Text importantForAccessibility="no" accessibilityElementsHidden className="text-brand-700">
        →
      </Text>
    </Pressable>
  )
}
