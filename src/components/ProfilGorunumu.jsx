import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { api } from '../lib/api'
import { useAsync } from '../state/useAsync'
import { formatDateTime } from '../lib/format'
import { seviyeEtiketi, seviyeHesapla, seviyeIlerlemeMetni } from '../lib/seviye'
import { brand } from '../lib/theme'
import { Avatar } from './Avatar'
import { SubjectBadges } from './SubjectBadges'
import { UniversiteRozetleri } from './UniversiteRozetleri'
import { ToplulukRozetleri } from './ToplulukRozetleri'
import { GrafikIkonu, KepIkonu, TakvimIkonu, YildizIkonu } from './Ikonlar'
import { Badge, Button, Card, EmptyState, ErrorBox, Loading } from './ui'

/*
  KOMPAKT PROFİL — web'deki UserProfileView'ın portu (iş kuralı 2).

  Samimi profil görünümü, CV değil: en üstte kimlik ve seviye, altında sayaç şeridi,
  branş rozetleri, "ne anlatır / ne öğrenmek ister" etiketleri, en altta doğrulanmış
  yorumlar. Sıralama "bu kişiyle ders yapar mıyım" sorusunu yukarıdan aşağıya yanıtlar.

  Web kararları aynen:
  • "0 dk"lık deneyim sayacı YOK — seviye aynı yeri kullanır ama en baştan anlamlı
    bir şey söyler; branş bilgisi rozetlerde.
  • Adın yanında seviye rozeti YOK — aynı bilgi sayaç şeridinde puan ve sonraki eşikle
    birlikte duruyor; üçüncü tekrar başlıkla vurgu yarışına girerdi.
  • Yıldız dağılımı akordeon ve varsayılan KAPALI — "derine bak" verisi.
  • Değerlendirme etiketleri çizilmiyor (sunucu döndürmeye devam ediyor; ürün kararı).

  MOBİL FARKI: web'in max-h-96'lık iç kaydırmalı yorum kutusu TAŞINMADI — sayfa zaten
  ScrollView ve iç içe dikey kaydırma dokunmatikte jest çatışması üretir. Liste düz
  akar, uzunluk sayfalamayla (Önceki/Sonraki) sınırlanır — "kaydırılabilir liste"
  işlevi sayfanın kendisinde.

  ROZET ŞERİTLERİ web'dekiyle AYNI SIRADA: branş (SubjectBadges) → görüşme
  (UniversiteRozetleri) → topluluk (ToplulukRozetleri). Üçü de "bu kişi ne yapmış"
  sorusunu yanıtlıyor ve konu panellerinden ("ne yapabilir") önce geliyor; üçü de
  gösterecek bir şey yoksa kendini tamamen gizliyor.

  YÖNETİM ROZETİ BURADA YOK ve bu bir eksik değil: profil ucu rolü bilerek sızdırmıyor
  (bkz. YonetimRozeti.jsx). Rozetin işi forumda/Keşfet'te resmi cevabı ayırt etmek,
  profilde kişi etiketlemek değil.
*/

