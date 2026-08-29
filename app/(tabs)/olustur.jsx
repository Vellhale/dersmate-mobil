import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../../src/lib/api'
import { useAsync } from '../../src/state/useAsync'
import { EkranBasligi } from '../../src/components/EkranBasligi'
import { KonuSecici } from '../../src/components/KonuSecici'
import { Badge, Button, Card, ErrorBox, Field, Girdi, Loading, Modal, Notice } from '../../src/components/ui'

/*
  DERS İLANI OLUŞTUR — web'deki pages/Portfolio.jsx'in portu (➕ sekmesi).

  Dinamik portföy (Modül 1.1): iki yönlü profil.
    Offer = "Verebileceğim konular"   → PUAN KAZANDIRIR (ders onaylandığında basılır)
    Seek  = "Almak istediğim konular" → bedelsiz; yalnızca eşleşme için sinyal
  Çapraz eşleşme algoritması bu iki listeyi karşı tarafınkiyle çakıştırır.

  Web kararları aynen:
  • KATALOG SAYFADA, MODALDA DEĞİL: seçici her açılışta 767 satırı yeniden indirmesin.
  • İKİ AŞAMALI EKLEME: önce konu (KonuSecici), sonra detay formu — form, cevaplanacak
    sorusu oluşmadan görünmemeli.
  • Web'in iki sütunu mobilde alt alta iki bölüm: tek sütun, aynı kart dili.

  MOBİL FARK — seviye kaydırıcı DEĞİL beş buton: RN'de yerleşik range yok ve beş
  değerlik bir seçim için kaydırıcı zaten fazlaydı (web'deki süre butonlarıyla aynı
  gerekçe: seçenek az ve yan yana karşılaştırma bedava).
*/
export default function Olustur() {
  const entries = useAsync(() => api.myPortfolio(), [])
  const konular = useAsync(() => api.topics(), [])
  const [modalDirection, setModalDirection] = useState(null)
  const [notice, setNotice] = useState(null)

  const offers = entries.data?.filter((e) => e.direction === 'Offer') ?? []
  const seeks = entries.data?.filter((e) => e.direction === 'Seek') ?? []

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <EkranBasligi baslik="Ders Portföyü" />

      <ScrollView contentContainerClassName="gap-3 p-4">
        <Text className="text-sm leading-relaxed text-slate-600">
          Anlatabildiğin konular puan kazandırır; almak istediklerin ücretsizdir. İkisini de
          doldurduğunda karşılıklı takas önerileri güçlenir.
        </Text>

        {notice && (
          <Notice tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Notice>
        )}

        <ErrorBox error={entries.error} onRetry={entries.reload} />

        {entries.loading ? (
          <Loading />
        ) : (
          <>
            <PortfoyBolumu
              title="Verebileceğim konular"
              tone="success"
              aciklama="Onaylanan her ders sana puan kazandırır."
              emptyText="Henüz anlatabileceğin bir konu eklemedin. En iyi olduğun konuyla başla."
              entries={offers}
              onAdd={() => setModalDirection('Offer')}
              onRemoved={() => entries.reload({ silent: true })}
            />
            <PortfoyBolumu
              title="Almak istediğim konular"
              tone="brand"
              aciklama="Ücretsizdir; eşleşme önerileri için sinyaldir."
              emptyText="İhtiyacın olan konuları ekle; sana anlatabilecek öğrenciler önerilsin."
              entries={seeks}
              onAdd={() => setModalDirection('Seek')}
              onRemoved={() => entries.reload({ silent: true })}
            />
          </>
        )}
      </ScrollView>

      <KonuEkleAkisi
        direction={modalDirection}
        konular={konular.data}
        konularYukleniyor={konular.loading}
        onClose={() => setModalDirection(null)}
        onSaved={(yon) => {
          setModalDirection(null)
          setNotice(
            yon === 'Offer'
              ? 'İlan eklendi — bu konuyu almak isteyenlerin akışında görünecek.'
              : 'Konu eklendi — akışında sana anlatabilecek kişiler önerilecek.',
          )
          entries.reload({ silent: true })
        }}
      />
    </SafeAreaView>
  )
}

