import { FlatList, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useInbox } from '../../src/state/InboxContext'
import { formatDateTime } from '../../src/lib/format'
import { EkranBasligi } from '../../src/components/EkranBasligi'
import { Avatar } from '../../src/components/Avatar'
import { Badge, Button, EmptyState, ErrorBox, Loading } from '../../src/components/ui'

/*
  MESAJLAR — web'deki Chat.jsx'in LİSTE yarısı. Web ana-detay ızgarasını lg'de yan
  yana kuruyordu; mobilde detay her zaman ayrı ekran (app/sohbet/[conversationId]) —
  web'in "lg altında ekrana yalnızca biri sığar" kararının kalıcı hâli.

  Konuşma listesi ve SignalR bağlantısı InboxContext'ten (tab kabuğu): bu ekran veri
  ÇEKMEZ, gösterir. Rozet ve canlı güncellemeler kullanıcı başka sekmedeyken de işler.
*/

const DURUM = {
  connected: { tone: 'success', label: 'Canlı bağlantı' },
  connecting: { tone: 'warning', label: 'Bağlanıyor…' },
  reconnecting: { tone: 'warning', label: 'Yeniden bağlanıyor…' },
  disconnected: { tone: 'danger', label: 'Bağlantı yok — yeni mesajlar gecikebilir' },
}

export default function Mesajlar() {
  const router = useRouter()
  const { conversations, loading, error, reloadConversations, hub } = useInbox()

  const durum = DURUM[hub.status] ?? DURUM.connecting

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <EkranBasligi baslik="Mesajlar" sag={<Badge tone={durum.tone}>{durum.label}</Badge>} />

      {loading ? (
        <Loading />
      ) : error ? (
        <View className="p-4">
          <ErrorBox error={error} onRetry={reloadConversations} />
        </View>
      ) : conversations.length === 0 ? (
        <View className="p-4">
          <EmptyState
            title="Henüz sohbetin yok"
            description="Sohbet, bir eşleşme isteği kabul edildiğinde otomatik açılır."
            action={<Button onPress={() => router.push('/')}>Eşleşme bul</Button>}
          />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.conversationId}
          contentContainerClassName="gap-1.5 p-4"
          renderItem={({ item }) => <KonusmaSatiri konusma={item} router={router} />}
        />
      )}
    </SafeAreaView>
  )
}

function KonusmaSatiri({ konusma, router }) {
  const zaman = konusma.lastMessageAtUtc
    ? formatDateTime(konusma.lastMessageAtUtc)
    : 'Henüz mesaj yok'
  const okunmamis = konusma.unreadCount > 0

  /*
    Erişilebilir ad ELLE kuruluyor: satır tek düğüm olarak okunur ve etiket çocuk
    metinlerin birleşiminden türeseydi rozetin çıplak sayısı ("… 3") bağlamsız kalırdı.
    Görsel tarafta okunmamış satır sayı rozetine EK olarak kalın isimle de ayrışır —
    web üst barındaki "N okunmamış mesaj" aria-label kararının liste karşılığı.
  */
  const erisimEtiketi = [
    konusma.otherDisplayName,
    zaman,
    konusma.isClosed ? 'kapalı' : null,
    okunmamis ? `${konusma.unreadCount} okunmamış mesaj` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={erisimEtiketi}
      onPress={() => router.push(`/sohbet/${konusma.conversationId}`)}
      className="flex-row items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 active:bg-slate-50"
    >
      <Avatar userId={konusma.otherUserId} name={konusma.otherDisplayName} size="md" />

      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={1}
          className={okunmamis ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}
        >
          {konusma.otherDisplayName}
        </Text>
        <Text className="text-xs text-slate-500">{zaman}</Text>
      </View>

      {konusma.isClosed && <Badge tone="neutral">Kapalı</Badge>}
      {okunmamis && <Badge tone="brand">{konusma.unreadCount}</Badge>}
    </Pressable>
  )
}
