import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { api } from '../lib/api'
import { useAsync } from '../state/useAsync'
import { useProfilArkadaslari } from '../state/useProfilArkadaslari'
import { formatDateTime } from '../lib/format'
import { seviyeEtiketi, seviyeHesapla, seviyeIlerlemeMetni } from '../lib/seviye'
import { beyaz, brand } from '../lib/theme'
import { ArkadaslarBolumu } from './ArkadaslarBolumu'
import { Avatar } from './Avatar'
import { SubjectBadges } from './SubjectBadges'
import { UniversiteRozetleri } from './UniversiteRozetleri'
import { ToplulukRozetleri } from './ToplulukRozetleri'
import { YonetimRozeti } from './YonetimRozeti'
import {
  GrafikIkonu,
  KameraIkonu,
  KepIkonu,
  KisilerIkonu,
  SagOkIkonu,
  TakvimIkonu,
  YildizIkonu,
} from './Ikonlar'
import { Badge, Button, Card, EmptyState, ErrorBox, Loading, Spinner } from './ui'

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

  YÖNETİM ROZETİ ADIN YANINDA (bkz. ProfilBasligi). Önce bilerek yoktu — gerekçe
  "rozetin işi resmi cevabı ayırt etmek, profilde kişi etiketlemek değil" idi — ama o
  gerekçe rozeti DOĞRULAMA yolunu kapatıyordu: forumda rozetli bir yorum görüp adına
  dokunan kullanıcı hiçbir işaret bulamıyordu. Sunucu profil ucuna `isStaff` ekledi
  (ProfileQueries.cs) ve rozet buraya bağlandı; ayrıntılı gerekçe YonetimRozeti.jsx'te.

  ARKADAŞLAR (web #31) konu panelleri ile değerlendirmeler arasında ve AYRI UÇTAN
  (api.userFriends) geliyor — profil yanıtına alan eklenmedi. Kurallar bileşenin kendi
  başında (ArkadaslarBolumu.jsx). Sayı 2026-09-26'dan beri başlıkta da var (fotoğrafın
  altındaki hap ya da "N arkadaş · M ortak" satırı); ikisi aynı çekimden beslenir
  (useProfilArkadaslari), uç bir kez çağrılır.

  FOTOĞRAF (`fotograf` = { onPress, yukleniyor }): yalnızca Profilim veriyor ve yalnızca
  kendi profilinde çiziliyor. Başkasının profili rotası (profil/[userId]) prop geçmiyor:
  kullanıcı oradan kendi kimliğine gelse de düzenleme Profilim'de kalıyor (o dosyanın
  başındaki kural). Yükleme işi çağıranın; burada yalnızca dokunma hedefi ve durum.
*/

