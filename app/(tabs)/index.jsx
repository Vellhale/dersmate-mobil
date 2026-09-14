import { useEffect, useState } from 'react'
import { FlatList, Pressable, RefreshControl, View } from 'react-native'
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
import { EmptyState, ErrorBox, Loading, Notice, SayacRozeti } from '../../src/components/ui'

/*
  AKIŞ (ANA SAYFA) — Instagram düzeninin ana sayfası: kişiselleştirilmiş öneri
  kartları tam genişlik akış olarak.

  Web'de bu veri Keşfet'in "öneri modu"ydu (Discover.jsx → Suggestions). Mobilde ayrı
  bir sekmeye taşındı: sosyal akış düzeninde açılış ekranı gezinilecek bir katalog
  değil, kaydırılacak bir akıştır. Keşfet sekmesi arama/filtre işine odaklanır.

  Veri kararları web'den:
  • api.suggestions(20) — öneriler "Almak istediğim konular" portföyünden türer;
    portföyde Seek yoksa kullanıcıya bunu söyleyen bilgi kutusu çıkar.
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
  useOnePlanaGelince(() => dersler.reload({ silent: true }))
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

  function yenile() {
    setYenileniyor(true)
    suggestions.reload({ silent: true })
    portfolio.reload({ silent: true })
    dersler.reload({ silent: true })
    iliskiler.yenile()
  }

  const bosDegil = (suggestions.data?.length ?? 0) > 0

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
        data={suggestions.data ?? []}
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

            {/* Hata hâlinde bilgi kutusu ÇIKMAZ: portföy çekilemediyse mySeekCount=0
                veri değil bilinmezliktir — "konu ekle" demek yanlış yönlendirirdi. */}
            {!portfolio.loading && !portfolio.error && mySeekCount === 0 && (
              <Notice tone="info">
                Öneriler, "Almak istediğim konular" listenden üretilir. ➕ sekmesinden
                portföyüne en az bir konu ekleyerek başla.
              </Notice>
            )}
          </View>
        }
        ListEmptyComponent={
          suggestions.loading ? (
            <Loading />
          ) : suggestions.error ? null : (
            <EmptyState
              title="Şimdilik öneri yok"
              description="Almak istediğin konuları genişlet ya da Keşfet sekmesinden katalogda ara."
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
