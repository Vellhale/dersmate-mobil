import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { api } from '../lib/api'
import { ILISKI } from '../lib/iliski'
import { Button, ErrorBox, Modal } from './ui'

/*
  ARKADAŞ İSTEĞİ — web'deki RequestModal'ın portu, alt sayfa (bottom sheet) olarak.
  Dosya ve bileşen adı bilerek eski (web de RequestModal adını tuttu, #31).

  Web'deki iki <select> mobilde SEÇİM SATIRLARINA döndü: RN'de yerel select yok ve
  seçenek sayısı az (kişinin anlatabildikleri + takas kesişimi) — hepsini açık liste
  olarak basmak, gizli bir açılır listeden daha az dokunuş ve daha görünür.

  İş kuralları web'den aynen:
  • requestedTopicId ZORUNLU — istek bir konu üzerinedir.
  • offeredTopicId OPSİYONEL ve yalnızca karşı tarafın öğrenmek istedikleri ile benim
    verebildiklerimin KESİŞİMİNDEN seçilebilir (geçerli takas teklifi).
  • Teklifsiz göndermek sorun değil — ders almak ücretsiz (iş kuralı 1); ipucu metni
    bunu açıkça söylüyor.

  KONU DURUMU (opsiyonel `konuDurumu`, bkz. lib/iliski.js → konuHaritasi): arkadaşlığı
  süren ya da isteği bekleyen konu satırı PASİF ve nedenini yanında söylüyor. Satır
  listeden SİLİNMİYOR: kişinin anlattığı konu kaybolsa kullanıcı onu kartta görüp burada
  arardı. Pasifleştirme konu başına, kişi başına değil: Türev'de arkadaş olunan kişiden
  Limit istemek geçerli bir istek. Seçilebilir tek konu kaldıysa önceden seçili geliyor.

  KİŞİ İLİŞKİSİ (opsiyonel `kisiIliskisi`, bkz. lib/iliski.js → iliskiHaritasi): yalnızca
  isteğin SONUCUNU anlatan cümle için. Zaten arkadaş olunan kişiye "arkadaş olursunuz"
  denmez; ilişki bilinmiyorsa (yükleniyor ya da hata) da denmez — olumlu bir iddia bilgi ister.
*/

/**
 * Tek seçim satırı: radyo işareti + etiket. 44px dokunma hedefi.
 * `pasif` satır basılamıyor; `ek` nedenini etiketin sonuna yazıyor. Neden METİNDE, yalnızca
 * soluk renkte değil: renk farkı ekran okuyucuya ve renk ayırt edemeyene hiçbir şey demez.
 */