export function ProfilGorunumu({ userId, kendiProfilim = false, fotograf, onYuklendi, onHata }) {
  const profile = useAsync(() => api.userProfile(userId), [userId])
  const [reviewPage, setReviewPage] = useState(1)
  const reviews = useAsync(() => api.userReviews(userId, reviewPage), [userId, reviewPage])
  /* Arkadaş verisi başlık ve bölüm için TEK çekim; kanca erken dönüşlerden ÖNCE (koşullu
     kanca olmasın) ve profil isteğiyle paralel başlıyor. */
  const arkadaslar = useProfilArkadaslari(userId)

  /* Profil verisi gelince çağırana verilir: başkasının profilindeki eylem düğmeleri
     (arkadaş ekle / engelle) kişinin ADINA ihtiyaç duyuyor ve o ad yalnızca bu istekte
     var. Alternatif aynı ucu ikinci kez çağırmaktı; profil ucu birkaç toplama sorgusu
     koşuyor (web UserProfileView kararı).
     Kanca ERKEN DÖNÜŞLERDEN ÖNCE: aşağıdaki `if (profile.loading) return` koşullu kanca
     üretirdi. Çağıran KARARLI bir setState geçmeli — satır içi işlev her render'da yeni
     kimlik demek ve efekt her seferinde yeniden koşar. */
  useEffect(() => {
    if (profile.data && onYuklendi) onYuklendi(profile.data)
  }, [profile.data, onYuklendi])

  /* Hata da bildiriliyor: çağıran profil gelene kadar eylem satırı için yer tutucu
     çiziyor ve profil hiç gelmeyecekse onu kaldırabilmeli. Hata TEMİZLENİNCE de (null)
     bildiriliyor: "Tekrar dene" yüklemeyi başlatınca yer tutucu geri gelmeli, yoksa profil
     gelince kart yine zıplardı. Aynı KARARLI geri çağrı kuralı. */
  useEffect(() => {
    if (onHata) onHata(profile.error ?? null)
  }, [profile.error, onHata])

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
      <ProfilBasligi
        profile={p}
        benimProfilim={benimProfilim}
        arkadaslar={arkadaslar}
        fotograf={benimProfilim ? fotograf : null}
      />

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
      <ToplulukRozetleri
        oy={p.communityUpvotes}
        kendiProfilim={benimProfilim}
        gonderiSayisi={p.communityPostCount}
        yorumSayisi={p.communityCommentCount}
      />

      <KonuPaneli title="Anlatabilirim" tone="brand" topics={p.canTeach} emptyText="Henüz konu eklenmemiş." />
      {/* Yön durum değil kategori: ikinci panel neutral (yeşil kalktı, kullanıcı kararı, A düzeni). */}
      <KonuPaneli
        title="Öğrenmek istiyorum"
        tone="neutral"
        topics={p.wantsToLearn}
        emptyText="Henüz konu eklenmemiş."
      />

      {/*
        ARKADAŞLAR — konu panelleri ile değerlendirmeler ARASINDA (web yerleşimi).
        Sayfa "kim → ne yapmış → ne yapabilir → başkaları ne diyor" diye okunuyor;
        arkadaş listesi yetenek beyanı değil sosyal kanıt ve en yakın akrabası
        değerlendirmeler. Sayaç şeridine beşinci kutu olarak KONMADI: 2×2 şerit
        2+2+1 öksüz bir satır bırakırdı. Sayı bölümün kendi başlığında ve profil
        başlığındaki arkadaş satırında (aynı veri).
      */}
      <ArkadaslarBolumu veri={arkadaslar} kendiProfilim={benimProfilim} ad={p.displayName} />

      <Degerlendirmeler reviews={reviews} page={reviewPage} onPage={setReviewPage} />
    </View>
  )
}

