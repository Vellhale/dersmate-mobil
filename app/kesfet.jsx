import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../src/lib/api'
import { engelDegisti, engelSurumu } from '../src/lib/engelSurumu'
import { ILISKI } from '../src/lib/iliski'
import { useIliskiler } from '../src/state/useIliskiler'
import { formatDate } from '../src/lib/format'
import { seviyeEtiketi, seviyeHesapla } from '../src/lib/seviye'
import { useAsync } from '../src/state/useAsync'
import { useDebounced } from '../src/hooks/useDebounced'
import { Avatar } from '../src/components/Avatar'
import { SeviyeRozeti } from '../src/components/SeviyeRozeti'
import { YonetimRozeti } from '../src/components/YonetimRozeti'
import { EslesmeIstegiModali } from '../src/components/EslesmeIstegiModali'
import { IlanKarti } from '../src/components/IlanKarti'
import { EngellemeModali } from '../src/components/EngellemeModali'
import { EkranBasligi } from '../src/components/EkranBasligi'
import { HamburgerDugmesi } from '../src/components/Cekmece'
import { KepIkonu, SaatIkonu, YildizIkonu } from '../src/components/Ikonlar'
import { Badge, Button, Card, EmptyState, ErrorBox, Field, Girdi, Loading, Modal, Notice, Spinner } from '../src/components/ui'
import { amber, brand, slate } from '../src/lib/theme'

