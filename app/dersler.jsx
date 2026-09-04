import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Image, Platform, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { api } from '../src/lib/api'
import { useYetkiliGorsel } from '../src/components/YetkiliGorsel'
import { amber, rose, slate } from '../src/lib/theme'
import { useAsync } from '../src/state/useAsync'
import { useWallet } from '../src/state/WalletContext'
import { Avatar } from '../src/components/Avatar'
import { ReviewModal } from '../src/components/ReviewModal'
import { OkAsagiIkonu, SaatIkonu, UyariIkonu } from '../src/components/Ikonlar'
import {
  REPORT_REASON_LABELS,
  SESSION_STATUS_LABELS,
  TRANSACTION_LABELS,
  formatDateTime,
  remainingText,
  signedCredit,
} from '../src/lib/format'
import {
  Badge,
  Button,
  EmptyState,
  ErrorBox,
  Field,
  Girdi,
  Loading,
  Modal,
  Notice,
  Spinner,
} from '../src/components/ui'

/*
  DERSLERİM — web'deki pages/Sessions.jsx'in portu. Web'in iki sabit sütunu mobilde
  TEK AKIŞA iner: aksiyon bekleyenler → planlanmış → saati geçmiş açıklar → geçmiş.

  İKİ BİLİNÇLİ MOBİL FARKI:
  • Geçmiş SAYFA DEĞİŞTİRMEZ, BİRİKİR (iş kuralı 4): 5'erli sayfalar FlatList
    onEndReached ile eklenir. Web'in numaralı sayfalaması başparmağa ters.
  • Kanıt dosya seçici DEĞİL expo-image-picker (iş kuralı 5).

  Web'den aynen taşınan kritik kararlar:
  • Saati geçmiş ders "Yaklaşan"da KALAMAZ: sunucu aktif/geçmiş ayrımını yalnızca
    duruma göre yapar; arayüz üç yönlü ayırır (aksiyon / saati gelmemiş / saati geçmiş
    açık). Saati geçmiş açıklar sayfalı geçmişin İÇİNE karıştırılmaz — sunucu
    sayfalarını yalanlamamak için ayrı başlık altında üstte durur.
  • 20 sn'lik tick: geri sayımlar ve gruplama canlı aksın — saati dolan ders sayfa
    yenilenmeden doğru tarafa geçsin.
  • Rezervasyonu yapan taraf HER ZAMAN ÖĞRENCİ: seçilebilir konu, karşı tarafın BANA
    anlatacağı konudur (iAmInitiator ? requestedTopic : offeredTopic) — tersini
    listelemek puanı yanlış tarafa yazdırırdı.
  • Onay/tamamlama/iptal/şikayet çift gönderime karşı REF kilidi taşır: state bir
    sonraki render'a kadar eski değeri gösterir, kilit render beklemez.
  • Puan önizlemesi GÖSTERİM sabiti (30 dk blok = 50 puan, SessionRules ile birebir);
    bağlayıcı değer her zaman sunucunun mintAmount'u.
*/

const DURUM_STILI = {
  Booked: { serit: 'bg-brand-500', takvim: 'bg-brand-100', takvimYazi: 'text-brand-700', rozet: 'brand', vurgu: 'text-brand-700' },
  AwaitingApproval: { serit: 'bg-amber-400', takvim: 'bg-amber-100', takvimYazi: 'text-amber-800', rozet: 'warning', vurgu: 'text-amber-700' },
  Completed: { serit: 'bg-emerald-500', takvim: 'bg-emerald-100', takvimYazi: 'text-emerald-700', rozet: 'success', vurgu: 'text-emerald-700' },
  Disputed: { serit: 'bg-rose-500', takvim: 'bg-rose-100', takvimYazi: 'text-rose-700', rozet: 'danger', vurgu: 'text-rose-700' },
  Cancelled: { serit: 'bg-rose-300', takvim: 'bg-rose-100', takvimYazi: 'text-rose-700', rozet: 'danger', vurgu: 'text-rose-700' },
  Expired: { serit: 'bg-slate-300', takvim: 'bg-slate-100', takvimYazi: 'text-slate-700', rozet: 'neutral', vurgu: 'text-slate-600' },
}

const VARSAYILAN_DURUM_STILI = DURUM_STILI.Expired

/* Sayfa başına 5 geçmiş ders — mobil iş kuralı (web 20 kullanıyor). */
const PAST_PAGE_SIZE = 5