function SecimSatiri({ secili, pasif = false, ek = null, onPress, children }) {
  return (
    <Pressable
      accessibilityRole="radio"
      // radio rolünün doğru durumu 'checked' — 'selected' TalkBack'te okunmuyordu.
      // accessibilityState DEĞİL aria-checked: RN Web 0.21 accessibilityState'i DOM'a hiç
      // yazmıyor (önizlemede ölçüldü, seçili satırda aria-checked yoktu). aria-* iki platformda
      // da okunuyor; pasif durumu `disabled` hem aria-disabled'a hem erişim durumuna yazıyor.
      aria-checked={pasif ? false : secili}
      disabled={pasif}
      onPress={onPress}
      className={`min-h-[44px] flex-row items-center gap-3 rounded-lg border px-3 py-2
                  ${pasif ? 'border-slate-200 bg-slate-50' : secili ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2
                    ${secili ? 'border-brand-600' : 'border-slate-300'}`}
      >
        {secili && <View className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
      </View>
      <Text
        className={`flex-1 text-sm ${pasif ? 'text-slate-500' : secili ? 'font-medium text-brand-800' : 'text-slate-700'}`}
      >
        {children}
        {pasif && ek ? ` — ${ek}` : null}
      </Text>
    </Pressable>
  )
}

export function EslesmeIstegiModali({ person, myOffers, konuDurumu, kisiIliskisi, onClose, onSent }) {
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
  // Seçilebilir TEK konu kaldıysa o seçili gelir: soru yok, cevabı zaten belli. Yalnızca
  // hedef değişince koşuyor, konuDurumu bağımlılık DEĞİL: sayfa açıkken gelen odak
  // tazelemesi kullanıcının yaptığı seçimi ezmesin.
  // KAPANIŞTA SIFIRLAMA YOK: person null olunca userId de değişiyor ve efekt koşuyor.
  // Seçim silinseydi, sayfa aşağı kayarken footer'a "konuyu seç" ipucu geri gelir, sayfa bir
  // satır yukarı sıçrar ve az önce gönderilen istek pasif düğmeyle kapanırdı (sonKisi ile
  // aynı kusur sınıfı). Yeniden açılışta userId undefined → id değiştiği için form yine sıfırlanır.
  useEffect(() => {
    if (!person) return
    const secilebilir = (person.theyCanTeach ?? []).filter((t) => !konuDurumu?.(person.userId, t.topicId))
    setRequestedTopicId(secilebilir.length === 1 ? secilebilir[0].topicId : null)
    setOfferedTopicId(null)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.userId])

  // Karşı tarafın öğrenmek istedikleri ∩ benim verebildiklerim = geçerli takas teklifi.
  const wantedTopicIds = new Set((gosterilen?.theyWantToLearn ?? []).map((t) => t.topicId))
  const tradeableOffers = (myOffers ?? []).filter((o) => wantedTopicIds.has(o.topicId))

  // `gosterilen`dan okunuyor, person'dan değil: kapanış animasyonunda cümle değişip sayfa
  // yüksekliği oynamasın. `kisiIliskisi` yoksa ilişki bilinmiyor → arkadaş DEĞİL sayılmaz.
  const arkadasDegil =
    Boolean(gosterilen && kisiIliskisi) && kisiIliskisi(gosterilen.userId)?.durum !== ILISKI.arkadas

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
      // Konu da dönüyor: çağıran dokunulan kartı o konu için "istek bekliyor"a çeviriyor.
      onSent(person.displayName, requestedTopicId)
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
      title="Arkadaş isteği"
      footer={
        <>
          {/*
            PASİF DÜĞME NEDENİNİ SÖYLER: "İsteği gönder" konu seçilmeden basılamıyor ve
            basınca hiçbir yanıt vermiyordu; kullanıcı neyin eksik olduğunu tahmin etmek
            zorundaydı. `w-full` sarmalayıcıyı footer'ın (flex-row flex-wrap) kendi satırına indirir.

            CANLI BÖLGE VIEW'DA, TEXT'TE DEĞİL — iki tuzak var (RN 0.86):
            • Text `aria-live`ı native'de ÇÖZMÜYOR: Text.js yalnızca busy/checked/disabled/
              expanded/hidden/label/selected'ı çeviriyor; native çevirici
              (AccessibilityProps.cpp) de enableNativeViewPropTransformations bayrağına bağlı ve
              bayrak varsayılan kapalı. View.js ise aria-live'ı accessibilityLiveRegion'a
              kendisi çeviriyor; RN Web DOM'a aria-live yazıyor, eski adın kullanım dışı
              uyarısı da çıkmıyor.
            • `collapsable={false}` ŞART: Fabric yalnızca yerleşim taşıyan View'u düzleştiriyor
              ve live region bu kararda sayılmıyor (ViewShadowNode.cpp → formsView). Düzleşen
              View'un canlı bölgesi native görünümle birlikte kaybolurdu.
          */}
          {!requestedTopicId && (
            <View aria-live="polite" collapsable={false} className="w-full">
              <Text className="text-right text-xs text-slate-600">
                Göndermek için almak istediğin konuyu seç.
              </Text>
            </View>
          )}
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
            {gosterilen.theyCanTeach.map((topic) => {
              const d = konuDurumu?.(gosterilen.userId, topic.topicId)
              return (
                <SecimSatiri
                  key={topic.topicId}
                  secili={requestedTopicId === topic.topicId}
                  pasif={Boolean(d)}
                  ek={d?.durum === 'aktif' ? 'Arkadaşlığınızda' : d ? 'İstek bekliyor' : null}
                  onPress={() => setRequestedTopicId(topic.topicId)}
                >
                  {topic.topicName} ({topic.subjectName})
                </SecimSatiri>
              )
            })}
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

            <Text className="text-xs text-slate-600">
              {tradeableOffers.length > 0
                ? 'Takas teklifi isteğin kabul edilme ihtimalini artırır.'
                : 'Karşı tarafın aradığı konulardan birini verebiliyorsan burada görünür. Boş bırakman da sorun değil — ders almak ücretsiz.'}
            </Text>
          </View>

          {/* İsteğin SONUCU gönderimden ÖNCE anlatılır: kullanıcı kabulden sonra ne
              olacağını bilmiyordu. Hepsi sunucu davranışı — RespondMatch kabulde HER eşleşmeye
              kendi sohbetini açıyor (arkadaşla ikinci konuda da yeni sohbet), BookSession
              yalnızca kabul edilmiş eşleşmenin konularına ders alıyor. "Arkadaş olursunuz"
              yalnızca arkadaş olmadığı BİLİNEN kişide: sunucu farklı konuda arkadaşa da istek
              kabul ediyor (MatchRequests.cs yalnızca aynı konuda bekleyeni reddediyor). */}
          <Text className="text-xs text-slate-600">
            {arkadasDegil
              ? 'Kabul edilince arkadaş olursunuz, sohbet açılır ve bu konuda ders rezerve edebilirsin.'
              : 'Kabul edilince bu konuda sohbet açılır ve ders rezerve edebilirsin.'}
          </Text>

          <ErrorBox error={error} />
        </View>
      )}
    </Modal>
  )
}
