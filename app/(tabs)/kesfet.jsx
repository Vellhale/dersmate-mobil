import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { sekmeAltDolgusu } from '../../src/lib/sekmeCubugu'
import { api } from '../../src/lib/api'
import { formatDate } from '../../src/lib/format'
import { useAsync } from '../../src/state/useAsync'
import { useDebounced } from '../../src/hooks/useDebounced'
import { Avatar } from '../../src/components/Avatar'
import { SeviyeRozeti } from '../../src/components/SeviyeRozeti'
import { YonetimRozeti } from '../../src/components/YonetimRozeti'
import { EslesmeIstegiModali } from '../../src/components/EslesmeIstegiModali'
import { EngellemeModali } from '../../src/components/EngellemeModali'
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

  Üç sekme web'den aynen: YKS (konu/ilan araması), Üniversite (okul/bölüm ağı) ve Arkadaş
  Ekle (isimle kişi araması, web #30). Üç durum nesnesi AYRI (web kararı): ortak nesne,
  sekme geçişinde yazılanı silmek ya da bir kipin alanını diğerinin sorgusuna sızdırmak
  zorunda bırakırdı — isim `term`e bağlansaydı sekme değişince yazılan ad ilan aramasına
  dönüşürdü.

  ⚠️ `!universiteKipi` artık "YKS" demek DEĞİL. YKS'ye özgü her dal `yksKipi`ye bakar;
  iki sekme varsayan bir koşul kalırsa Arkadaş Ekle'de YKS sorgusu koşar ve ilan kartı
  çizilir.
*/

const VARSAYILAN_FILTRELER = {
  categoryId: null,
  sort: 'Relevance',
  minLevel: null,
  minRating: null,
}

const UNIVERSITE_VARSAYILAN = { university: '', department: '' }

/*
  En az iki harf (web ARKADAS_MIN_HARF). Sunucu daha kısa ismi HATA VERMEDEN yok sayıyor ve
  üniversite ağını döndürüyor (SearchUniversityPeers): alt sınır burada uygulanmazsa
  kullanıcı rastgele bir kalabalık görür. Tek harf zaten neredeyse herkesi getiren,
  sorusu olmayan bir sorgu.
*/
const ARKADAS_MIN_HARF = 2

const SEKMELER = [
  { key: 'yks', label: 'YKS' },
  { key: 'universite', label: 'Üniversite' },
  /* "Şu kişi burada mı" sorusu. Üniversite sekmesine bir isim alanı olarak konsaydı,
     üniversitesini yazmamış kişiler orada görünmediği için alan çalışmıyor gibi dururdu
     (web kararı). */
  { key: 'arkadas', label: 'Arkadaş Ekle' },
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

      /*
        YÜKLEME BAYRAKLARI DA SIFIRLANMALI.

        seq artırıldığı anda uçuştaki isteğin `finally` bloğu artık koşulunu sağlamıyor
        (seq.current === benimSeq false) ve bayrakları TEMİZLEMİYOR. Arama kutusu yazı
        yazılırken temizlendiğinde tam bu oluyordu: ekranda "Aramaya başla" yönlendirmesi
        yerine sonsuza kadar dönen bir "Aranıyor…" spinner'ı kalıyor, kullanıcı arama
        kutusuna yeniden bir şey yazana kadar da çıkmıyordu.

        Kilit de bırakılıyor: aksi hâlde sonraki arama "zaten yükleniyor" sanılıp
        hiç başlatılmazdı.
      */
      kilit.current = false
      basarisizHedef.current = null
      setIlkYukleme(false)
      setEkYukleme(false)
      setError(null)
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
    /*
      YENİDEN KUR — engelleme/engel kaldırma sonrası (web'deki reload({ silent }) karşılığı).
      1. sayfadan kurulur: engellenen kartı yerelde silmek, sunucu saf ofset sayfaladığı için
      bir SONRAKİ sayfada bir kişiyi atlatırdı (düşen kişiyle herkes bir sıra kayıyor;
      yukarıdaki tekilleştirme çift kaydı yakalar, atlamayı yakalamaz). Birikmiş sayfaların
      kaybı, engelleme gibi seyrek bir işlemde kabul edilebilir.
      Pasif listede HİÇBİR ŞEY yapmaz: yoksa "adını yaz" durumunda kısa isimle istek gider
      ve sunucu ismi yok sayıp üniversite ağını döndürür.
    */
    yenile: () => {
      if (aktif) sayfaGetir(1)
    },
  }
}

