import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Image, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../src/lib/api'
import { rose } from '../src/lib/theme'
import { useAsync } from '../src/state/useAsync'
import { useAuth } from '../src/state/AuthContext'
import { UyariIkonu } from '../src/components/Ikonlar'
import { DISPUTE_REASON_LABELS, REPORT_REASON_LABELS, formatDateTime } from '../src/lib/format'
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
  SectionTitle,
  Spinner,
} from '../src/components/ui'

/*
  YÖNETİM — web'deki pages/Admin.jsx'in MOBİL ALT KÜMESİ.

  Web paneli beş sekme taşıyor; buraya yalnızca ZAMANA DUYARLI olan üçü alındı:
  şikayet kuyruğu, öğretmen adaylığı ve (eski) itirazlar. Moderasyon gecikmeye
  tahammülsüz ve karar için gereken bilgi birkaç yüz karakter — telefona sığar. Bu üç
  kuyruk mobilde web'den DAHA kullanışlı: moderatör masasında değilken de karar verir.

  BİLEREK GELMEYENLER (ekranın altındaki şeritte kullanıcıya da yazılı):
  • Ekonomi panosu ve denetim izi — geniş ızgara/tablo; telefon genişliğinde okunmaz,
    bakılma anı da acil değil.
  • Puan düzeltmesi (adjustCredits) — idempotency anahtarı gerektiren, geri alınamaz
    finansal işlem. Yanlış dokunma riski, mobilde kazanılan hızdan büyük.

  ⚠️ YETKİ KONTROLÜ SUNUCUDA. Aşağıdaki isAdmin kontrolü kapı DEĞİL; kapı /api/admin/*
  uçlarının 403'ü. Bu kontrolün tek işi, yetkisiz bir hesapta ekranı üst üste hata
  kutusuyla doldurmamak — yetkiyi iki yerde tutmak, birinin unutulduğu gün sessizce
  açık bırakır.
*/

const SEKMELER = [
  /*
    Şikayet kuyruğu ÖNCE: yeni akış buradan geçiyor. İtiraz sekmesi yalnızca eski,
    hâlâ açık itirazlar için duruyor — yeni itiraz açılamıyor (web kararı).

    ETİKETLER KISA: web'in "Öğretmen adayları" / "Eski itirazlar" adları üç sütunlu
    dar şeritte iki satıra kırılıp şeridi tırtıklıyordu (Eşleşmeler'de aynı karar).
    Sayaç kalır, uzun ad düşer.
  */
  { key: 'reports', label: 'Şikayetler', sayac: (m) => m?.openReports },
  { key: 'teachers', label: 'Adaylar', sayac: (m) => m?.pendingTeacherCandidates },
  { key: 'disputes', label: 'İtirazlar', sayac: (m) => m?.openDisputes },
]

