import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../src/lib/api'
import { useAsync } from '../src/state/useAsync'
import { useInbox } from '../src/state/InboxContext'
import { formatDateTime } from '../src/lib/format'
import { Avatar } from '../src/components/Avatar'
import { Badge, Button, Card, EmptyState, ErrorBox, GeriDugmesi, Loading, Notice, SayacRozeti } from '../src/components/ui'
import { ogrenciKonusu } from '../src/lib/iliski'

/*
  ARKADAŞLAR — web'deki pages/Matches.jsx'in portu. Kök yığın ekranı (ÇEKMECEDEN ve
  profildeki kısayoldan gelinir): gelen isteği kabul etmeden ders akışı hiç
  başlayamaz — bu ekran Derslerim'in ön koşulu.

  ROTA ADI BİLEREK ESKİ (/eslesmeler). Web #31'de ekran "Eşleşmeler"den "Arkadaşlar"a
  döndü ve web adresi /arkadaslar oldu, ama eski adresi yönlendirme olarak tuttu. Mobilde
  yol kullanıcıya görünmüyor; değiştirmek ise sessizce kırar: tur çıpası 'eslesmeler'
  (src/lib/tur.js — çıpa artık hamburger düğmesinde, adım adı 'menu'),
  Stack.Protected listesi — yeni ad oraya eklenmezse ekran OTURUMSUZ da açılır.
  Bileşen/API adları da (Eslesmeler, MatchKarti, myMatches…) web gibi aynı kaldı.

  Web kararları aynen:
  • Üç sekme kısa adla (Gelen/Giden/Arkadaş): dar ekranda uzun ad iki satıra kırılıp
    şeridi tırtıklıyordu; sayaç kalır, uzun ad düşer. "Arkadaşlar" sayaçla birlikte
    sığmadığı için kısa ad "Arkadaş" (web'de 375px'te ölçüldü).
  • Konusuz eşleşme (üniversite ağı ya da Arkadaş Ekle isteği): requestedTopicName null
    gelir ve kart "Arkadaşlık · ders içermez" der — boş bir "Almak istediğin:" satırı
    basılmaz. Eskiden "Üniversite ağı · Sohbet isteği" diyordu; ama Arkadaş Ekle'den gelen
    istek de konusuz ve kabul edilmiş arkadaşlıkta "istek" sözü yanlıştı. Kartın asıl
    söylemesi gereken, bu ilişkiden ders rezerve edilemeyeceği.
  • Sonlandırma tek taraflı ve geri alınamaz — tek tıkla olmaz, satır içi onay kutusu.
  • "Ders rezerve et" yalnızca bu eşleşmede ÖĞRENCİ olduğum bir konu varsa çizilir
    (lib/iliski.js → ogrenciKonusu; Derslerim'in rezervasyon listesiyle aynı tanım).
    Konusuz eşleşmeden ders rezerve edilemez (sunucu da reddeder). Takassız ve anlatanın
    ben olduğum eşleşmede de yok: rezervasyonu dersi alan taraf yapar.
*/

const TABS = [
  { key: 'incoming', label: 'Gelen' },
  { key: 'outgoing', label: 'Giden' },
  { key: 'active', label: 'Arkadaş' },
]