export default function Kesfet() {
  const guvenli = useSafeAreaInsets()
  const [sekme, setSekme] = useState('yks')
  const [term, setTerm] = useState('')
  const [filters, setFilters] = useState(VARSAYILAN_FILTRELER)
  const [uniFiltre, setUniFiltre] = useState(UNIVERSITE_VARSAYILAN)
  const [filtreAcik, setFiltreAcik] = useState(false)
  const [hedef, setHedef] = useState(null)
  const [sohbetHedefi, setSohbetHedefi] = useState(null)
  const [engelHedefi, setEngelHedefi] = useState(null)
  const [engelListesiAcik, setEngelListesiAcik] = useState(false)
  const [notice, setNotice] = useState(null)
  // İsim kutusu `term`e BAĞLANMAZ (web kararı — üstteki blok yorumu).
  const [arkadasIsim, setArkadasIsim] = useState('')

  const yksKipi = sekme === 'yks'
  const universiteKipi = sekme === 'universite'
  const arkadasKipi = sekme === 'arkadas'
  const debouncedTerm = useDebounced(term)

  const filtersTouched =
    filters.categoryId !== null ||
    filters.minLevel !== null ||
    filters.minRating !== null ||
    filters.sort !== VARSAYILAN_FILTRELER.sort

  const searchMode = debouncedTerm.trim().length > 0 || filtersTouched

  const categories = useAsync(() => api.categories(), [])
  // Arkadaş isteği modalındaki takas teklifi listesi için (Akış'takiyle aynı ihtiyaç).
  const portfolio = useAsync(() => api.myPortfolio(), [])
  const myOffers = portfolio.data?.filter((e) => e.direction === 'Offer') ?? []

  const yks = useBirikenListe(
    yksKipi && searchMode,
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

  /*
    İSİMLE ARAMA — üniversite ağıyla AYNI uç (web kararı: aynı sıralama, sayfalama ve engel
    elemesini ikinci kez yazmamak için). Sunucu `name` gelince üniversite şartını düşürüyor.
    İki harften kısa sorgu HİÇ atılmıyor: liste pasif kalıyor.
  */
  const gecikmeliIsim = useDebounced(arkadasIsim)
  const isimSorgusu = gecikmeliIsim.trim()
  const isimYeterli = isimSorgusu.length >= ARKADAS_MIN_HARF

  const arkadas = useBirikenListe(
    arkadasKipi && isimYeterli,
    (page, pageSize) => api.searchUniversityPeers({ name: isimSorgusu, page, pageSize }),
    [isimSorgusu],
    (k) => k.userId,
  )

  // Engellediklerim yalnızca bu sekmede yükleniyor (web kararı): her Keşfet açılışında bir
  // istek daha atmanın karşılığı yok, liste yalnızca burada görünüyor.
  const engellilerim = useAsync(
    () => (arkadasKipi ? api.myBlocks() : Promise.resolve(null)),
    [arkadasKipi],
  )
  const engelSayisi = engellilerim.data?.length ?? 0

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

  const liste = arkadasKipi ? arkadas : universiteKipi ? uni : yks

  const baslikBolumu = (
    <View className="gap-3 pb-3">
      {/* Sekme şeridi — üç sekme EŞİT GENİŞLİKTE (Arkadaşlar ekranındaki kalıp). Eski
          self-start şerit üç sekmeyle 360 dp ve 1.3 yazı ölçeğinde ~346 dp tutuyor,
          kullanılabilir genişlik 328 dp: son sekme ekran dışına düşüp dokunulamaz olurdu.
          flex-1 ile uzun ad sekmenin içinde sarıyor, hedef 44 dp kalıyor. */}
      <View className="flex-row rounded-xl bg-slate-100 p-1">
        {SEKMELER.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: sekme === item.key }}
            onPress={() => setSekme(item.key)}
            className={`min-h-[44px] flex-1 items-center justify-center rounded-lg px-2 ${
              sekme === item.key ? 'bg-white' : ''
            }`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                sekme === item.key ? 'text-brand-700' : 'text-slate-600'
              }`}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-sm text-slate-600">
        {arkadasKipi
          ? 'Adını bildiğin birini bul ve arkadaş isteği gönder. Ders ilanı vermemiş, profilini doldurmamış kişiler de burada çıkar.'
          : universiteKipi
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
      {arkadasKipi ? (
        /* Kutu İSİM arıyor. Düğme "Filtre" değil: bu sekmede alt sayfanın içi engel listesi,
           "Filtre" yazsaydı açan kişi filtre arar, bulamazdı. Engellediklerim YALNIZCA burada
           (web kararı): engelleme bu sekmenin ikizi — kapsam "herkes aranabilir" diye
           açıldığında bedeli olarak geldi. Başka bir yere konsaydı engelini geri almak
           isteyen kullanıcı onu aramak zorunda kalırdı. */
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Girdi
              value={arkadasIsim}
              onChangeText={setArkadasIsim}
              placeholder="Adını yaz…"
              accessibilityLabel="İsimle ara"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="search"
            />
          </View>
          <Button variant="secondary" onPress={() => setEngelListesiAcik(true)}>
            Engellediklerim{engelSayisi > 0 ? ` (${engelSayisi})` : ''}
          </Button>
        </View>
      ) : universiteKipi ? (
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

      {yksKipi && searchMode && !liste.ilkYukleme && !liste.error && (
        <Text className="text-sm font-semibold text-slate-800">{liste.totalCount} ilan</Text>
      )}
      {universiteKipi && !liste.ilkYukleme && !liste.error && liste.items.length > 0 && (
        <Text className="text-sm font-semibold text-slate-800">{liste.totalCount} öğrenci</Text>
      )}
      {arkadasKipi && isimYeterli && !liste.ilkYukleme && !liste.error && liste.items.length > 0 && (
        <Text className="text-sm font-semibold text-slate-800">{liste.totalCount} kişi</Text>
      )}
    </View>
  )

  /* Arkadaş Ekle'de ÜÇ AYRI boş durum (web kararı): davet (hiç yazılmamış ya da kısa),
     aranıyor, sonuç yok. Tek bir "bulunamadı", henüz aramamış kullanıcıya "aradık, yok"
     derdi — bu yüzden "adını yaz" dalı yükleniyor dalından ÖNCE. */
  const bosDurum = arkadasKipi && !isimYeterli ? (
    <EmptyState
      title="Aradığın kişinin adını yaz"
      description={`Adının en az ${ARKADAS_MIN_HARF} harfini yazdığında sonuçlar burada çıkar. Ders ilanı olmayan, profilini doldurmamış kişiler de bulunur.`}
    />
  ) : liste.ilkYukleme ? (
    <Loading label="Aranıyor…" />
  ) : liste.error ? null : arkadasKipi ? (
    <EmptyState
      title="Kimseyi bulamadık"
      description="Adı platformda yazdığı şekliyle dene. Kişi henüz kayıtlı olmayabilir."
    />
  ) : universiteKipi ? (
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
        keyExtractor={(item) => (yksKipi ? item.offerId : item.userId)}
        renderItem={({ item }) =>
          yksKipi ? (
            <IlanSonucKarti offer={item} onIstek={setHedef} />
          ) : (
            /* Arkadaş Ekle kartı YENİDEN YAZILMADI: iki listede gösterilen şey aynı, bir kişi
               (web kararı). Yalnızca istek metni değişiyor. */
            <UniversiteKarti
              kisi={item}
              onSohbet={setSohbetHedefi}
              onEngelle={setEngelHedefi}
              istekMetni={arkadasKipi ? 'Arkadaş isteği gönder' : 'Sohbet isteği gönder'}
            />
          )
        }
        contentContainerClassName="gap-3 p-4"
        /* Yüzen sekme çubuğu içeriğin ÜSTÜNDE duruyor; alt dolgu olmadan son öğe onun
           altında kalır (bkz. src/lib/sekmeCubugu.js). */
        contentContainerStyle={{ paddingBottom: sekmeAltDolgusu(guvenli.bottom) }}
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
        resultCount={searchMode && yksKipi && !liste.ilkYukleme ? liste.totalCount : null}
      />

      <EslesmeIstegiModali
        person={hedef}
        myOffers={myOffers}
        onClose={() => setHedef(null)}
        onSent={(name) => {
          setHedef(null)
          setNotice(`${name} kişisine arkadaş isteği gönderildi. Kabul edilince sohbet açılacak.`)
        }}
      />

      <SohbetIstegiModali
        kisi={sohbetHedefi}
        arkadaslik={arkadasKipi}
        onClose={() => setSohbetHedefi(null)}
        onSent={(name) => {
          setSohbetHedefi(null)
          setNotice(
            arkadasKipi
              ? `${name} kişisine arkadaş isteği gönderildi. Kabul edilince sohbet açılacak.`
              : `${name} kişisine sohbet isteği gönderildi. Kabul edilince sohbet açılacak.`,
          )
        }}
      />

      <EngellemeModali
        kisi={engelHedefi}
        onClose={() => setEngelHedefi(null)}
        onEngellendi={(name) => {
          setEngelHedefi(null)
          setNotice(`${name} engellendi. Artık birbirinize istek gönderemezsiniz.`)
          /* Engellenen kişi sonuçlardan düşmeli (sunucu artık döndürmüyor) ve engel
             listesine girmeli; yalnızca listeyi tazelemek kartı ekranda bırakırdı.
             yenile() pasif listede hiçbir şey yapmıyor — yalnızca açık sekme kurulur. */
          engellilerim.reload({ silent: true })
          arkadas.yenile()
          uni.yenile()
        }}
      />

      {/* Kaldır bildirimi alt sayfanın ARKASINDA, liste başlığında çıkıyor — web'in dar
          ekran çekmecesiyle aynı. Alt sayfanın içine ikinci bir bildirim konmadı: satırın
          listeden düşmesi zaten geri bildirim. */}
      <EngellilerModali
        open={engelListesiAcik}
        onClose={() => setEngelListesiAcik(false)}
        liste={engellilerim}
        onKaldir={async (kisi) => {
          await api.unblockUser(kisi.userId)
          setNotice(`${kisi.displayName} için engel kaldırıldı.`)
          engellilerim.reload({ silent: true })
          arkadas.yenile()
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
            {/* İşaret SUNUCUDAN (tutorIsStaff) — resmi hesap ayırt edilebilmeli. */}
            {offer.tutorIsStaff && <YonetimRozeti kucuk />}
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
          Arkadaş isteği gönder
        </Button>
      </View>
    </Card>
  )
}

/*
  ÜNİVERSİTE KARTI — web UniversiteKarti portu; Arkadaş Ekle sonuçları da AYNI kartı
  kullanıyor (yalnızca istek metni farklı). KARTTA DERS/KONU YOK (bilinçli): kayıt bir
  ilan değil, kişinin okuduğu yer. BÖLÜM VURGULU (marka pill), üniversite düz satır.
  1–10 genel seviye rozeti burada da var: seviye kişiye ait, konuya değil.
*/
function UniversiteKarti({ kisi, onSohbet, onEngelle, istekMetni = 'Sohbet isteği gönder' }) {
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
            {kisi.isStaff && <YonetimRozeti kucuk />}
            <SeviyeRozeti kaynak={{ level: kisi.level }} boyut="sm" ton="acik" />
          </View>

          {/* ÜNİVERSİTESİ YOKSA KATILMA TARİHİ. Üniversite sekmesinde bu dal hiç çalışmaz
              (sorgu üniversitesi olanları getiriyor); Arkadaş Ekle'de ise aynı adı taşıyan
              iki kişiyi ayırt eden tek işaret — yoksa kullanıcı yanlış kişiye istek
              gönderir (web kararı). */}
          {kisi.university ? (
            <Text numberOfLines={1} className="mt-1.5 text-sm text-slate-600">
              {kisi.university}
            </Text>
          ) : kisi.createdAtUtc ? (
            <Text className="mt-1.5 text-sm text-slate-500">
              {formatDate(kisi.createdAtUtc)} tarihinde katıldı
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

      {/* ENGELLE İKİNCİL VE DAR: kartın işi tanıştırmak, engelleme istisna — eşit ağırlıkta
          iki düğme listeyi oylamaya çevirirdi. Yine de kartın ÜZERİNDE, menüye saklanmadı:
          rahatsız eden biriyle karşılaşan kullanıcı onu ararken vazgeçmemeli (web kararı).
          Etikette ad var: TalkBack kart başına aynı "Engelle"yi okumasın. */}
      <View className="mt-4 flex-row gap-2">
        <Button className="flex-1" onPress={() => onSohbet(kisi)}>
          {istekMetni}
        </Button>
        {onEngelle && (
          <Button
            variant="secondary"
            accessibilityLabel={`${kisi.displayName} kişisini engelle`}
            onPress={() => onEngelle(kisi)}
          >
            Engelle
          </Button>
        )}
      </View>
    </Card>
  )
}

/*
  SOHBET İSTEĞİ — web SohbetIstegiModali portu. Arkadaş isteği modalından AYRI (web kararı):
  oradaki formun tamamı konu seçimidir ve burada seçilecek konu yok.
  requestedTopicId null gider — uç konusuz isteği böyle tanır.

  ⚠️ `arkadaslik` YALNIZCA METNİ değiştiriyor: iki sekmeden de aynı konusuz istek gidiyor.
  Sunucuda "arkadaşlık" diye ayrı bir tür yok ve olmamalı — kabul/ret, sohbet açılışı ve
  engel kontrolü ikinci kez yazılırdı. Fark kullanıcının niyeti: "aynı okuldan biriyle
  tanışayım" ile "şu arkadaşımı ekleyeyim".
*/
function SohbetIstegiModali({ kisi, arkadaslik = false, onClose, onSent }) {
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
      title={arkadaslik ? 'Arkadaş isteği' : 'Sohbet isteği'}
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

/*
  ENGELLEDİKLERİM — web EngellilerPaneli'nin alt sayfa hâli (web'in dar ekrandaki düğme +
  çekmece ikilisi). Sayfanın başlığı zaten "Engellediklerim" dediği için panelin kendi
  başlığı tekrarlanmıyor (web'de de yalnızca geniş ekranda var).

  YALNIZCA KENDİ ENGELLEDİKLERİ: "beni kimler engelledi" listesi sunucuda da yok ve
  istenmemeli — engellemeyi misillemeye çevirirdi. Kaldır ONAY SORMUYOR, engelleme soruyor:
  asimetri bilinçli (bkz. EngellemeModali). Sayfalama yok; liste doğal olarak kısa
  (web DEVAM-EDILECEK'te kabul edilmiş sınır).
*/
function EngellilerModali({ open, onClose, liste, onKaldir }) {
  const [calisan, setCalisan] = useState(null)
  const [hata, setHata] = useState(null)

  // Kapatılıp yeniden açılınca önceki kaldırma hatası taşınmasın.
  useEffect(() => {
    if (open) setHata(null)
  }, [open])

  async function kaldir(kisi) {
    if (calisan) return
    setCalisan(kisi.userId)
    setHata(null)
    try {
      await onKaldir(kisi)
    } catch (err) {
      setHata(err)
    } finally {
      setCalisan(null)
    }
  }

  const kayitlar = liste.data ?? []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Engellediklerim"
      footer={<Button onPress={onClose}>Kapat</Button>}
    >
      <View className="gap-3 pb-2">
        <Text className="text-xs text-slate-500">
          Engellediğin kişiler aramada çıkmaz, birbirinize istek gönderemezsiniz. Engellendiği
          karşı tarafa bildirilmez.
        </Text>

        {/* onRetry kaldırma hatasını da TEMİZLİYOR: liste.reload() yalnızca listenin kendi
            hatasını siliyor; `hata` kalsaydı başarılı tazelemeden sonra da kutu ekranda
            dururdu (web #33'ün Profile.jsx'te düzelttiği ilke — web'in panelinde eksik). */}
        <ErrorBox
          error={hata ?? liste.error}
          onRetry={() => {
            setHata(null)
            liste.reload()
          }}
        />

        {liste.loading ? (
          <Loading label="Yükleniyor…" />
        ) : kayitlar.length === 0 ? (
          <Text className="text-sm text-slate-500">Kimseyi engellemedin.</Text>
        ) : (
          <View>
            {kayitlar.map((kisi, i) => (
              <View
                key={kisi.userId}
                className={`flex-row items-center gap-2 py-2 ${i > 0 ? 'border-t border-slate-200' : ''}`}
              >
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-sm font-medium text-slate-800">
                    {kisi.displayName}
                  </Text>
                  <Text className="text-xs text-slate-500">{formatDate(kisi.blockedAtUtc)}</Text>
                  {/* Not YALNIZCA engelleyene görünüyor — karşı taraf ne engellendiğini ne de
                      not yazıldığını görüyor. */}
                  {kisi.note ? (
                    <Text className="mt-0.5 text-xs italic text-slate-500">{kisi.note}</Text>
                  ) : null}
                </View>
                {/* Bir satır çalışırken diğer satırların düğmeleri pasif (web kararı). */}
                <Button
                  variant="ghost"
                  loading={calisan === kisi.userId}
                  disabled={calisan !== null}
                  accessibilityLabel={`${kisi.displayName} için engeli kaldır`}
                  onPress={() => kaldir(kisi)}
                >
                  Kaldır
                </Button>
              </View>
            ))}
          </View>
        )}
      </View>
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
