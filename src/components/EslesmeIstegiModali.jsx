import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { api } from '../lib/api'
import { Button, ErrorBox, Modal } from './ui'

/*
  EŞLEŞME İSTEĞİ — web'deki RequestModal'ın portu, alt sayfa (bottom sheet) olarak.

  Web'deki iki <select> mobilde SEÇİM SATIRLARINA döndü: RN'de yerel select yok ve
  seçenek sayısı az (kişinin anlatabildikleri + takas kesişimi) — hepsini açık liste
  olarak basmak, gizli bir açılır listeden daha az dokunuş ve daha görünür.

  İş kuralları web'den aynen:
  • requestedTopicId ZORUNLU — istek bir konu üzerinedir.
  • offeredTopicId OPSİYONEL ve yalnızca karşı tarafın öğrenmek istedikleri ile benim
    verebildiklerimin KESİŞİMİNDEN seçilebilir (geçerli takas teklifi).
  • Teklifsiz göndermek sorun değil — ders almak ücretsiz (iş kuralı 1); ipucu metni
    bunu açıkça söylüyor.
*/

/** Tek seçim satırı: radyo işareti + etiket. 44px dokunma hedefi. */
function SecimSatiri({ secili, onPress, children }) {
  return (
    <Pressable
      accessibilityRole="radio"
      // radio rolünün doğru durumu 'checked' — 'selected' TalkBack'te okunmuyordu.
      accessibilityState={{ checked: secili }}
      onPress={onPress}
      className={`min-h-[44px] flex-row items-center gap-3 rounded-lg border px-3 py-2
                  ${secili ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2
                    ${secili ? 'border-brand-600' : 'border-slate-300'}`}
      >
        {secili && <View className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
      </View>
      <Text className={`flex-1 text-sm ${secili ? 'font-medium text-brand-800' : 'text-slate-700'}`}>
        {children}
      </Text>
    </Pressable>
  )
}

export function EslesmeIstegiModali({ person, myOffers, onClose, onSent }) {
  const [requestedTopicId, setRequestedTopicId] = useState(null)
  const [offeredTopicId, setOfferedTopicId] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  /*
    Kapanış animasyonu için SON KİŞİ tutulur: person kapatmada anında null oluyor ve
    alt sayfa aşağı kayarken içerik {person && …} guard'ıyla yok olup boş beyaz bir
    kutu kalıyordu. Animasyon süresince son kişi çizilmeye devam eder; görünürlüğü
    zaten Modal'ın open'ı yönetiyor.
  */
  const [sonKisi, setSonKisi] = useState(null)
  useEffect(() => {
    if (person) setSonKisi(person)
  }, [person])
  const gosterilen = person ?? sonKisi

  // Hedef değişince form sıfırlanır — web'de aynı iş `key` ile yapılıyordu: önceki
  // kişinin seçimi/hatası yeni kişide görünmesin.
  useEffect(() => {
    setRequestedTopicId(null)
    setOfferedTopicId(null)
    setError(null)
  }, [person?.userId])

  // Karşı tarafın öğrenmek istedikleri ∩ benim verebildiklerim = geçerli takas teklifi.
  const wantedTopicIds = new Set((gosterilen?.theyWantToLearn ?? []).map((t) => t.topicId))
  const tradeableOffers = (myOffers ?? []).filter((o) => wantedTopicIds.has(o.topicId))

  async function submit() {
    if (busy || !person) return
    setBusy(true)
    setError(null)
    try {
      await api.createMatch({
        responderUserId: person.userId,
        requestedTopicId,
        offeredTopicId: offeredTopicId || null,
      })
      onSent(person.displayName)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={Boolean(person)}
      onClose={onClose}
      title="Eşleşme isteği"
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Vazgeç
          </Button>
          <Button onPress={submit} loading={busy} disabled={!requestedTopicId}>
            İsteği gönder
          </Button>
        </>
      }
    >
      {gosterilen && (
        <View className="gap-5 pb-2">
          <View className="gap-2">
            <Text className="text-sm font-medium text-slate-700">
              {gosterilen.displayName} kişisinden almak istediğin konu
            </Text>
            {gosterilen.theyCanTeach.map((topic) => (
              <SecimSatiri
                key={topic.topicId}
                secili={requestedTopicId === topic.topicId}
                onPress={() => setRequestedTopicId(topic.topicId)}
              >
                {topic.topicName} ({topic.subjectName})
              </SecimSatiri>
            ))}
          </View>

          <View className="gap-2">
            <Text className="text-sm font-medium text-slate-700">
              Karşılığında anlatmayı önerdiğin konu (opsiyonel)
            </Text>

            <SecimSatiri secili={offeredTopicId === null} onPress={() => setOfferedTopicId(null)}>
              Teklif yok — yalnızca ders almak istiyorum
            </SecimSatiri>
            {tradeableOffers.map((offer) => (
              <SecimSatiri
                key={offer.entryId}
                secili={offeredTopicId === offer.topicId}
                onPress={() => setOfferedTopicId(offer.topicId)}
              >
                {offer.topicName} ({offer.subjectName})
              </SecimSatiri>
            ))}

            <Text className="text-xs text-slate-500">
              {tradeableOffers.length > 0
                ? 'Takas teklifi isteğin kabul edilme ihtimalini artırır.'
                : 'Karşı tarafın aradığı konulardan birini verebiliyorsan burada görünür. Boş bırakman da sorun değil — ders almak ücretsiz.'}
            </Text>
          </View>

          <ErrorBox error={error} />
        </View>
      )}
    </Modal>
  )
}