/*
  PROFİL BAŞLIĞI — Instagram düzeni (web'in üçüncü hâli): ÖNCE KİŞİ, sonra sayılar.
  Avatar (xl) tek başına duran ilk şey; ad sayfanın en büyük metni; okulun altında
  arkadaş satırı; sayaçlar aynı kartın içinde 2×2 şerit. Mobil daima "dar ekran"
  olduğundan web'in sm-altı düzeni (ortalı portre) tek düzen olarak kalır — Instagram da
  öyle yapıyor.

  Kendi profilinde (Profilim) fotoğrafın köşesinde kamera rozeti var ve fotoğrafa dokunmak
  onu değiştiriyor: Profilim'in üstündeki "Fotoğrafı değiştir" düğmesinin yerine geldi
  (2026-09-26, bütün ayarlar Ayarlar ekranına taşındı).
*/
function ProfilBasligi({ profile, benimProfilim, arkadaslar, fotograf }) {
  return (
    <Card dolgu="p-7" className="items-center">
      <ProfilFotografi profile={profile} fotograf={fotograf} />

      {/*
        YÖNETİM ROZETİ ADIN YANINDA, altında değil: forumda rozetli bir yorum görüp
        adına dokunan kullanıcının doğrulamak istediği şey tam olarak bu ve aradığı
        yerde bulmalı. Aşağı kaydırma gerektiren bir rozet, doğrulama adımını
        başarısız kılar.

        Sarmalayıcı flex-wrap: mobilde ad zaten 3xl ve uzun adlarda rozet alt satıra
        iniyor; aynı satırda zorlanırsa ad kırpılır ve kimlik okunamaz hâle gelir —
        rozetin varlığı adın okunmasından daha önemli değil.
      */}
      <View className="mt-4 flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2">
        {/* Başlık rolü: ekran okuyucu kullanıcısı başlıklar arasında gezinerek kişinin adına
            atlayabilsin (eylem bloğu adın ÜSTÜNDE duruyor). */}
        <Text
          accessibilityRole="header"
          className="text-center text-3xl font-bold leading-tight tracking-tight text-slate-900"
        >
          {profile.displayName}
        </Text>
        {profile.isStaff && <YonetimRozeti />}
      </View>

      {(profile.university || profile.department) && (
        <Text className="mt-2 text-center text-sm font-medium text-slate-600">
          {[profile.university, profile.department].filter(Boolean).join(' · ')}
        </Text>
      )}

      <ArkadasOzeti benimProfilim={benimProfilim} veri={arkadaslar} />

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
  PROFİL FOTOĞRAFI — `fotograf` verilmediyse düz avatar (başkasının profili, ya da
  [userId] rotasından açılan kendi profil). Verildiyse avatarın TAMAMI dokunma hedefi
  (cihazda ~98dp); köşedeki kamera rozeti yalnızca görsel işaret, ayrı bir durak değil.

  Avatar'ın yer tutucusu kendisi `accessible` (Avatar.jsx): basılabilir sarmalayıcının
  içinde Android'de ikinci bir durak olup adı ikinci kez okuyordu. İç görünüm ekran
  okuyucudan gizleniyor (ArkadaslarBolumu satırlarındaki çözüm); ad ve durum düğmenin
  kendi etiketinde.

  Rozet boyu px ile: rem cihazda 14 sayılıyor (h-9 → 31.5dp). Yüklenirken avatarın
  üstünde yarı saydam örtü ve beyaz spinner, düğme kapalı: ikinci bir seçici açılsaydı
  ilk yüklemenin sonucu ikincisinin altında kalırdı.
*/
function ProfilFotografi({ profile, fotograf }) {
  const avatar = (
    <Avatar
      userId={profile.userId}
      name={profile.displayName}
      size="xl"
      className="border-4 border-brand-200"
    />
  )
  if (!fotograf) return avatar

  const yukleniyor = Boolean(fotograf.yukleniyor)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={yukleniyor ? 'Profil fotoğrafı yükleniyor' : 'Profil fotoğrafını değiştir'}
      accessibilityState={{ busy: yukleniyor, disabled: yukleniyor }}
      disabled={yukleniyor}
      onPress={fotograf.onPress}
      className="relative self-center rounded-full active:opacity-80"
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {avatar}
        {yukleniyor ? (
          <View className="absolute inset-0 items-center justify-center rounded-full bg-slate-900/40">
            <Spinner renk={beyaz} />
          </View>
        ) : null}
        <View className="absolute bottom-0 right-0 h-[34px] w-[34px] items-center justify-center rounded-full border-[3px] border-white bg-brand-600">
          <KameraIkonu renk={beyaz} boy={16} />
        </View>
      </View>
    </Pressable>
  )
}

/*
  ARKADAŞ SATIRI — okulun altında, "hakkında"nın üstünde. Sayaç şeridine beşinci kutu
  olarak girmedi (ProfilGorunumu'ndaki ARKADAŞLAR notu); sayının yeri kimlik bloğu.

  • Kendi profilin: HAP DÜĞME, arkadaş listesini açar (/eslesmeler?sekme=active; 0
    arkadaşta oradaki boş durum "Arkadaş bul" düğmesini taşıyor). Profilim'in üstündeki
    "Arkadaşlarım" düğmesinin yeni yeri. Veri gelmeden ya da hata verdiyse de SAYISIZ
    çiziliyor: giriş her zaman var ve sayı gelince kart zıplamıyor.
  • Başkasının profili: düz bilgi satırı, eylem yok ("12 arkadaş · 3 ortak"). Tam ya da
    ortak liste aşağıdaki Arkadaşlar bölümünde kalıyor. Yüklenirken aynı yükseklikte boş
    satır (min-h-[20px]). "0 arkadaş" da yazılıyor: sayının bazen görünüp bazen
    görünmemesi, bölümün her profilde aynı çizilmesi kuralını bozardı (ArkadaslarBolumu).

  Kendi profil mi: profil yanıtının isSelf'i (benimProfilim); bölüm de aynı cevabı
  arkadaş yanıtının isSelf'inden alıyor, ikisi sunucudan.
*/
function ArkadasOzeti({ benimProfilim, veri }) {
  const router = useRouter()
  const d = veri.data
  const sayi = d ? (d.friendCount ?? 0) : null

  if (benimProfilim) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          sayi == null ? 'Arkadaşlarım. Listeyi aç' : `Arkadaşlarım, ${sayi} arkadaş. Listeyi aç`
        }
        onPress={() => router.push('/eslesmeler?sekme=active')}
        className="mt-4 min-h-[44px] flex-row items-center gap-2 self-center rounded-full bg-brand-50 px-4 active:bg-brand-100"
      >
        <KisilerIkonu renk={brand[600]} boy={18} />
        <Text className="text-sm font-semibold text-brand-800">
          {sayi == null ? 'Arkadaşlarım' : `Arkadaşlarım · ${sayi}`}
        </Text>
        <SagOkIkonu renk={brand[600]} boy={16} />
      </Pressable>
    )
  }

  const ortak = d?.mutualCount ?? 0
  return (
    <View className="mt-3 min-h-[20px] justify-center">
      {d ? (
        <Text className="text-center text-sm text-slate-600">
          <Text className="font-semibold text-slate-800">{sayi}</Text> arkadaş
          {ortak > 0 ? (
            <>
              {' · '}
              <Text className="font-semibold text-slate-800">{ortak}</Text> ortak
            </>
          ) : null}
        </Text>
      ) : null}
    </View>
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
    <Card dolgu="p-0" className="overflow-hidden">
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
 * tekniğinin RN hâli: altta gri beş yıldız, üstte kırpılan amber kopya).
 * Yuvarlama bilinçli olarak YOK: 4.5 ile 4.9 aynı görünmesin.
 *
 * ⚠️ AMBER KOPYA SABİT GENİŞLİKTE ÇİZİLİYOR, kırpan kutu ondan dar. Eskiden kopya, kırpan
 * kutunun (%92 genişlik) İÇİNE yerleşiyordu: RN metni kabının genişliğine SIĞDIRIR, yani
 * beş yıldız kırpılmak yerine daraltılan satıra sığdırılmaya çalışıldı ve
 * `numberOfLines={1}` sona "…" koydu. 4.6 puan ~3,5 dolu yıldız + üç nokta gibi
 * görünüyordu, 3 puanlık yorumda da aynı iz vardı. Web'de CSS `white-space: nowrap`
 * bu sorunu hiç doğurmuyor; RN'de karşılığı, gri satırın ölçülen genişliğini kopyaya
 * açıkça vermek. +2 px pay: yuvarlanan ölçü yüzünden son yıldız bir alt satıra
 * düşmesin (taşan pay kırpan kutunun dışında kalır, görünmez).
 */
