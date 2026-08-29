import { useEffect, useState } from 'react'
import { FlatList, Pressable, RefreshControl, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../../src/lib/api'
import { useAsync } from '../../src/state/useAsync'
import { brand, slate } from '../../src/lib/theme'
import { EkranBasligi } from '../../src/components/EkranBasligi'
import { KepIkonu, KisilerIkonu, ToplulukIkonu } from '../../src/components/Ikonlar'
import { useTurCipasi } from '../../src/lib/tur'
import { IlanKarti } from '../../src/components/IlanKarti'
import { EslesmeIstegiModali } from '../../src/components/EslesmeIstegiModali'
import { EmptyState, ErrorBox, Loading, Notice } from '../../src/components/ui'

/*
  AKIŞ (ANA SAYFA) — Instagram düzeninin ana sayfası: kişiselleştirilmiş öneri
  kartları tam genişlik akış olarak.

  Web'de bu veri Keşfet'in "öneri modu"ydu (Discover.jsx → Suggestions). Mobilde ayrı
  bir sekmeye taşındı: sosyal akış düzeninde açılış ekranı gezinilecek bir katalog
  değil, kaydırılacak bir akıştır. Keşfet sekmesi arama/filtre işine odaklanır.

  Veri kararları web'den:
  • api.suggestions(20) — öneriler "Almak istediğim konular" portföyünden türer;
    portföyde Seek yoksa kullanıcıya bunu söyleyen bilgi kutusu çıkar.
  • Portföyün Offer girdileri eşleşme modalındaki takas teklifi listesini besler.
  • İstek gönderilince önerilerin SESSİZ tazelenmesi (silent): liste spinner'a
    dönmeden güncellenir.

  ÇEKEREK YENİLEME: akış deseninin beklenen jesti. useAsync'in loading bayrağı sessiz
  tazelemede yükselmediği için RefreshControl kendi yerel bayrağını taşır ve veri
  (ya da hata) geldiğinde söner.
*/
export default function Akis() {
  const router = useRouter()
  const eslesmelerCipasi = useTurCipasi('eslesmeler')
  const derslerCipasi = useTurCipasi('dersler')
  const suggestions = useAsync(() => api.suggestions(20), [])
  const portfolio = useAsync(() => api.myPortfolio(), [])

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
  }

  const bosDegil = (suggestions.data?.length ?? 0) > 0

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Instagram düzeninde tab çubuğuna girmeyen bölümler başlıktan açılır:
          Topluluk (forum), Eşleşmeler (istek kabul/ret) ve Derslerim (rezervasyon +
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
                ışık tuttuğu öğeler (bkz. src/lib/tur.js TUR_ADIMLARI). */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Eşleşmeler"
              onPress={() => router.push('/eslesmeler')}
              className="h-11 w-11 items-center justify-center rounded-lg"
              {...eslesmelerCipasi}
            >
              <KisilerIkonu renk={slate[700]} boy={24} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Derslerim"
              onPress={() => router.push('/dersler')}
              className="h-11 w-11 items-center justify-center rounded-lg"
              {...derslerCipasi}
            >
              <KepIkonu renk={slate[700]} boy={24} />
            </Pressable>
          </View>
        }
      />

      <FlatList
        data={suggestions.data ?? []}
        keyExtractor={(kisi) => kisi.userId}
        renderItem={({ item }) => <IlanKarti kisi={item} onIstek={setHedef} />}
        contentContainerClassName="gap-3 p-4"
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
              title="Şimdilik eşleşme yok"
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
        onClose={() => setHedef(null)}
        onSent={(name) => {
          setHedef(null)
          setNotice(`${name} kişisine eşleşme isteği gönderildi. Kabul edilince sohbet açılacak.`)
          suggestions.reload({ silent: true })
        }}
      />
    </SafeAreaView>
  )
}
