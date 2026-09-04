import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../../src/lib/api'
import { useAuth } from '../../src/state/AuthContext'
import { useInbox } from '../../src/state/InboxContext'
import { parseHubError } from '../../src/hooks/useChatHub'
import { formatTime } from '../../src/lib/format'
import { Badge, Button, ErrorBox, Field, Girdi, Loading, Modal, Notice } from '../../src/components/ui'

/*
  KONUŞMA EKRANI — web'deki Chat.jsx'in KONUŞMA yarısının portu. Web'in tüm sıralama
  ve yarış kararları aynen taşındı:

  • Hub BURADA KURULMAZ — InboxContext'inki kullanılır (iki bağlantı = bölünen gruplar).
  • Geçmiş YALNIZCA sohbet değişince çekilir, bağlantı durumuna bağlanmaz: her yeniden
    bağlanmada geçmişi çekmek, uçuşta gelen canlı mesajı ezip kaybettirirdi. Fetch
    uçuştayken gelen canlı mesajlar id'ye göre birleştirilerek korunur (mergeById).
  • Gruba katılma yalnızca bağlantı GERÇEKTEN kuruluyken; yeniden bağlanmada sunucudaki
    grup üyeliği kaybolduğu için hub.status'a bağlı effect tekrar katılır.
  • Kullanıcı bu sohbete BAKIYORKEN gelen mesaj okunmuş sayılır — web'deki
    document.visibilityState kontrolünün karşılığı AppState.currentState === 'active'.
  • Gönderim: hub açıksa hub, kapalıysa REST yedeği — backend iki yolda da aynı yayını yapar.
  • Kapalı sohbette yazma alanı HİÇ ÇİZİLMEZ: kutuyu gösterip sunucuya reddettirmek,
    kullanıcıya mesajını yazdırıp sonra kaybettirmek olurdu.

  MOBİL FARKI — TERS LİSTE: web en alta scrollIntoView ile atlıyordu; RN'de inverted
  FlatList aynı işi yerleşimle yapar — liste alttan başlar, yeni mesaj geldiğinde
  kaydırma konumu kendiliğinden korunur, "ilk açılışta en alta atla" diye bir sorun
  hiç doğmaz. Veri ASC tutulur (web ile aynı), render'a ters çevrilerek verilir.
*/
export default function Konusma() {
  const { conversationId } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useAuth()
  const inbox = useInbox()

  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [joinError, setJoinError] = useState(null)
  const [sendError, setSendError] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [tarihce, setTarihce] = useState(0) // hata sonrası "tekrar dene" tetikleyicisi
  const [sikayetAcik, setSikayetAcik] = useState(false)
  const [sikayetBildirimi, setSikayetBildirimi] = useState(null)

  const active = inbox.conversations.find((c) => c.conversationId === conversationId) ?? null
  const hub = inbox.hub
  const refreshConversations = inbox.reloadConversations

  const onIncomingMessage = useCallback(
    (message) => {
      if (message.conversationId !== conversationId) {
        // Başka sohbete mesaj geldi: rozet tazelemesini zaten InboxContext yapıyor.
        return
      }

      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))

      if (AppState.currentState === 'active' && message.senderUserId !== session.userId) {
        api.markRead(conversationId).then(refreshConversations).catch(() => {})
      }
    },
    [conversationId, refreshConversations, session.userId],
  )

  // Canlı mesajlara abone ol; bağlantının kendisi sağlayıcıda duruyor.
  useEffect(
    () => inbox.subscribe({ onMessage: onIncomingMessage }),
    [inbox.subscribe, onIncomingMessage],
  )

  // (1) Geçmiş + okundu işaretleme — YALNIZCA sohbet değişince (ya da elle yeniden dene).
  useEffect(() => {
    if (!conversationId) return

    let cancelled = false
    setMessages([])
    setLoadingMessages(true)
    setHistoryError(null)
    setSendError(null)

    api
      .messages(conversationId, 1, 50)
      .then((page) => {
        if (cancelled) return
        setMessages((live) => mergeById([...page].reverse(), live))
      })
      .catch((err) => !cancelled && setHistoryError(err))
      .finally(() => !cancelled && setLoadingMessages(false))

    api.markRead(conversationId).then(refreshConversations).catch(() => {})

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, tarihce])

  /*
    (1b) YENİDEN BAĞLANINCA GEÇMİŞİ TAZELE.

    Bağlantı koptuğu sırada karşı tarafın yazdığı mesajlar canlı olarak gelemiyor;
    yeniden bağlanınca da yalnızca gruba KATILINIYOR, geçmiş yeniden okunmuyordu.
    Sonuç: başlıktaki nokta yeşile dönüp "Canlı bağlantı" yazıyor — yani kullanıcı her
    şeyin yolunda olduğunu sanıyor — ama kopukluk sırasındaki mesajlar sohbette hiç
    görünmüyor. Ancak ekran kapatılıp yeniden açılırsa ortaya çıkıyorlardı.

    İlk bağlantıda tazeleme YAPILMIYOR: geçmiş zaten (1) numaralı efektte okundu.
  */
  const baglanmisti = useRef(false)
  useEffect(() => {
    if (hub.status !== 'connected') return
    if (baglanmisti.current) setTarihce((v) => v + 1)
    baglanmisti.current = true
  }, [hub.status])

  // (2) Gruba katılma — yalnızca bağlantı gerçekten kuruluyken.
  useEffect(() => {
    if (!conversationId || hub.status !== 'connected') return

    let cancelled = false
    setJoinError(null)

    hub.joinConversation(conversationId)?.catch((err) => {
      if (!cancelled) setJoinError(parseHubError(err))
    })

    return () => {
      cancelled = true
      hub.leaveConversation(conversationId)?.catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, hub.status])

  async function send() {
    const content = draft.trim()
    if (!content || sending) return

    setSending(true)
    setSendError(null)
    try {
      const message = hub.isConnected()
        ? await hub.sendMessage(conversationId, content)
        : await api.sendMessage(conversationId, content)

      if (message) {
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
      }
      setDraft('')
      refreshConversations()
    } catch (err) {
      setSendError(err.name === 'ApiError' ? err : parseHubError(err))
    } finally {
      setSending(false)
    }
  }

  // Ters liste: en yeni mesaj dizinin BAŞINDA olmalı.
  const tersListe = useMemo(() => [...messages].reverse(), [messages])

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Başlık: geri + kişi (profile götürür) + durum. */}
        <View className="flex-row items-center gap-2 border-b border-slate-200 bg-white px-2 py-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sohbet listesine dön"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/mesajlar'))}
            className="h-11 w-11 items-center justify-center rounded-lg"
          >
            <Text className="text-xl text-slate-500">←</Text>
          </Pressable>

          <Pressable
            accessibilityRole="link"
            className="min-h-[44px] min-w-0 flex-1 justify-center"
            onPress={() => active?.otherUserId && router.push(`/profil/${active.otherUserId}`)}
          >
            <Text numberOfLines={1} className="font-semibold text-brand-700">
              {active?.otherDisplayName ?? 'Sohbet'}
            </Text>
            <Text numberOfLines={1} className="text-xs text-slate-500">
              {active?.isClosed
                ? 'Bu eşleşme sonlandırıldı — geçmiş okunabilir, yeni mesaj yazılamaz.'
                : 'Ders linkini (Zoom / Meet / Discord) buradan paylaşabilirsin.'}
            </Text>
          </Pressable>

          {joinError && <Badge tone="danger">Katılınamadı</Badge>}
          <BaglantiNoktasi status={hub.status} />

          {/*
            ŞİKAYET — SOHBETTEN.

            Buraya kadar şikayet açmanın tek yolu bir DERS üzerindendi. Eşleşip
            yazışmaya başlayan iki kişiden biri taciz ederse, henüz tamamlanmış ders
            yoksa karşı tarafın bildirme yolu YOKTU — öğrenci platformunda tacizin en
            olası anı tam olarak burası.

            Kapalı sohbette de görünür: "eşleşme bitti, artık bildiremezsin" demek,
            susturmanın en kolay yolunu (önce taciz et, sonra eşleşmeyi kapat) açık
            bırakırdı.

            Sessiz duruyor — dikkat çeken bir düğme sohbeti ihbar hattı gibi gösterirdi,
            gömülü bir menü ise ihlali gören kişinin vazgeçtiği yol olurdu.
          */}
          {active?.otherUserId && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Şikayet et"
              onPress={() => setSikayetAcik(true)}
              className="min-h-[44px] justify-center rounded-lg px-2"
            >
              <Text className="text-xs font-medium text-slate-500">Şikayet</Text>
            </Pressable>
          )}
        </View>

        {sikayetBildirimi && (
          <View className="px-3 pt-3">
            <Notice tone="success" onDismiss={() => setSikayetBildirimi(null)}>
              {sikayetBildirimi}
            </Notice>
          </View>
        )}

        {loadingMessages ? (
          <View className="flex-1">
            <Loading label="Mesajlar yükleniyor…" />
          </View>
        ) : historyError ? (
          <View className="flex-1 p-4">
            <ErrorBox error={historyError} onRetry={() => setTarihce((v) => v + 1)} />
          </View>
        ) : messages.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <Text className="text-center text-sm text-slate-500">
              {active?.isClosed
                ? 'Bu sohbette hiç mesaj yazılmadan eşleşme sonlandırıldı.'
                : 'İlk mesajı sen yaz. Ders saatini kararlaştırıp toplantı linkini paylaşın.'}
            </Text>
          </View>
        ) : (
          <FlatList
            inverted
            data={tersListe}
            keyExtractor={(m) => m.id}
            contentContainerClassName="gap-2 p-4"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <MesajBalonu message={item} mine={item.senderUserId === session.userId} />
            )}
          />
        )}

        {active?.isClosed ? (
          <View className="border-t border-slate-200 bg-white p-3">
            <Text className="text-center text-sm text-slate-500">
              Bu eşleşme sonlandırıldı. Geçmişi okuyabilirsin ama yeni mesaj gönderemezsin.
            </Text>
          </View>
        ) : (
          <View className="border-t border-slate-200 bg-white p-3">
            {sendError && <Text className="mb-2 text-sm text-rose-600">{sendError.message}</Text>}
            <View className="flex-row items-end gap-2">
              <Girdi
                value={draft}
                onChangeText={setDraft}
                placeholder="Mesajını yaz…"
                maxLength={2000}
                multiline
                className="max-h-28 flex-1"
              />
              <Button loading={sending} disabled={!draft.trim()} onPress={send}>
                Gönder
              </Button>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <SohbetSikayetModali
        open={sikayetAcik}
        kisi={active}
        onClose={() => setSikayetAcik(false)}
        onGonderildi={() => {
          setSikayetAcik(false)
          setSikayetBildirimi('Şikayetin yönetime iletildi. Karşı taraf bunu görmez.')
        }}
      />
    </SafeAreaView>
  )
}