function Yildizlar({ deger, kucuk = false }) {
  const oran = Math.max(0, Math.min(1, Number(deger) / 5))
  const boyut = kucuk ? 'text-xs' : 'text-base'
  const [genislik, setGenislik] = useState(0)

  return (
    <View accessible accessibilityLabel={`5 üzerinden ${Number(deger).toFixed(1)}`} className="self-start">
      <Text
        onLayout={(e) => setGenislik(e.nativeEvent.layout.width)}
        className={`${boyut} leading-none text-slate-300`}
      >
        ★★★★★
      </Text>
      {/* Ölçü gelmeden amber katman çizilmez: tahmini bir genişlikle bir kare yanlış
          dolgu göstermektense bir kare boyunca yalnızca gri satır görünsün. */}
      {genislik > 0 && (
        <View
          className="absolute bottom-0 left-0 top-0 overflow-hidden"
          style={{ width: genislik * oran }}
          pointerEvents="none"
        >
          <Text className={`${boyut} leading-none text-amber-400`} style={{ width: genislik + 2 }}>
            ★★★★★
          </Text>
        </View>
      )}
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
      {/* Genişlikler SABİT kalıyor (çubuk başlangıçları hizalı olsun diye); büyük yazıda metin
          sabit kutuya sığmayınca "Zaman/lama" diye bölünüyordu — artık küçülerek sığıyor. */}
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} className="w-20 shrink-0 text-xs text-slate-600">
        {label}
      </Text>
      <View className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        <View className="h-full rounded-full bg-brand-500" style={{ width: `${oran}%` }} />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {Number(value).toFixed(1)}
      </Text>
    </View>
  )
}