export default function Dersler() {
  const router = useRouter()
  const sessions = useAsync(() => api.mySessions(1, PAST_PAGE_SIZE), [])
  const matches = useAsync(() => api.myMatches(), [])
  const { refreshWallet } = useWallet()

  const [notice, setNotice] = useState(null)
  const [bookOpen, setBookOpen] = useState(false)
  const [dialog, setDialog] = useState(null) // { type, session }

  /*
    GEÇMİŞİN BİRİKEN KISMI: sessions.data.past ilk 5'i taşır; sonraki sayfalar buraya
    eklenir. sessions yeniden yüklenince birikinti sıfırlanır — onaylanan ders geçmişin
    BAŞINA girer ve eski birikinti bayat sayfalardan oluşurdu.
  */
  const [ekGecmis, setEkGecmis] = useState([])
  const [gecmisSayfa, setGecmisSayfa] = useState(1)
  const [gecmisYukleniyor, setGecmisYukleniyor] = useState(false)
  const [gecmisHata, setGecmisHata] = useState(null)
  const gecmisKilit = useRef(false)

  /*
    NESİL SAYACI — tazeleme ile sayfalama yarışıyor.

    Bir ders onaylandığında sessions.reload() koşuyor ve aşağıdaki efekt biriken
    geçmişi sıfırlıyor. Ama o sırada uçuşta bir "daha getir" varsa, o istek döndüğünde
    ESKİ ofsetli sayfayı YENİ listenin üstüne ekliyordu: onaylanan ders geçmişin başına
    girdiği için sayfa sınırları kayıyor ve arada kalan kayıtlar hiç görünmüyordu.

    Nesil, hangi listenin geçerli olduğunu söylüyor; eski nesle ait yanıt atılıyor.
  */
  const gecmisNesil = useRef(0)

  useEffect(() => {
    gecmisNesil.current += 1
    gecmisKilit.current = false
    setEkGecmis([])
    setGecmisSayfa(1)
    setGecmisHata(null)
  }, [sessions.data])

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 20000)
    return () => clearInterval(id)
  }, [])

  const groups = useMemo(() => {
    const active = sessions.data?.active ?? []
    const simdi = Date.now()

    const aksiyonBekliyor = (s) => s.canComplete || s.canApprove || s.status === 'Disputed'
    const saatiGecti = (s) => new Date(s.scheduledEndUtc).getTime() <= simdi

    return {
      action: active.filter(aksiyonBekliyor),
      upcoming: active.filter((s) => !aksiyonBekliyor(s) && !saatiGecti(s)),
      gecmisAcik: active.filter((s) => !aksiyonBekliyor(s) && saatiGecti(s)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.data, tick])

  const gecmisItems = useMemo(() => {
    /*
      Tekilleştirme TÜM birikinti üzerinden: sunucu geçmişi saf ofsetle sayfalıyor ve
      sayfalar yüklenirken üste yeni kayıt düşerse (karşı taraf onaylar, otomatik onay
      işler) sonraki sayfa bir öncekinin son öğesini TEKRAR getirir. Yalnızca ilk
      sayfaya bakan küme bunu kaçırıyordu — aynı sessionId FlatList'e iki kez girip
      çift kart + duplicate key üretirdi.
    */
    const görülen = new Set()
    const sonuc = []
    for (const s of [...(sessions.data?.past?.items ?? []), ...ekGecmis]) {
      if (görülen.has(s.sessionId)) continue
      görülen.add(s.sessionId)
      sonuc.push(s)
    }
    return sonuc
  }, [sessions.data, ekGecmis])

  const gecmisToplam = sessions.data?.past?.totalCount ?? 0
  const dahaVar = gecmisItems.length < gecmisToplam
  const activeTruncated = (sessions.data?.activeTotal ?? 0) > (sessions.data?.active?.length ?? 0)

  async function dahaGetir() {
    if (gecmisKilit.current || !dahaVar) return
    const nesil = gecmisNesil.current
    gecmisKilit.current = true
    setGecmisYukleniyor(true)
    setGecmisHata(null)
    try {
      const data = await api.mySessions(gecmisSayfa + 1, PAST_PAGE_SIZE)
      // Liste bu sırada tazelendiyse bu sayfa artık başka bir listeye ait: at.
      if (nesil !== gecmisNesil.current) return
      setEkGecmis((prev) => [...prev, ...(data.past?.items ?? [])])
      setGecmisSayfa((p) => p + 1)
    } catch (err) {
      if (nesil === gecmisNesil.current) setGecmisHata(err)
    } finally {
      if (nesil === gecmisNesil.current) {
        gecmisKilit.current = false
        setGecmisYukleniyor(false)
      }
    }
  }

  function refresh(message) {
    setDialog(null)
    setBookOpen(false)
    if (message) setNotice(message)
    sessions.reload()
    matches.reload({ silent: true })
    // Onay puan basar; seviye rozeti aynı cüzdan ucundan besleniyor.
    refreshWallet()
  }

  /*
    BOŞ DURUM, HATA DURUMUNDAN AYRI.

    Liste yüklenemediğinde de uzunluk 0 oluyordu ve ekranda kırmızı "Sunucuya ulaşılamadı"
    kutusunun HEMEN ALTINDA "Henüz dersin yok" yazıyordu. İki mesaj birbiriyle çelişiyor
    ve ikincisi daha kesin konuştuğu için kullanıcı derslerinin silindiğini sanıyordu.
    Veri gerçekten geldiyse ve boşsa boş durum doğrudur; hata varsa yalnızca hata.
  */
  const hicDersYok =
    !sessions.error &&
    sessions.data != null &&
    groups.action.length + groups.upcoming.length + groups.gecmisAcik.length + gecmisItems.length === 0

  const baslikBolumu = (
    <View className="gap-3 pb-1">
      <Text className="text-sm text-slate-600">
        Ders almak ücretsizdir. Ders onaylandığında anlatan tarafa puan yazılır.
      </Text>

      {notice && (
        <Notice tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}

      <ErrorBox error={sessions.error} onRetry={sessions.reload} />

      {sessions.loading ? (
        <Loading />
      ) : hicDersYok ? (
        <EmptyState
          title="Henüz dersin yok"
          description="Kabul edilmiş bir eşleşmen varsa hemen ders saati belirleyebilirsin."
          action={<Button onPress={() => setBookOpen(true)}>Ders rezerve et</Button>}
        />
      ) : (
        <View className="gap-3">
          {/* Kesme SESSİZ olmaz: kullanıcı listenin tamamını görmediğini bilmeli. */}
          {activeTruncated && (
            <Notice tone="warning">
              {sessions.data.activeTotal} aktif dersinden ilk {sessions.data.active.length}{' '}
              tanesi gösteriliyor. Listeyi kısaltmak için tamamlanan dersleri onayla.
            </Notice>
          )}

          {groups.action.length > 0 && (
            <>
              <AltBaslik tone="amber" sayi={groups.action.length}>
                Senden aksiyon bekleyenler
              </AltBaslik>
              {groups.action.map((s) => (
                <SessionKarti key={s.sessionId} session={s} onAction={setDialog} />
              ))}
            </>
          )}

          {groups.upcoming.length > 0 && (
            <>
              <AltBaslik sayi={groups.upcoming.length}>Planlanmış</AltBaslik>
              {groups.upcoming.map((s) => (
                <SessionKarti key={s.sessionId} session={s} onAction={setDialog} />
              ))}
            </>
          )}

          {groups.gecmisAcik.length > 0 && (
            <>
              <AltBaslik tone="amber" sayi={groups.gecmisAcik.length}>
                Saati geçti, hâlâ açık
              </AltBaslik>
              {groups.gecmisAcik.map((s) => (
                <SessionKarti key={s.sessionId} session={s} onAction={setDialog} />
              ))}
            </>
          )}

          {gecmisItems.length > 0 && <AltBaslik sayi={gecmisToplam}>Geçmiş dersler</AltBaslik>}
        </View>
      )}
    </View>
  )

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
        <Text className="flex-1 text-lg font-bold text-slate-900">Derslerim</Text>
        <Button onPress={() => setBookOpen(true)}>+ Rezerve et</Button>
      </View>

      {/* Geçmiş, FlatList'in KENDİSİ (iş kuralı 4): 5'erli sayfalar onEndReached ile
          birikir. Aktif bölümler başlıkta yaşar — sunucu aktifleri zaten sınırlı ve
          TAM döndürür (aksiyon bekleyen ders sayfanın altında kalmamalı). */}
      <FlatList
        data={sessions.loading ? [] : gecmisItems}
        keyExtractor={(s) => s.sessionId}
        renderItem={({ item }) => <SessionKarti session={item} onAction={setDialog} past />}
        contentContainerClassName="gap-3 p-4"
        ListHeaderComponent={baslikBolumu}
        onEndReached={dahaGetir}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          <View className="gap-3">
            {gecmisYukleniyor && (
              <View className="py-2">
                <Spinner />
              </View>
            )}
            <ErrorBox error={gecmisHata} onRetry={dahaGetir} />
            {!sessions.loading && !hicDersYok && <PuanGecmisi />}
          </View>
        }
      />

      {bookOpen && (
        <BookModal
          matches={matches.data?.active ?? []}
          onClose={() => setBookOpen(false)}
          onBooked={(code, mintAmount) =>
            refresh(
              `Ders rezerve edildi (eğitmen ${mintAmount} puan kazanacak). ` +
                `Doğrulama kodun: ${code} — ders ekran görüntüsünde görünmeli.`,
            )
          }
        />
      )}

      {dialog?.type === 'complete' && (
        <CompleteModal
          key={dialog.session.sessionId}
          session={dialog.session}
          onClose={() => setDialog(null)}
          onDone={() => refresh('Kanıt yüklendi. Ders karşı tarafın onayına gönderildi.')}
        />
      )}

      {dialog?.type === 'approve' && (
        <ApproveModal
          key={dialog.session.sessionId}
          session={dialog.session}
          onClose={() => setDialog(null)}
          onApproved={(credits, session) => {
            refresh(`Ders onaylandı. Eğitmene ${credits} puan yazıldı.`)
            // Değerlendirme onayın hemen ardından: yorum ancak tamamlanmış dersin
            // çıktısı olabilir ve bu an tam olarak o an.
            setDialog({ type: 'review', session })
          }}
          onReport={() => setDialog({ type: 'report', session: dialog.session })}
          onDispute={() => setDialog({ type: 'dispute', session: dialog.session })}
        />
      )}

      {dialog?.type === 'dispute' && (
        <DisputeModal
          session={dialog.session}
          onClose={() => setDialog(null)}
          onDone={() =>
            refresh(
              'İtirazın yönetime iletildi. Karar verilene kadar puan yazılmayacak; ' +
                'sonucu Derslerim ekranından takip edebilirsin.',
            )
          }
        />
      )}

      {dialog?.type === 'review' && (
        <ReviewModal
          open
          session={dialog.session}
          onClose={() => setDialog(null)}
          onSubmitted={() => {
            setDialog(null)
            refresh('Değerlendirmen kaydedildi. Teşekkürler!')
          }}
        />
      )}

      {dialog?.type === 'report' && (
        <ReportModal
          key={dialog.session.sessionId}
          session={dialog.session}
          onClose={() => setDialog(null)}
          onDone={() => refresh('Şikayetin yönetime iletildi. Karşı tarafa bildirilmez.')}
        />
      )}

      {dialog?.type === 'cancel' && (
        <CancelModal
          key={dialog.session.sessionId}
          session={dialog.session}
          onClose={() => setDialog(null)}
          onDone={() => refresh('Ders iptal edildi.')}
        />
      )}
    </SafeAreaView>
  )
}

