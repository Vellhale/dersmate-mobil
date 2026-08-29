import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../../src/lib/api'
import { useAsync } from '../../src/state/useAsync'
import { useDebounced } from '../../src/hooks/useDebounced'
import { Avatar } from '../../src/components/Avatar'
import { SeviyeRozeti } from '../../src/components/SeviyeRozeti'
import { EslesmeIstegiModali } from '../../src/components/EslesmeIstegiModali'
import { EkranBasligi } from '../../src/components/EkranBasligi'
import { KepIkonu, SaatIkonu, YildizIkonu } from '../../src/components/Ikonlar'
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Girdi, Loading, Modal, Notice, Spinner } from '../../src/components/ui'
import { amber, brand, slate } from '../../src/lib/theme'

/*
  KEŞFET — web'deki pages/Discover.jsx'in portu, İKİ FARKLA:

  1. ÖNERİ MODU BURADA YOK: kişiselleştirilmiş öneriler Akış sekmesinde yaşıyor
     (Instagram düzeninin gereği). Keşfet saf arama/filtre ekranı — web'de "arama
     kutusuna dokununca girilen" mod, burada varsayılan.
  2. SAYFALAMA DEĞİL SONSUZ KAYDIRMA: web önceki/sonraki düğmeleri kullanıyordu;
     mobil listede sayfa değiştirme düğmesi başparmağa ters — FlatList onEndReached
     sayfaları BİRİKTİRİR. Filtre/arama değişince liste sıfırdan kurulur.

  İki sekme web'den aynen: YKS (konu/ilan araması) ve Üniversite (okul/bölüm ağı).
  İki durum nesnesi AYRI (web kararı): ortak nesne, sekme geçişinde yazılanı silmek
  ya da bir kipin alanını diğerinin sorgusuna sızdırmak zorunda bırakırdı.
*/

const VARSAYILAN_FILTRELER = {
  categoryId: null,
  sort: 'Relevance',
  minLevel: null,
  minRating: null,
}

const UNIVERSITE_VARSAYILAN = { university: '', department: '' }

const SEKMELER = [
  { key: 'yks', label: 'YKS' },
  { key: 'universite', label: 'Üniversite' },
]

const SAYFA_BOYU = 20

