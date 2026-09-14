import tailwindConfig from '../../tailwind.config.js'

/*
  Marka tonları, JS'ten okunabilir hâlde — web'deki src/lib/brand.js'in karşılığı.

  NEDEN VAR: NativeWind sınıfları yalnızca className alan yerlerde çalışır. Tab bar
  renkleri (tabBarActiveTintColor), SVG dolguları, StatusBar ve navigasyon temaları
  bir SINIF değil, gerçek bir renk DEĞERİ ister. Değerler tailwind.config.js'ten
  OKUNUYOR, kopyalanmıyor: palet tek yerde yaşar, burada ikinci bir liste yok.
*/
export const brand = tailwindConfig.theme.extend.colors.brand

/** Sık kullanılan nötrler — Tailwind'in kendi slate ölçeğinden, marka dışı. */
export const ink = '#0F172A' // slate-900 — koyu zemin (splash, koyu paneller)
export const zemin = '#F8FAFC' // slate-50 — sayfa zemini (web'de body)
export const beyaz = '#FFFFFF'
/** Yüzen sekme çubuğunun zemini — referans tasarımın neredeyse siyahı. Mobil'e özgü (web'de
    karşılığı yok); slate-900 (ink) hap için fazla lacivert kalıyordu. */
export const gece = '#111318'

export const slate = {
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
}

/*
  Durum renkleri — Tailwind'in kendi ölçeğinden, sınıf adıyla erişilemeyen yerler
  (SVG renk prop'u, tab bar rozeti) için. Yalnızca KULLANILAN basamaklar tutuluyor:
  tam ölçek kopyalamak, hiç okunmayan satırlarla paleti şişirirdi.

  YEŞİL (emerald) YOK: olumlu durum marka mavisi, değeri `brand`'den okunur. Yeşil marka
  paletinin dışındaydı (kullanıcı kararı, A düzeni). amber yalnızca bekleyen/dikkat, yıldız
  ve madalya altın-bronzu (SubjectBadges, Topluluk/UniversiteRozetleri), rose tehlike ve sayaç.
*/
/* amber-600 değerlendirme yıldızının dolgusu: 400 beyazda 1.67:1 kalıyordu (WCAG 1.4.11
   grafik nesne için 3:1 istiyor); 600 = 3.19:1 ve hâlâ "yıldız sarısı" okunuyor. */
export const amber = { 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 800: '#92400E' }
export const rose = { 600: '#E11D48', 800: '#9F1239' }