export function ProfilGorunumu({ userId, kendiProfilim = false }) {
  const profile = useAsync(() => api.userProfile(userId), [userId])
  const [reviewPage, setReviewPage] = useState(1)
  const reviews = useAsync(() => api.userReviews(userId, reviewPage), [userId, reviewPage])

  if (profile.loading) return <Loading />
  if (profile.error) return <ErrorBox error={profile.error} onRetry={profile.reload} />
  if (!profile.data) return null

  const p = profile.data

  /* Kendi profilim mi: asıl kaynak SUNUCUNUN `isSelf` alanı (web de onu kullanıyor).
     Çağıranın verdiği prop yalnızca yedek — merdiven/ilerleme metinleri "burada ne
     kazanabilirsin" diyor ve bunu kime söylediğine sunucu karar vermeli. */
  const benimProfilim = p.isSelf ?? kendiProfilim

  return (
    <View className="gap-3">
      <ProfilBasligi profile={p} />

      {/* Branş rozetleri istatistiklerin hemen altında: ikisi de "bu kişi ne yapmış"
          sorusunu yanıtlıyor, konu panellerinden ("ne yapabilir") önce gelmeli.
          Bileşen, rozet de ilerleme de yoksa kendini tamamen gizler. */}
      <SubjectBadges userId={userId} kendiProfilim={benimProfilim} />

      {/*
        GÖRÜŞME ROZETLERİ yalnızca üniversite bilgisi olan profilde.

        İki şerit birden görünebilir ve bu bir tutarsızlık değil: branş rozetleri "hangi
        derste ne kadar anlattı", görüşme rozeti "toplamda ne kadar görüştü" diyor. Aynı
        kişide ikisi de doğru olabilir. Üniversite bilgisi olmayan profilde ikinci şerit
        hiç çizilmiyor; üniversite bilgisi olup hiç oturumu olmayanda ise bileşen kendini
        gizliyor (bkz. UniversiteRozetleri).
      */}
      {p.university ? <UniversiteRozetleri userId={userId} kendiProfilim={benimProfilim} /> : null}

      {/*
        TOPLULUK ROZETLERİ — forumda alınan toplam yukarı oy (100/500/1000).

        Sayaç SUNUCUDAN geliyor ve kaldırılmış/perdeli içeriğin oyunu saymıyor — yani
        kural ihlaliyle toplanan oy rozet kazandırmıyor (bkz. ProfileQueries).
        Kazanılmamış kademelerin merdiveni yalnızca kendi profilinde çiziliyor.
      */}
      <ToplulukRozetleri oy={p.communityUpvotes} kendiProfilim={benimProfilim} />

      <KonuPaneli title="Anlatabilirim" tone="brand" topics={p.canTeach} emptyText="Henüz konu eklenmemiş." />
      <KonuPaneli
        title="Öğrenmek istiyorum"
        tone="success"
        topics={p.wantsToLearn}
        emptyText="Henüz konu eklenmemiş."
      />

      <Degerlendirmeler reviews={reviews} page={reviewPage} onPage={setReviewPage} />
    </View>
  )
}

/*
  PROFİL BAŞLIĞI — Instagram düzeni (web'in üçüncü hâli): ÖNCE KİŞİ, sonra sayılar.
  Avatar 112px ve tek başına duran ilk şey; ad sayfanın en büyük metni; sayaçlar aynı
  kartın içinde 2×2 şerit. Mobil daima "dar ekran" olduğundan web'in sm-altı düzeni
  (ortalı portre) tek düzen olarak kalır — Instagram da öyle yapıyor.
*/
function ProfilBasligi({ profile }) {
  return (
    <Card className="items-center p-7">
      <Avatar
        userId={profile.userId}
        name={profile.displayName}
        size="xl"
        className="border-4 border-brand-200"
      />

      <Text className="mt-4 text-center text-3xl font-bold leading-tight tracking-tight text-slate-900">
        {profile.displayName}
      </Text>

      {(profile.university || profile.department) && (
        <Text className="mt-2 text-center text-sm font-medium text-slate-600">
          {[profile.university, profile.department].filter(Boolean).join(' · ')}
        </Text>
      )}

      {profile.bio ? (
        <Text className="mt-4 text-center text-[15px] leading-relaxed text-slate-700">
          {profile.bio}
        </Text>
      ) : null}

      <SayacSeridi profile={profile} />
    </Card>
  )
}

