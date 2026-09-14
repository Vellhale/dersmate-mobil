import { useEffect, useState } from 'react'
import { Image, Text, View } from 'react-native'
import { api } from '../lib/api'
import { useYetkiliGorsel } from './YetkiliGorsel'

/**
 * Profil fotoğrafı — web'deki components/Avatar.jsx'in portu. Yoksa baş harflerden
 * bir yer tutucu üretir.
 *
 * Yer tutucu bilinçli olarak RENKLİ ve kişiye özel: kullanıcı kimliğinden türeyen sabit
 * bir renk seçilir, böylece fotoğrafı olmayan kişiler de listede birbirinden ayırt edilir.
 * Tek tip gri bir daire, sohbet ve akış listelerini okunmaz hâle getirirdi.
 *
 * Ayrım gökkuşağıyla değil marka mavisi + slate basamaklarıyla: sky/emerald/amber/rose/violet
 * marka paletinin dışındaydı ve durum renkleriyle karışıyordu (kullanıcı kararı, A düzeni).
 * Beşi de beyaz baş harfle en az 4.5:1 (brand-600 4.90, slate-600 7.58).
 *
 * WEB'DEN FARK: object URL + önbellek havuzu yerine <Image source={{uri, headers}}> —
 * RN Image kendi disk önbelleğini taşıyor (bkz. api.avatarImageSource). Avatar yoksa
 * sunucu 404 döner, onError baş harf yer tutucusuna düşürür. Büyütme katmanı
 * (lightbox) ADIM 3'te profil başlığıyla birlikte gelecek — akış/sohbet listelerinde
 * zaten bilinçli olarak kapalıydı (tıklama kişiye gitmeli, fotoğrafa değil).
 */

const RENKLER = ['bg-brand-600', 'bg-brand-700', 'bg-brand-800', 'bg-slate-600', 'bg-slate-700']

function renkSec(userId = '') {
  let sum = 0
  for (let i = 0; i < userId.length; i++) sum += userId.charCodeAt(i)
  return RENKLER[sum % RENKLER.length]
}

function basHarfler(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/*
  Küçük boyutlar YUVARLATILMIŞ KARE, xl TAM DAİRE — web kararı aynen: liste satırında
  kare avatar hizalanması kolay bir blok; profil başlığında daire daha çok yüz gösterir.

  YARIÇAP SINIFI WEB'DEN BİR BASAMAK AŞAĞIDA (sm md, md lg; web sm lg, md xl). Mobil köşe
  ölçeği px ve bir basamak yumuşak (tailwind.config.js) ama kutu boyu hâlâ rem: cihazda
  sm 28dp. Web sınıfıyla sm 12/28 (düz kenar 4dp) daireden ayırt edilmiyordu ve md mesaj
  satırının (rounded-lg) içinde satırdan daha yuvarlak duruyordu. Bu tabloyla üç boyut da
  cihazda ~%29 (eskiden %25/%25/%20): biraz yumuşak, şekil tek.
*/
const BOYUTLAR = {
  sm: { kutu: 'h-8 w-8 rounded-md', yazi: 'text-xs', px: 32 },
  md: { kutu: 'h-12 w-12 rounded-lg', yazi: 'text-sm', px: 48 },
  lg: { kutu: 'h-20 w-20 rounded-2xl', yazi: 'text-2xl', px: 80 },
  xl: { kutu: 'h-28 w-28 rounded-full', yazi: 'text-4xl', px: 112 },
}

export function Avatar({ userId, name, size = 'md', className = '' }) {
  const [dustu, setDustu] = useState(false)
  const b = BOYUTLAR[size] ?? BOYUTLAR.md
  const kaynak = userId ? api.avatarImageSource(userId) : null

  /*
    Görsel BAŞLIKLI İSTEKLE indiriliyor, Image'a doğrudan adres verilmiyor: RN Image
    Authorization başlığını göndermiyor ve avatar istekleri sessizce 401 alıyordu
    (bkz. YetkiliGorsel). Yükleme bitene kadar baş harfler görünür.
  */
  const { uri: gorselUri, hata: gorselHatasi } = useYetkiliGorsel(kaynak)

  /*
    DÜŞMÜŞ DURUMU KAYNAK DEĞİŞİNCE SIFIRLA.

    Eskiden `dustu` bir kez true olduğunda o bileşen örneği KALICI olarak baş harflere
    düşüyordu. Fotoğrafı olmayan kullanıcıda uç 404 döner ve onError hemen çalışır; o
    andan sonra kullanıcı fotoğraf yüklese ve URI değişse bile Image bir daha hiç
    denenmezdi. Ekran yeniden kurulduğunda düzeliyordu, ama kurulmayan her yerde
    (liste satırları, başlıklar) fotoğraf hiç görünmüyordu.

    Bağımlılık URI: yalnızca gösterilecek görsel değiştiğinde yeniden denenir, her
    render'da değil.
  */
  useEffect(() => {
    setDustu(false)
  }, [gorselUri])

  if (!userId || dustu || gorselHatasi || !gorselUri) {
    return (
      <View
        accessible
        accessibilityLabel={name}
        className={`${b.kutu} ${renkSec(userId)} shrink-0 items-center justify-center ${className}`}
      >
        <Text className={`${b.yazi} font-bold text-white`}>{basHarfler(name)}</Text>
      </View>
    )
  }

  return (
    <Image
      source={{ uri: gorselUri }}
      accessibilityLabel={name ?? 'Profil fotoğrafı'}
      onError={() => setDustu(true)}
      className={`${b.kutu} shrink-0 bg-slate-100 ${className}`}
      resizeMode="cover"
    />
  )
}
