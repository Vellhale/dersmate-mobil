import { Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

/*
  Marka kilidi: iki nokta (SVG) + kelime markası (Text) — web'deki components/Logo.jsx'in
  RN portu. Geometri ve renk kararları web'den birebir taşındı:

  • viewBox 42×20, her kenarda 1 birim nefes payı (daireler kutuya değmez — kenar
    yumuşatması kırpılmasın).
  • Bağ yayı GERÇEK renkte ve dairelerin ARKASINDA çizilir: uçları noktaların altında
    kaybolur, görünen kısım iki akranı bağlayan köprü.
  • Kelime markası gerçek metin (SVG değil): RN'de de metin rasterizasyonu sistemden
    gelir, keskin çizilir. font ağırlığı 600 — 700 bu puntolarda gövdeleri şişiriyordu
    (web'deki 2026-08-25 kararı).

  ÜÇ ZEMİN, ÜÇ VURGU TONU (web'deki WCAG ölçümleriyle):
    acik  → beyaz/açık gri yüzeyler: nokta brand-500, "mate" brand-500
    marka → brand-600 gradyanlı koyu panel: nokta brand-100 (3.86:1), "mate" brand-100
    gece  → slate-900 zemin: nokta brand-400 (6.57:1 — beyazdan 2.72:1 ayrışır), "mate" brand-400
*/

const ACCENT = '#0088CC' // brand-500 — açık zeminlerde marka tonu
const BG = '#E6F4FB' // brand-50 — LogoMark'ın zemini
const ACCENT_MARKA = '#CCE9F7' // brand-100
const ACCENT_GECE = '#33A7DF' // brand-400
const INK = '#0F172A' // slate-900
const BEYAZ = '#FFFFFF'

const ZEMINLER = {
  /** Beyaz / açık gri yüzeyler. */
  acik: { nokta: ACCENT, ikinciNokta: INK, ders: INK, mate: ACCENT },
  /** Giriş ekranının brand-600 gradyanlı koyu paneli. */
  marka: { nokta: ACCENT_MARKA, ikinciNokta: BEYAZ, ders: BEYAZ, mate: ACCENT_MARKA },
  /** slate-900 koyu yüzeyler (splash). */
  gece: { nokta: ACCENT_GECE, ikinciNokta: BEYAZ, ders: BEYAZ, mate: ACCENT_GECE },
}

/*
  Boyutlar: yazı puntosu + işaret yüksekliği birlikte ölçeklenir (web kararı: metin ile
  işaretin oranı sabit kalmalı). İşaret genişliği 42:20 oranından türetilir.
*/
const BOYUTLAR = {
  sm: { yazi: 15, isaret: 7, bosluk: 6 },
  md: { yazi: 17, isaret: 8, bosluk: 8 },
  lg: { yazi: 20, isaret: 9, bosluk: 8 },
  xl: { yazi: 24, isaret: 11, bosluk: 10 },
}

/**
 * @param boyut  sm | md | lg | xl — metin ve işaret birlikte ölçeklenir.
 * @param zemin  acik | marka | gece — üstteki kontrast tablosu.
 */
export function Logo({ boyut = 'md', zemin = 'acik' }) {
  const z = ZEMINLER[zemin] ?? ZEMINLER.acik
  const b = BOYUTLAR[boyut] ?? BOYUTLAR.md
  const isaretGenislik = (b.isaret * 42) / 20

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="dersmate"
      style={{ flexDirection: 'row', alignItems: 'center', gap: b.bosluk }}
    >
      <Svg viewBox="0 0 42 20" width={isaretGenislik} height={b.isaret}>
        <Path d="M 10 10 Q 21 0, 32 10" stroke={z.nokta} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Circle cx="10" cy="10" r="9" fill={z.nokta} />
        <Circle cx="32" cy="10" r="9" fill={z.ikinciNokta} />
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
 * Yazısız kare rozet — dar alanlar için (web favicon'u ile aynı geometri).
 * Splash sonrası açılış ekranında ve ileride bildirim ikonlarında kullanılır.
 */
export function LogoMark({ boy = 32 }) {
  return (
    <Svg viewBox="0 0 64 64" width={boy} height={boy} accessibilityLabel="dersmate">
      <Rect width="64" height="64" fill={BG} rx="14" />
      <Circle cx="23" cy="34" r="11" fill={ACCENT} opacity="0.95" />
      <Circle cx="41" cy="34" r="11" fill={INK} opacity="0.95" />
      <Path d="M 23 34 Q 32 22, 41 34" stroke={BG} strokeWidth={3.5} fill="none" strokeLinecap="round" />
    </Svg>
  )
}