/*
  SOHBET ŞİKAYET MODALI.

  SEBEP LİSTESİ DERS ŞİKAYETİNDEN FARKLI: oradaki seçenekler dersle ilgili ("ders hiç
  yapılmadı", "kanıt sahte", "süre kısa sürdü") ve sohbette hiçbirinin karşılığı yok.
  Burada yalnızca ders bağlamı gerektirmeyen ikisi listelenir. Sunucu enum'u aynı
  (ReportReason); ayrılan yalnızca kullanıcıya sunulan alt küme.

  Açıklama ZORUNLU ve alt sınırı var: "Diğer" seçildiğinde moderatörün elinde yalnızca
  bu metin oluyor.
*/

/* SUNUCUYLA AYNI SAYI (CreateReportHandler). İstemcide daha GEVŞEK bir sınır,
   kullanıcıya 12 karakter yazdırıp gönderdikten sonra 400 gösterirdi — kontrolün
   istemcide olmasının tek amacı o gidiş gelişi önlemek. */
const EN_AZ_ACIKLAMA = 15

const SOHBET_SIKAYET_SEBEPLERI = [
  { key: 'Abuse', label: 'Hakaret, taciz veya uygunsuz davranış' },
  { key: 'Other', label: 'Diğer' },
]

function SohbetSikayetModali({ open, kisi, onClose, onGonderildi }) {
  const [sebep, setSebep] = useState('Abuse')
  const [aciklama, setAciklama] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Kapanış animasyonu boyunca içerik çizili kalsın (boş beyaz kutu görünmesin).
  const [sonKisi, setSonKisi] = useState(null)
  useEffect(() => {
    if (kisi) setSonKisi(kisi)
  }, [kisi])
  const gosterilen = kisi ?? sonKisi

  const kapat = () => {
    setSebep('Abuse')
    setAciklama('')
    setError(null)
    onClose()
  }

  const gonderilebilir = aciklama.trim().length >= EN_AZ_ACIKLAMA

  async function gonder() {
    if (!gonderilebilir || busy || !kisi?.otherUserId) return
    setBusy(true)
    setError(null)
    try {
      await api.reportUser(kisi.otherUserId, sebep, aciklama.trim())
      setSebep('Abuse')
      setAciklama('')
      onGonderildi()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={kapat}
      title="Şikayet et"
      footer={
        <>
          <Button variant="secondary" onPress={kapat}>
            Vazgeç
          </Button>
          <Button variant="danger" loading={busy} disabled={!gonderilebilir} onPress={gonder}>
            Şikayeti gönder
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <Notice tone="info">
          Şikayetin yalnızca yönetime gider. {gosterilen?.otherDisplayName ?? 'Karşı taraf'} ne
          şikayeti görür, ne bildirim alır, ne de kim olduğunu öğrenir.
        </Notice>

        <View>
          <Text className="mb-2 text-sm font-medium text-slate-700">Sebep</Text>
          <View className="gap-2">
            {SOHBET_SIKAYET_SEBEPLERI.map(({ key, label }) => {
              const secili = sebep === key
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: secili }}
                  onPress={() => setSebep(key)}
                  className={`min-h-[44px] justify-center rounded-lg border px-3 py-2
                              ${secili ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
                >
                  <Text className={`text-sm ${secili ? 'font-medium text-brand-800' : 'text-slate-700'}`}>
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Field
          label="Ne oldu?"
          hint={`En az ${EN_AZ_ACIKLAMA} karakter. Mümkünse mesajdan alıntı yap.`}
        >
          <Girdi
            value={aciklama}
            onChangeText={setAciklama}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            className="h-28"
            placeholder="Örn. Sohbette ısrarla telefon numaramı istedi ve reddedince hakaret etti."
          />
        </Field>

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}

/** Geçmiş ile canlı mesajları id'ye göre tekilleştirip zamana göre sıralar (web ile aynı). */
function mergeById(history, live) {
  const byId = new Map()
  for (const message of [...history, ...live]) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => new Date(a.sentAtUtc) - new Date(b.sentAtUtc))
}

function MesajBalonu({ message, mine }) {
  return (
    <View className={`flex-row ${mine ? 'justify-end' : 'justify-start'}`}>
      <View
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${mine ? 'bg-brand-600' : 'bg-slate-100'}`}
      >
        <LinkliMetin
          metin={message.content}
          className={`text-sm ${mine ? 'text-white' : 'text-slate-800'}`}
          linkClassName={mine ? 'text-white underline' : 'text-brand-700 underline'}
        />
        {/* Zaman damgası renkleri ÖLÇÜLDÜ: brand-100/brand-600 3.86:1 ve
            slate-500/slate-100 4.34:1 — ikisi de 11px normal metnin AA eşiği 4.5:1
            altında. Beyaz (4.90:1) ve slate-600 (6.9:1) geçiyor; hiyerarşi puntoyla
            zaten kurulu, rengi soldurmak okunurluğu feda ediyordu. */}
        <Text className={`mt-1 text-[11px] ${mine ? 'text-white' : 'text-slate-600'}`}>
          {formatTime(message.sentAtUtc)}
        </Text>
      </View>
    </View>
  )
}

/**
 * Toplantı linklerini tıklanabilir yapar — kanal bağımsızlığı ilkesinin arayüz
 * karşılığı (platform video barındırmaz; Zoom/Meet/Discord linki buradan paylaşılır).
 * Yalnızca http/https eşleşir — javascript:/data: gibi şemalar ASLA linke dönüşmez
 * (web ile aynı kural; Linking.openURL da yalnız bu iki şemayla çağrılır).
 */
function LinkliMetin({ metin, className, linkClassName }) {
  const parcalar = String(metin).split(/(https?:\/\/[^\s]+)/g)

  return (
    <Text className={className}>
      {parcalar.map((parca, i) =>
        /^https?:\/\//.test(parca) ? (
          <Text
            key={i}
            className={linkClassName}
            accessibilityRole="link"
            onPress={() => Linking.openURL(parca).catch(() => {})}
          >
            {parca}
          </Text>
        ) : (
          parca
        ),
      )}
    </Text>
  )
}

/*
  Bağlantı durumu — web'deki ConnectionBadge'in dar-ekran hâli: başlıkta metinli rozet
  yerine renkli NOKTA (yer yok), metin accessibilityLabel'da. Liste ekranındaki tam
  rozet zaten durumu kelimeyle söylüyor.
*/
const NOKTA_RENK = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-400',
  reconnecting: 'bg-amber-400',
  disconnected: 'bg-rose-500',
}

const NOKTA_ETIKET = {
  connected: 'Canlı bağlantı',
  connecting: 'Bağlanıyor',
  reconnecting: 'Yeniden bağlanıyor',
  disconnected: 'Bağlantı yok',
}

function BaglantiNoktasi({ status }) {
  return (
    <View
      accessible
      accessibilityLabel={NOKTA_ETIKET[status] ?? status}
      className={`mr-2 h-2.5 w-2.5 rounded-full ${NOKTA_RENK[status] ?? 'bg-amber-400'}`}
    />
  )
}