export default function Eslesmeler() {
  const router = useRouter()
  const { reloadConversations } = useInbox()
  const matches = useAsync(() => api.myMatches(), [])

  /*
    ODAKTA SESSİZ TAZELEME (CLAUDE.md → "Başka ekranda değişen veri ODAKTA tazelenir").
    Bu ekrandan açılan bir profil ekranda başka bir Arkadaşlar ekranına götürebiliyor ya da
    orada istek gönderilip engel konabiliyor; dönüldüğünde liste eski kalıyor ve zaten
    yanıtlanmış isteğe "Kabul et" basmak sunucudan 409 alıyordu. Kurulumla aynı anda gelen
    odak atlanıyor (ArkadaslarBolumu kalıbı): ilk çekimi useAsync zaten yaptı.
  */
  const tazele = useRef(matches.reload)
  tazele.current = matches.reload
  const kuruluyor = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (!kuruluyor.current) tazele.current({ silent: true })
    }, []),
  )
  useEffect(() => {
    kuruluyor.current = false
  }, [])
  /* Başlangıç sekmesi adresten gelebilir (Profilim → "Arkadaşlarım" → ?sekme=active).
     Bilinmeyen değer Gelen'e düşer: bildirimden gelen kullanıcının niyeti istekler. */
  const { sekme } = useLocalSearchParams()
  const [tab, setTab] = useState(() => (TABS.some((t) => t.key === sekme) ? sekme : 'incoming'))
  const [notice, setNotice] = useState(null)

  const lists = matches.data ?? { incoming: [], outgoing: [], active: [] }
  const current = lists[tab] ?? []

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <GeriDugmesi onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text className="min-w-0 flex-1 text-lg font-bold text-slate-900">Arkadaşlar</Text>
      </View>

      {/* Açıklama cümlesi başlık şeridinde değil içeriğin başında (Derslerim ve Topluluk'la aynı
          yer). Şeritte 390 dp'de iki satıra kırılıyordu: şerit öteki yığın başlıklarından 16px
          uzuyor ve geri düğmesi ekranlar arasında geçerken 8px zıplıyordu (ölçüldü). */}
      <Text className="mx-4 mt-4 text-sm text-slate-600">
        İstek kabul edilince sohbet açılır; ders de oradan planlanır.
      </Text>

      <View className="mx-4 mt-3 flex-row rounded-lg bg-slate-100 p-1">
        {TABS.map((item) => {
          const sayi = lists[item.key]?.length ?? 0
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              // Sayı adın içinde: Gelen'deki rozet ekran okuyucudan gizli (SayacRozeti), yani
              // ad vermeseydik o sekme sayısız okunurdu. Üç sekme aynı biçimde adlanıyor.
              accessibilityLabel={sayi > 0 ? `${item.label}, ${sayi}` : item.label}
              accessibilityState={{ selected: tab === item.key }}
              onPress={() => setTab(item.key)}
              className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-1 rounded-md ${
                tab === item.key ? 'bg-white' : ''
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  tab === item.key ? 'text-brand-700' : 'text-slate-600'
                }`}
              >
                {item.label}
              </Text>
              {/* Gelen, Akış başlığındaki sayaçla aynı rozeti taşıyor: kullanıcıyı buraya o
                  rozet çağırdı ve iş burada. Giden ile Arkadaş iş değil bilgi, nötr parantez
                  kalıyor. Rengi slate-600: slate-400 beyaz zeminde bile 2.56:1'di (WCAG 1.4.3). */}
              {item.key === 'incoming' ? (
                <SayacRozeti sayi={sayi} />
              ) : (
                sayi > 0 && (
                  <Text className="text-xs text-slate-600" style={{ fontVariant: ['tabular-nums'] }}>
                    ({sayi})
                  </Text>
                )
              )}
            </Pressable>
          )
        })}
      </View>

      <ScrollView contentContainerClassName="gap-3 p-4">
        {notice && (
          <Notice tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Notice>
        )}

        <ErrorBox error={matches.error} onRetry={matches.reload} />

        {matches.loading ? (
          <Loading />
        ) : /* Hata varken boş durum GÖSTERİLMEZ: "Bekleyen istek yok" ile "Sunucuya
              ulaşılamadı" aynı ekranda çelişiyor ve kullanıcı kendisine gelmiş bir
              isteği kaçırdığını fark etmiyor. Boş durum yalnızca veri gerçekten
              geldiyse doğrudur. */
        matches.error || matches.data == null ? null : current.length === 0 ? (
          <SekmeBosDurumu tab={tab} router={router} />
        ) : (
          current.map((match) => (
            <MatchKarti
              key={match.matchId}
              match={match}
              tab={tab}
              router={router}
              onChanged={(message) => {
                setNotice(message)
                matches.reload({ silent: true })
                /*
                  SOHBET LİSTESİ DE TAZELENMELİ.

                  İstek kabul edilince sunucu konuşmayı AÇIYOR ama bunu kimseye
                  BİLDİRMİYOR: SignalR'ın ConversationUpdated olayı yalnızca mesaj
                  gönderiminde yayınlanıyor. InboxContext ise listeyi açılışta bir kez
                  çekip sonrasını o olaya bırakıyor. Sonuç: kullanıcı "Sohbet açıldı"
                  bildirimini görüyor, Mesajlar sekmesine geçiyor ve orada hiçbir şey
                  yok — ilk arkadaşıysa "Henüz sohbetin yok" boş durumu duruyor.
                  Ancak karşı taraf mesaj yazınca ya da uygulama yeniden açılınca düzeliyor.
                */
                reloadConversations()
              }}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function SekmeBosDurumu({ tab, router }) {
  if (tab === 'incoming') {
    return (
      <EmptyState
        title="Bekleyen istek yok"
        description="Portföyüne konu ekledikçe sana daha çok istek gelir."
      />
    )
  }

  if (tab === 'outgoing') {
    return (
      <EmptyState
        title="Bekleyen isteğin yok"
        description="Keşfet'ten sana uygun öğrencilere istek gönderebilirsin."
        action={<Button onPress={() => router.push('/kesfet')}>Keşfet'e git</Button>}
      />
    )
  }

  /* Eylem ŞART: Profilim'deki "Arkadaşlarım" artık doğrudan bu sekmeyi açıyor ve yeni kullanıcı
     buraya eylemsiz bir boş durumla iniyordu (Arkadaşlar bölümündeki "Arkadaş bul"un aynısı). */
  return (
    <EmptyState
      title="Henüz arkadaşın yok"
      description="Adını bildiğin birini bulup arkadaş isteği gönderebilirsin; kabul edilince burada görünür ve sohbet açılır."
      action={
        <Button variant="secondary" onPress={() => router.push('/kesfet?sekme=arkadas')}>
          Arkadaş bul
        </Button>
      }
    />
  )
}

function MatchKarti({ match, tab, router, onChanged }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [confirmClose, setConfirmClose] = useState(false)

  async function close() {
    if (busy) return
    setBusy('close')
    setError(null)
    try {
      await api.closeMatch(match.matchId)
      onChanged(`${match.otherDisplayName} ile arkadaşlığın sonlandırıldı. Sohbet geçmişin duruyor.`)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
      setConfirmClose(false)
    }
  }

  async function respond(accept) {
    if (busy) return
    setBusy(accept ? 'accept' : 'decline')
    setError(null)
    try {
      await api.respondMatch(match.matchId, accept)
      onChanged(
        accept
          ? `${match.otherDisplayName} ile arkadaş oldunuz. Sohbet açıldı — ders saatini kararlaştırın.`
          : 'İstek reddedildi.',
      )
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${match.otherDisplayName} profilini aç`}
        onPress={() => router.push(`/profil/${match.otherUserId}`)}
        className="flex-row items-center gap-3"
      >
        <Avatar userId={match.otherUserId} name={match.otherDisplayName} size="md" />
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="shrink font-semibold text-brand-700" numberOfLines={1}>
              {match.otherDisplayName}
            </Text>
            {match.offeredTopicId && <Badge tone="success">Takas teklifi</Badge>}
          </View>
          <Text className="mt-0.5 text-xs text-slate-600">{formatDateTime(match.createdAtUtc)}</Text>
        </View>
      </Pressable>

      {match.requestedTopicName ? (
        <Text className="mt-3 text-sm text-slate-600">
          {match.iAmInitiator ? 'Almak istediğin: ' : 'Senden istediği: '}
          <Text className="font-semibold text-slate-800">{match.requestedTopicName}</Text>
        </Text>
      ) : (
        <Text className="mt-3 text-sm text-slate-600">
          Arkadaşlık · <Text className="font-semibold text-slate-800">ders içermez</Text>
        </Text>
      )}

      {match.offeredTopicName && (
        <Text className="mt-1 text-sm text-slate-600">
          {match.iAmInitiator ? 'Karşılığında anlatacağın: ' : 'Karşılığında anlatacağı: '}
          <Text className="font-semibold text-slate-800">{match.offeredTopicName}</Text>
        </Text>
      )}

      <View className="mt-4 flex-row flex-wrap gap-2">
        {tab === 'incoming' && (
          <>
            {/* Etiketlerde ad: kart başına aynı "Kabul et / Reddet" ekran okuyucuda kimin isteği
                olduğunu söylemiyordu. Görünen metinle başlıyor (WCAG 2.5.3). */}
            <Button
              variant="primary"
              className="flex-1"
              loading={busy === 'accept'}
              accessibilityLabel={`Kabul et, ${match.otherDisplayName}`}
              onPress={() => respond(true)}
            >
              Kabul et
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              loading={busy === 'decline'}
              accessibilityLabel={`Reddet, ${match.otherDisplayName}`}
              onPress={() => respond(false)}
            >
              Reddet
            </Button>
          </>
        )}

        {tab === 'outgoing' && <Badge tone="warning">Yanıt bekleniyor</Badge>}

        {tab === 'active' && (
          <>
            {match.conversationId && (
              /* "Mesaj gönder": profil ve Keşfet kartındaki aynı eylemle tek ad. Web "Sohbet" diyor;
                 ayrışma mobilde ilişkiyi bilen yüzeylerle doğdu ve kullanıcı ikisini art arda
                 görüyordu (bu karttan profile geçince). */
              <Button
                className="min-w-[45%] flex-1"
                accessibilityLabel={`Mesaj gönder, ${match.otherDisplayName}`}
                onPress={() => router.push(`/sohbet/${match.conversationId}`)}
              >
                Mesaj gönder
              </Button>
            )}
            {/* min-w-[45%]: flex-1'in tabanı 0 olduğu için satır hiç sarmıyordu; Sonlandır 94 px'ini
                alıyor, iki birincil eylem kalan alana sıkışıp varsayılan boyutta harf ortasından
                bölünüyordu ("Sohb/et"). Artık Sonlandır gerekirse alt satıra iniyor. */}
            {/*
              KOŞUL `requestedTopicName` DEĞİL, öğrenci konusu. Eski koşul, karşı tarafın benden
              takassız ders istediği arkadaşlıkta da düğmeyi çiziyordu: rezervasyon listesinde o
              arkadaş hiç yok (anlatan benim) ve düğme "sana anlatılacak konu yok" diyen boş bir
              sayfaya çıkıyordu. Adres de parametresizdi; kullanıcı Derslerim'de "+ Rezerve et"e
              yeniden basıp arkadaşını listeden yeniden seçiyordu. ?rezerve= sayfayı bu arkadaş
              seçili açar (app/dersler.jsx).
            */}
            {ogrenciKonusu(match) && (
              <Button
                variant="secondary"
                className="min-w-[45%] flex-1"
                accessibilityLabel={`Ders rezerve et, ${match.otherDisplayName}`}
                onPress={() => router.push(`/dersler?rezerve=${match.matchId}`)}
              >
                Ders rezerve et
              </Button>
            )}
            <Button
              variant="secondary"
              accessibilityLabel={`Sonlandır, ${match.otherDisplayName}`}
              onPress={() => setConfirmClose(true)}
            >
              Sonlandır
            </Button>
            {/* Düğmenin yokluğu tek başına bir şey anlatmıyor: ders konusu olan arkadaşlıkta
                kullanıcı "neden rezerve edemiyorum?" diye kalıyordu. w-full satırı kırar. */}
            {!ogrenciKonusu(match) && match.requestedTopicName ? (
              <Text className="w-full text-xs text-slate-600">
                Bu derste anlatan sensin; rezervasyonu {match.otherDisplayName} yapar. Saati sohbette
                kararlaştırın.
              </Text>
            ) : null}
          </>
        )}
      </View>

      {/* Sonlandırma geri alınamaz: yıkıcı eylem onayı rose (A düzeni). Amber yalnızca
          bekleyen durumu anlatır; yönetimdeki ban onayıyla aynı kutu. */}
      {confirmClose && (
        <View className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <Text className="text-sm text-rose-800">
            <Text className="font-semibold">{match.otherDisplayName}</Text> ile arkadaşlığın
            sonlandırılsın mı? Sohbet geçmişin durur ama yeni mesaj yazamazsın ve bu arkadaşlıktan
            ders rezerve edilemez. Geri alınamaz.
          </Text>
          <View className="mt-3 flex-row gap-2">
            <Button variant="danger" loading={busy === 'close'} onPress={close}>
              Evet, sonlandır
            </Button>
            <Button variant="secondary" onPress={() => setConfirmClose(false)}>
              Vazgeç
            </Button>
          </View>
        </View>
      )}

      {error && (
        <View className="mt-3">
          <ErrorBox error={error} />
        </View>
      )}
    </Card>
  )
}