/*
  BİRİKTİRMELİ LİSTE KANCASI — arama/filtre değişince 1. sayfadan kurulur, liste sonuna
  gelinince sonraki sayfa EKLENİR.

  Yarışlara karşı sıra numarası (seq): filtre hızla değişirken geç dönen eski yanıt,
  yeni listeyi ezmemeli. Her yükleme kendi numarasını taşır; dönen yanıt güncel değilse
  sessizce atılır. Çift tetiklenmeye karşı yükleme bayrağı ref'te — state bir sonraki
  render'a kadar eski değeri gösterir (web'deki gonderimKilidi gerekçesi).
*/
function useBirikenListe(aktif, yukleyici, bagimliliklar, anahtar) {
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [page, setPage] = useState(0)
  const [ilkYukleme, setIlkYukleme] = useState(false)
  const [ekYukleme, setEkYukleme] = useState(false)
  const [error, setError] = useState(null)
  const seq = useRef(0)
  const kilit = useRef(false)
  const basarisizHedef = useRef(null)

  async function sayfaGetir(hedefSayfa) {
    const benimSeq = ++seq.current
    kilit.current = true
    if (hedefSayfa === 1) setIlkYukleme(true)
    else setEkYukleme(true)
    setError(null)
    try {
      const data = await yukleyici(hedefSayfa, SAYFA_BOYU)
      if (seq.current !== benimSeq) return
      setItems((prev) => {
        if (hedefSayfa === 1) return data.items
        // Ekleme anahtara göre TEKİLLEŞTİRİLİR: sunucu saf ofset sayfalıyor ve üste
        // yeni kayıt düşerse bir sonraki sayfa öncekinin son öğesini tekrar getirir;
        // süzülmezse aynı anahtar FlatList'e iki kez girer.
        const görülen = new Set(prev.map(anahtar))
        return [...prev, ...data.items.filter((x) => !görülen.has(anahtar(x)))]
      })
      setTotalCount(data.totalCount)
      setHasNextPage(Boolean(data.hasNextPage ?? data.page < data.totalPages))
      setPage(hedefSayfa)
      basarisizHedef.current = null
    } catch (err) {
      if (seq.current === benimSeq) {
        // Başarısız HEDEF ayrıca tutulur: page yalnızca başarıda ilerliyor ve retry
        // page'i hedeflese, zaten yüklü sayfayı İKİNCİ KEZ ekleyip başarısız sayfayı
        // hiç denemezdi (dersler.jsx'teki dahaGetir'in doğru kurulumuyla aynı ders).
        basarisizHedef.current = hedefSayfa
        setError(err)
      }
    } finally {
      if (seq.current === benimSeq) {
        kilit.current = false
        setIlkYukleme(false)
        setEkYukleme(false)
      }
    }
  }

  useEffect(() => {
    if (!aktif) {
      // Pasif sekmenin sorgusu koşmaz (web'deki Promise.resolve(null) kararı);
      // eski sonuçlar da temizlenir ki sekmeye dönüşte bayat liste görünmesin.
      seq.current += 1
      setItems([])
      setTotalCount(0)
      setHasNextPage(false)
      setPage(0)
      return
    }
    sayfaGetir(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktif, ...bagimliliklar])

  return {
    items,
    totalCount,
    error,
    ilkYukleme,
    ekYukleme,
    dahaGetir: () => {
      if (!kilit.current && hasNextPage) sayfaGetir(page + 1)
    },
    yenidenDene: () => sayfaGetir(basarisizHedef.current ?? (page === 0 ? 1 : page)),
  }
}

export default function Kesfet() {
  const [sekme, setSekme] = useState('yks')
  const [term, setTerm] = useState('')
  const [filters, setFilters] = useState(VARSAYILAN_FILTRELER)
  const [uniFiltre, setUniFiltre] = useState(UNIVERSITE_VARSAYILAN)
  const [filtreAcik, setFiltreAcik] = useState(false)
  const [hedef, setHedef] = useState(null)
  const [sohbetHedefi, setSohbetHedefi] = useState(null)
  const [notice, setNotice] = useState(null)

  const universiteKipi = sekme === 'universite'
  const debouncedTerm = useDebounced(term)

  const filtersTouched =
    filters.categoryId !== null ||
    filters.minLevel !== null ||
    filters.minRating !== null ||
    filters.sort !== VARSAYILAN_FILTRELER.sort

  const searchMode = debouncedTerm.trim().length > 0 || filtersTouched

  const categories = useAsync(() => api.categories(), [])
  // Eşleşme modalındaki takas teklifi listesi için (Akış'takiyle aynı ihtiyaç).
  const portfolio = useAsync(() => api.myPortfolio(), [])
  const myOffers = portfolio.data?.filter((e) => e.direction === 'Offer') ?? []

  const yks = useBirikenListe(
    !universiteKipi && searchMode,
    (page, pageSize) =>
      api.searchOffers({ ...filters, search: debouncedTerm.trim(), page, pageSize }),
    [debouncedTerm, filters.categoryId, filters.sort, filters.minLevel, filters.minRating],
    (o) => o.offerId,
  )

  const gecikmeliUniversite = useDebounced(uniFiltre.university)
  const gecikmeliBolum = useDebounced(uniFiltre.department)

  const uni = useBirikenListe(
    universiteKipi,
    (page, pageSize) =>
      api.searchUniversityPeers({
        university: gecikmeliUniversite,
        department: gecikmeliBolum,
        page,
        pageSize,
      }),
    [gecikmeliUniversite, gecikmeliBolum],
    (k) => k.userId,
  )

  const aktifFiltreSayisi = useMemo(
    () =>
      [filters.categoryId, filters.minLevel, filters.minRating].filter((v) => v !== null).length +
      (filters.sort !== VARSAYILAN_FILTRELER.sort ? 1 : 0),
    [filters],
  )

  function resetAll() {
    setFilters(VARSAYILAN_FILTRELER)
    setTerm('')
    setFiltreAcik(false)
  }

  const liste = universiteKipi ? uni : yks

  const baslikBolumu = (
    <View className="gap-3 pb-3">
      {/* Sekme şeridi */}
      <View className="flex-row self-start rounded-xl bg-slate-100 p-1">
        {SEKMELER.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: sekme === item.key }}
            onPress={() => setSekme(item.key)}
            className={`min-h-[44px] justify-center rounded-lg px-4 ${
              sekme === item.key ? 'bg-white' : ''
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                sekme === item.key ? 'text-brand-700' : 'text-slate-600'
              }`}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-sm text-slate-600">
        {universiteKipi
          ? 'Aynı üniversiteden ya da okumak istediğin bölümden öğrencileri bul.'
          : 'Katalogdaki tüm ders ilanlarında ara; önerilerin Akış sekmesinde.'}
      </Text>

      {notice && (
        <Notice tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}

      {/* Arama kutusu ÜNİVERSİTE SEKMESİNDE YOK (web kararı): o kutu konu/ders arar,
          üniversite ağında konu kavramı yok — çalışmayan bir denetim olurdu. */}
      {universiteKipi ? (
        <View className="gap-2">
          <Girdi
            value={uniFiltre.university}
            onChangeText={(v) => setUniFiltre((f) => ({ ...f, university: v }))}
            placeholder="Üniversite adı…"
            accessibilityLabel="Üniversite"
          />
          <Girdi
            value={uniFiltre.department}
            onChangeText={(v) => setUniFiltre((f) => ({ ...f, department: v }))}
            placeholder="Bölüm adı…"
            accessibilityLabel="Bölüm"
          />
        </View>
      ) : (
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Girdi
              value={term}
              onChangeText={setTerm}
              placeholder="Konu, ders ya da eğitmen ara…"
              accessibilityLabel="Ara"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
          <Button variant="secondary" onPress={() => setFiltreAcik(true)}>
            Filtre{aktifFiltreSayisi > 0 ? ` (${aktifFiltreSayisi})` : ''}
          </Button>
        </View>
      )}

      <ErrorBox error={liste.error} onRetry={liste.yenidenDene} />

      {!universiteKipi && searchMode && !liste.ilkYukleme && !liste.error && (
        <Text className="text-sm font-semibold text-slate-800">{liste.totalCount} ilan</Text>
      )}
      {universiteKipi && !liste.ilkYukleme && !liste.error && liste.items.length > 0 && (
        <Text className="text-sm font-semibold text-slate-800">{liste.totalCount} öğrenci</Text>
      )}
    </View>
  )

  const bosDurum = liste.ilkYukleme ? (
    <Loading label="Aranıyor…" />
  ) : liste.error ? null : universiteKipi ? (
    <EmptyState
      title="Kimseyi bulamadık"
      description="Üniversite ya da bölüm adını değiştirip tekrar dene."
    />
  ) : searchMode ? (
    <EmptyState
      title="Sonuç yok"
      description="Aramayı kısaltmayı ya da filtreleri gevşetmeyi dene."
      action={
        <Button variant="secondary" onPress={resetAll}>
          Filtreleri temizle
        </Button>
      }
    />
  ) : (
    <EmptyState
      title="Aramaya başla"
      description="Konu, ders ya da eğitmen adı yaz — ya da filtreyle TYT/AYT kataloğunu süz."
    />
  )

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <EkranBasligi baslik="Keşfet" />

      <FlatList
        data={liste.items}
        keyExtractor={(item) => (universiteKipi ? item.userId : item.offerId)}
        renderItem={({ item }) =>
          universiteKipi ? (
            <UniversiteKarti kisi={item} onSohbet={setSohbetHedefi} />
          ) : (
            <IlanSonucKarti offer={item} onIstek={setHedef} />
          )
        }
        contentContainerClassName="gap-3 p-4"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={baslikBolumu}
        ListEmptyComponent={bosDurum}
        onEndReached={liste.dahaGetir}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          liste.ekYukleme ? (
            <View className="py-4">
              <Spinner />
            </View>
          ) : null
        }
      />

      <FiltreModali
        open={filtreAcik}
        onClose={() => setFiltreAcik(false)}
        value={filters}
        onChange={setFilters}
        onReset={resetAll}
        categories={categories.data ?? []}
        resultCount={searchMode && !universiteKipi && !liste.ilkYukleme ? liste.totalCount : null}
      />

      <EslesmeIstegiModali
        person={hedef}
        myOffers={myOffers}
        onClose={() => setHedef(null)}
        onSent={(name) => {
          setHedef(null)
          setNotice(`${name} kişisine eşleşme isteği gönderildi. Kabul edilince sohbet açılacak.`)
        }}
      />

      <SohbetIstegiModali
        kisi={sohbetHedefi}
        onClose={() => setSohbetHedefi(null)}
        onSent={(name) => {
          setSohbetHedefi(null)
          setNotice(`${name} kişisine sohbet isteği gönderildi. Kabul edilince sohbet açılacak.`)
        }}
      />
    </SafeAreaView>
  )
}

