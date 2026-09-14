import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { sekmeAltDolgusu } from '../../src/lib/sekmeCubugu'
import { api } from '../../src/lib/api'
import { useAsync } from '../../src/state/useAsync'
import { useIliskiler } from '../../src/state/useIliskiler'
import { useOnePlanaGelince } from '../../src/state/useOnePlanaGelince'
import { eylemBekliyor } from '../../src/lib/dersDurumu'
import { brand, slate } from '../../src/lib/theme'
import { EkranBasligi } from '../../src/components/EkranBasligi'
import { KepIkonu, KisilerIkonu, ToplulukIkonu } from '../../src/components/Ikonlar'
import { useTurCipasi } from '../../src/lib/tur'
import { IlanKarti } from '../../src/components/IlanKarti'
import { EslesmeIstegiModali } from '../../src/components/EslesmeIstegiModali'
import { Button, EmptyState, ErrorBox, Loading, Notice, SayacRozeti } from '../../src/components/ui'

/*
  AKIŞ (ANA SAYFA) — Instagram düzeninin ana sayfası: kişiselleştirilmiş öneri
  kartları tam genişlik akış olarak.

  Web'de bu veri Keşfet'in "öneri modu"ydu (Discover.jsx → Suggestions). Mobilde ayrı
  bir sekmeye taşındı: sosyal akış düzeninde açılış ekranı gezinilecek bir katalog
  değil, kaydırılacak bir akıştır. Keşfet sekmesi arama/filtre işine odaklanır.

  Veri kararları web'den:
  • api.suggestions(20) — öneriler "Almak istediğim konular" portföyünden türer;
    portföyde Seek yoksa kullanıcıya bunu söyleyen kutu ve Oluştur'a götüren düğme çıkar.
  • Portföyün Offer girdileri arkadaş isteği modalındaki takas teklifi listesini besler.

  İSTEK SONUCU DOKUNULAN KARTTA (web'den sapma): web istek gönderilince önerileri sessizce
  tazeliyor; mobilde bu tazeleme KALDIRILDI. Öneri yanıtı istekten etkilenmiyor
  (GetMatchSuggestions eşleşmeleri süzmüyor), yani tazeleme karta yeni bir şey getirmiyor,
  en fazla kartları yeniden sıralayıp kaydırılmış akışı oynatıyordu. Asıl kusur da
  çözülmüyordu: bildirim liste başında, kaydırılmış akışta ekran dışında kalıyor, kart
  değişmiyor ve aynı konuya ikinci basış sunucunun 409'unu okutuyordu. Şimdi kart konu
  durumunu biliyor (useIliskiler → konuDurumu): gönderilen konu kartın altında hemen
  "istek bekliyor" oluyor.

  ÇEKEREK YENİLEME: akış deseninin beklenen jesti. useAsync'in loading bayrağı sessiz
  tazelemede yükselmediği için RefreshControl kendi yerel bayrağını taşır ve veri
  (ya da hata) geldiğinde söner.

  BEKLEYEN İŞ SAYAÇLARI (mobil sapma, web'de yok): gelen istek ve kullanıcının kapatabileceği
  dersler Akış'tan görünmüyordu. İkisinin de sessiz bir süresi var: istek 14 günde kendini
  kapatıyor, onaylanmayan ders 48 saatte otomatik onaylanıp itiraz hakkını götürüyor. Push
  bildirimi yok, yani kullanıcıyı Arkadaşlar'a ya da Derslerim'e çağıracak tek şey bu iki
  rozet. Sayılar mevcut uçlardan: myMatches (useIliskiler) ve mySessions(1, 1) — aktif dersler
  sayfadan bağımsız TAM dönüyor, geçmişten yalnızca tek kayıt istenir. Ekran kurulu kaldığı
  için ikisi de odakta ve ön plana dönüşte sessiz tazeleniyor (useOnePlanaGelince).

  SOĞUK BAŞLANGIÇ TEK DOKUNUŞ (mobil sapma): portföyü boş kullanıcı iki eylemsiz kutu
  görüyordu ("➕ sekmesinden ekle" tarifi ve altında "Şimdilik öneri yok"); ilk öneriye 8
  dokunuş ve tahmin vardı. Şimdi tek kutu ve tek düğme: Oluştur'u "Almak istediğim konu"
  seçicisi açık getirir (?ekle=Seek). Boş liste kutusu o durumda çizilmez; ikisi aynı
  şeyi söylüyordu ve yalnızca birinde düğme vardı.

  Dönüşte tazeleme: konu Oluştur'da ekleniyor ve Akış kurulu kalıyor. Portföy odakta
  sessiz çekiliyor; Seek sayısı 0 sınırını geçtiyse (iki yönde de) öneriler de yeniden
  isteniyor. Her odakta öneri çekilmiyor: yeniden sıralanan kartlar kaydırılmış akışı
  oynatırdı (üstteki "istek sonucu" gerekçesi). Kartı olan kullanıcının sonradan eklediği
  konu çekerek yenilemeyle gelir; boş akışta ise bekletecek bir kaydırma yok.
*/
export default function Akis() {
  const guvenli = useSafeAreaInsets()
  const router = useRouter()
  const eslesmelerCipasi = useTurCipasi('eslesmeler')
  const derslerCipasi = useTurCipasi('dersler')
  const suggestions = useAsync(() => api.suggestions(20), [])
  const portfolio = useAsync(() => api.myPortfolio(), [])
  const iliskiler = useIliskiler()
  const dersler = useAsync(() => api.mySessions(1, 1), [])
  useOnePlanaGelince(() => {
    dersler.reload({ silent: true })
    portfolio.reload({ silent: true })
  })
  // Derslerim'deki "Senden aksiyon bekleyenler" grubuyla aynı tanım (lib/dersDurumu.js).
  const dersAksiyon = (dersler.data?.active ?? []).filter((s) => eylemBekliyor(s)).length

  const [hedef, setHedef] = useState(null)
  const [notice, setNotice] = useState(null)
  const [yenileniyor, setYenileniyor] = useState(false)

  /*
    Yenileme bayrağı İKİ AYRI efektle söner ve ayrım bilinçli: tek efekt
    [data, error] bağımlılığıyla, reload'un BAŞLANGIÇTAKİ error→null geçişinde de
    tetikleniyor ve spinner istek sürerken sönüyordu. Şimdi veri geldiğinde (yeni
    dizi referansı) ya da YENİ bir hata oluştuğunda söner; hatanın null'a temizlenmesi
    (isteğin başlaması) bayrağa dokunmaz.
  */
  useEffect(() => {
    setYenileniyor(false)
  }, [suggestions.data])

  useEffect(() => {
    if (suggestions.error) setYenileniyor(false)
  }, [suggestions.error])

  const myOffers = portfolio.data?.filter((entry) => entry.direction === 'Offer') ?? []
  const mySeekCount = portfolio.data?.filter((entry) => entry.direction === 'Seek').length ?? 0

  /*
    SOĞUK BAŞLANGIÇ KUTUSU VE KARTLAR BİRLİKTE ÇİZİLMEZ. Hata hâlinde kutu ÇIKMAZ: portföy
    çekilemediyse mySeekCount=0 veri değil bilinmezliktir, "konu ekle" demek yanlış
    yönlendirirdi.

    Kutu varken liste boş veriliyor, öneri yanıtı beklenmeden. Seek'lerin hepsi kaldırılıp
    Akış'a dönülünce portföy odakta tazeleniyor ama öneriler eski kalıyordu. Kutu ("Henüz
    bir konu eklemedin") silinen konulardan türemiş kartların ÜSTÜNDE duruyordu (önizlemede
    ölçüldü: kutu ve 3 kart). Sunucu Seek yokken zaten boş liste döndürüyor
    (GetMatchSuggestions yalnızca Seek'lenen konuları tarıyor); liste yanıttan önce boşalınca
    iki yüzey ağ süresi boyunca da çelişmiyor.
  */
  const sogukBaslangic = !portfolio.loading && !portfolio.error && mySeekCount === 0
  const oneriler = sogukBaslangic ? [] : (suggestions.data ?? [])

  /*
    SEEK SAYISI 0 SINIRINI GEÇİNCE ÖNERİLER. Sayı portföy gelmeden null: "bilinmiyor", 0
    değil. Yoksa ilk yanıt 0→N geçişi sayılır ve öneriler kurulumda ikinci kez çekilirdi.

    0→N (ilk konu eklendi): tazeleme sessiz DEĞİL. Sessiz tazelemede useAsync elde veri ([])
    olduğu için yükleme bayrağını kaldırmaz; istek sürerken, konu daha yeni eklenmişken
    ekranda "Şimdilik öneri yok" yazardı. Sayı 0 iken kart çizilmediği için korunacak
    kaydırma da yok.

    N→0 (son konu kaldırıldı): liste yukarıda zaten boş çiziliyor; tazeleme verinin kendisini
    boşaltıyor. Yapılmasaydı eski kartlar veride kalır ve sonraki 0→N geçişinde yeni yanıt
    gelene kadar silinen konuların kartları geri görünürdü. Bu tazeleme SESSİZ: yükleme
    bayrağı kalksaydı liste boş çizildiği için kutunun altında yanıt gelene kadar "Yükleniyor"
    dönerdi.

    N→M (0 olmayan iki sayı) bilerek tazelenmiyor: kartlar zaten var ve yeniden sıralama
    kaydırılmış akışı oynatır (dosya başındaki gerekçe). O fark çekerek yenilemeyle gelir.
  */
  const seekSayisi = portfolio.data ? mySeekCount : null
  const oncekiSeek = useRef(seekSayisi)
  /* useLayoutEffect: 0→N render'ında liste boş ve loading=false geliyor; pasif efekt boyamadan SONRA
     koştuğu için "Şimdilik öneri yok" bir kare görünüyordu (5 turda 5, ölçüldü). Layout efektindeki
     setState boyamadan önce işleniyor. */
  useLayoutEffect(() => {
    const onceki = oncekiSeek.current
    oncekiSeek.current = seekSayisi
    if (onceki === null || seekSayisi === null) return
    if (onceki === 0 && seekSayisi > 0) {
      suggestions.reload()
    } else if (onceki > 0 && seekSayisi === 0) {
      suggestions.reload({ silent: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekSayisi])

  function yenile() {
    setYenileniyor(true)
    suggestions.reload({ silent: true })
    portfolio.reload({ silent: true })
    dersler.reload({ silent: true })
    iliskiler.yenile()
  }

  const bosDegil = oneriler.length > 0

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Instagram düzeninde tab çubuğuna girmeyen bölümler başlıktan açılır:
          Topluluk (forum), Arkadaşlar (istek kabul/ret) ve Derslerim (rezervasyon +
          kanıt akışı). Üçü de sekme olmadı çünkü alt bar beşten fazlasını taşıyamaz;
          sıra kullanma sıklığına göre. */}
      <EkranBasligi
        sag={
          <View className="flex-row items-center">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Topluluk"
              onPress={() => router.push('/topluluk')}
              className="h-11 w-11 items-center justify-center rounded-lg"
            >
              <ToplulukIkonu renk={slate[700]} boy={24} />
            </Pressable>
            {/* Tur çıpaları: bu iki ikon turun "eslesmeler" ve "dersler" adımlarının
                ışık tuttuğu öğeler (bkz. src/lib/tur.js TUR_ADIMLARI).
                Sayaç rozetleri düğmenin İÇİNDE absolute: 44×44 dokunma alanı ve çıpa ölçüsü
                değişmiyor. Sayı rozetten değil erişim adından okunuyor (bkz. SayacRozeti). */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                iliskiler.gelenIstekSayisi > 0
                  ? `Arkadaşlar, ${iliskiler.gelenIstekSayisi} gelen istek`
                  : 'Arkadaşlar'
              }
              onPress={() => router.push('/eslesmeler')}
              className="h-11 w-11 items-center justify-center rounded-lg active:bg-slate-100"
              {...eslesmelerCipasi}
            >
              <KisilerIkonu renk={slate[700]} boy={24} />
              <SayacRozeti sayi={iliskiler.gelenIstekSayisi} className="absolute right-0.5 top-1" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={dersAksiyon > 0 ? `Derslerim, ${dersAksiyon} ders işlem bekliyor` : 'Derslerim'}
              onPress={() => router.push('/dersler')}
              className="h-11 w-11 items-center justify-center rounded-lg active:bg-slate-100"
              {...derslerCipasi}
            >
              <KepIkonu renk={slate[700]} boy={24} />
              <SayacRozeti sayi={dersAksiyon} className="absolute right-0.5 top-1" />
            </Pressable>
          </View>
        }
      />

      <FlatList
        data={oneriler}
        keyExtractor={(kisi) => kisi.userId}
        renderItem={({ item }) => (
          <IlanKarti
            kisi={item}
            onIstek={setHedef}
            // İlk yanıt gelmeden durum VERİLMİYOR ("bilinmiyor", "kapsanan yok" değil); kart o arada
            // varsayılan istek düğmesini çiziyor, yanıt gelince konuya göre değişiyor.
            konuDurumu={iliskiler.yukleniyor ? undefined : iliskiler.konuDurumu}
          />
        )}
        // Veri dizisi değişmeden kart durumu değişiyor: FlatList satırları yeniden çizsin.
        extraData={iliskiler.konuDurumu}
        contentContainerClassName="gap-3 p-4"
        /* Yüzen sekme çubuğu içeriğin ÜSTÜNDE duruyor; alt dolgu olmadan son öğe onun
           altında kalır (bkz. src/lib/sekmeCubugu.js). */
        contentContainerStyle={{ paddingBottom: sekmeAltDolgusu(guvenli.bottom) }}
        refreshControl={
          <RefreshControl refreshing={yenileniyor} onRefresh={yenile} tintColor={brand[600]} colors={[brand[600]]} />
        }
        ListHeaderComponent={
          <View className="gap-3">
            {notice && (
              <Notice tone="success" onDismiss={() => setNotice(null)}>
                {notice}
              </Notice>
            )}

            <ErrorBox error={suggestions.error} onRetry={() => suggestions.reload()} />

            {/* Koşul ve hata hâli sogukBaslangic'te. Kutu Notice değil: Notice metin
                taşıyor, burada kutunun işi düğme. Tonu Notice'in info tonuyla aynı. */}
            {sogukBaslangic && (
              <View className="gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
                <Text className="text-sm text-brand-800">
                  Öneriler, öğrenmek istediğin konulardan üretilir. Henüz bir konu eklemedin.
                </Text>
                <Button onPress={() => router.push('/olustur?ekle=Seek')}>
                  Öğrenmek istediğim konuyu ekle
                </Button>
              </View>
            )}
          </View>
        }
        /* Portföy ilk kez gelmeden boş liste kutusu SEÇİLMİYOR: hangisinin doğru olduğunu
           (soğuk başlangıç kutusu mu, "öneri yok" mu) portföy söylüyor. Beklenmeseydi
           portföyü boş kullanıcı açılışta önce "Şimdilik öneri yok" görür, kutu sonra
           yerine gelirdi. portfolio.loading yalnızca ilk çekimde yükseliyor (sessiz
           tazelemeler bayrağa dokunmuyor). */
        ListEmptyComponent={
          suggestions.loading || portfolio.loading ? (
            <Loading />
          ) : suggestions.error || sogukBaslangic ? null : (
            <EmptyState
              title="Şimdilik öneri yok"
              description="Almak istediğin konuları genişlet ya da Keşfet sekmesinden katalogda ara."
              action={
                <Button variant="secondary" onPress={() => router.push('/kesfet')}>
                  Keşfet'te ara
                </Button>
              }
            />
          )
        }
        // Boş/yüklenme durumlarında başlık ile içerik arasına da akıştaki kart
        // boşluğu girsin — gap yalnızca kardeş öğeler arasında çalışır.
        ListHeaderComponentStyle={bosDegil ? null : { marginBottom: 12 }}
      />

      <EslesmeIstegiModali
        person={hedef}
        myOffers={myOffers}
        konuDurumu={iliskiler.yukleniyor ? undefined : iliskiler.konuDurumu}
        // Hata da "bilinmiyor": boş harita herkesi arkadaş değil gösterirdi.
        kisiIliskisi={iliskiler.yukleniyor || iliskiler.hata ? undefined : iliskiler.iliski}
        onClose={() => setHedef(null)}
        onSent={(name, topicId) => {
          const id = hedef.userId
          setHedef(null)
          iliskiler.konuIstendi(id, topicId)
          setNotice(`${name} kişisine arkadaş isteği gönderildi. Kabul edilince sohbet açılacak.`)
        }}
      />
    </SafeAreaView>
  )
}