function PortfoyBolumu({ title, aciklama, tone, entries, emptyText, onAdd, onRemoved }) {
  const [removingId, setRemovingId] = useState(null)
  const [removeError, setRemoveError] = useState(null)

  async function remove(entryId) {
    if (removingId) return
    setRemovingId(entryId)
    setRemoveError(null)
    try {
      await api.removePortfolioEntry(entryId)
      onRemoved()
    } catch (err) {
      setRemoveError(err)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Card className="p-0">
      {/* Başlık şeridi hafif marka zemini taşır: bölümün "kapağı" olduğu bir bakışta
          anlaşılsın. Sayı rozeti başlığın yanında — kaç konu olduğu kaydırmadan görünür. */}
      <View className="flex-row flex-wrap items-center justify-between gap-3 rounded-t-2xl bg-brand-50 px-4 py-3">
        <View className="min-w-0 shrink">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-semibold text-slate-900">{title}</Text>
            <Badge tone={tone}>{String(entries.length)}</Badge>
          </View>
          <Text className="mt-0.5 text-xs text-slate-600">{aciklama}</Text>
        </View>
        <Button variant="secondary" onPress={onAdd}>
          + Konu ekle
        </Button>
      </View>

      {removeError && (
        <View className="px-4 pt-3">
          <ErrorBox error={removeError} />
        </View>
      )}

      {entries.length === 0 ? (
        <View className="m-4 items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10">
          <Text className="font-medium text-slate-700">Liste boş</Text>
          <Text className="mt-1 text-center text-sm text-slate-600">{emptyText}</Text>
        </View>
      ) : (
        <View className="px-2 py-2">
          {entries.map((entry) => (
            <View
              key={entry.entryId}
              className="flex-row items-start justify-between gap-3 rounded-xl px-2 py-3"
            >
              <View className="min-w-0 shrink">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="shrink font-medium text-slate-800">{entry.topicName}</Text>
                  <Badge tone={tone}>Seviye {entry.selfAssessedLevel}/5</Badge>
                </View>
                <Text className="mt-0.5 text-xs text-slate-600">
                  {entry.categoryName} · {entry.subjectName}
                </Text>
                {entry.note ? <Text className="mt-2 text-sm text-slate-600">{entry.note}</Text> : null}
              </View>

              <Button
                variant="ghost"
                loading={removingId === entry.entryId}
                onPress={() => remove(entry.entryId)}
              >
                Kaldır
              </Button>
            </View>
          ))}
        </View>
      )}
    </Card>
  )
}

/*
  İKİ AŞAMALI EKLEME — web'deki AddEntryModal. 1. aşama KonuSecici, 2. aşama detay.
  Seçilen konu özet olarak durur ve "Değiştir" ile 1. aşamaya dönülür.
*/
function KonuEkleAkisi({ direction, konular, konularYukleniyor, onClose, onSaved }) {
  const [secilenKonu, setSecilenKonu] = useState(null)
  const [level, setLevel] = useState(3)
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const isOffer = direction === 'Offer'
  const acik = Boolean(direction)

  function kapat() {
    setSecilenKonu(null)
    setLevel(3)
    setNote('')
    setError(null)
    onClose()
  }

  async function onSubmit() {
    if (busy || !secilenKonu) return
    setBusy(true)
    setError(null)
    try {
      await api.addPortfolioEntry({
        topicId: secilenKonu.topicId,
        direction,
        selfAssessedLevel: Number(level),
        note: note.trim() || null,
      })
      const yon = direction
      setSecilenKonu(null)
      setNote('')
      setLevel(3)
      onSaved(yon)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  // 1. AŞAMA — konu seçimi
  if (acik && !secilenKonu) {
    return (
      <KonuSecici
        open
        konular={konular}
        yukleniyor={konularYukleniyor}
        baslik={isOffer ? 'Verebileceğim konu ekle' : 'Almak istediğim konu ekle'}
        onClose={kapat}
        onSelect={setSecilenKonu}
      />
    )
  }

  // 2. AŞAMA — detaylar
  return (
    <Modal
      open={acik}
      onClose={kapat}
      title={isOffer ? 'Verebileceğim konu ekle' : 'Almak istediğim konu ekle'}
      footer={
        <>
          <Button variant="secondary" onPress={kapat}>
            Vazgeç
          </Button>
          <Button loading={busy} disabled={busy || !secilenKonu} onPress={onSubmit}>
            Ekle
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <View className="flex-row items-start justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
          <View className="min-w-0 shrink">
            <Text numberOfLines={1} className="text-sm font-semibold text-brand-900">
              {secilenKonu?.topic}
            </Text>
            <Text className="mt-0.5 text-xs text-brand-800">
              {secilenKonu?.rootCategory} · {secilenKonu?.category} · {secilenKonu?.subject}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSecilenKonu(null)}
            hitSlop={10}
            className="min-h-[32px] justify-center"
          >
            <Text className="text-xs font-medium text-brand-700 underline">Değiştir</Text>
          </Pressable>
        </View>

        <Field
          label={isOffer ? 'Bu konudaki seviyen' : 'Mevcut seviyen'}
          hint={
            isOffer
              ? 'Öz değerlendirme. Eşleşme sıralamasında dikkate alınır.'
              : 'Anlatacak kişiye nereden başlayacağını gösterir.'
          }
        >
          <View className="flex-row gap-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const aktif = Number(level) === n
              return (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: aktif }}
                  accessibilityLabel={`Seviye ${n}`}
                  onPress={() => setLevel(n)}
                  className={`min-h-[44px] flex-1 items-center justify-center rounded-lg border
                              ${aktif ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
                >
                  <Text className={`text-sm font-medium ${aktif ? 'text-brand-800' : 'text-slate-600'}`}>
                    {n}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <Text className="mt-1 text-center text-sm font-medium text-slate-700">{level} / 5</Text>
        </Field>

        {/* İpucu yöne göre değişir (web kararı): not alanının işi karşı tarafa bir
            beklenti iletmek; beklenti de yöne göre değişir. */}
        <Field
          label="Not (opsiyonel)"
          hint={
            isOffer
              ? 'Örn: Temelden başlayıp soru çözümüyle ilerliyorum.'
              : 'Örn: Bu konunun formüllerinde zorlanıyorum, bol soru çözümü istiyorum.'
          }
        >
          <Girdi
            value={note}
            onChangeText={setNote}
            maxLength={500}
            placeholder={
              isOffer
                ? 'Temelden başlayıp soru çözümüyle ilerliyorum.'
                : 'Bu konunun formüllerinde zorlanıyorum, bol soru çözümü istiyorum.'
            }
          />
        </Field>

        <ErrorBox error={error} />
      </View>
    </Modal>
  )
}
