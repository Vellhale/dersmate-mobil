import { Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { beyaz, brand, ink } from '../lib/theme'

/*
  Marka kilidi: iki nokta (SVG) + kelime markası (Text) — web'deki components/Logo.jsx'in
  RN portu. Geometri ve renk kararları web'den birebir taşındı (web #26, 2026-09-07).

  ÜÇÜNCÜ (VE SON) KURGU. Önceki iki denemenin ikisi de yayın rengini ıskaladı:
  • 1. deneme: daireler üst üste, ayrım zemin rengiyle çizilmiş yayla — ama yay TEK bir
    renge sabitlenmişti; koyu zeminde görünmez kalıp iki daireyi tek kütleye çeviriyordu.
  • 2. deneme (bu dosyanın eski hâli): daireler ayrık, araya VURGU renginde bir köprü
    yayı, üstelik dairelerin ARKASINDA. Yay birinci daireyle kaynaşıyor, sağ ucu
    dairelerin arasından kuyruk gibi taşıyordu — 7–11px'te çizim değil, leke.
  Şimdi: daireler yeniden üst üste biniyor, ayrım yine zemin rengiyle — AMA yayın rengi
  VARYANTA GÖRE arkasındaki zemin (`z.yay`) ve yay SON çocuk, dairelerin üstüne çiziliyor.

  ⛔ `yay`'ı vurgu tonuna çevirme, Path'i Circle'lardan önceye taşıma. İkisi de işaretin
  okunurluğunu YOK EDİYOR ve ikisi de "sadeleştirme" gibi görünüyor. react-native-svg
  çocukları yazıldığı sırayla boyar; sıra bozulursa daireler yayı örter, hata da vermez.

  Oranlar LogoMark ile aynı aileden: r=9, merkezler arası 17.6 (≈1.96r), yay kalınlığı
  2.6 (≈0.29r), tepe eksenin 5 birim üstünde (≈0.56r). viewBox 37.6×20, her kenarda 1
  birim pay — sıfır payda kenar yumuşatması son piksel şeridini kutunun dışına taşırıyor.
  Yayın tepesi iki dairenin de DIŞINDA kalır: orada zemin rengi zeminin üstüne düşer ve
  görünmez. Yay zeminden farklıysa iki dairenin arasında ince bir çizgi belirir.

  Kelime markası gerçek metin (SVG değil): RN'de de metin rasterizasyonu sistemden
  gelir, keskin çizilir. Ağırlık 600 — 700 bu puntolarda gövdeleri şişiriyordu
  (web'deki 2026-08-25 kararı).

  ÜÇ ZEMİN, ÜÇ VURGU TONU (web'deki WCAG ölçümleriyle):
    acik  → beyaz yüzeyler (EkranBasligi, MetinUstSeridi): nokta brand-500, yay beyaz
    marka → AuthKabuk'un brand-600 gradyanı: nokta brand-100 (3.86:1), yay brand-600
    gece  → slate-900 zemin: nokta brand-400 (6.57:1 — beyazdan 2.72:1 ayrışır), yay slate-900
*/

/* Renkler theme.js'ten OKUNUYOR, hex elle yazılmıyor. Web bu senkronu bir e2e testiyle
   zorluyor (kaynak-sabitleri.spec.js); mobilde import aynı işi kendiliğinden görüyor. */
const ACCENT = brand[500] // açık zeminlerde marka tonu
const BG = brand[50] // LogoMark'ın zemini — web favicon'u ile ortak
const ACCENT_MARKA = brand[100] // AuthKabuk gradyanı üstünde
const ACCENT_GECE = brand[400] // slate-900 üstünde
const INK = ink // slate-900
const BEYAZ = beyaz

/* Bağ yayının rengi = ARKASINDAKİ ZEMİN. `marka` varyantının zemini AuthKabuk'un
   LinearGradient'i, ilk durağı da brand[600] — ikisi aynı kaynaktan okuduğu için palet
   değişirse birlikte kayarlar.
   ⚠️ Gradyan tek renk değil: logonun altındaki şeridi düz brand-600'de tutan şey
   AuthKabuk'taki `locations`. O prop kalkarsa logonun altı cihaza göre #0072AC–#0070A9
   olur, yay zeminden ~1.1:1 ayrışır ve daireler arasında çizgi belirir. */
const ZEMIN_MARKA = brand[600]

const ZEMINLER = {
  /** Beyaz yüzeyler — EkranBasligi ve MetinUstSeridi (ikisi de bg-white). */
  acik: { nokta: ACCENT, ikinciNokta: INK, yay: BEYAZ, ders: INK, mate: ACCENT },
  /** AuthKabuk'un brand-600 → brand-700 → slate-900 gradyanlı üst paneli. */
  marka: { nokta: ACCENT_MARKA, ikinciNokta: BEYAZ, yay: ZEMIN_MARKA, ders: BEYAZ, mate: ACCENT_MARKA },
  /** slate-900 koyu yüzeyler (web'deki üst barın karşılığı; şu an çağıran ekran yok). */
  gece: { nokta: ACCENT_GECE, ikinciNokta: BEYAZ, yay: INK, ders: BEYAZ, mate: ACCENT_GECE },
}

/*
  Boyutlar: yazı puntosu + işaret yüksekliği birlikte ölçeklenir (web kararı: metin ile
  işaretin oranı sabit kalmalı). İşaret metnin BÜYÜK HARF yüksekliğine yakın: punto × 0.7.

  ⛔ İŞARETİ 12'NİN ALTINA İNDİRME — web'de ölçüldü, tahmin değil. Eski 7/8/9/11 değerleri
  yay dairelerin ARKASINDA saklandığı sürece sorun değildi: görünen iki dolu daireydi.
  Yeni kurguda yay işaretin İÇİNDEN geçiyor (kalınlık yüksekliğin %13'ü). 1× piksel
  oranında 8px'te yay 1px'e düşüp kopuk lekelere dönüyor, 11px sınırda, 12px okunur,
  14px+ net. Telefonların çoğu 2×–3.5× ama 1.5× (hdpi) Android hâlâ var; taban web'le aynı.

  İşaret genişliği viewBox'ın 37.6:20 oranından türetilir — viewBox değişirse formül de
  değişmeli, yoksa işaret kutuda ortalanıp metinle arasına sessiz boşluk girer. İşaret her
  boyutta satır yüksekliğinin (yazi × 1.05) altında kalır, yani satırın boyu değişmez.
*/
const BOYUTLAR = {
  sm: { yazi: 15, isaret: 12, bosluk: 6 }, // taban
  md: { yazi: 17, isaret: 12, bosluk: 8 },
  lg: { yazi: 20, isaret: 14, bosluk: 8 },
  xl: { yazi: 24, isaret: 17, bosluk: 10 },
}

/**
 * @param boyut  sm | md | lg | xl — metin ve işaret birlikte ölçeklenir.
 * @param zemin  acik | marka | gece — üstteki kontrast tablosu.
 */
export function Logo({ boyut = 'md', zemin = 'acik' }) {
  const z = ZEMINLER[zemin] ?? ZEMINLER.acik
  const b = BOYUTLAR[boyut] ?? BOYUTLAR.md
  const isaretGenislik = (b.isaret * 37.6) / 20

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="dersmate"
      style={{ flexDirection: 'row', alignItems: 'center', gap: b.bosluk }}
    >
      {/* Boyama sırası anlamlı: yay SON çocuk, dairelerin üstüne çizilir. */}
      <Svg viewBox="0 0 37.6 20" width={isaretGenislik} height={b.isaret}>
        <Circle cx="10" cy="10" r="9" fill={z.nokta} />
        <Circle cx="27.6" cy="10" r="9" fill={z.ikinciNokta} />
        <Path d="M 10 10 Q 18.8 0, 27.6 10" stroke={z.yay} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      </Svg>

      <Text
        style={{ fontSize: b.yazi, fontWeight: '600', letterSpacing: -0.3, lineHeight: b.yazi * 1.05 }}
      >
        <Text style={{ color: z.ders }}>ders</Text>
        <Text style={{ color: z.mate }}>mate</Text>
      </Text>
    </View>
  )
}

/**
 * Yazısız kare rozet — dar alanlar için. Geometrisi web'deki favicon.svg ve LogoMark ile
 * BİREBİR aynı (web #26); oranlar yukarıdaki işaretle aynı aileden. cy 34 → 32: işaret
 * 64'lük kutuda 2 birim aşağıdaydı. Dairelerdeki opacity="0.95" kaldırıldı: koyu düğüm
 * zemine karışıp soluyordu. Şu an çağıran ekran yok — bir hata derlemede görünmez.
 */
export function LogoMark({ boy = 32 }) {
  return (
    <Svg viewBox="0 0 64 64" width={boy} height={boy} accessibilityLabel="dersmate">
      <Rect width="64" height="64" fill={BG} rx="14" />
      <Circle cx="21.2" cy="32" r="11" fill={ACCENT} />
      <Circle cx="42.8" cy="32" r="11" fill={INK} />
      <Path d="M 21.2 32 Q 32 19.8, 42.8 32" stroke={BG} strokeWidth={3.2} fill="none" strokeLinecap="round" />
    </Svg>
  )
}