/*
  İLAN SONUÇ KARTI — web SearchResults kartının portu. Akış kartıyla aynı kimlik
  hiyerarşisi; SEVİYE ROZETİ YOK (arama ucu ilanı döndürür, eğitmenin genel seviyesini
  değil — yer tutucu rozet olmayan veriyi uydururdu). Puanı olmayan eğitmende "Yeni"
  rozeti puanın yokluğunu söyler.
*/
function IlanSonucKarti({ offer, onIstek }) {
  const router = useRouter()

  return (
    <Card>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${offer.tutorDisplayName} profilini aç`}
        onPress={() => router.push(`/profil/${offer.tutorUserId}`)}
        className="flex-row items-start gap-4"
      >
        <Avatar userId={offer.tutorUserId} name={offer.tutorDisplayName} size="lg" className="border-2 border-white" />

        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text className="shrink text-base font-semibold text-brand-700" numberOfLines={2}>
              {offer.tutorDisplayName}
            </Text>
            {offer.tutorRatingCount === 0 && <Badge tone="neutral">Yeni</Badge>}
          </View>

          {offer.tutorRatingCount > 0 && (
            <View className="mt-1.5 flex-row items-center gap-1.5">
              <YildizIkonu renk={amber[500]} boy={14} />
              <Text className="text-xs font-semibold text-slate-700">
                {Number(offer.tutorAverageRating).toFixed(1)}
              </Text>
              <Text className="text-xs text-slate-600">({offer.tutorRatingCount} değerlendirme)</Text>
            </View>
          )}
        </View>
      </Pressable>

      {offer.tutorBio ? (
        <Text numberOfLines={2} className="mt-3 text-sm leading-relaxed text-slate-600">
          {offer.tutorBio}
        </Text>
      ) : null}

      <View className="mt-3 flex-row flex-wrap gap-1.5">
        <View className="max-w-full flex-row items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1">
          <KepIkonu renk={brand[700]} boy={14} />
          <Text numberOfLines={1} className="shrink text-xs font-medium text-brand-700">
            {offer.topicName}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
          <SaatIkonu renk={slate[600]} boy={14} />
          <Text className="text-xs font-medium text-slate-700">30 / 60 dk</Text>
        </View>
      </View>
      <Text className="mt-2 text-xs text-slate-600">
        {offer.categoryName} · {offer.subjectName} · seviye {offer.selfAssessedLevel}/5
      </Text>

      {offer.note ? (
        <Text numberOfLines={3} className="mt-2 text-sm text-slate-600">
          {offer.note}
        </Text>
      ) : null}

      <View className="mt-4">
        <Button
          onPress={() =>
            /* Arama sonucunda konu ZATEN belli: istek modalına tek elemanlı
               "anlatabilir" listesiyle girilir; uç, karşı tarafın öğrenmek
               istediklerini dönmediği için takas listesi boş kalır (web kararı). */
            onIstek({
              userId: offer.tutorUserId,
              displayName: offer.tutorDisplayName,
              theyCanTeach: [
                { topicId: offer.topicId, topicName: offer.topicName, subjectName: offer.subjectName },
              ],
              theyWantToLearn: [],
            })
          }
        >
          Eşleşme isteği gönder
        </Button>
      </View>
    </Card>
  )
}

/*
  ÜNİVERSİTE KARTI — web UniversiteKarti portu. KARTTA DERS/KONU YOK (bilinçli): kayıt
  bir ilan değil, kişinin okuduğu yer. BÖLÜM VURGULU (marka pill), üniversite düz satır.
  1–10 genel seviye rozeti burada da var: seviye kişiye ait, konuya değil.
*/
function UniversiteKarti({ kisi, onSohbet }) {
  const router = useRouter()

  return (
    <Card>
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

          {kisi.university ? (
            <Text numberOfLines={1} className="mt-1.5 text-sm text-slate-600">
              {kisi.university}
            </Text>
          ) : null}

          {kisi.ratingCount > 0 ? (
            <View className="mt-1.5 flex-row items-center gap-1.5">
              <YildizIkonu renk={amber[500]} boy={14} />
              <Text className="text-xs font-semibold text-slate-700">
                {Number(kisi.averageRating).toFixed(1)}
              </Text>
              <Text className="text-xs text-slate-600">({kisi.ratingCount} değerlendirme)</Text>
            </View>
          ) : (
            /* Üniversite kartında puan tek sinyal — yokluğu da bilgi (web kararı). */
            <Text className="mt-1.5 text-xs text-slate-600">Henüz değerlendirilmemiş</Text>
          )}
        </View>
      </Pressable>

      {kisi.department ? (
        <View className="mt-3 flex-row">
          <View className="max-w-full flex-row items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1">
            <KepIkonu renk={brand[700]} boy={14} />
            <Text numberOfLines={1} className="shrink text-xs font-medium text-brand-700">
              {kisi.department}
            </Text>
          </View>
        </View>
      ) : null}

      <View className="mt-4">
        <Button onPress={() => onSohbet(kisi)}>Sohbet isteği gönder</Button>
      </View>
    </Card>
  )
}

/*
  SOHBET İSTEĞİ — web SohbetIstegiModali portu. Eşleşme modalından AYRI (web kararı):
  oradaki formun tamamı konu seçimidir ve burada seçilecek konu yok.
  requestedTopicId null gider — uç konusuz isteği böyle tanır.
*/
function SohbetIstegiModali({ kisi, onClose, onSent }) {
  const [hata, setHata] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sonKisi, setSonKisi] = useState(null)
  useEffect(() => {
    if (kisi) {
      setSonKisi(kisi)
      setHata(null)
    }
  }, [kisi])
  const gosterilen = kisi ?? sonKisi

  async function gonder() {
    if (busy || !kisi) return
    setBusy(true)
    setHata(null)
    try {
      await api.createMatch({
        responderUserId: kisi.userId,
        requestedTopicId: null,
        offeredTopicId: null,
      })
      onSent(kisi.displayName)
    } catch (err) {
      setHata(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={Boolean(kisi)}
      onClose={onClose}
      title="Sohbet isteği"
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Vazgeç
          </Button>
          <Button onPress={gonder} loading={busy}>
            İsteği gönder
          </Button>
        </>
      }
    >
      {gosterilen && (
        <View className="gap-3 pb-2">
          <View>
            <Text className="font-semibold text-slate-800">{gosterilen.displayName}</Text>
            {gosterilen.university ? (
              <Text className="text-sm text-slate-600">{gosterilen.university}</Text>
            ) : null}
            {gosterilen.department ? (
              <Text className="text-sm font-medium text-slate-800">{gosterilen.department}</Text>
            ) : null}
          </View>

          <Text className="text-sm text-slate-600">
            Kabul edilirse sohbet açılır ve doğrudan yazışabilirsiniz.
          </Text>

          <ErrorBox error={hata} />
        </View>
      )}
    </Modal>
  )
}

/* ── FİLTRE MODALI — web FilterPanel'in alt sayfa hâli ──────────────────────── */

const SIRALAMALAR = [
  { value: 'Relevance', label: 'Önerilen' },
  { value: 'Popular', label: 'Popüler' },
  { value: 'RatingDesc', label: 'Puanı yüksek' },
  { value: 'RatingAsc', label: 'Puanı düşük' },
  { value: 'Newest', label: 'En yeni' },
]

/* Eşikler web'den: anlamlı eşik üç tane, sıra katıdan gevşeğe. null = filtre kapalı —
   aktif filtre sayacı null'u "dokunulmamış" sayar, 0 değil. */
const PUANLAR = [
  { value: 4.5, label: '4.5+' },
  { value: 4, label: '4.0+' },
  { value: 3.5, label: '3.5+' },
  { value: null, label: 'Hepsi' },
]

/* Web'de 1–5 kaydırıcıydı (1 = Hepsi); RN'de yerleşik kaydırıcı yok ve beş değerlik
   seçim için pill'ler zaten daha net — aynı sözleşme: null = filtre yok. */
const SEVIYELER = [
  { value: null, label: 'Hepsi' },
  { value: 2, label: '2+' },
  { value: 3, label: '3+' },
  { value: 4, label: '4+' },
  { value: 5, label: '5' },
]

function Pill({ active, onPress, children }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      className={`min-h-[44px] justify-center rounded-full border px-3.5 ${
        active ? 'border-brand-500 bg-brand-600' : 'border-slate-200 bg-white active:bg-brand-50'
      }`}
    >
      <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-slate-600'}`}>
        {children}
      </Text>
    </Pressable>
  )
}