export default function Yonetim() {
  const router = useRouter()
  const { session } = useAuth()
  const yonetici = Boolean(session?.isAdmin)

  const [tab, setTab] = useState('reports')
  const [notice, setNotice] = useState(null)

  /*
    Metrikler sekme değil SAYFA düzeyinde okunuyor (web kararı): bekleyen iş sayıları
    sekme başlıklarında rozet olarak görünsün. Yalnızca açık sekmenin kuyruğu sayılsaydı,
    o sekmeye hiç girmeyen bir moderatör öğretmen adaylığı kuyruğunda iş biriktiğini
    fark etmezdi.

    Ekonomi PANOSU port edilmedi ama METRİK UCU burada kullanılıyor: buradan alınan şey
    bir tablo değil, üç rakam. Hata durumunda rozet hiç çizilmez — kuyruklar çalışmaya
    devam eder, bu yüzden metrics.error için hata kutusu YOK.
  */
  const metrics = useAsync(
    () => (yonetici ? api.economyMetrics() : Promise.resolve(null)),
    [yonetici],
  )

  function bildir(mesaj) {
    setNotice(mesaj)
    // Sessiz tazeleme: sayaçlar güncellenirken sekme şeridi boşalıp yeniden dolmasın.
    metrics.reload({ silent: true })
  }

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
        <View className="min-w-0 flex-1">
          <Text className="text-lg font-bold text-slate-900">Yönetim</Text>
          <Text className="text-xs text-slate-500">
            Şikayet kuyruğu, öğretmen adaylığı ve itiraz hakemliği.
          </Text>
        </View>
      </View>

      {!yonetici ? (
        <View className="p-4">
          <EmptyState
            title="Bu ekran yönetim içindir"
            description="Hesabında yönetim yetkisi görünmüyor. Yetkiyi veren sunucudur; yetkin varsa çıkış yapıp yeniden giriş yaptığında bu ekran açılır."
          />
        </View>
      ) : (
        <>
          <View className="m-4 mb-0 flex-row rounded-lg bg-slate-100 p-1">
            {SEKMELER.map((item) => {
              const sayi = item.sayac(metrics.data) ?? 0
              const secili = tab === item.key
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: secili }}
                  accessibilityLabel={sayi > 0 ? `${item.label}, ${sayi} bekleyen` : item.label}
                  onPress={() => setTab(item.key)}
                  className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-md
                              ${secili ? 'bg-white' : ''}`}
                >
                  <Text
                    className={`text-sm font-medium ${secili ? 'text-brand-700' : 'text-slate-600'}`}
                  >
                    {item.label}
                  </Text>
                  {sayi > 0 && (
                    <View className="rounded-full bg-rose-500 px-1.5 py-0.5">
                      <Text className="text-[10px] font-bold leading-none text-white">{sayi}</Text>
                    </View>
                  )}
                </Pressable>
              )
            })}
          </View>

          {/* Bildirim şeritte SABİT duruyor, listeyle birlikte kaymıyor: moderatör
              karardan sonra kuyruğu kaydırmaya devam ediyor ve "uygulandı" cümlesini
              kaçırırsa aynı kararı ikinci kez vermeye yönelir. */}
          {notice && (
            <View className="px-4 pt-3">
              <Notice tone="success" onDismiss={() => setNotice(null)}>
                {notice}
              </Notice>
            </View>
          )}

          {tab === 'reports' && <SikayetKuyrugu onNotice={bildir} />}
          {tab === 'teachers' && <AdayKuyrugu onNotice={bildir} />}
          {tab === 'disputes' && <ItirazKuyrugu onNotice={bildir} />}

          {/* Eksikliğin SÖYLENMESİ gerekiyor: moderatör aradığı şeyi bulamayınca
              "mobilde çalışmıyor" diye düşünüp masaya da dönmeyebilir. */}
          <View className="border-t border-slate-200 bg-white px-4 py-2">
            <Text className="text-xs leading-relaxed text-slate-500">
              Ekonomi panosu, denetim izi ve puan düzeltmesi bu ekranda yok — geniş tablo ve geri
              alınamaz finansal işlem masabaşı işidir. Web panelinden bak.
            </Text>
          </View>
        </>
      )}
    </SafeAreaView>
  )
}

/* ── ORTAK KART İSKELETİ ─────────────────────────────────────────────────── */

/*
  Kuyruk kartı: içerik + alt aksiyon şeridi (Derslerim'deki SessionKarti ile aynı
  iskelet). Web bu ekranda düğmeleri sağa, metnin YANINA koyuyordu; telefon
  genişliğinde o sütun 90px'e iner ve düğme metinleri kırılır. Şerit, kart ne kadar
  uzarsa uzasın alt kenarda: göz hep aynı noktayı arar.
*/
function KuyrukKarti({ children, aksiyonlar }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <View className="gap-2 p-5">{children}</View>
      {aksiyonlar && (
        <View className="flex-row flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5">
          {aksiyonlar}
        </View>
      )}
    </View>
  )
}

/** Radyo satırı — yaptırım türü, karar seçimi ve filtre dışındaki tekil seçimler. */
function SecimSatiri({ secili, baslik, aciklama, onPress }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: secili }}
      onPress={onPress}
      className={`min-h-[44px] justify-center rounded-xl border p-3
                  ${secili ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
    >
      <Text className={`text-sm font-semibold ${secili ? 'text-brand-800' : 'text-slate-900'}`}>
        {baslik}
      </Text>
      {aciklama ? (
        <Text className="mt-0.5 text-xs leading-relaxed text-slate-600">{aciklama}</Text>
      ) : null}
    </Pressable>
  )
}

/** Gerekçe alanı — üç kuyruk da aynı sözleşmeyi kullanıyor: zorunlu, denetim izine yazılır. */
function GerekceAlani({ deger, onChange, enAz, ipucu, ornek, maxLength = 500 }) {
  const uzunluk = deger.trim().length
  return (
    <Field
      label="Gerekçe (zorunlu)"
      // Eksik karakter sayısı GÖRÜNÜR: mobilde düğmenin neden kapalı olduğunu
      // anlatan başka bir işaret yok (web'de imleç hâlâ alandaydı).
      hint={uzunluk < enAz ? `En az ${enAz} karakter — şu an ${uzunluk}. ${ipucu}` : ipucu}
    >
      <Girdi
        value={deger}
        onChangeText={onChange}
        maxLength={maxLength}
        multiline
        textAlignVertical="top"
        className="h-24"
        placeholder={ornek}
      />
    </Field>
  )
}

/* ── ŞİKAYET KUYRUĞU ─────────────────────────────────────────────────────── */

/*
  Şikayetler yalnızca burada görünür. Şikayet edilen kullanıcı bunu hiçbir ekranda
  göremez; karar verirken tek kaynak şikayetçinin anlatısıdır.

  "Bu kişi hakkında N şikayet" rozeti kasıtlı olarak öne çıkarılıyor: tek bir şikayet
  bir anlaşmazlık olabilir, aynı kişide biriken şikayetler örüntüdür — yaptırımın
  ağırlığı oradan gelir.
*/
function SikayetKuyrugu({ onNotice }) {
  const reports = useAsync(() => api.reports(true), [])
  const [error, setError] = useState(null)
  const [yaptirimHedefi, setYaptirimHedefi] = useState(null)
  const [icerikHedefi, setIcerikHedefi] = useState(null)
  const [kapatmaHedefi, setKapatmaHedefi] = useState(null)

  const [kapaniyor, setKapaniyor] = useState(false)
  const kapatmaKilidi = useRef(false)

  /*
    "İşlem gerekmedi" — şikayeti actionTaken=false ile kapatır. actionTaken=true YOLU
    BURADA YOK ve olmamalı: o bayrak yaptırımın gerçekten uygulandığını söylüyor ve
    yalnızca yaptırım isteği tuttuktan sonra (YaptirimSayfasi içinde) yazılıyor.

    Kapatma GERİ ALINAMAZ (sunucu ikinci kapatmaya 409 döner) — bu yüzden hem onay
    adımı hem ref kilidi var: state bir sonraki render'a kadar eski değeri gösterir.
  */
  async function kapat(rapor) {
    if (kapatmaKilidi.current) return
    kapatmaKilidi.current = true
    setKapaniyor(true)
    setError(null)
    try {
      await api.resolveReport(rapor.reportId, false, null)
      setKapatmaHedefi(null)
      onNotice('Şikayet kapatıldı: işlem gerekmedi.')
      // Sessiz: karardan sonra tüm kuyruğun spinner'a dönmesi, kalan işleri
      // gözden kaybettiriyordu.
      reports.reload({ silent: true })
    } catch (err) {
      setError(err)
    } finally {
      kapatmaKilidi.current = false
      setKapaniyor(false)
    }
  }

  const veri = reports.data ?? []

  return (
    <>
      <FlatList
        data={reports.loading ? [] : veri}
        keyExtractor={(r) => r.reportId}
        contentContainerClassName="gap-3 p-4"
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <ErrorBox error={reports.error} onRetry={reports.reload} />
            <ErrorBox error={error} />
            {!reports.loading && veri.length > 0 && (
              <SectionTitle>Açık şikayetler ({veri.length})</SectionTitle>
            )}
          </View>
        }
        ListEmptyComponent={
          reports.loading ? (
            <Loading />
          ) : reports.error ? null : (
            <EmptyState title="Kuyruk boş" description="Bekleyen şikayet yok." />
          )
        }
        renderItem={({ item }) => (
          <SikayetKarti
            rapor={item}
            onYaptirim={setYaptirimHedefi}
            onIcerik={setIcerikHedefi}
            onKapat={setKapatmaHedefi}
          />
        )}
      />

      {yaptirimHedefi && (
        <YaptirimSayfasi
          key={yaptirimHedefi.reportId}
          hedef={yaptirimHedefi}
          onClose={() => setYaptirimHedefi(null)}
          onUygulandi={(mesaj) => {
            setYaptirimHedefi(null)
            onNotice(mesaj)
            reports.reload({ silent: true })
          }}
        />
      )}

      {icerikHedefi && (
        <IcerikKarariSayfasi
          key={icerikHedefi.reportId}
          hedef={icerikHedefi}
          onClose={() => setIcerikHedefi(null)}
          onUygulandi={(mesaj) => {
            setIcerikHedefi(null)
            onNotice(mesaj)
            reports.reload({ silent: true })
          }}
        />
      )}

      {kapatmaHedefi && (
        <Modal
          open
          onClose={kapaniyor ? () => {} : () => setKapatmaHedefi(null)}
          title="Şikayeti kapat"
          footer={
            <>
              <Button variant="secondary" disabled={kapaniyor} onPress={() => setKapatmaHedefi(null)}>
                Vazgeç
              </Button>
              <Button loading={kapaniyor} disabled={kapaniyor} onPress={() => kapat(kapatmaHedefi)}>
                İşlem gerekmedi, kapat
              </Button>
            </>
          }
        >
          <View className="gap-3 pb-2">
            <Text className="text-sm leading-relaxed text-slate-700">
              <Text className="font-semibold">{kapatmaHedefi.reportedDisplayName}</Text> hakkındaki
              şikayet, yaptırım uygulanmadan kapatılacak. Kayıt denetim izinde kalır ama kuyruktan
              düşer ve geri açılamaz.
            </Text>
            {/* İçerik kararıyla karıştırılmasın: kapatma perdeyi kaldırmaz. */}
            {(kapatmaHedefi.communityPostId || kapatmaHedefi.communityCommentId) &&
              kapatmaHedefi.contentStatus === 'UnderReview' && (
                <Notice tone="warning">
                  Şikayet edilen içerik hâlâ incelemede (akışta perdeli). Şikayeti kapatmak perdeyi
                  KALDIRMAZ — içerik kararını ayrıca vermen gerekiyor.
                </Notice>
              )}
            <ErrorBox error={error} />
          </View>
        </Modal>
      )}
    </>
  )
}

function SikayetKarti({ rapor, onYaptirim, onIcerik, onKapat }) {
  const router = useRouter()
  const forumIcerigi = Boolean(rapor.communityPostId || rapor.communityCommentId)

  return (
    <KuyrukKarti
      aksiyonlar={
        <>
          {/* "Yaptırım uyguladım" DEĞİL "Yaptırım uygula" (web 2026-08-27 düzeltmesi):
              eski düğme yalnızca şikayeti kapatıp denetim izine actionTaken=true
              yazıyordu, yaptırımın KENDİSİ hiçbir yerden verilemiyordu. */}
          <Button variant="danger" onPress={() => onYaptirim(rapor)}>
            Yaptırım kararı
          </Button>

          {/* İÇERİK KARARI AYRI DÜĞME ve ayrı olmak zorunda: kuralı ihlal eden gönderiyi
              kaldırmak, yazarını askıya almakla aynı şey değil. İlk ihlalde çoğu zaman
              doğru karar "içeriği kaldır, kişiye dokunma"dır; tek düğme bu ayrımı
              imkânsız kılardı. */}
          {forumIcerigi && (
            <Button variant="secondary" onPress={() => onIcerik(rapor)}>
              {rapor.contentStatus === 'Removed' ? 'İçeriği geri getir' : 'İçerik kararı'}
            </Button>
          )}

          <Button variant="secondary" onPress={() => onKapat(rapor)}>
            İşlem gerekmedi
          </Button>
        </>
      }
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <Badge tone="danger">{REPORT_REASON_LABELS[rapor.reason] ?? rapor.reason}</Badge>
        {rapor.reportedUserTotalReports > 1 && (
          <Badge tone="warning">Bu kişi hakkında {rapor.reportedUserTotalReports} şikayet</Badge>
        )}
      </View>

      <Text className="text-xs text-slate-500">{formatDateTime(rapor.createdAtUtc)}</Text>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${rapor.reportedDisplayName} profilini aç`}
        onPress={() => router.push(`/profil/${rapor.reportedUserId}`)}
        className="min-h-[44px] justify-center"
      >
        <Text className="text-sm font-semibold text-brand-700 underline">
          {rapor.reportedDisplayName}
        </Text>
        <Text className="text-xs text-slate-500">
          hakkında · şikayet eden: {rapor.reporterDisplayName}
          {rapor.topicName ? ` · ${rapor.topicName}` : ''}
        </Text>
      </Pressable>

      <Text className="text-sm leading-relaxed text-slate-700">{rapor.description}</Text>

      <SikayetEdilenIcerik rapor={rapor} />
    </KuyrukKarti>
  )
}

/*
  ─── ŞİKAYET EDİLEN FORUM İÇERİĞİ ────────────────────────────────────────────

  Bu blok olmadan forum şikayetleri kuyruğa düşüyor ama İNCELENEMİYOR: moderatör
  "Telif ihlali — 'izinsiz PDF paylaşıyor'" satırını görüyor, hangi gönderiden söz
  edildiğini göremiyor. Şikayet edilen içeriği okuyamayan moderatör ancak şikayet
  edenin anlatımına inanarak karar verebilir — yani karar veremez.

  DURUM ROZETİ metinden önce: içerik zaten kaldırılmışsa metni okumaya gerek yok.
  Metin KISALTILMIYOR: kuyruk taranan bir liste değil, tek tek karar verilen kayıtlar;
  kesilmiş alıntı kararın dayanağını gizler.
*/
const ICERIK_DURUM_TONU = {
  Visible: { ton: 'success', label: 'Yayında' },
  UnderReview: { ton: 'warning', label: 'İncelemede (akışta perdeli)' },
  Removed: { ton: 'neutral', label: 'Kaldırıldı' },
}

function SikayetEdilenIcerik({ rapor }) {
  if (!rapor.communityPostId && !rapor.communityCommentId) return null

  const tur = rapor.communityPostId ? 'Forum gönderisi' : 'Forum yorumu'
  const durum = ICERIK_DURUM_TONU[rapor.contentStatus]

  return (
    <View className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-xs font-semibold text-slate-700">{tur}</Text>
        {durum && <Badge tone={durum.ton}>{durum.label}</Badge>}
      </View>

      {rapor.contentExcerpt ? (
        <Text className="mt-2 text-sm leading-relaxed text-slate-800">{rapor.contentExcerpt}</Text>
      ) : (
        /* İçerik veritabanından silinmişse alıntı boş gelir. Boş bir kutu göstermek
           yerine bunu SÖYLEMEK gerekiyor: moderatör metnin yüklenmediğini mi yoksa
           içeriğin gitmiş olduğunu mu gördüğünü bilmeli. */
        <Text className="mt-2 text-sm italic text-slate-500">
          İçerik artık veritabanında yok; şikayet kaydı duruyor.
        </Text>
      )}
    </View>
  )
}

/*
  ─── YAPTIRIM ────────────────────────────────────────────────────────────────

  Yaptırımı GERÇEKTEN uygular, sonra şikayeti kapatır.

  ⚠️ SIRA BİLEREK BU YÖNDE: önce yaptırım, sonra şikayetin kapatılması. İkisi ayrı
  istek ve arada hata olabilir; hangi yönde bozulacağını seçmek zorundayız. Bu sırada
  yaptırım uygulanır ama şikayet açık kalır — moderatör kuyrukta görür ve kapatır
  (yaptırım tekrarı da zararsız: aynı kişiye ikinci uyarı). Ters sırada şikayet
  "yaptırım uygulandı" diye kapanır ve yaptırım hiç gerçekleşmez.

  ÜÇ SEVİYE, çünkü ölçek "hiçbir şey yapma / kalıcı ban" ikilemine sıkışmamalı: uyarı
  geri alınabilir ve kayda geçer; süreli askı zaman kazandırır; kalıcı ban cihaz
  kimliğini de kapsar.

  DÖRDÜNCÜ SEÇENEK — BAN KALDIRMA — web'de bu sayfada YOK, mobilde eklendi. Sebebi:
  yanlış verilmiş bir ban kararını geri almanın ürün içindeki tek yolu bu uç ve
  moderatör kuyrukta o kişinin kaydına zaten bakıyor. Ban kaldırma bir yaptırım
  DEĞİLDİR, bu yüzden şikayeti KAPATMAZ (bkz. uygula) ve ayrı bir başlık altında durur.

  Gerekçe ZORUNLU: sunucu 5 karakter istiyor, arayüz 10 — denetim izini okuyan kişi
  (belki başka bir moderatör, belki mahkeme) kararın neye dayandığını görebilmeli;
  "spam" yazan bir kayıt hiçbir şey anlatmıyor.
*/
const YAPTIRIM_TURLERI = [
  {
    key: 'Warning',
    label: 'Uyarı',
    aciklama: 'Hesap açık kalır, karar kayda geçer. Tekrarında ölçek yükseltilir.',
  },
  {
    key: 'TemporaryBan',
    label: 'Süreli askı',
    aciklama: 'Hesap belirtilen süre boyunca giriş yapamaz. Cihaz banı uygulanmaz.',
  },
  {
    key: 'PermanentBan',
    label: 'Kalıcı ban',
    aciklama: 'Hesap ve kullanıcının bilinen tüm cihaz kimlikleri (HWID) banlanır.',
  },
]

/** Süreli askı için hazır seçenekler. Elle saat yazdırmak yazım hatasına açık. */
const ASKI_SURELERI = [
  { saat: 24, label: '1 gün' },
  { saat: 72, label: '3 gün' },
  { saat: 168, label: '1 hafta' },
  { saat: 720, label: '30 gün' },
]

const EN_AZ_GEREKCE = 10

function YaptirimSayfasi({ hedef, onClose, onUygulandi }) {
  const [tur, setTur] = useState('Warning')
  const [saat, setSaat] = useState(72)
  const [gerekce, setGerekce] = useState('')
  const [onaylandi, setOnaylandi] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const kilit = useRef(false)

  // Tür değişince onay düşer: "kalıcı ban"ı onaylayıp sonra "uyarı"ya dönen biri,
  // bir sonraki basışta onaysız bir bana gitmemeli (ya da tersi).
  useEffect(() => setOnaylandi(false), [tur])

  const uygulanabilir = gerekce.trim().length >= EN_AZ_GEREKCE
  // Ban ve ban kaldırma hesabın tamamını etkiliyor: tek dokunuşla değil, açık onayla.
  // (Uyarı ve süreli askı geri alınabilir; onları ikinci adıma sokmak kuyruğu yavaşlatır.)
  const kritik = tur === 'PermanentBan' || tur === 'BanKaldir'
  const onayGerekiyor = kritik && !onaylandi

  async function uygula() {
    if (kilit.current || !uygulanabilir) return
    kilit.current = true
    setBusy(true)
    setError(null)
    try {
      const sebep = gerekce.trim()

      if (tur === 'BanKaldir') {
        const sonuc = await api.unbanUser(hedef.reportedUserId, sebep)
        // Şikayet AÇIK KALIR: ban kaldırma bu şikayete verilmiş bir yanıt değil,
        // önceki bir kararın düzeltilmesi. Kuyruktaki kayıt ayrıca sonuçlandırılır.
        onUygulandi(
          `${hedef.reportedDisplayName}: ban kaldırıldı (${sonuc?.devicesUnbanned ?? 0} cihaz banı düştü). ` +
            'Şikayet kuyrukta açık kaldı.',
        )
        return
      }

      let ek = ''
      if (tur === 'PermanentBan') {
        // Ban ayrı uçtan: cihaz kimliklerini de kapsıyor ve yalnızca Admin'e açık.
        const sonuc = await api.banUser(hedef.reportedUserId, sebep)
        ek = ` (${sonuc?.devicesBanned ?? 0} cihaz engellendi)`
      } else {
        await api.sanctionUser(
          hedef.reportedUserId,
          tur,
          sebep,
          tur === 'TemporaryBan' ? saat : null,
        )
      }

      // Yaptırım tuttu; şimdi şikayeti kapat. Bu ikinci istek düşerse yaptırım yine de
      // uygulanmış olur ve şikayet kuyrukta kalır (bkz. yukarıdaki sıra notu).
      await api.resolveReport(hedef.reportId, true, sebep)

      const ad = YAPTIRIM_TURLERI.find((y) => y.key === tur)?.label ?? tur
      onUygulandi(
        `${hedef.reportedDisplayName}: ${ad.toLocaleLowerCase('tr')} uygulandı${ek}, şikayet kapatıldı.`,
      )
    } catch (err) {
      setError(err)
    } finally {
      // Kilit hata dalında da açılır: düzeltip yeniden denenebilmeli.
      kilit.current = false
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      // İstek uçarken sayfa hiçbir yoldan kapanmaz (karartma, ✕ ve Android geri tuşu
      // dahil): kapanırsa kilit delinir ve karar arka planda sessizce tamamlanır.
      onClose={busy ? () => {} : onClose}
      title="Hesap kararı"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onPress={onClose}>
            Vazgeç
          </Button>
          <Button
            variant={tur === 'BanKaldir' ? 'primary' : 'danger'}
            loading={busy}
            disabled={!uygulanabilir || busy}
            onPress={() => (onayGerekiyor ? setOnaylandi(true) : uygula())}
          >
            {onayGerekiyor
              ? 'Devam et'
              : tur === 'BanKaldir'
                ? 'Banı kaldır'
                : 'Uygula ve şikayeti kapat'}
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <View className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Text className="text-sm font-semibold text-slate-900">{hedef.reportedDisplayName}</Text>
          <Text className="mt-1 text-xs text-slate-600">
            {REPORT_REASON_LABELS[hedef.reason] ?? hedef.reason}
            {hedef.reportedUserTotalReports > 1
              ? ` · bu kişi hakkında ${hedef.reportedUserTotalReports} şikayet`
              : ''}
          </Text>
        </View>

        <View>
          <Text className="mb-2 text-sm font-medium text-slate-700">Yaptırım</Text>
          <View className="gap-2">
            {YAPTIRIM_TURLERI.map(({ key, label, aciklama }) => (
              <SecimSatiri
                key={key}
                secili={tur === key}
                baslik={label}
                aciklama={aciklama}
                onPress={() => setTur(key)}
              />
            ))}
          </View>
        </View>

        {/* Süre yalnızca süreli askıda: diğer seçeneklerde anlamı yok ve açık
            bırakılsaydı "uyarıyı 3 gün verdim" gibi yanlış bir zihin modeli kurardı. */}
        {tur === 'TemporaryBan' && (
          <View>
            <Text className="mb-2 text-sm font-medium text-slate-700">Askı süresi</Text>
            <View className="flex-row flex-wrap gap-2">
              {ASKI_SURELERI.map(({ saat: s, label }) => {
                const aktif = saat === s
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: aktif }}
                    onPress={() => setSaat(s)}
                    className={`min-h-[44px] flex-1 basis-24 items-center justify-center rounded-lg border
                                ${aktif ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
                  >
                    <Text
                      className={`text-sm font-medium ${aktif ? 'text-brand-800' : 'text-slate-600'}`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        <View>
          <Text className="mb-2 text-sm font-medium text-slate-700">Geri alma</Text>
          <SecimSatiri
            secili={tur === 'BanKaldir'}
            baslik="Banı kaldır"
            aciklama="Hesap ban öncesindeki durumuna döner ve bu kullanıcı yüzünden konmuş cihaz banları düşer. Şikayet kuyrukta AÇIK kalır."
            onPress={() => setTur('BanKaldir')}
          />
        </View>

        {/* Onay adımı: metin, o an seçili karara göre sonucu tek cümlede söyler. */}
        {onaylandi && kritik && (
          <View className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <Text className="text-sm leading-relaxed text-rose-800">
              {tur === 'PermanentBan' ? (
                <>
                  <Text className="font-semibold">{hedef.reportedDisplayName}</Text> kalıcı olarak
                  banlanacak ve bu hesabın bilinen tüm cihaz kimlikleri (HWID) engellenecek.
                  Şikayet de kapatılacak. Emin misin?
                </>
              ) : (
                <>
                  <Text className="font-semibold">{hedef.reportedDisplayName}</Text> hesabının banı
                  kalkacak ve bu kullanıcı yüzünden konmuş cihaz banları düşecek. Emin misin?
                </>
              )}
            </Text>
          </View>
        )}

        <GerekceAlani
          deger={gerekce}
          onChange={setGerekce}
          enAz={EN_AZ_GEREKCE}
          ipucu="Denetim izine yazılır; kararı sonradan okuyan kişi neye dayandığını görebilmeli."
          ornek="Örn. Sohbette tekrarlayan hakaret; 3 ayrı kullanıcı bildirdi."
        />

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}

/*
  ─── İÇERİK KARARI ───────────────────────────────────────────────────────────

  Kaldır ya da geri getir. YAPTIRIMDAN AYRI SAYFA: ikisini birleştirmek "içeriği
  kaldır" ile "kişiyi askıya al"ı tek karara bağlardı.

  ŞİKAYETİ KAPATMAZ ve bu bilinçli: aynı içerik hakkında birden çok şikayet olabiliyor.
  İçerik kararı verildikten sonra moderatör her şikayeti ayrı ayrı kapatıyor — karar
  tek, kuyruk kayıtları ayrı.

  Onay adımı YOK (yaptırımdan farkı): kaldırma geri alınabilir ve geri getirme düğmesi
  aynı yerde duruyor. Zorunlu gerekçe zaten bir duraklama noktası.
*/
function IcerikKarariSayfasi({ hedef, onClose, onUygulandi }) {
  const [gerekce, setGerekce] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const kilit = useRef(false)

  const kaldirilmis = hedef.contentStatus === 'Removed'
  const gonderi = Boolean(hedef.communityPostId)

  // Sunucu da en az 10 karakter istiyor (ModerateForumContentHandler); istemcideki
  // kontrolün tek amacı kullanıcıyı yazdıktan sonra 400'e düşürmemek.
  const uygulanabilir = gerekce.trim().length >= EN_AZ_GEREKCE

  async function uygula() {
    if (kilit.current || !uygulanabilir) return
    kilit.current = true
    setBusy(true)
    setError(null)
    try {
      await api.moderateForumContent({
        postId: hedef.communityPostId ?? null,
        commentId: hedef.communityCommentId ?? null,
        remove: !kaldirilmis,
        reason: gerekce.trim(),
      })

      const ad = gonderi ? 'Gönderi' : 'Yorum'
      onUygulandi(
        kaldirilmis
          ? `${ad} geri getirildi. Şikayet hâlâ açık.`
          : `${ad} kaldırıldı. Şikayet hâlâ açık.`,
      )
    } catch (err) {
      setError(err)
    } finally {
      kilit.current = false
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={kaldirilmis ? 'İçeriği geri getir' : 'İçeriği kaldır'}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onPress={onClose}>
            Vazgeç
          </Button>
          <Button
            variant={kaldirilmis ? 'primary' : 'danger'}
            loading={busy}
            disabled={!uygulanabilir || busy}
            onPress={uygula}
          >
            {kaldirilmis ? 'Geri getir' : 'Kaldır'}
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <ErrorBox error={error} />

        <SikayetEdilenIcerik rapor={hedef} />

        <Text className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          {kaldirilmis
            ? 'İçerik yeniden yayına alınır ve akışta perdesiz görünür. Şikayet sayacı sıfırlanmaz. '
            : 'İçerik akıştan kaldırılır; yazarı ve okuyanlar bir daha göremez. Şikayet kaydı ve sayacı durur, karar denetim izine yazılır. '}
          Bu işlem şikayeti KAPATMAZ — kuyruktaki kaydı ayrıca sonuçlandırman gerekiyor.
        </Text>

        <GerekceAlani
          deger={gerekce}
          onChange={setGerekce}
          enAz={EN_AZ_GEREKCE}
          maxLength={1000}
          ipucu="Denetim izine yazılır. Kaldırma en çok tartışılan karardır; dayanağı görünür olmalı."
          ornek="Örn. gönderi izinsiz PDF bağlantısı paylaşıyor, 2. kural ihlali."
        />
      </View>
    </Modal>
  )
}

/* ── ÖĞRETMEN ADAYLIĞI ───────────────────────────────────────────────────── */

const ADAY_FILTRELERI = [
  { key: 'Pending', label: 'Bekleyen' },
  { key: 'Verified', label: 'Doğrulanmış' },
  { key: 'Rejected', label: 'Reddedilmiş' },
  { key: 'All', label: 'Tümü' },
]

const ADAY_DURUMU = {
  Pending: { label: 'Karar bekliyor', tone: 'warning' },
  Verified: { label: 'Doğrulandı', tone: 'success' },
  Rejected: { label: 'Reddedildi', tone: 'danger' },
}

/**
 * Kararlar. "Reddet" kırmızı ama YIKICI DEĞİL: beyan silinmez, kullanıcı bilgilerini
 * düzeltip yeniden gönderebilir. Bu ekranda geri alınamaz işlem yok.
 */
const ADAY_KARARLARI = {
  Verify: {
    label: 'Doğrula',
    variant: 'success',
    title: 'Beyanı doğrula',
    hint: 'Profilde "Doğrulandı" rozeti görünür. Gerekçeye hangi belgeyi gördüğünü yaz — sistemde belge kaydı yok, bu not tek dayanak.',
    ornek: 'Örn: Öğrenci belgesi e-posta ile gönderildi, 2026 bahar dönemi.',
  },
  Reject: {
    label: 'Reddet',
    variant: 'danger',
    title: 'Beyanı reddet',
    hint: '🌱 rozeti geri alınır ve gönüllü ders açamaz. Beyan silinmez; kullanıcı düzeltip yeniden gönderebilir. Gerekçeyi KULLANICI GÖRÜR.',
    ornek: 'Örn: Belge gönderilmedi. Öğrenci belgeni ilettiğinde yeniden değerlendirilecek.',
  },
  Revert: {
    label: 'Kararı geri al',
    variant: 'secondary',
    title: 'Kararı geri al',
    hint: 'Beyan yeniden kuyruğa döner, kullanıcı bilgilerini düzenleyebilir hâle gelir ve reddedilmişse 🌱 rozeti iade edilir. Doğrulanmış bir beyanı güncellemenin tek yolu budur.',
    ornek: 'Örn: Bölüm değişikliği bildirildi, yeniden inceleme gerekiyor.',
  },
}

const EN_AZ_ADAY_NOTU = 5

/* Sayfa boyutu web'le AYNI (25); mobilde değişen şey sayfa GEZİNTİSİ: numaralı
   sayfalar yerine onEndReached ile biriken liste. */
const ADAY_SAYFA_BOYUTU = 25

function AdayKuyrugu({ onNotice }) {
  const [filtre, setFiltre] = useState('Pending')
  const list = useAsync(() => api.teacherCandidates(filtre, 1, ADAY_SAYFA_BOYUTU), [filtre])

  const [ekSatirlar, setEkSatirlar] = useState([])
  const [sayfa, setSayfa] = useState(1)
  const [ekYukleniyor, setEkYukleniyor] = useState(false)
  const [ekHata, setEkHata] = useState(null)
  const sayfaKilidi = useRef(false)

  const [hedef, setHedef] = useState(null) // { row, karar }

  /*
    NESİL SAYACI — uçuştaki sayfa isteğini sıfırlamadan ayırt eder.

    İlk sayfa yenilenince birikinti sıfırlanır (karar verilen satır "Bekleyen"
    kuyruğundan düşer, elde kalan birikinti bayat ofsetlerden oluşurdu). Ama sıfırlama
    anında bir `dahaGetir` uçuyor olabilir: yanıtı döndüğünde sıfırlanmış birikintinin
    üstüne ESKİ ofsetle eklenir ve aradaki sayfalar kalıcı olarak atlanırdı.

    Her yükleme kendi neslini taşıyor; nesil değişmişse yanıt sessizce atılıyor.
  */
  const nesil = useRef(0)

  useEffect(() => {
    nesil.current += 1
    setEkSatirlar([])
    setSayfa(1)
    setEkHata(null)
  }, [list.data])

  const satirlar = useMemo(() => {
    /*
      Tekilleştirme TÜM birikinti üzerinden: sunucu saf ofsetle sayfalıyor ve sayfalar
      yüklenirken kuyruğa üstten kayıt düşerse (yeni beyan) sonraki sayfa bir öncekinin
      son öğesini tekrar getirir — aynı profileId FlatList'e iki kez girip çift kart ve
      duplicate key üretirdi.
    */
    const gorulen = new Set()
    const sonuc = []
    for (const r of [...(list.data?.items ?? []), ...ekSatirlar]) {
      if (gorulen.has(r.profileId)) continue
      gorulen.add(r.profileId)
      sonuc.push(r)
    }
    return sonuc
  }, [list.data, ekSatirlar])

  const toplam = list.data?.totalCount ?? 0
  const dahaVar = satirlar.length < toplam

  async function dahaGetir() {
    if (sayfaKilidi.current || !dahaVar) return
    const benimNesil = nesil.current
    sayfaKilidi.current = true
    setEkYukleniyor(true)
    setEkHata(null)
    try {
      const veri = await api.teacherCandidates(filtre, sayfa + 1, ADAY_SAYFA_BOYUTU)
      // Bu istek uçarken liste sıfırlandıysa yanıt ARTIK GEÇERSİZ: eklemek, yeni
      // birikintiye eski ofsetin sayfasını yamamak olurdu.
      if (nesil.current !== benimNesil) return
      setEkSatirlar((prev) => [...prev, ...(veri.items ?? [])])
      setSayfa((p) => p + 1)
    } catch (err) {
      if (nesil.current === benimNesil) setEkHata(err)
    } finally {
      sayfaKilidi.current = false
      setEkYukleniyor(false)
    }
  }

  return (
    <>
      <FlatList
        data={list.loading ? [] : satirlar}
        keyExtractor={(r) => r.profileId}
        contentContainerClassName="gap-3 p-4"
        onEndReached={dahaGetir}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <ErrorBox error={list.error} onRetry={list.reload} />

            <View className="flex-row flex-wrap gap-1.5">
              {ADAY_FILTRELERI.map((item) => {
                const aktif = filtre === item.key
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: aktif }}
                    onPress={() => setFiltre(item.key)}
                    className={`min-h-[44px] justify-center rounded-full border px-4
                                ${aktif ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white'}`}
                  >
                    <Text
                      className={`text-sm ${aktif ? 'font-medium text-brand-700' : 'text-slate-600'}`}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {!list.loading && satirlar.length > 0 && (
              <SectionTitle>
                {ADAY_FILTRELERI.find((f) => f.key === filtre)?.label} ({toplam})
              </SectionTitle>
            )}

            {/* Dürüstlük notu operatöre de gösteriliyor: bu ekran belge doğrulamaz,
                karar kaydeder. */}
            <Text className="text-xs leading-relaxed text-slate-500">
              Sistemde öğrenci belgesi yükleme kanalı yok. Doğrulama, sistem dışı bir kanıta (ör.
              e-posta ile gelen öğrenci belgesi) dayanır; gerekçe alanı o kanıtın kayda geçtiği tek
              yerdir ve denetim izine yazılır.
            </Text>
          </View>
        }
        ListEmptyComponent={
          list.loading ? (
            <Loading />
          ) : list.error ? null : (
            <EmptyState
              title="Kayıt yok"
              description={
                filtre === 'Pending'
                  ? 'Karar bekleyen öğretmen adaylığı beyanı yok.'
                  : 'Bu filtreye uyan beyan yok.'
              }
            />
          )
        }
        ListFooterComponent={
          <View className="gap-3">
            {ekYukleniyor && (
              <View className="py-2">
                <Spinner />
              </View>
            )}
            <ErrorBox error={ekHata} onRetry={dahaGetir} />
          </View>
        }
        renderItem={({ item }) => <AdayKarti row={item} onKarar={setHedef} />}
      />

      {hedef && (
        <AdayKararSayfasi
          key={`${hedef.row.profileId}-${hedef.karar}`}
          hedef={hedef}
          onClose={() => setHedef(null)}
          onBitti={(mesaj) => {
            setHedef(null)
            onNotice(mesaj)
            list.reload({ silent: true })
          }}
        />
      )}
    </>
  )
}

function AdayKarti({ row, onKarar }) {
  const router = useRouter()
  const durum = ADAY_DURUMU[row.reviewStatus] ?? { label: row.reviewStatus, tone: 'neutral' }

  // Beyandaki okul ile profildeki serbest metin farklıysa hakem bunu bilmeli: tek
  // başına suç değil ama bakılması gereken bir sinyal.
  const profilFarkli =
    row.profileUniversity &&
    row.profileUniversity.trim().toLocaleLowerCase('tr') !==
      row.university.trim().toLocaleLowerCase('tr')

  return (
    <KuyrukKarti
      aksiyonlar={
        <>
          {row.reviewStatus !== 'Verified' && (
            <Button variant="success" onPress={() => onKarar({ row, karar: 'Verify' })}>
              Doğrula
            </Button>
          )}
          {row.reviewStatus !== 'Rejected' && (
            <Button variant="danger" onPress={() => onKarar({ row, karar: 'Reject' })}>
              Reddet
            </Button>
          )}
          {row.reviewStatus !== 'Pending' && (
            <Button variant="secondary" onPress={() => onKarar({ row, karar: 'Revert' })}>
              Kararı geri al
            </Button>
          )}
        </>
      }
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <Badge tone={durum.tone}>{durum.label}</Badge>
        {row.userStatus !== 'Active' && <Badge tone="danger">{row.userStatus}</Badge>}
        {row.hasPedagogicalCertificate && <Badge tone="neutral">Pedagojik formasyon</Badge>}
      </View>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${row.displayName} profilini aç`}
        onPress={() => router.push(`/profil/${row.userId}`)}
        className="min-h-[44px] justify-center"
      >
        <Text className="text-sm font-semibold text-brand-700 underline">{row.displayName}</Text>
        <Text numberOfLines={1} className="text-xs text-slate-500">
          {row.email}
        </Text>
      </Pressable>

      <Text className="text-sm text-slate-800">
        {row.university} · {row.faculty} · {row.department}
        {row.gradeYear ? ` · ${row.gradeYear}. sınıf` : ''}
      </Text>

      {profilFarkli && (
        <Text className="text-xs text-amber-700">
          Profilinde farklı okul yazıyor: {row.profileUniversity}
          {row.profileDepartment ? ` · ${row.profileDepartment}` : ''}
        </Text>
      )}

      <View className="gap-1">
        <Text className="text-xs text-slate-600">Beyan: {formatDateTime(row.declaredAtUtc)}</Text>
        <Text className="text-xs text-slate-600">Üyelik: {formatDateTime(row.joinedAtUtc)}</Text>
        {/* Davranışsal sinyal: beyanı fiilen kullanıyor mu? */}
        <Text
          className={`text-xs ${
            row.completedVolunteerSessions > 0 ? 'font-medium text-emerald-700' : 'text-slate-600'
          }`}
        >
          Gönüllü ders: {row.completedVolunteerSessions} tamamlandı · {row.volunteerOfferCount} açık
          ilan
        </Text>
        {row.ratingCount > 0 && (
          <Text className="text-xs text-slate-600">
            Puan: {row.averageRating} ({row.ratingCount})
          </Text>
        )}
      </View>

      {row.reviewStatus !== 'Pending' && (
        <View className="rounded-xl bg-slate-50 p-3">
          <Text className="text-xs text-slate-600">
            {durum.label} · {formatDateTime(row.reviewedAtUtc)}
            {row.reviewedByDisplayName ? ` · ${row.reviewedByDisplayName}` : ''}
          </Text>
          {row.reviewNote ? (
            <Text className="mt-1 text-xs leading-relaxed text-slate-700">{row.reviewNote}</Text>
          ) : null}
        </View>
      )}
    </KuyrukKarti>
  )
}

function AdayKararSayfasi({ hedef, onClose, onBitti }) {
  const [not, setNot] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const kilit = useRef(false)

  const yapilandirma = ADAY_KARARLARI[hedef.karar]
  const gonderilebilir = not.trim().length >= EN_AZ_ADAY_NOTU

  async function gonder() {
    if (kilit.current || !gonderilebilir) return
    kilit.current = true
    setBusy(true)
    setError(null)
    try {
      const sonuc = await api.reviewTeacherCandidate(hedef.row.profileId, hedef.karar, not.trim())
      onBitti(
        `${hedef.row.displayName} — ${yapilandirma.label.toLocaleLowerCase('tr')} işlemi uygulandı.` +
          (sonuc?.badgeRemoved ? ' 🌱 rozeti geri alındı.' : '') +
          (sonuc?.badgeRestored ? ' 🌱 rozeti iade edildi.' : ''),
      )
    } catch (err) {
      setError(err)
    } finally {
      kilit.current = false
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={yapilandirma.title}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onPress={onClose}>
            Vazgeç
          </Button>
          <Button
            variant={yapilandirma.variant}
            loading={busy}
            disabled={!gonderilebilir || busy}
            onPress={gonder}
          >
            {yapilandirma.label}
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <View className="rounded-xl bg-slate-50 p-3">
          <Text className="text-sm font-medium text-slate-800">{hedef.row.displayName}</Text>
          <Text className="mt-0.5 text-sm text-slate-600">
            {hedef.row.university} · {hedef.row.faculty} · {hedef.row.department}
          </Text>
        </View>

        <Text className="text-sm leading-relaxed text-slate-600">{yapilandirma.hint}</Text>

        <GerekceAlani
          deger={not}
          onChange={setNot}
          enAz={EN_AZ_ADAY_NOTU}
          ipucu="Denetim izine kaydedilir."
          ornek={yapilandirma.ornek}
        />

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}

/* ── ESKİ İTİRAZLAR (hakemlik) ───────────────────────────────────────────── */

const KARARLAR = [
  {
    value: 'ForStudent',
    label: 'Öğrenci haklı — puan basma',
    hint: 'Eğitmene puan yazılmaz, ders iptal olur. Öğrenciden düşen bir şey zaten yok.',
    variant: 'primary',
  },
  {
    value: 'ForTutor',
    label: 'Eğitmen haklı — puanı bas',
    hint: 'Ders tamamlanmış sayılır ve eğitmene süreye göre puan yazılır.',
    variant: 'success',
  },
  {
    value: 'Dismissed',
    label: 'İtiraz geçersiz',
    hint: 'Ders itiraz öncesindeki durumuna döner.',
    variant: 'secondary',
  },
]

function ItirazKuyrugu({ onNotice }) {
  const disputes = useAsync(() => api.disputes(), [])
  const [secilenId, setSecilenId] = useState(null)

  const veri = disputes.data ?? []

  return (
    <>
      <FlatList
        data={disputes.loading ? [] : veri}
        keyExtractor={(d) => d.disputeId}
        contentContainerClassName="gap-3 p-4"
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <ErrorBox error={disputes.error} onRetry={disputes.reload} />
            {!disputes.loading && veri.length > 0 && (
              <SectionTitle>Açık itirazlar ({veri.length})</SectionTitle>
            )}
          </View>
        }
        ListEmptyComponent={
          disputes.loading ? (
            <Loading />
          ) : disputes.error ? null : (
            <EmptyState
              title="Kuyruk boş"
              description="Bekleyen itiraz yok. Yeni itiraz açılamıyor; bu kuyruk yalnızca eski kayıtlar için duruyor."
            />
          )
        }
        renderItem={({ item }) => (
          <KuyrukKarti
            aksiyonlar={
              <Button onPress={() => setSecilenId(item.disputeId)}>İncele ve karar ver</Button>
            }
          >
            <View className="flex-row flex-wrap items-center gap-2">
              <Badge tone="danger">{DISPUTE_REASON_LABELS[item.reason] ?? item.reason}</Badge>
              <Badge tone="neutral">{item.status}</Badge>
            </View>
            <Text className="text-xs text-slate-500">{formatDateTime(item.createdAtUtc)}</Text>
            <Text className="text-sm leading-relaxed text-slate-700">{item.description}</Text>
          </KuyrukKarti>
        )}
      />

      {secilenId && (
        /* key: her itiraz için TEMİZ durum. Web bunu useEffect ile sıfırlıyordu
           (modal hep monteliydi); mobilde sayfa koşullu monte edildiği için key
           yeterli — önceki itirazın kararı/notu yeni itiraza taşınmaz. */
        <IncelemeSayfasi
          key={secilenId}
          disputeId={secilenId}
          onClose={() => setSecilenId(null)}
          onKarara={(mesaj) => {
            setSecilenId(null)
            onNotice(mesaj)
            disputes.reload({ silent: true })
          }}
        />
      )}
    </>
  )
}

function IncelemeSayfasi({ disputeId, onClose, onKarara }) {
  const detail = useAsync(() => api.disputeDetail(disputeId), [disputeId])

  const [karar, setKarar] = useState('ForStudent')
  const [not, setNot] = useState('')
  const [error, setError] = useState(null)
  const [bilgi, setBilgi] = useState(null)

  const [busy, setBusy] = useState(false)
  const kararKilidi = useRef(false)

  const [banHedefi, setBanHedefi] = useState(null)
  const [banGerekcesi, setBanGerekcesi] = useState('')
  const [banliyor, setBanliyor] = useState(false)
  const banKilidi = useRef(false)

  const d = detail.data
  const secilenKarar = KARARLAR.find((r) => r.value === karar)

  async function uygula() {
    if (kararKilidi.current || !d) return
    kararKilidi.current = true
    setBusy(true)
    setError(null)
    try {
      await api.resolveDispute(d.disputeId, karar, not.trim() || null)
      onKarara('İtiraz karara bağlandı ve puan sonucu uygulandı.')
    } catch (err) {
      setError(err)
    } finally {
      kararKilidi.current = false
      setBusy(false)
    }
  }

  async function banla() {
    if (banKilidi.current || !banHedefi) return
    banKilidi.current = true
    setBanliyor(true)
    setError(null)
    try {
      const sonuc = await api.banUser(banHedefi.userId, banGerekcesi.trim())
      setBanHedefi(null)
      setBanGerekcesi('')
      // Web burada alert() kullanıyordu; RN'de karşılığı yok ve olsa da sayfayı
      // bloke ederdi. Sonuç sayfanın İÇİNDE kalıyor: hakem kararını vermeye devam
      // ediyor ve ne olduğunu aynı ekranda görüyor.
      setBilgi(
        `${banHedefi.displayName} banlandı. Engellenen cihaz: ${sonuc?.devicesBanned ?? 0}. ` +
          'İtiraz hâlâ karar bekliyor.',
      )
      detail.reload({ silent: true })
    } catch (err) {
      setError(err)
    } finally {
      banKilidi.current = false
      setBanliyor(false)
    }
  }

  const kilitli = busy || banliyor

  return (
    <Modal
      open
      onClose={kilitli ? () => {} : onClose}
      title="İtirazı karara bağla"
      footer={
        d ? (
          <>
            <Button variant="secondary" disabled={kilitli} onPress={onClose}>
              Vazgeç
            </Button>
            <Button
              variant={secilenKarar?.variant ?? 'primary'}
              loading={busy}
              disabled={kilitli}
              onPress={uygula}
            >
              Kararı uygula
            </Button>
          </>
        ) : null
      }
    >
      {detail.loading ? (
        <Loading label="İtiraz detayı yükleniyor…" />
      ) : detail.error ? (
        <ErrorBox error={detail.error} onRetry={detail.reload} />
      ) : d ? (
        <View className="gap-4 pb-2">
          {bilgi && (
            <Notice tone="info" onDismiss={() => setBilgi(null)}>
              {bilgi}
            </Notice>
          )}

          {/* Ders künyesi: kod, süre, basım durumu — kararın dayanağı olan künye. */}
          <View className="rounded-xl bg-slate-50 p-3">
            <View className="flex-row flex-wrap items-center gap-2">
              <Badge tone="danger">{DISPUTE_REASON_LABELS[d.reason] ?? d.reason}</Badge>
              <Badge tone="neutral">{d.sessionStatus}</Badge>
              {d.mintPending ? (
                <Badge tone="warning">{d.creditCost} puan basılacak</Badge>
              ) : (
                <Badge tone="neutral">Basım kapalı</Badge>
              )}
            </View>
            <Text className="mt-2 text-sm font-medium text-slate-800">
              {d.topicName} · {d.subjectName}
            </Text>
            <Text className="text-xs text-slate-500">
              {formatDateTime(d.scheduledStartUtc)} — {d.durationMinutes} dk
            </Text>
            <Text selectable className="mt-1 font-mono text-xs text-slate-600">
              Kod: {d.verificationCode}
            </Text>
          </View>

          {/* Web'de iki taraf yan yana ızgaradaydı; telefonda alt alta — 180px'lik iki
              sütunda e-posta ve unvan satırları okunmuyordu. */}
          <TarafKarti
            baslik="Eğitmen"
            taraf={d.tutor}
            onBan={setBanHedefi}
            pasif={kilitli || Boolean(banHedefi)}
          />
          <TarafKarti
            baslik="Öğrenci"
            taraf={d.student}
            onBan={setBanHedefi}
            pasif={kilitli || Boolean(banHedefi)}
          />

          {/*
            BAN ONAYI SAYFANIN İÇİNDE, iç içe Modal DEĞİL: RN'de Modal ayrı bir pencere
            açar; üst üste iki pencerede kapanma sırası platforma göre değişiyor ve
            alttaki sayfa görünmez hâlde ekranda kalabiliyor. Onay, düğmenin hemen
            altında beliriyor — bakılan yer neresiyse karar da orada.
          */}
          {banHedefi && (
            <View className="gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
              <Text className="text-sm leading-relaxed text-rose-800">
                <Text className="font-semibold">{banHedefi.displayName}</Text> kalıcı olarak
                banlanacak ve bu hesabın bilinen tüm cihaz kimlikleri (HWID) engellenecek. Bu işlem
                itirazı karara bağlamaz.
              </Text>

              {/* GEREKÇE ELLE YAZILIYOR — web burada sabit bir metin ("İtiraz incelemesi:
                  <id>") gönderiyordu. O metin denetim izine hiçbir şey anlatmayan bir
                  kayıt bırakıyor: hangi itiraz olduğunu zaten kayıt kendisi söylüyor,
                  NEDEN banlandığını hiç kimse söylemiyordu. */}
              <GerekceAlani
                deger={banGerekcesi}
                onChange={setBanGerekcesi}
                enAz={EN_AZ_GEREKCE}
                ipucu="Denetim izine yazılır."
                ornek={`Örn. İtiraz incelemesinde sahte kanıt tespit edildi (${d.verificationCode}).`}
              />

              <View className="flex-row justify-end gap-2">
                <Button
                  variant="secondary"
                  disabled={banliyor}
                  onPress={() => {
                    setBanHedefi(null)
                    setBanGerekcesi('')
                  }}
                >
                  Vazgeç
                </Button>
                <Button
                  variant="danger"
                  loading={banliyor}
                  disabled={banliyor || banGerekcesi.trim().length < EN_AZ_GEREKCE}
                  onPress={banla}
                >
                  Banla
                </Button>
              </View>
            </View>
          )}

          {/* İKİ TARAFIN BEYANI. Eğitmen yanıtı yoksa bu da hakem için bir veridir. */}
          <View className="gap-2">
            <View className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <Text className="text-xs font-medium uppercase tracking-wide text-rose-700">
                Öğrencinin iddiası · {formatDateTime(d.createdAtUtc)}
              </Text>
              <Text className="mt-1 text-sm leading-relaxed text-slate-700">{d.description}</Text>
            </View>

            <View className="rounded-xl border border-slate-200 bg-white p-3">
              <Text className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Eğitmenin savunması
                {d.tutorStatementAtUtc ? ` · ${formatDateTime(d.tutorStatementAtUtc)}` : ''}
              </Text>
              {d.tutorStatement ? (
                <Text className="mt-1 text-sm leading-relaxed text-slate-700">
                  {d.tutorStatement}
                </Text>
              ) : (
                <Text className="mt-1 text-sm italic text-slate-500">
                  Eğitmen henüz savunma yazmadı.
                </Text>
              )}
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-medium text-slate-700">Yüklenen kanıtlar</Text>
            {(d.proofs?.length ?? 0) === 0 ? (
              <Text className="text-sm text-slate-500">
                Bu derse hiç kanıt yüklenmemiş — "ders yapılmadı" iddiasını güçlendirir.
              </Text>
            ) : (
              d.proofs.map((kanit) => (
                <KanitKarti key={kanit.proofId} kanit={kanit} sessionId={d.sessionId} />
              ))
            )}
          </View>

          <View>
            <Text className="mb-2 text-sm font-medium text-slate-700">Karar</Text>
            <View className="gap-2">
              {KARARLAR.map((secenek) => (
                <SecimSatiri
                  key={secenek.value}
                  secili={karar === secenek.value}
                  baslik={secenek.label}
                  aciklama={secenek.hint}
                  onPress={() => setKarar(secenek.value)}
                />
              ))}
            </View>
          </View>

          <Field label="Karar notu (opsiyonel)">
            <Girdi
              value={not}
              onChangeText={setNot}
              maxLength={2000}
              multiline
              textAlignVertical="top"
              className="h-20"
            />
          </Field>

          <ErrorBox error={error} />
        </View>
      ) : null}
    </Modal>
  )
}

/** Taraf kartı: kimlik + hakemin işine yarayan geçmiş sinyalleri. */
function TarafKarti({ baslik, taraf, onBan, pasif }) {
  return (
    <View className="rounded-xl border border-slate-200 p-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Text className="text-xs uppercase tracking-wide text-slate-600">{baslik}</Text>
          <Text numberOfLines={1} className="font-medium text-slate-800">
            {taraf.displayName}
          </Text>
          <Text numberOfLines={1} className="text-xs text-slate-500">
            {taraf.email}
          </Text>
        </View>
        {taraf.status !== 'Active' && <Badge tone="danger">{taraf.status}</Badge>}
      </View>

      <View className="mt-2 gap-1">
        <Text className="text-xs text-slate-600">
          Puan: {taraf.averageRating} ({taraf.ratingCount})
        </Text>
        <Text className="text-xs text-slate-600">Üyelik: {formatDateTime(taraf.joinedAtUtc)}</Text>
        {/* Aleyhine sonuçlanmış geçmiş itiraz: tekrar eden davranışın tek göstergesi. */}
        <Text
          className={`text-xs ${
            taraf.pastDisputesAgainst > 0 ? 'font-medium text-rose-600' : 'text-slate-600'
          }`}
        >
          Aleyhine sonuçlanan itiraz: {taraf.pastDisputesAgainst}
        </Text>
      </View>

      {taraf.status === 'Active' && (
        <View className="mt-3">
          <Button variant="danger" disabled={pasif} onPress={() => onBan(taraf)}>
            Kalıcı banla (+ cihazları)
          </Button>
        </View>
      )}
    </View>
  )
}

/**
 * Kanıt kartı: görsel + üstveri. "Sahte kanıt" itirazına karar veren hakemin görseli
 * GÖRMESİ şart — hash ve tarih tek başına karar için yeterli değil.
 *
 * Web burada blob indirip object URL üretiyordu (tarayıcıda <img> Authorization
 * başlığı taşıyamıyor). RN'de Image başlığı kendisi taşır: fetch, object URL ve
 * revoke temizliği topluca düştü (bkz. api.adminProofImageSource).
 */
function KanitKarti({ kanit, sessionId }) {
  const [hata, setHata] = useState(false)

  return (
    <View className="rounded-xl border border-slate-200 p-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-xs font-medium text-slate-700">
          {formatDateTime(kanit.uploadedAtUtc)}
        </Text>
        {kanit.isDuplicateHash && (
          <View className="flex-row items-center gap-1">
            <UyariIkonu renk={rose[600]} boy={14} />
            <Badge tone="danger">Tekrar kullanılmış görsel</Badge>
          </View>
        )}
      </View>

      {hata ? (
        <Text className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          Kanıt görseli yüklenemedi. Bağlantını kontrol edip sayfayı yeniden aç.
        </Text>
      ) : (
        <Image
          source={api.adminProofImageSource(sessionId, kanit.proofId)}
          accessibilityLabel="Ders kanıtı ekran görüntüsü"
          onError={() => setHata(true)}
          className="mt-2 h-72 w-full rounded-lg border border-slate-200 bg-slate-100"
          resizeMode="contain"
        />
      )}

      {/* Hash seçilebilir: aynı görselin başka derste kullanılıp kullanılmadığını
          sunucu zaten işaretliyor ama hakem kaydı dışarı taşımak isteyebilir. */}
      <Text selectable className="mt-2 font-mono text-xs text-slate-600">
        SHA-256: {kanit.sha256Hash}
      </Text>
    </View>
  )
}
