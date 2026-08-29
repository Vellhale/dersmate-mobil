import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { api } from '../lib/api'
import { amber, slate } from '../lib/theme'
import { useAsync } from '../state/useAsync'

/*
  BRANŞ ROZETLERİ — web'deki components/SubjectBadges.jsx'in portu (iş kuralı 2).

  Rozet, kazanılan puana değil o branşta ANLATILAN SÜREYE bakar. İki kademe:
    8 saat  → "Matematik Öğretici"  (gümüş)
    15 saat → "Matematik Üstadı"    (altın)

  Hesap tamamen backend'de (SubjectBadgeEngine); burada tek bir mantık yok, yalnızca
  gösterim. Başlık metni bile ("Matematik Öğretici") sunucudan hazır geliyor — Türkçe
  ekler tek yerde kalsın diye.

  Web'in tasarım kararları aynen: metalik/emoji süsleme YOK — sade beyaz hap içinde
  küçük bir madalya SVG'si + başlık. SVG her platformda aynı çizilir; kademe bilgisini
  tek başına madalyanın rengi (gümüş / altın) taşır. "0 dk" gibi boş sayaçlar yerine
  rozetler ve isteğe bağlı açılan ilerleme listesi (akordeon) görünür.
*/

/*
  KADEMELER. Sıra numarası ayrıca tutuluyor (`sira`): aynı branşta iki rozet varsa
  yükseği seçmek için sayısal karşılaştırma gerekiyor — enum adına göre alfabetik
  sıralamak tesadüfen doğru sonuç verip yarın sessizce bozulurdu.
*/
const KADEME = {
  Ogretici: { sira: 1, etiket: 'Gümüş', disk: slate[300], kenar: slate[400] },
  Ustad: { sira: 2, etiket: 'Altın', disk: amber[400], kenar: amber[500] },
}

const VARSAYILAN_KADEME = KADEME.Ogretici

/** Bir sonraki eşiğe kalan saat — ilerleme satırı için. Kural sunucuda; bu yalnız gösterim. */
const ESIKLER = [8, 15]

function sonrakiEsik(saat) {
  return ESIKLER.find((e) => saat < e) ?? null
}

export function SubjectBadges({ userId, kendiProfilim = false }) {
  const veri = useAsync(() => api.userSubjectBadges(userId), [userId])
  const [ilerlemeAcik, setIlerlemeAcik] = useState(false)

  // SESSİZ BAŞARISIZLIK: rozet şeridi profilin yardımcı bir parçası. Uç 500 dönerse
  // kullanıcının profili açılmaya devam etmeli — hata kutusu, asıl içeriği gölgeleyen
  // bir gürültü olurdu. Yükleniyorken de yer tutulmaz.
  if (veri.loading || veri.error || !veri.data) return null

  const { badges = [], progress = [] } = veri.data

  // Aynı branştan yalnızca EN YÜKSEK kademe gösterilir: "Öğretici + Üstadı" yan yana
  // durunca düşük olan yükseği zayıflatıyor (backend alt kademeyi geçmiş için saklar).
  const enYuksek = new Map()
  for (const b of badges) {
    const mevcut = enYuksek.get(b.branch)
    const yeniSira = (KADEME[b.level] ?? VARSAYILAN_KADEME).sira
    const mevcutSira = mevcut ? (KADEME[mevcut.level] ?? VARSAYILAN_KADEME).sira : -1
    if (yeniSira > mevcutSira) enYuksek.set(b.branch, b)
  }

  const gosterilecek = [...enYuksek.values()].sort(
    (a, b) =>
      (KADEME[b.level] ?? VARSAYILAN_KADEME).sira - (KADEME[a.level] ?? VARSAYILAN_KADEME).sira,
  )

  // Rozeti olmayan ama ders anlatmış branşlar — "az kaldı" göstergesi.
  const rozetsiz = progress.filter((p) => !enYuksek.has(p.branch) && p.hours > 0)

  if (gosterilecek.length === 0 && rozetsiz.length === 0) {
    // Hiç ders anlatmamış kullanıcıda blok tamamen gizlenir; boş bir "rozet yok"
    // kutusu, henüz başlamamış birine eksiklik gibi görünür.
    return null
  }

  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-5">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="text-sm font-semibold text-slate-800">Branş rozetleri</Text>
        {rozetsiz.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: ilerlemeAcik }}
            onPress={() => setIlerlemeAcik((v) => !v)}
            hitSlop={12}
          >
            <Text className="text-xs font-medium text-brand-700">
              {ilerlemeAcik ? 'İlerlemeyi gizle' : `İlerleme (${rozetsiz.length})`}
            </Text>
          </Pressable>
        )}
      </View>

      {gosterilecek.length > 0 ? (
        <View className="flex-row flex-wrap gap-3">
          {gosterilecek.map((b) => (
            <Madalya key={`${b.branch}-${b.level}`} rozet={b} />
          ))}
        </View>
      ) : (
        <Text className="text-xs text-slate-500">
          {kendiProfilim
            ? 'İlk rozet 8 saat ders anlatımıyla geliyor.'
            : 'Henüz branş rozeti kazanılmamış.'}
        </Text>
      )}

      {ilerlemeAcik && rozetsiz.length > 0 && (
        <View className="mt-4 gap-2 border-t border-slate-100 pt-4">
          {rozetsiz.map((p) => {
            const hedef = sonrakiEsik(p.hours)
            const oran = hedef ? Math.min(100, (p.hours / hedef) * 100) : 100
            return (
              <View key={p.branch} className="flex-row items-center gap-2">
                <Text numberOfLines={1} className="w-20 shrink-0 text-xs text-slate-500">
                  {p.subject}
                </Text>
                <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <View className="h-full rounded-full bg-slate-300" style={{ width: `${oran}%` }} />
                </View>
                <Text className="shrink-0 text-xs text-slate-500" style={{ fontVariant: ['tabular-nums'] }}>
                  {p.hours}/{hedef ?? ESIKLER.at(-1)} sa
                </Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

/**
 * Madalya ikonu: üstte iki kısa kurdele şeridi, altta disk — klasik madalya silueti.
 * Web'deki çizimle birebir aynı geometri; kurdele bilerek nötr slate — dikkat metalde.
 */
function MadalyaIkonu({ kademe }) {
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20}>
      <Path d="M7 2h4l1.8 7.5-4 1z" fill={slate[400]} />
      <Path d="M13 2h4l-1.8 8.5-4-1z" fill={slate[400]} />
      <Circle cx="12" cy="15" r="6" strokeWidth={1.5} fill={kademe.disk} stroke={kademe.kenar} />
    </Svg>
  )
}

/** Tek rozet: beyaz hap içinde madalya + sunucudan gelen başlık — başka süsleme yok. */
function Madalya({ rozet }) {
  const k = KADEME[rozet.level] ?? VARSAYILAN_KADEME

  return (
    <View
      accessible
      accessibilityLabel={`${rozet.title} — ${rozet.hours} saat ders anlatımı (${k.etiket} kademe)`}
      className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-2.5 pr-3.5"
    >
      <MadalyaIkonu kademe={k} />
      <Text className="text-sm font-medium text-slate-800">{rozet.title}</Text>
    </View>
  )
}