function FiltreBolumu({ baslik, children }) {
  return (
    <View>
      <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {baslik}
      </Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  )
}

function FiltreModali({ open, onClose, value, onChange, onReset, categories, resultCount }) {
  const set = (patch) => onChange({ ...value, ...patch })

  // Ağaç düz gelir; kökler (TYT/AYT) ve alt dallar burada ayrılır (web kararı: alt
  // kategoriler yalnızca kök seçiliyken — hepsi birden pill duvarı olurdu).
  const roots = categories.filter((c) => !c.parentCategoryId)
  const childrenOf = (id) => categories.filter((c) => c.parentCategoryId === id)
  const selectedRoot =
    roots.find((r) => r.categoryId === value.categoryId) ??
    roots.find((r) => childrenOf(r.categoryId).some((c) => c.categoryId === value.categoryId))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filtreler"
      footer={
        <>
          <Button variant="secondary" onPress={onReset}>
            Temizle
          </Button>
          <Button onPress={onClose}>
            {resultCount === null ? 'Uygula' : `${resultCount} sonucu göster`}
          </Button>
        </>
      }
    >
      <View className="gap-5 pb-2">
        <FiltreBolumu baslik="Kategori">
          <Pill active={!value.categoryId} onPress={() => set({ categoryId: null })}>
            Tümü
          </Pill>
          {roots.map((root) => (
            <Pill
              key={root.categoryId}
              active={value.categoryId === root.categoryId}
              onPress={() => set({ categoryId: root.categoryId })}
            >
              {root.name}
            </Pill>
          ))}
        </FiltreBolumu>

        {selectedRoot && childrenOf(selectedRoot.categoryId).length > 0 && (
          <View className="border-l-2 border-slate-200 pl-3">
            <View className="flex-row flex-wrap gap-2">
              {childrenOf(selectedRoot.categoryId).map((child) => (
                <Pill
                  key={child.categoryId}
                  active={value.categoryId === child.categoryId}
                  onPress={() =>
                    set({
                      // Seçili alt kategoriye tekrar basmak kökü geri getirir (aç/kapa).
                      categoryId:
                        value.categoryId === child.categoryId
                          ? selectedRoot.categoryId
                          : child.categoryId,
                    })
                  }
                >
                  {child.name}
                </Pill>
              ))}
            </View>
          </View>
        )}

        <FiltreBolumu baslik="Sıralama">
          {SIRALAMALAR.map((sort) => (
            <Pill key={sort.value} active={value.sort === sort.value} onPress={() => set({ sort: sort.value })}>
              {sort.label}
            </Pill>
          ))}
        </FiltreBolumu>

        <View>
          <FiltreBolumu baslik="Eğitmenin konu seviyesi">
            {SEVIYELER.map((s) => (
              <Pill key={s.label} active={value.minLevel === s.value} onPress={() => set({ minLevel: s.value })}>
                {s.label}
              </Pill>
            ))}
          </FiltreBolumu>
          <Text className="mt-1 text-xs text-slate-500">
            Eğitmenin o konudaki öz değerlendirmesi (1–5).
          </Text>
        </View>

        <View>
          <FiltreBolumu baslik="Eğitmen puanı">
            {PUANLAR.map((rating) => (
              <Pill
                key={rating.label}
                active={value.minRating === rating.value}
                onPress={() => set({ minRating: rating.value })}
              >
                {rating.label}
              </Pill>
            ))}
          </FiltreBolumu>
          <Text className="mt-1 text-xs text-slate-500">Aldığı değerlendirmelerin ortalaması.</Text>
        </View>
      </View>
    </Modal>
  )
}
