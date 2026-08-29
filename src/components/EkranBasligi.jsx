import { Text, View } from 'react-native'
import { Logo } from './Logo'

/*
  EKRAN BAŞLIĞI — Instagram düzeninde her sekmenin üst şeridi.

  Akış'ta marka kilidi (Instagram'ın kendi ana sayfası gibi), diğer sekmelerde sayfa
  adı. Web'deki üst barın karşılığı; seviye rozeti ve bildirim işaretleri ADIM 3'te
  `sag` yuvasına gelecek.
*/
export function EkranBasligi({ baslik, sag }) {
  return (
    <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      {baslik ? (
        <Text className="text-xl font-bold tracking-tight text-slate-900">{baslik}</Text>
      ) : (
        <Logo boyut="lg" />
      )}
      {sag ?? null}
    </View>
  )
}
