import { useEffect, useState } from 'react'
import { FlatList, Pressable, RefreshControl, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../src/lib/api'
import { useAsync } from '../src/state/useAsync'
import { brand, slate } from '../src/lib/theme'
import { IlanKarti } from '../src/components/IlanKarti'
import { EslesmeIstegiModali } from '../src/components/EslesmeIstegiModali'
import { EmptyState, ErrorBox, Loading, Notice } from '../src/components/ui'

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
  • İstek gönderilince önerilerin SESSİZ tazelenmesi (silent): liste spinner'a
    dönmeden güncellenir.

  ÇEKEREK YENİLEME: akış deseninin beklenen jesti. useAsync'in loading bayrağı sessiz
  tazelemede yükselmediği için RefreshControl kendi yerel bayrağını taşır ve veri
  (ya da hata) geldiğinde söner.
*/
export default function Akis() {
  const router = useRouter()
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
      {/*
        YIĞIN EKRANI BAŞLIĞI (2026-09-23). Akış ana sekmeden indi — Topluluk oraya çıktı —
        ve artık çekmeceden açılan bir yığın ekranı, tıpkı eski Topluluk gibi.

        BAŞLIKTAKİ ÜÇ İKON KALDIRILDI (Topluluk, Arkadaşlar, Derslerim). Üçü de artık
        bir dokunuş uzakta: Topluluk ana sekme, diğer ikisi çekmecede. Aynı hedefe iki
        kapı bırakmak, hangisinin 'doğru' olduğu sorusunu üretir.

        ⚠️ O ikonlardan ikisi TUR ÇIPASI taşıyordu ('eslesmeler', 'dersler'). Çıpalar
        silinmedi, HAMBURGER DÜĞMESİNE taşındı (src/components/Cekmece.jsx) ve ilgili
        iki adımın metni de güncellendi — artık 'menüde' diyorlar. Çıpasız bırakılsaydı
        tur çökmezdi ama adımlar ekranın ortasında bağlamsız kartlara düşerdi
        (tur.js'teki belgelenmiş yedek davranış).
      */}
      <View className="flex-row items-center gap-2 border-b border-slate-200 bg-white px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="h-11 w-11 items-center justify-center rounded-lg"
        >
          <Text className="text-xl text-slate-500">←</Text>
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-slate-900">Akış</Text>
      </View>
      <FlatList
        data={suggestions.data ?? []}
        keyExtractor={(kisi) => kisi.userId}
        renderItem={({ item }) => <IlanKarti kisi={item} onIstek={setHedef} />}
        contentContainerClassName="gap-3 p-4"
        /* Yüzen sekme çubuğu içeriğin ÜSTÜNDE duruyor; alt dolgu olmadan son öğe onun
           altında kalır (bkz. src/lib/sekmeCubugu.js). */
        /* Yığın ekranında yüzen sekme çubuğu çizilmiyor; alt dolguya gerek yok. */
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
        onClose={() => setHedef(null)}
        onSent={(name) => {
          setHedef(null)
          setNotice(`${name} kişisine arkadaş isteği gönderildi. Kabul edilince sohbet açılacak.`)
          suggestions.reload({ silent: true })
        }}
      />
    </SafeAreaView>
  )
}
