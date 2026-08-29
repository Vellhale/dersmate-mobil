import { Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { amber, slate } from '../lib/theme'
import { Card } from './ui'

/*
  TOPLULUK ROZETLERİ — web'deki components/ToplulukRozetleri.jsx'in RN portu.

  Forumda alınan toplam YUKARI OY'a bağlı üç kademe:

    100 oy  → Bronz
    500 oy  → Gümüş
   1000 oy  → Altın

  ÜÇÜNÜN DE ADI AYNI: "Topluluk Üyesi". Bu bir eksiklik değil, istenen tasarım —
  kademeyi ad değil MADALYANIN RENGİ taşıyor. Branş rozetlerinde ad değişiyordu
  ("Öğretici" / "Üstad") çünkü orada rozet bir yetkinlik iddiasıydı; burada iddia yok,
  katkı var. Üç ayrı unvan uydurmak forumda hiyerarşi kurar ve akranlık fikrine ters
  düşerdi.

  ─── VERİ ───────────────────────────────────────────────────────────────────────
  Sayaç SUNUCUDAN geliyor (`communityUpvotes`, profil ucu) ve kaldırılmış/perdeli
  içeriğin oyunu SAYMIYOR — kural ihlaliyle toplanan oy rozet kazandırmıyor. Alan
  gelmezse (eski sunucu) bileşen durumu UYDURMUYOR: rozet kazanılmış gibi
  gösterilmiyor, yerine kademe MERDİVENİ çiziliyor — "burada ne kazanabilirsin"
  ekranı, "ne kazandın" değil.

  Merdiven YALNIZCA KENDİ PROFİLİNDE görünüyor. Başkasının profilinde "kazanabileceği
  rozetler" listesi, o kişi hakkında hiçbir şey söylemeyen bir reklam olurdu.
  ─────────────────────────────────────────────────────────────────────────────────

  MOBİL SAPMALARI (web'den):
  • GRADYAN YOK — disk düz renk. Web'de madalya diski Tailwind gradyanlı bir HTML
    kutusuydu; RN'de gradyan ayrı bir bileşen (expo-linear-gradient) ya da benzersiz
    id'li SVG <linearGradient> ister. Aynı ekranda birden çok rozet varsa id çakışması
    ilk gradyanı ikinciye de uygular (bu proje bunu web'de favicon'da bir kez yaşadı).
    Düz renk o sorunu tanımıyor ve mobil branş rozetleri (SubjectBadges) zaten düz disk
    çiziyor — iki şerit yan yana geldiğinde tek bir madalya dili okunuyor.
  • Zemin opaklık kesirleri (bg-amber-50/60 gibi) düştü: kart zaten beyaz, telefonda
    /60 ile tam opak arasındaki fark okunmuyor.
  • title= (fare üstü ipucu) ve sr-only YOK — ikisinin de karşılığı tek bir
    accessibilityLabel; hap `accessible` işaretli, yoksa etiket ekran okuyucuya ulaşmaz.

  MADALYA ÇİZİMİ NEDEN BURADA: SubjectBadges.jsx'teki MadalyaIkonu dışa aktarılmıyor
  ve o dosya bu turun kapsamı dışında. Web'de de aynı çizim üç dosyada duruyor (orada
  gerekçe "çalışan ve doğrulanamayan dosyayı değiştirmemek"); ortak bileşene çıkarmanın
  zamanı, üç dosya birlikte taşındığında gelir.
*/

/*
  KADEMELER — en yüksekten aşağı. `kademeBul` ilk eşleşeni döndürüyor, sıra bu yüzden
  ÖNEMLİ: artan sırada olsaydı 1200 oyu olan kullanıcı bronz rozet alırdı.

  Renkler theme.js'ten okunuyor, hex elle yazılmıyor (palet tek kaynaktan).

  Bronz için amber-400/500 DEĞİL amber-800 (#92400E): altın zaten amber ailesinin açık
  ucunda ve iki kademe ayırt edilebilmeli. amber-800 altının yanında belirgin biçimde
  daha koyu ve "bakır" okunuyor. Halkası diskle aynı renk: halkanın işi AÇIK metalin
  (gümüş/altın) beyaz zemindeki sınırını okutmak; koyu bronz diskin sınırı zaten belli.
*/
const KADEMELER = [
  {
    oy: 1000,
    metal: 'Altın',
    disk: amber[400],
    kenar: amber[500],
    hap: 'border-amber-200 bg-amber-50',
    yazi: 'text-amber-900',
  },
  {
    oy: 500,
    metal: 'Gümüş',
    disk: slate[300],
    kenar: slate[400],
    hap: 'border-slate-200 bg-slate-50',
    yazi: 'text-slate-800',
  },
  {
    oy: 100,
    metal: 'Bronz',
    disk: amber[800],
    kenar: amber[800],
    hap: 'border-amber-200 bg-amber-50',
    yazi: 'text-amber-900',
  },
]

/** Üç kademede de aynı: rozetin adı metali değil, üyeliği söylüyor. */
const ROZET_ADI = 'Topluluk Üyesi'

/** Kazanılmış en yüksek kademe; hiçbiri tutmuyorsa null. */
function kademeBul(oy) {
  return KADEMELER.find((k) => oy >= k.oy) ?? null
}

/** Bir sonraki eşik — ilerleme çubuğu için. Zirvedeyse null. */
function sonrakiEsik(oy) {
  const artan = [...KADEMELER].sort((a, b) => a.oy - b.oy)
  return artan.find((k) => oy < k.oy)?.oy ?? null
}

/**
 * Madalya: üstte iki kurdele şeridi, altta disk — klasik madalya silueti.
 * Geometri branş rozetleriyle birebir aynı (24'lük ızgara); kurdele bilerek nötr slate
 * ve diskten ÖNCE çiziliyor: uçları diskin arkasında kalsın, dikkat metalde toplansın.
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

/** Kazanılmış rozet hapı. Oy sayısı ve metal, ekran okuyucu metninde. */
function Rozet({ kademe, oy }) {
  return (
    <View
      accessible
      accessibilityLabel={`${ROZET_ADI} — ${oy} yukarı oy (${kademe.metal} kademe)`}
      className={`flex-row items-center gap-2 rounded-full border py-1.5 pl-2.5 pr-3.5 ${kademe.hap}`}
    >
      <MadalyaIkonu kademe={kademe} />
      <Text className={`text-sm font-medium ${kademe.yazi}`}>{ROZET_ADI}</Text>
    </View>
  )
}

/**
 * Kademe merdiveni — HENÜZ KAZANILMAMIŞ üç rozet.
 *
 * Haplar kazanılmış hâlle aynı görünmüyor: zemin nötr beyaz, eşik sayısı hapın İÇİNDE
 * ve asıl etiketten ÖNCE okunuyor. Amaç, bunların bir başarı değil bir HEDEF listesi
 * olduğunun tek bakışta anlaşılması — kazanılmış rozetle aynı görünselerdi, profili
 * gezen biri üçünü de kazanılmış sanırdı.
 *
 * Madalya tam renkli kalıyor (soluklaştırılmadı): kullanıcıya neyi kazanacağını
 * göstermenin tek yolu o madalyayı göstermek.
 *
 * Üç hap saran bir SATIR olarak diziliyor, liste bileşeniyle değil: sayfa zaten
 * kaydırılıyor ve içeride ikinci bir dikey kaydırma jest çatışması üretir.
 */
function KademeMerdiveni({ oy }) {
  const artan = [...KADEMELER].sort((a, b) => a.oy - b.oy)

  return (
    <View className="flex-row flex-wrap gap-2">
      {artan.map((kademe) => (
        <View
          key={kademe.metal}
          accessible
          accessibilityLabel={
            `${kademe.oy} oy — ${ROZET_ADI}, ${kademe.metal} kademe, henüz kazanılmadı` +
            (oy > 0 ? `; şu an ${oy} oy` : '')
          }
          className="flex-row items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-2.5 pr-3.5"
        >
          <MadalyaIkonu kademe={kademe} />
          <Text
            className="text-sm font-semibold text-slate-800"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {kademe.oy} oy
          </Text>
          <Text className="text-sm text-slate-600">{ROZET_ADI}</Text>
        </View>
      ))}
    </View>
  )
}

/**
 * Profildeki topluluk rozeti şeridi.
 *
 * @param oy             Toplam yukarı oy (sunucudan). undefined/null geldiğinde
 *                       bileşen merdiven kipine düşüyor.
 * @param kendiProfilim  Merdiven yalnızca kendi profilinde çiziliyor.
 *
 * SubjectBadges ile aynı yüzey ve aynı gizlenme kuralı: gösterecek bir şey yoksa
 * bileşen hiç çizilmiyor. Boş bir "rozetin yok" kutusu, henüz başlamamış birine
 * eksiklik gibi okunuyor.
 */
export function ToplulukRozetleri({ oy, kendiProfilim = false }) {
  const sayacVar = typeof oy === 'number'
  const toplam = sayacVar ? oy : 0
  const kademe = sayacVar ? kademeBul(toplam) : null
  const hedef = sonrakiEsik(toplam)

  // Sayaç yokken yalnızca kendi profilinde merdiven; başkasının profilinde çizilecek
  // hiçbir şey yok.
  if (!sayacVar && !kendiProfilim) return null
  // Sayaç var ama kişi hiç oy almamışsa ve profil başkasınınsa: gizle.
  if (sayacVar && !kademe && !kendiProfilim) return null

  return (
    <Card>
      <Text className="mb-4 text-sm font-semibold text-slate-800">Topluluk rozetleri</Text>

      {kademe ? (
        <View className="flex-row flex-wrap items-center gap-3">
          <Rozet kademe={kademe} oy={toplam} />
          <Text className="text-xs text-slate-600">{toplam} yukarı oy</Text>
        </View>
      ) : (
        <>
          <KademeMerdiveni oy={toplam} />
          {/* Sayaç yokken cümle bir DURUM değil KURAL anlatıyor ("...dönüşür"): "şu an
              0 oydasın" demek, olmayan bir sayacı varmış gibi göstermek olurdu. */}
          <Text className="mt-3 text-xs leading-relaxed text-slate-600">
            {sayacVar
              ? `Gönderi ve yorumlarına gelen yukarı oylar burada sayılıyor — şu an ${toplam} oydasın.`
              : 'Topluluktaki gönderi ve yorumlarına gelen yukarı oylar burada madalyaya dönüşür.'}
          </Text>
        </>
      )}

      {/* İlerleme çubuğu yalnızca sayaç VARKEN ve zirvede DEĞİLKEN. Sayaç yokken
          çizilseydi hep %0 duran, hiç kıpırdamayan bir çubuk olurdu — ilerleme
          göstermeyen bir ilerleme çubuğu. */}
      {sayacVar && hedef ? (
        <View className="mt-4 flex-row items-center gap-2 border-t border-slate-100 pt-4">
          <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <View
              className="h-full rounded-full bg-slate-300"
              style={{ width: `${Math.min(100, (toplam / hedef) * 100)}%` }}
            />
          </View>
          <Text
            className="shrink-0 text-xs text-slate-600"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {toplam}/{hedef} oy
          </Text>
        </View>
      ) : null}
    </Card>
  )
}