/*
  KEŞFET — web'deki pages/Discover.jsx'in portu, İKİ FARKLA:

  1. ÖNERİ MODU VARSAYILAN — web'deki gibi. (Bir süre öyle değildi: öneriler ayrı bir
     Akış sekmesinde yaşıyordu ve burada yalnızca arama/filtre vardı. O ayrım
     2026-09-23'te KALDIRILDI; gerekçe web'in kendi yorumunda yazılı
     (Discover.jsx:96-98): öneriler için ayrı sekme açmak hem gezinmeyi şişiriyor hem
     de kullanıcıyı "önerilerde mi arıyorum, katalogda mı" ikilemine sokuyor. Mobil
     tam da o ayrı sekmeyi açmıştı; sekme çubuğu kalkınca ayrımın taşıyıcısı da
     kalmadı.)
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
  /* Ekrandaki sonucun HANGİ SORGUYA ait olduğu. Sorgu değiştiği ilk render'da liste henüz
     sıfırlanmamış ve eski sorgunun sonucunu taşıyor; bu anahtar olmadan o kare "bitti"
     sanılıyordu (iOS duyurusu sonuç varken "Kimseyi bulamadık" dedi, ölçüldü). */
  const [sonucAnahtari, setSonucAnahtari] = useState(null)
  const seq = useRef(0)
  const kilit = useRef(false)
  const basarisizHedef = useRef(null)

  async function sayfaGetir(hedefSayfa) {
    const benimSeq = ++seq.current
    const sorguAnahtari = JSON.stringify(bagimliliklar)
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
      if (hedefSayfa === 1) setSonucAnahtari(sorguAnahtari)
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
      setSonucAnahtari(null)

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

    /*
      YENİ SORGU ESKİ SONUÇLARI TAŞIMAZ. Önceden liste ancak 1. sayfa BAŞARIYLA dönünce
      değişiyordu ve bu iki hataya yol açıyordu:
      • Yazarken: "Ali"nin sonuçları "Ayşe" kutusunun altında debounce ve ağ süresi
        boyunca GÖSTERGESİZ duruyordu. "Aranıyor…" yalnızca boş listede çiziliyor, sayaç
        satırı da gizleniyordu.
      • 1. sayfa düşerse: page ve hasNextPage eski sorgudan kalıyordu, kaydırınca
        dahaGetir YENİ sorgunun 3. sayfasını ESKİ listenin sonuna ekliyordu. Ekranda iki
        aramanın karışımı ve yeni aramanın sayısı kalıyor, hata kutusu da kayboluyordu.
      Sıfırlama boş listeyi getiriyor (yani "Aranıyor…" görünüyor) ve hasNextPage=false
      eski listeye ekleme yapılmasını engelliyor. yenile()'ye KONMADI: engel sonrası
      tazeleme aynı sorguyu yeniliyor, listeyi boşaltıp titretmemeli.
    */
    setItems([])
    setTotalCount(0)
    setHasNextPage(false)
    setPage(0)
    setSonucAnahtari(null)
    basarisizHedef.current = null
    sayfaGetir(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktif, ...bagimliliklar])

  return {
    items,
    totalCount,
    sonucAnahtari,
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

  /*
    DIŞARIDAN SEKME SEÇİMİ (?sekme=arkadas): Profilim'deki "Arkadaş bul" gibi girişler doğru
    sekmeyi açabilsin. Keşfet bir SEKME ekranı ve kurulu kalıyor — başlangıç değeri bir kez
    okunsaydı ikinci girişte işe yaramazdı. Parametre uygulanınca BOŞALTILIYOR: aynı değerle
    yeniden gelindiğinde efekt yine koşsun, kullanıcının kendi seçtiği sekme de sonraki
    odakta ezilmesin. `undefined` değil boş dize: web'de setParams({ sekme: undefined })
    adresi değiştirmiyordu (ölçüldü) ve ikinci "Arkadaş bul" hiçbir şey yapmazdı.
  */
  const router = useRouter()
  const { sekme: istenenSekme } = useLocalSearchParams()
  useEffect(() => {
    if (!istenenSekme) return
    if (SEKMELER.some((s) => s.key === istenenSekme)) setSekme(istenenSekme)
    router.setParams({ sekme: '' })
  }, [istenenSekme, router])
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
  // Arkadaş isteği modalındaki takas teklifi listesi ve öneri kipindeki portföy uyarısı için.
  const portfolio = useAsync(() => api.myPortfolio(), [])
  const myOffers = portfolio.data?.filter((e) => e.direction === 'Offer') ?? []
  const mySeekCount = portfolio.data?.filter((e) => e.direction === 'Seek').length ?? 0

  /*
    ÖNERİ KİPİ — web'in Discover varsayılanı (Discover.jsx:92). Arama kutusuna
    yazılınca ya da filtreye dokununca katalog sonuçlarına geçiliyor, temizlenince
    önerilere dönülüyor: web'deki davranışın aynısı (searchMode zaten bu ayrımı
    taşıyordu, yalnızca boş dalı bir yer tutucu metindi).

    KOŞULSUZ YÜKLENİYOR (web de öyle): YKS, Keşfet'in açılış kipi — istek ilk
    render'da zaten gerekli. Kipe bağlanmış bir useAsync, sekme değiştirip dönen
    kullanıcıya her seferinde yeniden istek attırırdı.
  */
  const oneriler = useAsync(() => api.suggestions(20), [])
  const oneriKipi = yksKipi && !searchMode

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
  /*
    YAZILAN ile SORGULANAN ayrı: gecikme (~370 ms) boyunca eskiden önceki aramanın sonucu
    ya da "Kimseyi bulamadık" göstergesiz ekranda kalıyordu — "el"den "ele" geçen
    kullanıcı bir an Elif'i, bir an boş durumu görüyordu. Yazılan kısa ise davet hemen
    geliyor; sorgu yazılana yetişmediyse liste gizlenip "Aranıyor…" çıkıyor.
  */
  const yazilanIsim = arkadasIsim.trim()
  const isimKisa = yazilanIsim.length < ARKADAS_MIN_HARF
  const isimBekliyor = !isimKisa && yazilanIsim !== isimSorgusu

  const arkadas = useBirikenListe(
    arkadasKipi && isimYeterli,
    (page, pageSize) => api.searchUniversityPeers({ name: isimSorgusu, page, pageSize }),
    [isimSorgusu],
    (k) => k.userId,
  )
  // Ekrandaki sonuç YAZILAN sorguya mı ait? (bkz. useBirikenListe → sonucAnahtari)
  const sonucGuncel = arkadas.sonucAnahtari === JSON.stringify([isimSorgusu])
  /* Arama gerçekten bitti mi: sayı, boş durum ve duyuru AYNI koşula bakıyor — ayrı koşullar
     bir karede "1 kişi", bir karede "Kimseyi bulamadık" gösteriyordu. */
  const aramaBitti =
    arkadasKipi && !isimKisa && !isimBekliyor && sonucGuncel && !arkadas.ilkYukleme && !arkadas.error

  // Engellediklerim yalnızca bu sekmede yükleniyor (web kararı): her Keşfet açılışında bir
  // istek daha atmanın karşılığı yok, liste yalnızca burada görünüyor.
  const engellilerim = useAsync(
    () => (arkadasKipi ? api.myBlocks() : Promise.resolve(null)),
    [arkadasKipi],
  )
  const engelSayisi = engellilerim.data?.length ?? 0

  // Kişi gösteren iki sekmede kartlar ilişkiyi biliyor (bkz. lib/iliski.js).
  const iliskiler = useIliskiler(universiteKipi || arkadasKipi)

  /*
    ENGEL BAŞKA EKRANDA DEĞİŞTİYSE ODAKTA TAZELE. Kartın profili kök yığında Keşfet'in
    ÜSTÜNE açılıyor ve Keşfet kurulu kalıyor; web'de Discover sayfa geçişinde yeniden
    kuruluyor. Profilde engellenen kişi sonuçlarda duruyordu, Engellediklerim eski
    sayıyı ve eski listeyi gösteriyordu. Karttaki isteğe basan kullanıcı kendi engelini
    sunucunun nötr "Bu kişiye istek gönderilemiyor." metninden öğreniyordu; o metin karşı
    tarafın engeli için yazıldı.

    HER ODAKTA DEĞİL, yalnızca engel sürümü değiştiyse. yenile() listeyi 1. sayfadan
    kuruyor: bir karta dokunup profile bakan ve geri dönen kullanıcının biriktirdiği
    sayfalar ve kaydırma yeri her dönüşte silinirdi, oysa en sık yol bu. YKS listesi
    tazelenmiyor: ilan araması engel süzmüyor, yalnızca SearchUniversityPeers süzüyor.
    İşleyici ref'te: yenile() her render'da yeni kapanışla kuruluyor, odak geri çağrısı
    ise sabit kalmalı.
  */
  const gorulenEngelSurumu = useRef(engelSurumu())
  const engelSonrasiTazele = useRef(null)
  engelSonrasiTazele.current = () => {
    gorulenEngelSurumu.current = engelSurumu()
    engellilerim.reload({ silent: true })
    arkadas.yenile()
    uni.yenile()
    // Engel bekleyen istekleri kapatıyor: kartlardaki ilişki de değişti.
    iliskiler.yenile()
  }
  useFocusEffect(
    useCallback(() => {
      if (gorulenEngelSurumu.current !== engelSurumu()) engelSonrasiTazele.current()
    }, []),
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

  const liste = arkadasKipi ? arkadas : universiteKipi ? uni : yks

  const baslikBolumu = (
    <View className="gap-3 pb-3">
      {/* ÖNERİ KİPİNİN kendi hata kutusu ve portföy uyarısı. Katalog aramasının hata
          kutusu aşağıda ayrı duruyor: ikisi farklı istekler, biri düşerken öteki
          çalışıyor olabilir. */}
      {oneriKipi && <ErrorBox error={oneriler.error} onRetry={() => oneriler.reload()} />}
      {/* Hata hâlinde bilgi kutusu ÇIKMAZ: portföy çekilemediyse mySeekCount=0 veri
          değil bilinmezliktir — "konu ekle" demek yanlış yönlendirirdi. */}
      {oneriKipi && !portfolio.loading && !portfolio.error && mySeekCount === 0 && (
        <Notice tone="info">
          Öneriler, “Almak istediğim konular” listenden üretilir. Soldaki menüden “Ders
          Portföyü”ne en az bir konu ekleyerek başla.
        </Notice>
      )}
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
            className={`min-h-[44px] flex-1 items-center justify-center rounded-lg px-2 py-1.5 ${
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
            : 'Almak istediğin konulara göre seçilmiş öneriler aşağıda. Katalogda aramak için yaz ya da filtrele.'}
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
        /* KUTU TAM GENİŞLİK, Engellediklerim ALTTA. Eskiden ikisi yan yanaydı ve ikincil
           düğme (150 dp) aramanın kendisinden (130 dp) genişti; 320 dp'de ve (12) gibi bir
           sayıda kutu 122 dp'ye iniyor, yazılan adın yalnızca son sözcüğü görünüyordu.
           Düğme sonuç sayısıyla aynı satırı paylaşıyor: yeni bir satır açılmıyor. */
        <View className="gap-1">
          <Girdi
            value={arkadasIsim}
            onChangeText={setArkadasIsim}
            placeholder="Ad soyad ara…"
            accessibilityLabel="İsimle ara"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="search"
          />
          <View className="flex-row items-center justify-between gap-2">
            {/* shrink-0: büyük yazıda sayı "1 ki/şi" diye bölünüyordu; daralan taraf düğme. */}
            <Text className="shrink-0 text-sm font-semibold text-slate-800">
              {aramaBitti && liste.items.length > 0 ? `${liste.totalCount} kişi` : ''}
            </Text>
            {/* İkincil: YKS sekmesindeki "Filtre" ile aynı yüzey. ghost iken düz metin gibi okunuyordu. */}
            <Button variant="secondary" onPress={() => setEngelListesiAcik(true)}>
              Engellediklerim{engelSayisi > 0 ? ` (${engelSayisi})` : ''}
            </Button>
          </View>
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
      {/* Arkadaş Ekle'nin sonuç sayısı arama kutusunun altındaki satırda (yukarıda). */}
    </View>
  )

  /* Arkadaş Ekle'de ÜÇ AYRI boş durum (web kararı): davet (hiç yazılmamış ya da kısa),
     aranıyor, sonuç yok. Tek bir "bulunamadı", henüz aramamış kullanıcıya "aradık, yok"
     derdi — bu yüzden "adını yaz" dalı yükleniyor dalından ÖNCE. */
  /*
    ARAMA SONUCU DUYURUSU — iki platformda da açık duyuru, sorgu başına BİR kez. İsim yazan
    ekran okuyucu kullanıcısı aramanın bitip bitmediğini duymuyordu. İlk sürümde Android için
    görünen sayıya canlı bölge konmuştu: sıfır sonuçta metin boş kaldığı için "Kimseyi
    bulamadık" hiç okunmuyordu. Koşul `aramaBitti` (sonucGuncel dahil): eski sorgunun sonucu
    taşınan ara karede duyuru yapılıp sorgu "duyuruldu" diye kilitleniyordu.
  */
  const duyurulanSorgu = useRef(null)
  useEffect(() => {
    if (!aramaBitti || duyurulanSorgu.current === isimSorgusu) return
    duyurulanSorgu.current = isimSorgusu
    AccessibilityInfo.announceForAccessibility(
      liste.totalCount > 0 ? `${liste.totalCount} kişi bulundu` : 'Kimseyi bulamadık',
    )
  }, [aramaBitti, isimSorgusu, liste.totalCount])

  const bosDurum = arkadasKipi && isimKisa ? (
    /* Kapsam ("ilanı olmayanlar da çıkar") üstteki açıklamada zaten yazıyor; kutu yalnızca
       kuralı söylüyor — eskiden aynı cümle aynı anda iki kez okunuyordu. */
    <EmptyState
      title="Aradığın kişinin adını yaz"
      description={`En az ${ARKADAS_MIN_HARF} harf yazınca sonuçlar burada çıkar.`}
    />
  ) : arkadasKipi && (isimBekliyor || (!sonucGuncel && !liste.error)) ? (
    <Loading label="Aranıyor…" />
  ) : liste.ilkYukleme ? (
    <Loading label="Aranıyor…" />
  ) : liste.error ? null : arkadasKipi ? (
    /* Engellediğin kişi aramada ÇIKMIYOR. Onu arayan kullanıcıya yalnızca "kayıtlı
       olmayabilir" demek yanlış yere baktırırdı — özellikle profilden engelleyip dönünce. */
    <EmptyState
      title="Kimseyi bulamadık"
      description={
        engelSayisi > 0
          ? 'Adı platformda yazdığı şekliyle dene. Engellediğin kişiler aramada çıkmaz.'
          : 'Adı platformda yazdığı şekliyle dene. Kişi henüz kayıtlı olmayabilir.'
      }
      action={
        engelSayisi > 0 ? (
          <Button variant="secondary" onPress={() => setEngelListesiAcik(true)}>
            Engellediklerime bak
          </Button>
        ) : null
      }
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
  ) : oneriler.loading ? (
    <Loading />
  ) : oneriler.error ? null : (
    /* Hata kutusu başlıkta çiziliyor; burada ikinci kez bildirmek aynı olayı iki kez
       söylerdi. */
    <EmptyState
      title="Şimdilik öneri yok"
      description="Ders Portföyü’ndeki “Almak istediğim konular” listeni genişlet ya da yukarıdan konu, ders veya eğitmen adı arat."
    />
  )

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <EkranBasligi baslik="Keşfet" sol={<HamburgerDugmesi />} />

      <FlatList
        data={
          oneriKipi
            ? oneriler.data ?? []
            : arkadasKipi && (isimKisa || isimBekliyor || !sonucGuncel)
              ? []
              : liste.items
        }
        /* Öneri kipinde öğeler KİŞİ, katalogda İLAN: anahtar alanı da onunla değişiyor.
           Tek alana bağlansaydı kip geçişinde anahtarlar çakışır ve FlatList kartları
           yanlış yeniden kullanırdı. */
        keyExtractor={(item) => (oneriKipi || !yksKipi ? item.userId : item.offerId)}
        renderItem={({ item }) =>
          oneriKipi ? (
            /* Web'deki Suggestions kartının mobil karşılığı — Akış silinince buraya
               döndü, kartın kendisi değişmedi. */
            <IlanKarti kisi={item} onIstek={setHedef} />
          ) : yksKipi ? (
            <IlanSonucKarti offer={item} onIstek={setHedef} />
          ) : (
            /* Arkadaş Ekle kartı YENİDEN YAZILMADI: iki listede gösterilen şey aynı, bir kişi
               (web kararı). Yalnızca istek metni değişiyor. */
            <UniversiteKarti
              kisi={item}
              iliski={iliskiler.iliski(item.userId)}
              iliskiYukleniyor={iliskiler.yukleniyor}
              onSohbet={setSohbetHedefi}
              onEngelle={setEngelHedefi}
              istekMetni={arkadasKipi ? 'Arkadaş isteği gönder' : 'Sohbet isteği gönder'}
            />
          )
        }
        contentContainerClassName="gap-3 p-4"
        /* Alt dolgu = güvenli alan (home indicator) + nefes payı. Eskiden buraya yüzen
           sekme çubuğunun yüksekliği de giriyordu (sekmeCubugu.js); çubuk kalktı, gezinme
           artık soldaki çekmeceden ve içeriğin üstünde duran bir katman yok. */
        contentContainerStyle={{ paddingBottom: guvenli.bottom + 16 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={baslikBolumu}
        ListEmptyComponent={bosDurum}
        /* Liste gizliyken (yazılan sorguya yetişilmedi) bağlanmıyor: boş veride
           VirtualizedList onEndReached'i tetikliyor ve ESKİ sorgunun sonraki sayfası isteniyordu. */
        /* Öneri kipi SAYFALANMIYOR: api.suggestions sabit 20 kayıt döndürüyor, sonraki
           sayfa diye bir şey yok — bağlansaydı liste sonunda boşa istek koşardı. */
        onEndReached={
          oneriKipi || (arkadasKipi && (isimKisa || isimBekliyor || !sonucGuncel))
            ? undefined
            : liste.dahaGetir
        }
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
          /* Sessiz tazeleme: istek gönderilen kişi öneri listesinden düşsün ama liste
             spinner’a dönmesin (web’deki suggestions.reload() kararının aynısı). */
          oneriler.reload({ silent: true })
        }}
      />

      <SohbetIstegiModali
        kisi={sohbetHedefi}
        arkadaslik={arkadasKipi}
        onClose={() => setSohbetHedefi(null)}
        // Red çoğu zaman ilişkinin karttakinden farklı olduğunu söylüyor (409): kart düzelsin.
        onHata={() => iliskiler.yenile()}
        onSent={(kisi) => {
          setSohbetHedefi(null)
          // Kart hemen "İstek gönderildi"ye dönüyor: bildirim kaydırılmış listede ekran
          // dışında kalabiliyor, geri bildirimin asıl yeri dokunulan kart.
          iliskiler.istekGonderildi(kisi.userId)
          setNotice(
            arkadasKipi
              ? `${kisi.displayName} kişisine arkadaş isteği gönderildi. Kabul edilince sohbet açılacak.`
              : `${kisi.displayName} kişisine sohbet isteği gönderildi. Kabul edilince sohbet açılacak.`,
          )
        }}
      />

      <EngellemeModali
        kisi={engelHedefi}
        onClose={() => setEngelHedefi(null)}
        onEngellendi={(name) => {
          setEngelHedefi(null)
          /* Engellediklerim YALNIZCA Arkadaş Ekle sekmesinde. Üniversite sekmesinden engelleyen
             kullanıcı kişinin listeden düştüğünü görüyor ama geri almanın yerini hiçbir yerde
             okumuyordu. */
          setNotice(
            universiteKipi
              ? `${name} engellendi. Geri almak için: Arkadaş Ekle › Engellediklerim.`
              : `${name} engellendi. Artık birbirinize istek gönderemezsiniz.`,
          )
          /* Engellenen kişi sonuçlardan düşmeli (sunucu artık döndürmüyor) ve engel
             listesine girmeli; yalnızca listeyi tazelemek kartı ekranda bırakırdı.
             yenile() pasif listede hiçbir şey yapmıyor — yalnızca açık sekme kurulur.
             Görülen sürüm de burada eşitleniyor: sonraki odakta ikinci kez tazelenmez. */
          engelSonrasiTazele.current()
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
          engelDegisti()
          setNotice(`${kisi.displayName} için engel kaldırıldı.`)
          engelSonrasiTazele.current()
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
function UniversiteKarti({
  kisi,
  iliski = null,
  iliskiYukleniyor = false,
  onSohbet,
  onEngelle,
  istekMetni = 'Sohbet isteği gönder',
}) {
  const router = useRouter()

  /*
    BAĞLANTI ETİKETİ GÖRÜNEN BİLGİDEN KURULUYOR. RN'de accessibilityLabel çocuk metinlerin
    YERİNE okunuyor; eskiden yalnızca "X profilini aç" deniyordu ve aynı adı taşıyan iki kişiyi
    ayırt eden üniversite ya da katılma tarihi (aşağıdaki yorum) ekran okuyucuya hiç gitmiyordu.
    Avatar ve rozetler kendi `accessible` bayraklarıyla Android'de ayrı durak oluyordu: gizli.
  */
  const kimlikEtiketi = [
    kisi.displayName,
    seviyeEtiketi(seviyeHesapla({ level: kisi.level })),
    kisi.isStaff ? 'yönetim hesabı' : null,
    iliski?.durum === ILISKI.arkadas ? 'arkadaşın' : null,
    kisi.university ?? (kisi.createdAtUtc ? `${formatDate(kisi.createdAtUtc)} tarihinde katıldı` : null),
    kisi.ratingCount > 0
      ? `${Number(kisi.averageRating).toFixed(1)} puan, ${kisi.ratingCount} değerlendirme`
      : 'henüz değerlendirilmemiş',
  ]
    .filter(Boolean)
    .join(', ')
  // Birincil düğmeler de kişiyi söylüyor (Engelle'deki kural); etiket görünen metinle başlıyor.
  const adli = (metin) => `${metin}, ${kisi.displayName}`

  return (
    <Card>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${kimlikEtiketi}. Profilini aç`}
        onPress={() => router.push(`/profil/${kisi.userId}`)}
        className="flex-row items-start gap-4"
      >
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Avatar userId={kisi.userId} name={kisi.displayName} size="lg" className="border-2 border-white" />
        </View>

        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text className="shrink text-base font-semibold text-brand-700" numberOfLines={2}>
              {kisi.displayName}
            </Text>
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {kisi.isStaff && <YonetimRozeti kucuk />}
              <SeviyeRozeti kaynak={{ level: kisi.level }} boyut="sm" ton="acik" />
              {iliski?.durum === ILISKI.arkadas && <Badge tone="success">Arkadaşın</Badge>}
            </View>
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
            /* flex-wrap + shrink: büyük yazıda "(N değerlendirme)" kart kenarını ve ekranı aşıyordu. */
            <View className="mt-1.5 flex-row flex-wrap items-center gap-x-1.5">
              <YildizIkonu renk={amber[500]} boy={14} />
              <Text className="text-xs font-semibold text-slate-700">
                {Number(kisi.averageRating).toFixed(1)}
              </Text>
              <Text className="shrink text-xs text-slate-600">({kisi.ratingCount} değerlendirme)</Text>
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
      {/* İLİŞKİYE GÖRE BİRİNCİL EYLEM (bkz. lib/iliski.js). Eskiden her kartta aynı istek
          düğmesi vardı: arkadaşa ve sana istek atmış kişiye gereksiz bir bekleyen istek
          gidiyor, aynı yöne ikinci denemede sunucunun 409'u okunuyordu. İlişki bilgisi
          gelene kadar düğme PASİF — "ilişki yok" varsayılıp basılabilir olmasın. İlişki
          listesi hata verirse eski davranışa düşülüyor (istek düğmesi): aynı yöndeki
          yinelemeyi sunucu zaten reddediyor ve bütün listeyi bir yan isteğe kilitlemek
          orantısız olurdu. */}
      {/* flex-wrap + birincil min %55: büyük yazıda Engelle genişleyip birincil düğmeyi daraltıyor,
          birincil etiket harf ortasından bölünüyordu. O ölçekte Engelle alt satıra iniyor;
          varsayılan boyutta satır tek sıra kalıyor (135 + 8 + 80 ≤ 246, 320 dp). */}
      <View className="mt-4 flex-row flex-wrap gap-2">
        {iliski?.durum === ILISKI.arkadas ? (
          /* Kartta İKİNCİL, profilde birincil — bilinçli: keşif listesinin işi yeni biriyle
             tanıştırmak, zaten arkadaş olunan kişi listede öne çıkmamalı. Profilde ise o kişiye
             bakan kullanıcının en olası niyeti yazışmak. */
          iliski.conversationId ? (
            <Button
              variant="secondary"
              className="min-w-[55%] flex-1"
              accessibilityLabel={adli('Mesaj gönder')}
              onPress={() => router.push(`/sohbet/${iliski.conversationId}`)}
            >
              Mesaj gönder
            </Button>
          ) : (
            <View className="min-w-[55%] flex-1" />
          )
        ) : iliski?.durum === ILISKI.gelen ? (
          <Button className="min-w-[55%] flex-1" accessibilityLabel={adli('İsteğini yanıtla')} onPress={() => router.push('/eslesmeler')}>
            İsteğini yanıtla
          </Button>
        ) : iliski?.durum === ILISKI.giden ? (
          <Button variant="secondary" className="min-w-[55%] flex-1" accessibilityLabel={adli('İstek gönderildi')} disabled>
            İstek gönderildi
          </Button>
        ) : (
          <Button
            className="min-w-[55%] flex-1"
            accessibilityLabel={adli(istekMetni)}
            disabled={iliskiYukleniyor}
            onPress={() => onSohbet(kisi)}
          >
            {istekMetni}
          </Button>
        )}
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
function SohbetIstegiModali({ kisi, arkadaslik = false, onClose, onSent, onHata }) {
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
      onSent(kisi)
    } catch (err) {
      setHata(err)
      onHata?.(err)
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

  ⚠️ KALDIRILAN SATIR YERİNDE KALIYOR, alt sayfa kapanana kadar. İki denemeden sonra
  varılan karar, ikisi de ölçüldü:
    1. Eskiden satır liste tazelenene kadar (~250-550 ms) duruyor, düğmeler yeniden
       etkinleşiyordu; tazeleme gelince satırlar kayıyordu.
    2. Satırı başarı anında düşürmek pencereyi kapatmadı, ÖNE aldı: satır düştüğü karede
       düğmeler de etkinleşiyor, alt sayfa alta yaslı olduğu için komşu satırın "Engeli
       kaldır"ı parmağın altına geliyordu (elementFromPoint başka kişinin düğmesini döndürdü).
  İkinci dokunuş BAŞKA BİRİNİN engelini kaldırıyor ve sunucu kaydı sildiği için not ve tarih
  geri gelmiyor. Onay sormamanın bedeli ancak HİÇBİR SATIR KAYMIYORSA kabul edilebilir:
  kaldırılan kişi aynı yükseklikte, düğmesiz "Kaldırıldı" satırına dönüşüyor ve sıra alt
  sayfa açık kaldıkça sabit. Yeniden açılışta liste sunucudan temiz kuruluyor.
*/
function EngellilerModali({ open, onClose, liste, onKaldir }) {
  /* Büyük yazıda (>= 1.5) düğme adın ALTINA iniyor: sabit 150 px düğme ad sütununu daraltıp
     iki satırlık adı da kesiyordu. Sabit genişlik korunuyor (yükleme ve "Kaldırıldı" dönüşünde
     satır yüksekliği değişmesin), yalnızca yerleşim sütuna dönüyor. */
  const { fontScale } = useWindowDimensions()
  const sutun = fontScale >= 1.5
  const [calisan, setCalisan] = useState(null)
  const [hata, setHata] = useState(null)
  // userId → kaldırılmadan önceki kayıt (satırı aynı içerikle çizmek için).
  const [kaldirilanlar, setKaldirilanlar] = useState(() => new Map())
  // Açık kaldığı sürece görülen SIRA: sunucu listesi değişse de satırların yeri değişmesin.
  const sira = useRef([])

  // Her açılış temiz: önceki hata, "Kaldırıldı" satırları ve sabit sıra taşınmasın.
  useEffect(() => {
    if (open) {
      setHata(null)
      setKaldirilanlar(new Map())
      sira.current = []
    }
  }, [open])

  async function kaldir(kisi) {
    if (calisan) return
    setCalisan(kisi.userId)
    setHata(null)
    try {
      await onKaldir(kisi)
      setKaldirilanlar((m) => new Map(m).set(kisi.userId, kisi))
    } catch (err) {
      setHata(err)
    } finally {
      setCalisan(null)
    }
  }

  const sunucudakiler = new Map((liste.data ?? []).map((k) => [k.userId, k]))
  for (const id of sunucudakiler.keys()) {
    if (!sira.current.includes(id)) sira.current.push(id)
  }
  /* Sunucuda olmayan ve burada kaldırılmamış kayıt (başka ekrandan kaldırılmış) düşüyor:
     o kişi için bu sayfada bir eylem yapılmadı, yer tutmak yanıltıcı olurdu. */
  const kayitlar = sira.current
    .map((id) => sunucudakiler.get(id) ?? kaldirilanlar.get(id))
    .filter(Boolean)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Engellediklerim"
      /* Footer yok: mavi "Kapat" başlıktaki ✕ ile birebir aynı işi yapıyordu ve birincil
         rengi kapatmaya harcıyordu (uygulamada bunu yapan tek alt sayfaydı). */
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

        {liste.loading && !liste.data ? (
          <Loading label="Yükleniyor…" />
        ) : liste.error && !liste.data ? null : kayitlar.length === 0 ? (
          /* Liste YÜKLENEMEDİYSE boş durum çizilmiyor: hata kutusunun yanında "kimse yok"
             doğrulanmamış bir bilgi olurdu. */
          <EmptyState
            title="Engellediğin kimse yok"
            description="Birini engellemek için arama kartındaki ya da profilindeki Engelle'yi kullan."
          />
        ) : (
          <View>
            {kayitlar.map((kisi, i) => {
              const kaldirildi = kaldirilanlar.has(kisi.userId)
              return (
                <View
                  key={kisi.userId}
                  className={`${sutun ? 'items-start gap-2' : 'flex-row items-center gap-2'} py-2 ${i > 0 ? 'border-t border-slate-200' : ''}`}
                >
                  <View className={sutun ? 'self-stretch' : 'min-w-0 flex-1'}>
                    {/* İki satıra kadar: sabit 150 px düğme ad sütununu 320 dp'de 122 px'e indiriyor ve
                        onaysız "Engeli kaldır" listesinde kimliği taşıyan tek şey olan ad kesiliyordu. */}
                    <Text
                      numberOfLines={2}
                      className={`text-sm font-medium ${kaldirildi ? 'text-slate-400' : 'text-slate-800'}`}
                    >
                      {kisi.displayName}
                    </Text>
                    <Text className="text-xs text-slate-500">
                      {formatDate(kisi.blockedAtUtc)} tarihinde engellendi
                    </Text>
                    {/* Not YALNIZCA engelleyene görünüyor — karşı taraf ne engellendiğini ne de
                        not yazıldığını görüyor. */}
                    {kisi.note ? (
                      <Text className="mt-0.5 text-xs italic text-slate-500">{kisi.note}</Text>
                    ) : null}
                  </View>
                  {/* İkincil ve GERÇEKTEN SABİT GENİŞLİK (w, min-w değil): yükleme göstergesi
                      metnin yanına 28 dp ekliyor; min-w ile düğme 124'ten 140'a genişliyor ve
                      satırdaki not yeniden kırılıyordu. "Kaldırıldı" kutusu da aynı ölçüde. */}
                  {kaldirildi ? (
                    <View
                      accessible
                      accessibilityLabel={`${kisi.displayName} için engel kaldırıldı`}
                      className="min-h-[44px] w-[150px] items-center justify-center"
                    >
                      <Text className="text-sm font-medium text-emerald-700">Kaldırıldı</Text>
                    </View>
                  ) : (
                    <Button
                      variant="secondary"
                      className="w-[150px]"
                      loading={calisan === kisi.userId}
                      /* Bir satır çalışırken diğer satırların düğmeleri pasif (web kararı). */
                      disabled={calisan !== null}
                      accessibilityLabel={`${kisi.displayName} için engeli kaldır`}
                      onPress={() => kaldir(kisi)}
                    >
                      Engeli kaldır
                    </Button>
                  )}
                </View>
              )
            })}
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
