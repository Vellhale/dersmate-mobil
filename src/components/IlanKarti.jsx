import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Avatar } from './Avatar'
import { SeviyeRozeti } from './SeviyeRozeti'
import { KepIkonu, KitapIkonu, TakasIkonu, YildizIkonu } from './Ikonlar'
import { Button, Card } from './ui'
import { amber, brand, emerald, slate } from '../lib/theme'

/*
  AKIŞ KARTI — web'deki Discover öneri kartının (Suggestions içindeki CamKart)
  Instagram-akışı yorumu. Kart dili web'den aynen:

  • Hiyerarşi: avatar + kimlik üstte (isim + seviye rozeti + puan), bio altında,
    konular sonra, aksiyon en altta — göz önce kişiyi tanısın.
  • AVATAR ÖNE ÇIKIYOR (lg, 80px): yüz, listede gözün ilk tutunduğu şey. Beyaz halka +
    gölge avatarı kart yüzeyinden ayırır.
  • Puan ROZET DEĞİL küçük satır: kimlik bloğundaki tek rozet vurgusu seviye rozetinde
    kalsın. Öneri kartında "değerlendirilmemiş" metni YOK — her yeni kullanıcıda
    tekrarlanıp akışı olumsuz bir tekrarla doldururdu.
  • bio null ise satır TAMAMEN düşer — boş çizgi kalmaz.
  • "Karşılıklı takas" etiketi kimlik sütununun DIŞINDA, tam genişlikte: dar sütunda
    kırpılan etiket bilgi vermez.

  Web'in CamKart'ı (saydam cam yüzeyi) TAŞINMADI: o, masaüstündeki dekoratif zemin
  ızgarasının üstünde anlam kazanıyordu; mobil akışta kartlar ui.jsx'teki tek yüzey
  dilini kullanır — akış, veri yoğun bir ekrandır ve dekor okumayı gölgelemez.
*/

/** Puan satırı — web'deki PuanSatiri. Renkli olan işaret (amber yıldız), okunan şey metin. */
function PuanSatiri({ ortalama, adet }) {
  if (!(adet > 0)) return null
  return (
    <View className="mt-1.5 flex-row items-center gap-1.5">
      <YildizIkonu renk={amber[500]} boy={14} />
      <Text className="text-xs font-semibold text-slate-700">{Number(ortalama).toFixed(1)}</Text>
      <Text className="text-xs text-slate-600">({adet} değerlendirme)</Text>
    </View>
  )
}

const ETIKET_TONLARI = {
  brand: { kutu: 'bg-brand-100', yazi: 'text-brand-700', ikon: brand[700] },
  success: { kutu: 'bg-emerald-100', yazi: 'text-emerald-700', ikon: emerald[700] },
  neutral: { kutu: 'bg-slate-100', yazi: 'text-slate-700', ikon: slate[600] },
}

/** İkonlu etiket (pill) — web'deki IkonluEtiket. İkon 14px: rozet metni 12px ve ikon
    ondan büyük olursa ağırlık merkezi süse kayar. */
function IkonluEtiket({ ikon: Ikon, tone = 'brand', children }) {
  const t = ETIKET_TONLARI[tone] ?? ETIKET_TONLARI.brand
  return (
    <View className={`max-w-full flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${t.kutu}`}>
      <Ikon renk={t.ikon} boy={14} />
      <Text numberOfLines={1} className={`shrink text-xs font-medium ${t.yazi}`}>
        {children}
      </Text>
    </View>
  )
}

/**
 * Konu listesi — başlık + pill'ler. BAŞLIK DA İKONLU (web kararı): yön (kim kime
 * anlatıyor) metni okumadan da seçilsin — kep = anlatan taraf, kitap = öğrenen taraf;
 * aynı ikon pill'lerde tekrar eder.
 */
function TopicList({ title, tone, ikon: Ikon, topics }) {
  if (!topics?.length) return null
  const t = ETIKET_TONLARI[tone] ?? ETIKET_TONLARI.brand
  return (
    <View className="mt-3">
      <View className="flex-row items-center gap-1.5">
        <Ikon renk={slate[600]} boy={14} />
        <Text className="text-xs font-medium uppercase tracking-wide text-slate-600">{title}</Text>
      </View>
      <View className="mt-1.5 flex-row flex-wrap gap-1.5">
        {/* Ders adı OPAKLIKLA soldurulmuyor: opacity-70, 12px metni pastel zeminde AA
            eşiğinin (4.5:1) altına düşürüyordu (ölçüm: ~2.9:1). Ayrımı nokta ayracı
            zaten yapıyor; renk aynı tonda tam opak kalır. */}
        {topics.map((topic) => (
          <IkonluEtiket key={topic.topicId} ikon={Ikon} tone={tone}>
            {topic.topicName}
            <Text className={t.yazi}> · {topic.subjectName}</Text>
          </IkonluEtiket>
        ))}
      </View>
    </View>
  )
}

export function IlanKarti({ kisi, onIstek }) {
  const router = useRouter()

  return (
    <Card>
      {/* Kimlik bloğu profile götürür — web'deki PersonLink'in karşılığı. Kartın
          geneli DEĞİL yalnızca bu blok basılabilir: kartın asıl eylemi alttaki düğme
          ve tüm kartı linke çevirmek ikisini yarıştırırdı. */}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${kisi.displayName} profilini aç`}
        onPress={() => router.push(`/profil/${kisi.userId}`)}
        className="flex-row items-start gap-4"
      >
        <Avatar userId={kisi.userId} name={kisi.displayName} size="lg" className="border-2 border-white" />

        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text className="shrink text-base font-semibold text-brand-700" numberOfLines={2}>
              {kisi.displayName}
            </Text>
            <SeviyeRozeti kaynak={{ level: kisi.level }} boyut="sm" ton="acik" />
          </View>

          <PuanSatiri ortalama={kisi.averageRating} adet={kisi.ratingCount} />
        </View>
      </Pressable>

      {kisi.isCrossMatch && (
        <View className="mt-3 self-start">
          <IkonluEtiket ikon={TakasIkonu} tone="success">
            Karşılıklı takas
          </IkonluEtiket>
        </View>
      )}

      {kisi.bio ? (
        <Text numberOfLines={2} className="mt-3 text-sm leading-relaxed text-slate-600">
          {kisi.bio}
        </Text>
      ) : null}

      <TopicList title="Sana anlatabilir" tone="brand" ikon={KepIkonu} topics={kisi.theyCanTeach} />

      {kisi.theyWantToLearn?.length > 0 && (
        <TopicList
          title="Senden öğrenmek istiyor"
          tone="success"
          ikon={KitapIkonu}
          topics={kisi.theyWantToLearn}
        />
      )}

      <View className="mt-4">
        <Button onPress={() => onIstek(kisi)}>Eşleşme isteği gönder</Button>
      </View>
    </Card>
  )
}
