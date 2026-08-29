import { Text, View } from 'react-native'
import { EN_YUKSEK_SEVIYE, seviyeEtiketi, seviyeHesapla, seviyeIlerlemeMetni } from '../lib/seviye'

/*
  SEVİYE ROZETİ — web'deki components/SeviyeRozeti.jsx'in portu.

  İki parçalı yapı korunuyor: madalyon içinde rakam + yanında "Seviye" kelimesi.
  İki ton da web'den:
    koyu → koyu yüzeyler: dolu brand-300 zemin (slate-900 üstünde 8.19:1)
    acik → beyaz kartlar: brand-50 zemin + brand-200 halka — kişinin adı başlıktır,
           rozet ona iliştirilen bir niteliktir; açık ton başlığı bastırmaz.

  WEB'DEN SADELEŞEN KISIM: piksel altı optik düzeltmeler (mürekkep merkezleme,
  rakam başına yatay itme) TAŞINMADI. Onlar Segoe UI'ın 11-13px'teki glif
  çizimlerine göre ölçülmüştü; mobilde yazı tipi platforma göre değişir (SF/Roboto)
  ve o ölçümler geçersizdir. RN'in kutu merkezlemesi burada yeterli — yeni bir
  platformda yeni ölçüm yapılmadan düzeltme uygulanmaz (web'deki dersin kendisi bu).

  İlerleme bilgisi web'de tooltip'teydi; RN'de hover yok — accessibilityLabel'da
  aynı cümle okunuyor, görünen rozet yalın kalıyor.
*/

const TONLAR = {
  koyu: {
    kabuk: 'bg-brand-300',
    kabukYazi: 'text-slate-900',
    madalyon: 'bg-slate-900',
    madalyonYazi: 'text-brand-300',
  },
  acik: {
    kabuk: 'bg-brand-50 border border-brand-200',
    kabukYazi: 'text-brand-800',
    madalyon: 'bg-brand-600',
    madalyonYazi: 'text-white',
  },
}

const BOYUTLAR = {
  md: { kabuk: 'gap-1.5 py-1 pl-1 pr-2.5', madalyon: 'h-6 w-6', rakam: 13, etiket: 'text-xs' },
  sm: { kabuk: 'gap-1 py-0.5 pl-0.5 pr-2', madalyon: 'h-[18px] w-[18px]', rakam: 11, etiket: 'text-[11px]' },
}

/**
 * @param kaynak  `level` (+ opsiyonel nextLevelAt/totalEarnedCredits) taşıyan nesne —
 *   cüzdan ya da profil yanıtı; kart listelerinde `{ level: kisi.level }` yeterli.
 * @param etiketli  false ise "Seviye" kelimesi düşer, madalyon kalır (dar kart satırı) —
 *   web'deki "dar ekranda kelime düşer, kimlik kalır" davranışının açık parametresi.
 */
export function SeviyeRozeti({ kaynak, boyut = 'md', ton = 'koyu', etiketli = true }) {
  const seviye = seviyeHesapla(kaynak)
  const t = TONLAR[ton] ?? TONLAR.koyu
  const b = BOYUTLAR[boyut] ?? BOYUTLAR.md

  return (
    <View
      // accessible ŞART: View varsayılanda erişilebilirlik düğümü DEĞİLDİR — bayraksız
      // accessibilityLabel hiç okunmaz (bu üç bileşende de aynı hata vardı).
      accessible
      accessibilityLabel={`${seviyeEtiketi(seviye)} (${EN_YUKSEK_SEVIYE} üzerinden) — ${seviyeIlerlemeMetni(kaynak)}`}
      className={`flex-row items-center self-start rounded-full ${t.kabuk} ${b.kabuk}`}
    >
      <View className={`items-center justify-center rounded-full ${t.madalyon} ${b.madalyon}`}>
        <Text
          className={`font-bold ${t.madalyonYazi}`}
          style={{ fontSize: b.rakam, lineHeight: b.rakam + 2, fontVariant: ['tabular-nums'] }}
        >
          {seviye}
        </Text>
      </View>
      {etiketli && <Text className={`font-semibold ${t.kabukYazi} ${b.etiket}`}>Seviye</Text>}
    </View>
  )
}
