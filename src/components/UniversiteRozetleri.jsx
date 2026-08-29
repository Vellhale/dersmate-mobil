import { Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { api } from '../lib/api'
import { amber, slate } from '../lib/theme'
import { useAsync } from '../state/useAsync'
import { Card } from './ui'

/*
  ÜNİVERSİTE ROZETLERİ — web'deki components/UniversiteRozetleri.jsx'in RN portu.
  İki kademe, branşsız.

  Branş rozetlerinden (SubjectBadges) FARKI: orada rozet bir DERSE bağlıdır ("Matematik
  Üstadı") çünkü YKS tarafında anlatılan şey bir konudur. Üniversite tarafında ders ve
  konu kavramı YOK — iki kişi eşleşiyor, sohbette konuşuyor. Ölçülebilen tek şey
  birlikte geçirilen süre, o yüzden rozet de branşsız:

    8 saat  → Öğretici (gümüş)
    15 saat → Üstad    (altın)

  Eşikler branş rozetleriyle BİLEREK aynı: kullanıcı tek bir merdiven öğreniyor, ikinci
  bir sayı ezberlemiyor.

  ─── VERİ NEREDEN GELİYOR ───────────────────────────────────────────────────────
  Yeni bir uç açılmadı. `userSubjectBadges` yanıtındaki `progress[]` zaten branş başına
  DAKİKA taşıyor; toplamı, kullanıcının platformda görüşerek geçirdiği toplam süre.
  Backend'de ikinci bir sayaç kurmak aynı sayıyı iki yerde tutmak olurdu ve ikisi er ya
  da geç ayrışırdı.

  DAKİKA TOPLANIP SONRA SAATE ÇEVRİLİYOR (branş başına `hours` toplanmıyor): her branşta
  aşağı yuvarlanmış saatleri toplamak, üç branşta 50'şer dakika anlatmış birini 0 saatte
  bırakırdı.

  BİLİNEN SINIR: bu toplam TAMAMLANMIŞ ders oturumlarından türüyor. Henüz hiç oturumu
  olmayan bir üniversite kullanıcısında sıfırdır, yani rozet çıkmaz — bileşen de o
  durumda kendini gizler. Sohbet üzerinden yapılan görüşmelerin süresi ölçülmüyor;
  ölçülseydi kaynak yine burası olurdu, bileşen değişmezdi.
  ─────────────────────────────────────────────────────────────────────────────────

  MOBİL SAPMALARI: gradyan disk yerine DÜZ renk (RN'de gradyan ayrı bileşen ya da
  benzersiz id'li SVG tanımı ister; aynı ekrandaki iki rozette id çakışması ilk gradyanı
  ikinciye de uygular), zemin opaklık kesirleri düşürüldü, title/sr-only ikilisi tek bir
  accessibilityLabel'a indi. Gerekçelerin uzunu ToplulukRozetleri.jsx başında.
*/

/*
  Saat eşikleri. Sıra ÖNEMLİ: en yüksekten aşağı taranıyor — artan sırada 20 saati olan
  kullanıcı "Öğretici" rozetiyle kalırdı.

  Renkler theme.js'ten; disk/kenar çifti branş rozetleriyle aynı, iki şerit yan yana
  geldiğinde gümüş gümüşe, altın altına benzesin.
*/
const KADEMELER = [
  {
    saat: 15,
    etiket: 'Üstad',
    metal: 'Altın',
    disk: amber[400],
    kenar: amber[500],
    hap: 'border-amber-200 bg-amber-50',
    yazi: 'text-amber-900',
  },
  {
    saat: 8,
    etiket: 'Öğretici',
    metal: 'Gümüş',
    disk: slate[300],
    kenar: slate[400],
    hap: 'border-slate-200 bg-slate-50',
    yazi: 'text-slate-800',
  },
]

/* Toplam saatten kazanılmış en yüksek kademe. Yoksa null.
   DIŞA AKTARILMIYOR: tek çağıranı bu dosya. Çağrılmayan bir export bu projede iki kez
   gizli hata sakladı, o yüzden kapsam dar tutuluyor. */
function kademeBul(saat) {
  return KADEMELER.find((k) => saat >= k.saat) ?? null
}

/** Bir sonraki eşiğe kalan saat — ilerleme satırı için. Zirvedeyse null. */
function sonrakiEsik(saat) {
  const artan = [...KADEMELER].sort((a, b) => a.saat - b.saat)
  return artan.find((k) => saat < k.saat)?.saat ?? null
}

/**
 * Madalya: üstte iki kurdele şeridi, altta disk. Kurdele diskin ARKASINDA kalsın diye
 * önce çiziliyor ve nötr slate: kademe bilgisini tek başına diskin rengi taşıyor.
 *
 * Çizim SubjectBadges.jsx'ten import EDİLMİYOR: oradaki MadalyaIkonu dışa aktarılmamış
 * ve o dosya bu turun kapsamı dışında (web'de de aynı çizim üç dosyada duruyor).
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

/** Tek rozet hapı: madalya + kademe adı. Saat ve metal, ekran okuyucu metninde. */
function UniversiteRozeti({ kademe, saat }) {
  return (
    <View
      accessible
      accessibilityLabel={`${kademe.etiket} — ${saat} saat görüşme (${kademe.metal} kademe)`}
      className={`flex-row items-center gap-2 rounded-full border py-1.5 pl-2.5 pr-3.5 ${kademe.hap}`}
    >
      <MadalyaIkonu kademe={kademe} />
      <Text className={`text-sm font-medium ${kademe.yazi}`}>{kademe.etiket}</Text>
    </View>
  )
}

/**
 * Profildeki üniversite rozeti şeridi.
 *
 * Rozet YOKSA ve ilerleme de yoksa bileşen kendini tamamen gizler — henüz başlamamış
 * birine boş bir "rozetin yok" kutusu göstermek eksiklik gibi okunur (aynı karar
 * SubjectBadges'te de alındı).
 *
 * Yalnızca ÜNİVERSİTE bilgisi olan profilde çizilmesi kararı çağırana ait
 * (ProfilGorunumu), web'deki gibi: bileşen "üniversite mi" sorusunu sormuyor, süreye
 * bakıyor.
 */
export function UniversiteRozetleri({ userId, kendiProfilim = false }) {
  const veri = useAsync(() => api.userSubjectBadges(userId), [userId])

  // SESSİZ BAŞARISIZLIK: rozet şeridi profilin yardımcı bir parçası. Uç 500 dönerse
  // profil açılmaya devam etmeli; burada hata kutusu asıl içeriği gölgelerdi.
  // Yükleniyorken de yer tutulmaz.
  if (veri.loading || veri.error || !veri.data) return null

  const dakika = (veri.data.progress ?? []).reduce((t, p) => t + (p.minutes ?? 0), 0)
  const saat = Math.floor(dakika / 60)
  const kademe = kademeBul(saat)
  const hedef = sonrakiEsik(saat)

  if (!kademe && saat === 0) return null

  return (
    <Card>
      <Text className="mb-4 text-sm font-semibold text-slate-800">Görüşme rozetleri</Text>

      {kademe ? (
        <View className="flex-row flex-wrap items-center gap-3">
          <UniversiteRozeti kademe={kademe} saat={saat} />
          <Text className="text-xs text-slate-500">{saat} saat görüşme</Text>
        </View>
      ) : (
        <Text className="text-xs text-slate-500">
          {kendiProfilim
            ? `İlk rozet 8 saat görüşmede geliyor — ${saat} saatteysin.`
            : `${saat} saat görüşme yapmış.`}
        </Text>
      )}

      {/* İlerleme çubuğu yalnızca zirvede DEĞİLKEN. Üstad olan birine "bir sonraki
          eşik" göstermek, olmayan bir hedefi varmış gibi sunardı. */}
      {hedef ? (
        <View className="mt-4 flex-row items-center gap-2 border-t border-slate-100 pt-4">
          <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <View
              className="h-full rounded-full bg-slate-300"
              style={{ width: `${Math.min(100, (saat / hedef) * 100)}%` }}
            />
          </View>
          <Text
            className="shrink-0 text-xs text-slate-500"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {saat}/{hedef} sa
          </Text>
        </View>
      ) : null}
    </Card>
  )
}
