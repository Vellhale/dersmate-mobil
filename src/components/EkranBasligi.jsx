import { Text, View } from 'react-native'
import { Logo } from './Logo'

/*
  EKRAN BAŞLIĞI — Instagram düzeninde her sekmenin üst şeridi.

  Akış'ta marka kilidi (Instagram'ın kendi ana sayfası gibi), diğer sekmelerde sayfa
  adı. Web'deki üst barın karşılığı; seviye rozeti ve bildirim işaretleri ADIM 3'te
  `sag` yuvasına gelecek.
*/
/*
  `sol` YUVASI (2026-09-23): çekmece menüsünün hamburger düğmesi için açıldı. Web'de
  bar üç bölgeli (solda hamburger, ortada logo, sağda rozet+çıkış — Layout.jsx:302-400);
  mobil başlık iki bölgeliydi ve solda hamburgere yer yoktu.

  ⚠️ YÜKSEKLİK SABİTLENDİ (min-h-[56px]): dokunulabilir her öğe min 44px (CLAUDE.md) ve
  44px'lik bir düğme eski `py-3` ile barı 68px'e çıkarıyordu. Sabit yükseklik hem
  düğmeyi sığdırıyor hem de `sol` olan ve olmayan ekranlarda bar aynı kalıyor —
  sekmeler arası geçişte başlığın zıplamaması için bu şart.

  Başlık `flex-1` ve tek satır: uzun başlık `sag` yuvasını ezmesin, kırpılsın.
*/
export function EkranBasligi({ baslik, sol, sag }) {
  return (
    <View className="min-h-[56px] flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
      <View className="min-w-0 flex-1 flex-row items-center gap-1">
        {sol ?? null}
        {baslik ? (
          <Text numberOfLines={1} className="min-w-0 flex-1 text-xl font-bold tracking-tight text-slate-900">
            {baslik}
          </Text>
        ) : (
          <Logo boyut="lg" />
        )}
      </View>
      {sag ?? null}
    </View>
  )
}
