import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../src/lib/api'
import { useAsync } from '../src/state/useAsync'
import { formatDateTime } from '../src/lib/format'
import { Avatar } from '../src/components/Avatar'
import { Badge, Button, EmptyState, ErrorBox, Loading, Notice } from '../src/components/ui'

/*
  EŞLEŞMELER — web'deki pages/Matches.jsx'in portu. Tab çubuğunun üstünde yığın ekranı
  (Akış başlığından ve profildeki kısayoldan gelinir): gelen isteği kabul etmeden ders
  akışı hiç başlayamaz — bu ekran Derslerim'in ön koşulu.

  Web kararları aynen:
  • Üç sekme kısa adla (Gelen/Giden/Aktif): dar ekranda uzun ad iki satıra kırılıp
    şeridi tırtıklıyordu; sayaç kalır, uzun ad düşer.
  • Konusuz eşleşme = üniversite ağı isteği: requestedTopicName null gelir ve kart
    "Sohbet isteği" der — boş bir "Almak istediğin:" satırı basılmaz.
  • Sonlandırma tek taraflı ve geri alınamaz — tek tıkla olmaz, satır içi onay kutusu.
  • Üniversite ağı eşleşmesinden ders REZERVE EDİLEMEZ (sunucu da reddeder): konusuz
    eşleşmede "Ders rezerve et" düğmesi hiç çizilmez.
*/

const TABS = [
  { key: 'incoming', label: 'Gelen' },
  { key: 'outgoing', label: 'Giden' },
  { key: 'active', label: 'Aktif' },
]

export default function Eslesmeler() {
  const router = useRouter()
  const matches = useAsync(() => api.myMatches(), [])
  const [tab, setTab] = useState('incoming')
  const [notice, setNotice] = useState(null)

  const lists = matches.data ?? { incoming: [], outgoing: [], active: [] }
  const current = lists[tab] ?? []

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="flex-row items-center gap-2 border-b border-slate-200 bg-white px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="h-11 w-11 items-center justify-center rounded-lg"
        >
          <Text className="text-xl text-slate-500">←</Text>
        </Pressable>
        <View>
          <Text className="text-lg font-bold text-slate-900">Eşleşmeler</Text>
          <Text className="text-xs text-slate-500">
            İstek kabul edilince sohbet açılır; ders de oradan planlanır.
          </Text>
        </View>
      </View>

      <View className="m-4 mb-0 flex-row rounded-lg bg-slate-100 p-1">
        {TABS.map((item) => {
          const sayi = lists[item.key]?.length ?? 0
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
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
              {sayi > 0 && <Text className="text-xs text-slate-400">({sayi})</Text>}
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
        ) : current.length === 0 ? (
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
        description="Akış ve Keşfet'ten sana uygun öğrencilere istek gönderebilirsin."
        action={<Button onPress={() => router.push('/kesfet')}>Keşfet'e git</Button>}
      />
    )
  }

  return (
    <EmptyState
      title="Aktif eşleşmen yok"
      description="Bir istek kabul edildiğinde burada görünür ve sohbet açılır."
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
      onChanged(`${match.otherDisplayName} ile eşleşme sonlandırıldı. Sohbet geçmişin duruyor.`)
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
          ? `${match.otherDisplayName} ile eşleştiniz. Sohbet açıldı — ders saatini kararlaştırın.`
          : 'İstek reddedildi.',
      )
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-5">
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
          Üniversite ağı · <Text className="font-semibold text-slate-800">Sohbet isteği</Text>
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
            <Button variant="success" className="flex-1" loading={busy === 'accept'} onPress={() => respond(true)}>
              Kabul et
            </Button>
            <Button variant="secondary" className="flex-1" loading={busy === 'decline'} onPress={() => respond(false)}>
              Reddet
            </Button>
          </>
        )}

        {tab === 'outgoing' && <Badge tone="warning">Yanıt bekleniyor</Badge>}

        {tab === 'active' && (
          <>
            {match.conversationId && (
              <Button className="flex-1" onPress={() => router.push(`/sohbet/${match.conversationId}`)}>
                Sohbet
              </Button>
            )}
            {match.requestedTopicName && (
              <Button variant="secondary" className="flex-1" onPress={() => router.push('/dersler')}>
                Ders rezerve et
              </Button>
            )}
            <Button variant="secondary" onPress={() => setConfirmClose(true)}>
              Sonlandır
            </Button>
          </>
        )}
      </View>

      {confirmClose && (
        <View className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <Text className="text-sm text-amber-900">
            <Text className="font-semibold">{match.otherDisplayName}</Text> ile eşleşme
            sonlandırılsın mı? Sohbet geçmişin durur ama yeni mesaj yazamazsın ve bu eşleşmeden
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
    </View>
  )
}