/** Gruplama başlığı — etiket + sayaç + devam çizgisi (web AltBaslik). */
function AltBaslik({ children, sayi, tone = 'slate' }) {
  const amber = tone === 'amber'
  return (
    <View className="flex-row items-center gap-2.5 pt-1">
      <Text
        className={`shrink-0 text-xs font-semibold uppercase tracking-wider ${
          amber ? 'text-amber-700' : 'text-slate-600'
        }`}
      >
        {children}
      </Text>
      {sayi !== undefined && <Badge tone={amber ? 'warning' : 'neutral'}>{String(sayi)}</Badge>}
      <View className="h-px flex-1 bg-slate-200" />
    </View>
  )
}

/*
  Takvim yaprağı: ay üstte, gün büyük, saat altta — kartlar dizilince sol kenar bir
  zaman çizelgesi oluşturur (web kararı). Sabit genişlik şart: değişken genişlik metin
  sütununu kartlar arasında kaydırır.
*/
const AY_KISALTMASI = new Intl.DateTimeFormat('tr-TR', { month: 'short' })
const GUN_SAYISI = new Intl.DateTimeFormat('tr-TR', { day: 'numeric' })
const SAAT_DAKIKA = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })

function TarihBlogu({ utcString, stil }) {
  const tarih = new Date(utcString)
  // Intl.format geçersiz Date'te FIRLATIR — tek bozuk kayıt listeyi düşürmesin.
  const gecerli = !Number.isNaN(tarih.getTime())

  return (
    <View className="w-16 shrink-0 self-start overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Text className={`py-1 text-center text-xs font-semibold uppercase tracking-wide ${stil.takvim} ${stil.takvimYazi}`}>
        {gecerli ? AY_KISALTMASI.format(tarih) : '—'}
      </Text>
      <Text className="pt-2 text-center text-2xl font-bold leading-none text-slate-900" style={{ fontVariant: ['tabular-nums'] }}>
        {gecerli ? GUN_SAYISI.format(tarih) : '—'}
      </Text>
      <Text className="px-1 pb-2 pt-1.5 text-center text-xs font-medium text-slate-600" style={{ fontVariant: ['tabular-nums'] }}>
        {gecerli ? SAAT_DAKIKA.format(tarih) : '—'}
      </Text>
    </View>
  )
}

function UyariSatiri({ children }) {
  return (
    <View className="flex-row items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5">
      <View className="mt-0.5">
        <SaatIkonu renk={amber[800]} boy={16} />
      </View>
      <Text className="flex-1 text-xs leading-relaxed text-amber-800">{children}</Text>
    </View>
  )
}

