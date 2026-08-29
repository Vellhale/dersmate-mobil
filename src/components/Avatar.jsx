import { useState } from 'react'
import { Image, Text, View } from 'react-native'
import { api } from '../lib/api'

/**
 * Profil fotoğrafı — web'deki components/Avatar.jsx'in portu. Yoksa baş harflerden
 * bir yer tutucu üretir.
 *
 * Yer tutucu bilinçli olarak RENKLİ ve kişiye özel: kullanıcı kimliğinden türeyen sabit
 * bir renk seçilir, böylece fotoğrafı olmayan kişiler de listede birbirinden ayırt edilir.
 * Tek tip gri bir daire, sohbet ve akış listelerini okunmaz hâle getirirdi.
 *
 * WEB'DEN FARK: object URL + önbellek havuzu yerine <Image source={{uri, headers}}> —
 * RN Image kendi disk önbelleğini taşıyor (bkz. api.avatarImageSource). Avatar yoksa
 * sunucu 404 döner, onError baş harf yer tutucusuna düşürür. Büyütme katmanı
 * (lightbox) ADIM 3'te profil başlığıyla birlikte gelecek — akış/sohbet listelerinde
 * zaten bilinçli olarak kapalıydı (tıklama kişiye gitmeli, fotoğrafa değil).
 */

const RENKLER = ['bg-brand-600', 'bg-sky-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-violet-600']

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
*/
const BOYUTLAR = {
  sm: { kutu: 'h-8 w-8 rounded-lg', yazi: 'text-xs', px: 32 },
  md: { kutu: 'h-12 w-12 rounded-xl', yazi: 'text-sm', px: 48 },
  lg: { kutu: 'h-20 w-20 rounded-2xl', yazi: 'text-2xl', px: 80 },
  xl: { kutu: 'h-28 w-28 rounded-full', yazi: 'text-4xl', px: 112 },
}

export function Avatar({ userId, name, size = 'md', className = '' }) {
  const [dustu, setDustu] = useState(false)
  const b = BOYUTLAR[size] ?? BOYUTLAR.md

  if (!userId || dustu) {
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
      source={api.avatarImageSource(userId)}
      accessibilityLabel={name ?? 'Profil fotoğrafı'}
      onError={() => setDustu(true)}
      className={`${b.kutu} shrink-0 bg-slate-100 ${className}`}
      resizeMode="cover"
    />
  )
}