/*
  Sayaç şeridi — dört ayrı kartın yerine kartın İÇİNDE 2×2 ızgara (web kararı: yüzey
  sayısı düşsün, profil gösterge paneli gibi okunmasın). Her sayaçta ikon: göz etikete
  inmeden sayacın konusunu söylüyor. İlerleme metni SUNUCUDAN türetilir (seviye.js) —
  eşik istemciye kopyalanmaz.
*/
function SayacSeridi({ profile }) {
  const kalemler = [
    { deger: String(profile.taughtSessionCount ?? 0), etiket: 'ders anlattı', Ikon: KepIkonu },
    {
      deger: profile.ratingCount > 0 ? `${Number(profile.averageRating).toFixed(1)} ★` : '—',
      etiket: profile.ratingCount > 0 ? `${profile.ratingCount} değerlendirme` : 'değerlendirme yok',
      Ikon: YildizIkonu,
    },
    {
      deger: seviyeEtiketi(seviyeHesapla(profile)),
      etiket: seviyeIlerlemeMetni(profile),
      Ikon: GrafikIkonu,
    },
    { deger: String(new Date(profile.joinedAtUtc).getFullYear()), etiket: 'katılım', Ikon: TakvimIkonu },
  ]

  return (
    <View className="mt-6 w-full flex-row flex-wrap border-t border-slate-200 pt-5">
      {kalemler.map((k) => (
        <View key={k.etiket} className="w-1/2 p-1.5">
          <View className="items-center rounded-xl border border-brand-100 bg-brand-50 p-3">
            <k.Ikon renk={brand[600]} boy={16} />
            <Text className="mt-1.5 text-center text-base font-bold leading-tight text-slate-900">
              {k.deger}
            </Text>
            <Text className="mt-0.5 text-center text-xs leading-snug text-slate-600">{k.etiket}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function KonuPaneli({ title, tone, topics, emptyText }) {
  return (
    <Card>
      <Text className="mb-2 text-sm font-medium text-slate-700">{title}</Text>
      {topics?.length ? (
        <View className="flex-row flex-wrap gap-1.5">
          {/* opacity-70 yok — IlanKarti'deki kontrast kararıyla aynı: pastel zeminde
              12px metni soldurmak AA eşiğini kaybettiriyordu. */}
          {topics.map((topic) => (
            <Badge key={topic.topicId} tone={tone}>
              {topic.topicName} · {topic.subjectName}
            </Badge>
          ))}
        </View>
      ) : (
        <Text className="text-sm text-slate-600">{emptyText}</Text>
      )}
    </Card>
  )
}

/*
  DEĞERLENDİRMELER — özet şeridi + yorum listesi (web'in küçültülmüş bloku).
  Puan özeti ÇUBUKLA: anlatım/zamanlama farkı okumadan görünür. Yıldız dağılımı
  akordeon ve varsayılan kapalı.
*/
function Degerlendirmeler({ reviews, page, onPage }) {
  const [detayAcik, setDetayAcik] = useState(false)

  if (reviews.loading) return <Loading label="Değerlendirmeler yükleniyor…" />
  if (reviews.error) return <ErrorBox error={reviews.error} onRetry={reviews.reload} />

  const data = reviews.data
  if (!data || data.reviewCount === 0) {
    return (
      <EmptyState
        title="Henüz değerlendirme yok"
        description="Değerlendirmeler yalnızca tamamlanmış derslerden sonra yazılabilir."
      />
    )
  }

  return (
    <Card className="overflow-hidden p-0">
      {/* ÖZET — hafif renkli başlık şeridi: "bu bölüm bir başlık" der. */}
      <View className="gap-4 border-b border-slate-200 bg-slate-50 p-4">
        <View className="flex-row items-center gap-3">
          <Text className="text-3xl font-bold leading-none text-slate-900">
            {Number(data.averageScore).toFixed(1)}
          </Text>
          <View>
            <Yildizlar deger={data.averageScore} />
            <Text className="mt-1 text-xs text-slate-600">{data.reviewCount} değerlendirme</Text>
          </View>
        </View>

        <View className="gap-2">
          <MetrikCubugu label="Anlatım" value={data.averageTeachingScore} />
          <MetrikCubugu label="Zamanlama" value={data.averagePunctualityScore} />

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: detayAcik }}
            onPress={() => setDetayAcik((v) => !v)}
            className="min-h-[44px] justify-center"
          >
            <Text className="text-xs font-medium text-brand-700">
              {detayAcik ? 'Dağılımı gizle' : 'Yıldız dağılımını gör'}
            </Text>
          </Pressable>

          {detayAcik && (
            <View className="gap-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = data.scoreDistribution[star - 1] ?? 0
                const pct = data.reviewCount ? (count / data.reviewCount) * 100 : 0
                return (
                  <View key={star} className="flex-row items-center gap-2">
                    <Text className="w-6 shrink-0 text-xs text-slate-600" style={{ fontVariant: ['tabular-nums'] }}>
                      {star}★
                    </Text>
                    <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <View className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </View>
                    <Text className="w-5 shrink-0 text-right text-xs text-slate-600" style={{ fontVariant: ['tabular-nums'] }}>
                      {count}
                    </Text>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </View>

      {/* YORUM LİSTESİ — sayfa akışında düz liste; uzunluğu sayfalama sınırlar
          (mobilde iç içe kaydırma jest çatışması üretir — üstteki blok yorumu). */}
      <View className="px-4 pb-2">
        {data.reviews.items.map((review, i) => (
          <View key={review.reviewId} className={`py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
              <Text className="text-sm font-semibold text-slate-800">{review.reviewerDisplayName}</Text>
              <Yildizlar deger={review.score} kucuk />
              <Text className="ml-auto text-xs text-slate-600">{formatDateTime(review.createdAtUtc)}</Text>
            </View>

            {review.comment ? (
              <Text className="mt-1.5 text-sm leading-relaxed text-slate-700">{review.comment}</Text>
            ) : null}

            {/* Konu adı yorumun ALTINDA ve soluk: okuyan önce ne yazıldığına bakar. */}
            <Text className="mt-1.5 text-xs text-slate-600">{review.topicName}</Text>
          </View>
        ))}
      </View>

      {data.reviews.totalPages > 1 && (
        <View className="flex-row items-center justify-between border-t border-slate-200 px-4 py-3">
          <Button variant="secondary" disabled={page <= 1} onPress={() => onPage(page - 1)}>
            ← Önceki
          </Button>
          <Text className="text-xs text-slate-600">
            {data.reviews.page} / {data.reviews.totalPages}
          </Text>
          <Button variant="secondary" disabled={!data.reviews.hasNextPage} onPress={() => onPage(page + 1)}>
            Sonraki →
          </Button>
        </View>
      )}
    </Card>
  )
}

/**
 * Beş yıldızlık satır — kesirli değerde son yıldız KISMİ dolar (web'deki çift katman
 * tekniğinin RN hâli: altta gri beş yıldız, üstte genişliği % ile kırpılan amber kopya).
 * Yuvarlama bilinçli olarak YOK: 4.5 ile 4.9 aynı görünmesin.
 */
function Yildizlar({ deger, kucuk = false }) {
  const oran = Math.max(0, Math.min(100, (Number(deger) / 5) * 100))
  const boyut = kucuk ? 'text-xs' : 'text-base'

  return (
    <View accessible accessibilityLabel={`5 üzerinden ${Number(deger).toFixed(1)}`} className="self-start">
      <Text className={`${boyut} leading-none text-slate-300`}>★★★★★</Text>
      <View
        className="absolute bottom-0 left-0 top-0 overflow-hidden"
        style={{ width: `${oran}%` }}
        pointerEvents="none"
      >
        <Text numberOfLines={1} className={`${boyut} leading-none text-amber-400`}>
          ★★★★★
        </Text>
      </View>
    </View>
  )
}

/** Alt metrik çubuğu (Anlatım / Zamanlama). Etiket sabit genişlikte: çubuk başlangıçları
    hizalı kalsın — çubukların işi karşılaştırılmak. */
function MetrikCubugu({ label, value }) {
  if (value == null) return null
  const oran = Math.max(0, Math.min(100, (Number(value) / 5) * 100))

  return (
    <View className="flex-row items-center gap-3">
      <Text className="w-20 shrink-0 text-xs text-slate-600">{label}</Text>
      <View className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        <View className="h-full rounded-full bg-brand-500" style={{ width: `${oran}%` }} />
      </View>
      <Text
        className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {Number(value).toFixed(1)}
      </Text>
    </View>
  )
}
