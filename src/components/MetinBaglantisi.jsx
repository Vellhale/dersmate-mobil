import { Pressable, Text } from 'react-native'

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
