import { Pressable, Text, View } from 'react-native'
import { slate } from '../lib/theme'
import { DisBaglantiIkonu } from './Ikonlar'

/**
 * Metin içinden çıkarılmış bağlantı.
 *
 * WEB'DE CÜMLE İÇİNDEYDİ ("… talebini iletisim@dersmate.com adresine ilettiğinde…").
 * Mobilde cümle içi bağlantı iki kuralı birden çiğniyor: 15px'lik bir kelime 44px
 * dokunma hedefi taşıyamaz ve hitSlop komşu satırlarla çakışır. Bağlantı satır dışına
 * alındı — cümle bağlantının ne yaptığını anlatmaya devam ediyor, dokunulacak şey ise
 * tam boy bir satır.
 *
 * ⚠️ AYRI DOSYADA OLMASININ SEBEBİ (2026-09-21): eskiden MetinSayfasi.jsx içindeydi.
 * Künye bileşeni (Kunye.jsx) de bu bağlantıyı kullanıyor ve MetinSayfasi künyeyi
 * kendi altbilgisinde çiziyor — yani ikisi birbirini içe aktarıyordu. Döngü Metro'da
 * çalışıyordu (iki taraf da hoist edilen `function` bildirimi ve erişim render anında)
 * ama kırılgandı: taraflardan biri `const` bir bileşene dönseydi ya da modül gövdesinde
 * kullanılsaydı sessizce `undefined` olurdu. Bağlantı bir YAPRAK ilkel; künye ve sayfa
 * kabuğu onu kullanır, o kimseyi kullanmaz. Döngü böyle kırıldı.
 *
 * MetinSayfasi bunu YENİDEN DIŞA AKTARIYOR: sayfalar `MetinSayfasi`'ndan içe aktarmaya
 * devam ediyor, çağrı yerlerine dokunulmadı.
 */
export function MetinBaglantisi({ etiket, onPress, className = '' }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      /* self-start: RN'de esnek çocuk varsayılan olarak satırı doldurur; bağlantı tüm
         satır genişliğinde bir hedefe dönüşünce, etiketin sağındaki boşluğa dokunmak
         da e-posta açardı. Yükseklik 44'te kalır, genişlik etiketi sarar.

         className SONA geliyor: ortalı bir altbilgide (Profil) çağıran `self-center`
         geçip hizayı ezebilsin diye. RN'de alignSelf'i ÇOCUK belirler — ebeveynin
         items-center'ı buradaki self-start'ı yenemez, o yüzden ezme imkânı gerekli. */
      className={`min-h-[44px] flex-row items-center gap-1.5 self-start active:opacity-60 ${className}`}
    >
      <Text className="text-[15px] font-medium text-brand-700 underline">{etiket}</Text>
      {/* Ok dekoratif: etiketin kendisi zaten hedefi söylüyor. */}
      <Text importantForAccessibility="no" accessibilityElementsHidden className="text-brand-700">
        →
      </Text>
    </Pressable>
  )
}

/**
 * ALT BİLGİ BAĞLANTISI — alt bilginin (AltBilgi) ve künye satırının (KunyeSatiri) tek
 * bağlantı biçimi (2026-09-26).
 *
 * MetinBaglantisi'ndan AYRI bir görünüm, çünkü işi ayrı: o, uzun metnin içinden çıkarılmış
 * ve okurun asıl hedefi olan bağlantı (15px, mavi, altı çizili, oklu). Alt bilgi ise sayfanın
 * dibindeki ikincil gezinme; mavi ve altı çizili olsaydı ekranın en dikkat çeken satırı
 * künye olurdu. Burada slate-600, 13px, altı çizgisiz; bağlantı olduğunu rolü ve konumu
 * söylüyor.
 *
 * ⚠️ BU DOSYADA DURMASININ SEBEBİ yukarıdaki döngü dersiyle aynı: Kunye.jsx bunu kullanıyor
 * ve AltBilgi.jsx de Kunye'yi içe aktarıyor. AltBilgi.jsx'e konsaydı ikisi birbirini içe
 * aktarırdı. Yaprak ilkel yaprak modülde kalır.
 *
 * Boyutlar BİLEREK px: NativeWind cihazda rem'i 14 sayıyor, `text-xs` telefonda 10.5dp
 * çıkıyordu. Alt bilgi web önizlemesinde ve cihazda aynı ölçüde görünmeli.
 *
 * min-w-[44px]: "Gizlilik" gibi kısa bir etiket bile 44×44 dokunma hedefi taşır.
 *
 * @param rol  'link' (sayfaya gider) ya da 'button' (alt sayfa açar: Veri tercihleri).
 * @param dis  Uygulamadan çıkıp tarayıcıda açılıyorsa true: yanına 12px çapraz ok çizilir
 *             ve ekran okuyucuya "Tarayıcıda açılır" ipucu verilir. Ok süstür, gizlenir.
 */
export function AltBilgiBaglantisi({
  etiket,
  onPress,
  rol = 'link',
  dis = false,
  accessibilityLabel,
}) {
  return (
    <Pressable
      accessibilityRole={rol}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={dis ? 'Tarayıcıda açılır' : undefined}
      onPress={onPress}
      className="min-h-[44px] min-w-[44px] flex-row items-center justify-center gap-1 px-1 active:opacity-60"
    >
      <Text className="text-[13px] font-medium text-slate-600">{etiket}</Text>
      {dis ? (
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <DisBaglantiIkonu boy={12} renk={slate[400]} />
        </View>
      ) : null}
    </Pressable>
  )
}