/*
  DERS KARTI — üç bölgeli sabit iskelet (web kararı): NE ZAMAN (takvim yaprağı) →
  NE/KİMLE (başlık, kişi, meta) → NE YAPMALIYIM (alt aksiyon şeridi). Sıra her kartta
  aynı; düğmeler kartın alt kenarına yapışık.
*/
function SessionKarti({ session, onAction, past = false }) {
  const router = useRouter()
  const startsIn = remainingText(session.scheduledStartUtc)
  const endsIn = remainingText(session.scheduledEndUtc)
  const autoApproveIn = remainingText(session.autoApproveDeadlineUtc)

  // Sunucu bayrağı kaynak-of-truth; bitiş geçtiyse iyimser davranıp butonu açarız
  // (sunucu yine doğrular — kullanıcı "neden hâlâ kapalı?" diye takılmasın).
  const completeReady =
    session.canComplete || (session.iAmTutor && session.status === 'Booked' && !endsIn)

  const showCode = !past && (session.status === 'Booked' || session.status === 'AwaitingApproval')
  const stil = DURUM_STILI[session.status] ?? VARSAYILAN_DURUM_STILI

  return (
    <View className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      {/* Durum şeridi: kenarlık değil, içeriden çekilmiş yuvarlak uçlu çubuk. Bilgi
          taşımıyor, hızlandırıyor — aynı durum metinli rozette de yazılı. */}
      <View className={`absolute bottom-4 left-0 top-4 w-1 rounded-r-full ${stil.serit}`} />

      <View className="flex-row gap-4 p-5">
        <TarihBlogu utcString={session.scheduledStartUtc} stil={stil} />

        <View className="min-w-0 flex-1 gap-3">
          <View className="flex-row flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <View className="min-w-0 shrink grow basis-40">
              <Text numberOfLines={2} className="text-base font-semibold leading-snug text-slate-900">
                {session.topicName}
              </Text>
              <Text numberOfLines={1} className="mt-0.5 text-sm text-slate-600">
                {session.subjectName}
              </Text>
            </View>

            <Badge tone={stil.rozet}>{SESSION_STATUS_LABELS[session.status] ?? session.status}</Badge>
          </View>

          {/* Kişi satırı: yüzü olan bağlantı + rol rozeti (nötr — renk bu kartta yalnız
              dersin durumunu anlatır). */}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${session.otherDisplayName} profilini aç`}
            onPress={() => router.push(`/profil/${session.otherUserId}`)}
            className="min-h-[44px] flex-row flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-slate-200 pt-3"
          >
            <Avatar userId={session.otherUserId} name={session.otherDisplayName} size="sm" />
            <Text numberOfLines={1} className="min-w-0 shrink grow basis-24 text-sm font-medium text-slate-800">
              {session.otherDisplayName}
            </Text>
            <Badge tone="neutral" className="ml-auto">
              {session.iAmTutor ? 'Anlatıyorum' : 'Alıyorum'}
            </Badge>
          </Pressable>

          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text className="text-xs text-slate-600" style={{ fontVariant: ['tabular-nums'] }}>
              {session.durationMinutes} dk
            </Text>
            <Text className="text-slate-300">·</Text>
            <Text className="text-xs text-slate-600" style={{ fontVariant: ['tabular-nums'] }}>
              {session.mintAmount} puan
            </Text>
            {startsIn && !past ? (
              <>
                <Text className="text-slate-300">·</Text>
                <Text className={`text-xs font-semibold ${stil.vurgu}`}>{startsIn} sonra</Text>
              </>
            ) : null}
          </View>

          {showCode && (
            <View className="flex-row flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2">
              <Text className="text-xs text-slate-600">Doğrulama kodu</Text>
              <Text
                selectable
                className="rounded-md bg-white px-2 py-0.5 font-mono text-sm font-semibold tracking-widest text-slate-900"
              >
                {session.verificationCode}
              </Text>
            </View>
          )}

          {session.iAmTutor && session.status === 'Booked' && endsIn ? (
            <UyariSatiri>
              Time-Lock: "Dersi Tamamladım" <Text className="font-semibold">{endsIn}</Text> sonra
              (planlanan bitişte) açılır.
            </UyariSatiri>
          ) : null}

          {session.canApprove && autoApproveIn ? (
            <UyariSatiri>
              Onaylamazsan <Text className="font-semibold">{autoApproveIn}</Text> sonra otomatik
              onaylanacak ve eğitmene {session.mintAmount} puan yazılacak. İtiraz hakkın da o an
              kapanır.
            </UyariSatiri>
          ) : null}
        </View>
      </View>

      {/* Aksiyon şeridi: her kartta var (en az "Şikayet et") — kart ne kadar uzarsa
          uzasın düğmeler alt kenarda, göz hep aynı noktayı arar. */}
      <View className="flex-row flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5">
        {session.iAmTutor && session.status === 'Booked' && (
          <Button disabled={!completeReady} onPress={() => onAction({ type: 'complete', session })}>
            Dersi tamamladım
          </Button>
        )}

        {session.canApprove && (
          <Button variant="success" onPress={() => onAction({ type: 'approve', session })}>
            Kanıtı incele ve onayla
          </Button>
        )}

        {/* Şikayet HER derste açık; savunma düğmesi YOK — şikayet tek yönlüdür. */}
        {!session.canApprove && (
          <Button variant="secondary" onPress={() => onAction({ type: 'report', session })}>
            Şikayet et
          </Button>
        )}

        {session.canCancel && (
          <Button variant="secondary" onPress={() => onAction({ type: 'cancel', session })}>
            İptal
          </Button>
        )}
      </View>
    </View>
  )
}

/* ── REZERVASYON ─────────────────────────────────────────────────────────── */

function BookModal({ matches, onClose, onBooked }) {
  // Sunucudaki izinli süre kümesiyle birebir (SessionRules.AllowedDurations).
  const DURATION_OPTIONS = [30, 60]
  // GÖSTERİM sabitleri — SessionRules.MintPerBlock/MintBlockMinutes ile birebir;
  // bağlayıcı değer sunucunun mintAmount'u.
  const BLOK_DAKIKA = 30
  const BLOK_PUANI = 50

  const varsayilanBaslangic = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000)
    d.setMinutes(0, 0, 0)
    return d
  }

  const [matchId, setMatchId] = useState(null)
  /*
    iOS'ta başlangıç DOLU başlar: spinner ekranda zaten bir tarih gösteriyor ve
    kullanıcı onu kabul ettiğinde onChange hiç tetiklenmiyor — start null kalınca
    "Rezerve et" görünür değerle çelişerek kapalı kalıyordu. Android'de seçici
    diyalogla açıldığı için boş başlamak doğru: görünür ama seçilmemiş değer yok.
  */
  const [start, setStart] = useState(() => (Platform.OS === 'ios' ? varsayilanBaslangic() : null))
  const [duration, setDuration] = useState(60)
  const [error, setError] = useState(null)
  const [androidAdim, setAndroidAdim] = useState(null) // 'date' | 'time'

  const [gonderiliyor, setGonderiliyor] = useState(false)
  const gonderimKilidi = useRef(false)

  /*
    Rezervasyonu YAPAN taraf her zaman ÖĞRENCİ: seçilebilir konu, karşı tarafın BANA
    anlatacağı konudur. Her ikisini listelemek, kullanıcının kendi anlatacağı konuya
    öğrenci olarak kaydolmasına yol açardı (ders açılır, puan yanlış tarafa yazılır).
  */
  const options = matches.map((match) => ({
    match,
    topicId: match.iAmInitiator ? match.requestedTopicId : match.offeredTopicId,
    topicName: match.iAmInitiator ? match.requestedTopicName : match.offeredTopicName,
  }))

  const selected = options.find((o) => o.match.matchId === matchId) ?? null
  const bookable = options.filter((o) => o.topicId)

  const puanOnizleme = (Number(duration) / BLOK_DAKIKA) * BLOK_PUANI

  async function submit() {
    if (gonderimKilidi.current || !selected || !start) return
    gonderimKilidi.current = true
    setGonderiliyor(true)
    setError(null)
    try {
      const result = await api.bookSession({
        matchId,
        topicId: selected.topicId,
        // Seçici yerel saat verir; backend UTC bekler (toISOString hep "...Z" üretir).
        scheduledStartUtc: start.toISOString(),
        durationMinutes: Number(duration),
      })
      onBooked(result.verificationCode, result.mintAmount)
    } catch (err) {
      setError(err)
    } finally {
      // Kilit YALNIZCA burada açılır: hata dalında da — yoksa düzeltip yeniden denenemez.
      gonderimKilidi.current = false
      setGonderiliyor(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Ders rezerve et"
      footer={
        matches.length === 0 || bookable.length === 0 ? null : (
          <>
            <Button variant="secondary" onPress={onClose}>
              Vazgeç
            </Button>
            <Button loading={gonderiliyor} disabled={gonderiliyor || !selected || !start} onPress={submit}>
              Rezerve et
            </Button>
          </>
        )
      }
    >
      {matches.length === 0 ? (
        <EmptyState
          title="Kabul edilmiş eşleşmen yok"
          description="Önce Keşfet'ten istek gönder ve karşı tarafın kabul etmesini bekle."
        />
      ) : bookable.length === 0 ? (
        <EmptyState
          title="Bu eşleşmelerde sana anlatılacak konu yok"
          description="Aktif eşleşmelerinde ders anlatan taraf sensin. Ders almak için Keşfet'ten yeni bir istek gönder."
        />
      ) : (
        <View className="gap-4 pb-2">
          <View>
            <Text className="mb-1 text-sm font-medium text-slate-700">Eşleşme ve konu</Text>
            <Text className="mb-2 text-xs text-slate-600">
              Dersi alan taraf sensin; listelenen konu karşı tarafın sana anlatacağı konudur.
            </Text>
            <View className="gap-2">
              {bookable.map((option) => {
                const secili = option.match.matchId === matchId
                return (
                  <Pressable
                    key={option.match.matchId}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: secili }}
                    onPress={() => setMatchId(option.match.matchId)}
                    className={`min-h-[44px] justify-center rounded-lg border px-3 py-2
                                ${secili ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
                  >
                    <Text className={`text-sm ${secili ? 'font-medium text-brand-800' : 'text-slate-700'}`}>
                      {option.match.otherDisplayName} anlatacak — {option.topicName}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View>
            <Text className="mb-1 text-sm font-medium text-slate-700">Tarih ve saat</Text>
            <Text className="mb-2 text-xs text-slate-600">Kendi saat diliminde seç; sistem UTC'ye çevirir.</Text>

            {Platform.OS === 'ios' ? (
              /* iOS: yerleşik takvim+saat tek bileşende, satır içi. */
              <DateTimePicker
                value={start ?? varsayilanBaslangic()}
                mode="datetime"
                display="spinner"
                minuteInterval={5}
                locale="tr-TR"
                onChange={(event, date) => date && setStart(date)}
              />
            ) : (
              /* Android: sistem diyalogları iki adımda (tarih → saat) açılır. */
              <>
                <Button variant="secondary" onPress={() => setAndroidAdim('date')}>
                  {start ? formatDateTime(start.toISOString()) : 'Tarih ve saat seç'}
                </Button>
                {androidAdim && (
                  <DateTimePicker
                    value={start ?? varsayilanBaslangic()}
                    mode={androidAdim}
                    is24Hour
                    minuteInterval={5}
                    onChange={(event, date) => {
                      if (event.type === 'dismissed' || !date) {
                        setAndroidAdim(null)
                        return
                      }
                      if (androidAdim === 'date') {
                        setStart((prev) => {
                          const kaynak = prev ?? varsayilanBaslangic()
                          const yeni = new Date(date)
                          yeni.setHours(kaynak.getHours(), kaynak.getMinutes(), 0, 0)
                          return yeni
                        })
                        setAndroidAdim('time')
                      } else {
                        setStart((prev) => {
                          const yeni = new Date(prev ?? date)
                          yeni.setHours(date.getHours(), date.getMinutes(), 0, 0)
                          return yeni
                        })
                        setAndroidAdim(null)
                      }
                    }}
                  />
                )}
              </>
            )}
          </View>

          <View>
            <Text className="mb-2 text-sm font-medium text-slate-700">Süre</Text>
            <View className="flex-row gap-2">
              {DURATION_OPTIONS.map((dk) => {
                const aktif = Number(duration) === dk
                return (
                  <Pressable
                    key={dk}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: aktif }}
                    onPress={() => setDuration(dk)}
                    className={`min-h-[44px] flex-1 items-center justify-center rounded-lg border
                                ${aktif ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
                  >
                    <Text className={`text-sm font-medium ${aktif ? 'text-brand-800' : 'text-slate-600'}`}>
                      {dk} dakika
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* ÖZET ŞERİDİ — kararın tamamı tek bakışta. Sayı açıkça "eğitmenin kazanacağı
              puan" diye etiketli: etiketsiz sayı ücret gibi okunur (web kararı). */}
          <View className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-brand-700">Özet</Text>
            <View className="mt-2 gap-1.5">
              <OzetSatiri ad="Konu" deger={selected?.topicName ?? 'Eşleşme seçilmedi'} soluk={!selected} />
              <OzetSatiri ad="Anlatan" deger={selected?.match.otherDisplayName ?? '—'} soluk={!selected} />
              <OzetSatiri
                ad="Tarih ve saat"
                deger={start ? formatDateTime(start.toISOString()) : 'Henüz seçilmedi'}
                soluk={!start}
              />
              <OzetSatiri ad="Süre" deger={`${Number(duration)} dakika`} />
            </View>
            <View className="mt-3 flex-row items-center justify-between gap-3 border-t border-brand-100 pt-3">
              <Text className="text-sm font-medium text-brand-800">Eğitmenin kazanacağı puan</Text>
              <Text className="text-base font-semibold text-brand-800" style={{ fontVariant: ['tabular-nums'] }}>
                +{puanOnizleme} puan
              </Text>
            </View>
            <Text className="mt-1.5 text-xs text-brand-700">
              Sana ücretsiz — puanı sen ödemezsin, ders onaylandığında sistem basar.
            </Text>
          </View>

          <ErrorBox error={error} />
        </View>
      )}
    </Modal>
  )
}

function OzetSatiri({ ad, deger, soluk = false }) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text className="shrink-0 text-sm text-brand-700">{ad}</Text>
      <Text className={`shrink text-right text-sm ${soluk ? 'text-brand-700/70' : 'font-medium text-brand-800'}`}>
        {deger}
      </Text>
    </View>
  )
}

/* ── TAMAMLAMA (kanıt yükleme — iş kuralı 5) ─────────────────────────────── */

function CompleteModal({ session, onClose, onDone }) {
  const [code, setCode] = useState('')
  const [foto, setFoto] = useState(null) // { uri, name, type }
  const [error, setError] = useState(null)

  const [gonderiliyor, setGonderiliyor] = useState(false)
  const gonderimKilidi = useRef(false)

  async function fotoSec() {
    setError(null)
    const secim = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    })
    if (secim.canceled) return
    const a = secim.assets[0]
    setFoto({ uri: a.uri, name: a.fileName ?? 'kanit.jpg', type: a.mimeType ?? 'image/jpeg' })
  }

  async function submit() {
    /* Kanıt bir DOSYA taşıyor: yavaş bağlantıda istek saniyeler sürer ve çift gönderim
       aynı derse iki AYNI görsel yükler — ikincisi isDuplicateHash uyarısı doğurup
       kullanıcının kendi kanıtını şüpheli gösterirdi. Ref kilidi bu yüzden. */
    if (gonderimKilidi.current || !foto || !code.trim()) return
    gonderimKilidi.current = true
    setGonderiliyor(true)
    setError(null)
    try {
      await api.completeSession(session.sessionId, code.trim(), foto)
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      gonderimKilidi.current = false
      setGonderiliyor(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Dersi tamamladım"
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Vazgeç
          </Button>
          <Button loading={gonderiliyor} disabled={gonderiliyor || !foto || !code.trim()} onPress={submit}>
            Gönder
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <Notice tone="info">
          Ekran görüntüsünde sistem saati, katılımcı listesi ve doğrulama kodu{' '}
          <Text className="font-mono font-semibold">{session.verificationCode}</Text> görünmelidir.
          Öğrenci onayladığında {session.mintAmount} puan kazanırsın.
        </Notice>

        <Field label="Doğrulama kodu (Session ID)">
          <Girdi
            value={code}
            onChangeText={setCode}
            maxLength={12}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={session.verificationCode}
            className="font-mono uppercase tracking-wider"
          />
        </Field>

        <Field label="Kanıt ekran görüntüsü" hint="PNG, JPEG veya WebP · en fazla 10 MB.">
          {foto ? (
            <View className="gap-2">
              <Image
                source={{ uri: foto.uri }}
                accessibilityLabel="Seçilen kanıt görseli"
                className="h-48 w-full rounded-lg border border-slate-200 bg-slate-100"
                resizeMode="contain"
              />
              <Button variant="secondary" onPress={fotoSec}>
                Başka görsel seç
              </Button>
            </View>
          ) : (
            <Button variant="secondary" onPress={fotoSec}>
              Galeriden görsel seç
            </Button>
          )}
        </Field>

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}

/* ── ONAY (kanıt inceleme) ───────────────────────────────────────────────── */

function ApproveModal({ session, onClose, onApproved, onReport, onDispute }) {
  const proofs = useAsync(() => api.sessionProofs(session.sessionId), [session.sessionId])
  const [imageFailed, setImageFailed] = useState(false)

  const [error, setError] = useState(null)

  /* Onay dosyanın en pahalı geri alınamaz işlemi: puan basar. Kilit modalın KENDİ
     state'i (modal session id ile key'li) — global bayrak başka dersin butonunu da
     kilitlerdi. */
  const [onaylaniyor, setOnaylaniyor] = useState(false)
  const onayKilidi = useRef(false)

  const latestProof = proofs.data?.[proofs.data.length - 1] ?? null
  /*
    Kanıt görseli BAŞLIKLI İSTEKLE indiriliyor: RN Image, source'a verilen Authorization
    başlığını göndermiyor ve istek 401 alıyordu (ölçüm: YetkiliGorsel). Eski hâlinde
    kanıt hiçbir zaman görünmeyecekti — onay ekranındaki tek dayanak o görsel.
  */
  const kanitKaynagi = latestProof
    ? api.proofImageSource(session.sessionId, latestProof.proofId)
    : null
  const { uri: kanitUri, hata: kanitHatasi } = useYetkiliGorsel(kanitKaynagi)

  async function approve() {
    if (onayKilidi.current) return
    onayKilidi.current = true
    setOnaylaniyor(true)
    setError(null)
    try {
      const result = await api.approveSession(session.sessionId)
      onApproved(result.creditsMinted, session)
    } catch (err) {
      setError(err)
    } finally {
      onayKilidi.current = false
      setOnaylaniyor(false)
    }
  }

  return (
    <Modal
      open
      /*
        Onay uçarken modal HİÇBİR yoldan kapanmaz: düğmeler zaten kilitli ama karartma,
        ✕ ve Android geri tuşu (onRequestClose) da aynı onClose'a bağlı — açık kalsalar
        kilit delinir, onay arka planda biterken kullanıcı kapattığı modalın ardından
        beklenmedik bir değerlendirme ekranıyla karşılaşırdı.
      */
      onClose={onaylaniyor ? () => {} : onClose}
      title="Kanıtı incele ve onayla"
      footer={
        <>
          {/* Onay uçarken diğer düğmeler de kapalı: basım sürerken şikayete geçmek,
              hangi sonucun geçerli olduğunu tıklama sırasına bırakırdı. */}
          {/*
            DÜĞMELER DERSİN KADERİNİ BELİRLEYENLER: onayla ya da itiraz et. Şikayet
            gövdeye, sönük bir bağlantıya indi — çünkü şikayet dersi ETKİLEMİYOR, kişi
            hakkında bir bildirim. Üçünü eşit ağırlıkta düğme yapmak hem mobilde sığmıyor
            hem de "hangisi dersi durdurur" sorusunu belirsiz bırakıyordu.
          */}
          <Button variant="secondary" disabled={onaylaniyor} onPress={onClose}>
            Sonra
          </Button>
          <Button variant="danger" disabled={onaylaniyor} onPress={onDispute}>
            İtiraz et
          </Button>
          <Button variant="success" loading={onaylaniyor} disabled={onaylaniyor} onPress={approve}>
            Onayla
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <Notice tone="info">
          {/* "aktarılır" DEĞİL "yazılır": puan bu anda üretiliyor, senden bir şey
              alınmıyor (web kararı — transfer dili bedel izlenimi veriyordu). */}
          Onayladığında {session.otherDisplayName} kişisine {session.mintAmount} puan yazılır ve
          işlem geri alınamaz. Senden bir şey düşmez. Görselde{' '}
          <Text className="font-mono font-semibold">{session.verificationCode}</Text> kodunun,
          sistem saatinin ve katılımcı listesinin göründüğünü doğrula.
        </Notice>

        {proofs.loading ? (
          <Loading label="Kanıt yükleniyor…" />
        ) : proofs.error ? (
          <ErrorBox error={proofs.error} onRetry={proofs.reload} />
        ) : !latestProof ? (
          <View className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <Text className="text-sm text-amber-900">
              Bu derse hiç kanıt yüklenmemiş. Ders gerçekten yapılmadıysa onaylama — dilersen
              şikayet et, yönetim inceler.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {latestProof.isDuplicateHash && (
              <View className="flex-row items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
                <View className="mt-0.5">
                  <UyariIkonu renk={rose[800]} boy={18} />
                </View>
                <Text className="flex-1 text-sm text-rose-800">
                  Bu görsel <Text className="font-semibold">başka bir derste de kullanılmış</Text>.
                  Sahte kanıt olabilir — dikkatle incele.
                </Text>
              </View>
            )}

            {imageFailed || kanitHatasi ? (
              <Text className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                Kanıt görseli yüklenemedi. Bağlantını kontrol edip yeniden dene.
              </Text>
            ) : (
              /* Baytlar axios ile indirilip data URI olarak veriliyor; RN Image'ın
                 kendi başlık taşıma yolu Android'de çalışmıyor (bkz. YetkiliGorsel). */
              <Image
                source={kanitUri ? { uri: kanitUri } : undefined}
                accessibilityLabel="Ders kanıtı ekran görüntüsü"
                onError={() => setImageFailed(true)}
                className="h-80 w-full rounded-lg border border-slate-200 bg-slate-100"
                resizeMode="contain"
              />
            )}

            <Text className="text-xs text-slate-600">
              Yükleme: {formatDateTime(latestProof.uploadedAtUtc)}
            </Text>
          </View>
        )}

        <ErrorBox error={error} />

        {/*
          ŞİKAYET BURADA, DÜĞMELERDE DEĞİL. Dersin akışını değiştirmiyor: kişi hakkında
          yönetime giden bir bildirim. İtirazla aynı ağırlıkta sunmak, hangisinin puan
          basımını durdurduğunu belirsiz bırakıyordu.
        */}
        <View className="items-center border-t border-slate-100 pt-3">
          <Pressable
            accessibilityRole="button"
            disabled={onaylaniyor}
            onPress={onReport}
            className="min-h-[44px] justify-center px-2"
          >
            <Text className="text-sm text-slate-500 underline">
              Ders değil, kişi hakkında şikayetim var
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

/* ── İTİRAZ ──────────────────────────────────────────────────────────────── */

/*
  İTİRAZ — şikayetten AYRI bir mekanizma ve arayüzün bunu net söylemesi gerekiyor.

  Şikayet kişi hakkında; ders akmaya devam eder, puan basılır. İtiraz ise dersin
  KENDİSİNE dair: "yapılmadı" ya da "kanıt sahte". Ders Disputed'a geçer, puan basımı
  DONAR ve konu yönetim hakemliğine düşer. Öğrenci onay yolunu da kapatmış olur.

  Sebep listesi DisputeReason enum'undan (Domain/Moderation/Enums.cs) ve ders şikayeti
  listesiyle aynı beş değeri taşıyor — ama ayrı yazılıyor: iki enum bağımsız ve birinin
  değişmesi diğerinin formunu sessizce bozmamalı (aynı tuzak DERS_SIKAYET_SEBEPLERI'nde
  bir kez yaşandı).
*/
const ITIRAZ_SEBEPLERI = ['SessionNotHeld', 'FakeProof', 'DurationMismatch', 'Abuse', 'Other']

function DisputeModal({ session, onClose, onDone }) {
  const [reason, setReason] = useState('SessionNotHeld')
  const [description, setDescription] = useState('')
  const [error, setError] = useState(null)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const kilit = useRef(false)

  async function submit() {
    // Çift gönderim: ikincisi sunucudan DISPUTE_ALREADY_OPEN alır ve kullanıcı,
    // itiraz ASLINDA açılmışken hata görürdü.
    if (kilit.current || description.trim().length < 10) return
    kilit.current = true
    setGonderiliyor(true)
    setError(null)
    try {
      await api.disputeSession(session.sessionId, reason, description.trim())
      onDone()
    } catch (err) {
      kilit.current = false
      setError(err)
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <Modal
      open
      onClose={gonderiliyor ? () => {} : onClose}
      title="Bu derse itiraz et"
      footer={
        <>
          <Button variant="secondary" disabled={gonderiliyor} onPress={onClose}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            loading={gonderiliyor}
            disabled={gonderiliyor || description.trim().length < 10}
            onPress={submit}
          >
            İtirazı gönder
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <Notice tone="warning">
          İtiraz, dersi yönetim hakemliğine taşır: {session.otherDisplayName} kişisine puan
          YAZILMAZ ve karar verilene kadar donar. Bu dersi artık onaylayamazsın. Yalnızca
          ders gerçekten yapılmadıysa ya da kanıt bu derse ait değilse itiraz et.
        </Notice>

        <View>
          <Text className="mb-2 text-sm font-medium text-slate-700">Sebep</Text>
          <View className="gap-2">
            {ITIRAZ_SEBEPLERI.map((value) => {
              const secili = reason === value
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: secili }}
                  onPress={() => setReason(value)}
                  className={`min-h-[44px] justify-center rounded-lg border px-3 py-2
                              ${secili ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-white'}`}
                >
                  <Text className={`text-sm ${secili ? 'font-medium text-rose-800' : 'text-slate-700'}`}>
                    {REPORT_REASON_LABELS[value]}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Field label="Ne oldu?" hint="En az 10 karakter. Hakem yalnızca bunu ve kanıtı görecek.">
          <Girdi
            value={description}
            onChangeText={setDescription}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            className="h-28"
          />
        </Field>

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}

/* ── ŞİKAYET ─────────────────────────────────────────────────────────────── */

/*
  DERS ŞİKAYETİNİN SEBEP ALT KÜMESİ.

  Eskiden bu liste REPORT_REASON_LABELS tablosunun tamamını döküyordu. Tablo o gün
  yalnızca ders sebeplerinden ibaret olduğu için sorun görünmüyordu; forum şikayetleri
  eklenince (Spam, Telif, Kişisel bilgi, Konu dışı) ders formunda bağlamsız seçenekler
  belirecekti. Alt küme artık BURADA yazılı: tabloya sebep eklemek bir daha bu formu
  sessizce değiştirmiyor.

  Sıra bilinçli: en sık şikayet edilen ilk sırada, "Diğer" en sonda.
*/
const DERS_SIKAYET_SEBEPLERI = ['SessionNotHeld', 'FakeProof', 'DurationMismatch', 'Abuse', 'Other']

function ReportModal({ session, onClose, onDone }) {
  const [reason, setReason] = useState('SessionNotHeld')
  const [description, setDescription] = useState('')
  const [error, setError] = useState(null)

  const [gonderiliyor, setGonderiliyor] = useState(false)
  const gonderimKilidi = useRef(false)

  async function submit() {
    // Çift gönderim yönetime AYNI şikayetten iki kayıt düşürürdü.
    if (gonderimKilidi.current || description.trim().length < 15) return
    gonderimKilidi.current = true
    setGonderiliyor(true)
    setError(null)
    try {
      await api.reportSession(session.sessionId, reason, description.trim())
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      gonderimKilidi.current = false
      setGonderiliyor(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Şikayet et"
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            loading={gonderiliyor}
            disabled={gonderiliyor || description.trim().length < 15}
            onPress={submit}
          >
            Şikayeti gönder
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        {/* "Yönetim gerekli görürse uyarı, askı ya da ban uygular" cümlesi bilinçli
            olarak YOK: yaptırımın uygulanıp uygulanmayacağı moderatörün kararıdır,
            şikayet edene verilebilecek bir söz değil. Metin yalnızca KESİN olanı söyler. */}
        <Notice tone="info">
          Şikayetin yalnızca yönetime gider. Karşı taraf ne şikayeti görür, ne bildirim alır, ne
          de yanıt verebilir. Dersin akışı değişmez — bu bir itiraz değil, kişi hakkında
          bildirimdir. Şikayetin yönetim tarafından incelenir.
        </Notice>

        <View>
          <Text className="mb-2 text-sm font-medium text-slate-700">Sebep</Text>
          <View className="gap-2">
            {DERS_SIKAYET_SEBEPLERI.map((value) => {
              const secili = reason === value
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: secili }}
                  onPress={() => setReason(value)}
                  className={`min-h-[44px] justify-center rounded-lg border px-3 py-2
                              ${secili ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
                >
                  <Text className={`text-sm ${secili ? 'font-medium text-brand-800' : 'text-slate-700'}`}>
                    {REPORT_REASON_LABELS[value]}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Field label="Ne oldu?" hint="En az 15 karakter. Yönetim yalnızca senin anlattığını görecek.">
          <Girdi
            value={description}
            onChangeText={setDescription}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            className="h-28"
          />
        </Field>

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}

/* ── İPTAL ───────────────────────────────────────────────────────────────── */

function CancelModal({ session, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)

  const [iptalEdiliyor, setIptalEdiliyor] = useState(false)
  const iptalKilidi = useRef(false)

  async function submit() {
    // İkinci çağrı sunucudan hata döner ve kullanıcı, iptal ASLINDA başarılıyken
    // kırmızı bir hata kutusu görürdü.
    if (iptalKilidi.current) return
    iptalKilidi.current = true
    setIptalEdiliyor(true)
    setError(null)
    try {
      await api.cancelSession(session.sessionId, reason.trim() || null)
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      iptalKilidi.current = false
      setIptalEdiliyor(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Dersi iptal et"
      footer={
        <>
          <Button variant="secondary" disabled={iptalEdiliyor} onPress={onClose}>
            Vazgeç
          </Button>
          <Button variant="danger" loading={iptalEdiliyor} disabled={iptalEdiliyor} onPress={submit}>
            Dersi iptal et
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <Text className="text-sm text-slate-600">
          {formatDateTime(session.scheduledStartUtc)} tarihli ders iptal edilecek. Ders almak
          ücretsiz olduğu için iade edilecek bir puan yok; eğitmene de puan yazılmaz.
        </Text>

        <Field label="Sebep (opsiyonel)">
          <Girdi value={reason} onChangeText={setReason} maxLength={500} />
        </Field>

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}

/* ── PUAN GEÇMİŞİ (eski Cüzdan defteri) ──────────────────────────────────── */

const HISTORY_PAGE_SIZE = 20

function PuanGecmisi() {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const kilit = useRef(false)

  async function loadPage(next) {
    // "Daha eski" EKLEYEREK çalışır: çift tetik aynı sayfayı iki kez ekler ve her
    // satır defterde çift görünürdü — kilit fonksiyonun başında.
    if (kilit.current) return
    kilit.current = true
    setLoading(true)
    setError(null)
    try {
      const result = await api.statement(next, HISTORY_PAGE_SIZE)
      setRows((prev) => (next === 1 ? result.items : [...prev, ...result.items]))
      setTotal(result.totalCount)
      setPage(next)
    } catch (err) {
      setError(err)
    } finally {
      kilit.current = false
      setLoading(false)
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    // AÇILINCA YÜKLENİR (web kararı): defter çoğu ziyarette bakılmayan bir kayıt —
    // kapalıyken sıfır maliyet.
    if (next && page === 0) loadPage(1)
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        className="min-h-[44px] flex-row items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-4"
      >
        <View className="min-w-0 shrink">
          <Text className="text-sm font-semibold text-slate-900">Puan geçmişi</Text>
          <Text className="mt-0.5 text-xs text-slate-600">Her hareketin hangi dersten geldiği</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <OkAsagiIkonu renk={slate[500]} boy={20} />
        </View>
      </Pressable>

      {open && (
        <View className="mt-3 gap-3">
          <ErrorBox error={error} onRetry={() => loadPage(page || 1)} />

          {loading && rows.length === 0 ? (
            <Loading />
          ) : rows.length === 0 && !error ? (
            <View className="rounded-2xl border border-slate-100 bg-white p-5">
              <Text className="text-sm text-slate-600">
                Henüz puan hareketin yok. Bir ders anlatıp onaylandığında ilk kaydın burada
                belirir.
              </Text>
            </View>
          ) : (
            /* TEK kart, ince ayraçlar: defter tek bir belgedir, kart koleksiyonu değil. */
            <View className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
              {rows.map((row, i) => (
                <HareketSatiri key={`${row.createdAtUtc}-${i}`} row={row} ilk={i === 0} />
              ))}

              {rows.length < total && (
                <View className="items-center border-t border-slate-200 px-5 py-3.5">
                  <Button variant="secondary" loading={loading} onPress={() => loadPage(page + 1)}>
                    Daha eski hareketler ({rows.length}/{total})
                  </Button>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  )
}

function HareketSatiri({ row, ilk }) {
  const kazanc = row.amount > 0

  return (
    <View className={`flex-row items-center justify-between gap-3 px-5 py-3 ${ilk ? '' : 'border-t border-slate-100'}`}>
      <View className="min-w-0 shrink">
        <Text numberOfLines={1} className="text-sm font-medium text-slate-900">
          {TRANSACTION_LABELS[row.type] ?? row.type}
        </Text>
        <Text numberOfLines={1} className="text-xs text-slate-600">
          {row.topicName
            ? `${row.topicName}${row.counterpartDisplayName ? ` · ${row.counterpartDisplayName}` : ''}`
            : formatDateTime(row.createdAtUtc)}
        </Text>
      </View>

      <View className="shrink-0 items-end">
        <Text
          className={`text-sm font-semibold ${kazanc ? 'text-emerald-700' : 'text-slate-600'}`}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {signedCredit(row.amount)}
        </Text>
        <Text className="text-xs text-slate-600" style={{ fontVariant: ['tabular-nums'] }}>
          {formatDateTime(row.createdAtUtc)}
        </Text>
      </View>
    </View>
  )
}
