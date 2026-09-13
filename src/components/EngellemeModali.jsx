import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { api } from '../lib/api'
import { engelDegisti } from '../lib/engelSurumu'
import { Button, ErrorBox, Field, Girdi, Modal, Notice } from './ui'

/*
  ENGELLEME ONAYI — web components/EngellemeModali.jsx'in portu.

  NEDEN ONAY SORULUYOR: engelleme yalnızca bir satır yazmıyor, bekleyen istekleri de
  kapatıyor (BlockUserHandler) ve engel kaldırılsa bile o istekler geri gelmiyor — tek
  dokunuşla geri alınabilir bir işlem DEĞİL. Aşağıdaki liste bunu açıkça yazıyor; "emin
  misin" diye sormak, ne olacağını söylemeden onay almak olurdu. Engeli KALDIRMAK ise onay
  sormuyor: eski hâle dönüyor ve yanlışsa aynı yerden geri alınıyor. Asimetri bilinçli.

  ŞİKAYET YOLU NEDEN BURADA HATIRLATILIYOR: engelleme kişisel bir tercih — kimseye
  bildirilmiyor, denetim izi tutulmuyor, yönetimin haberi olmuyor. Taciz varsa engellemek
  YETMEZ; iki kavram karışırsa kullanıcı "hallettim" sanır, yönetim hiçbir şey görmez.
  Metin web'le birebir: değişecekse önce web'de değişmeli, yoksa iki istemci ayrışır.

  TEK KOPYA: Keşfet kartları ve başkasının profili aynı bileşeni kullanıyor. İki yerde
  ayrı yazılsaydı metin er ya da geç ayrışır, bir yol sonucu eksik anlatan bir onay
  gösterirdi.

  MOBİL FARKI: web kipi her açılışta yeniden monte ederek (key) sıfırlıyor. RN Modal'ı
  söküp takmak kayma animasyonunu keserdi; bu yüzden form AÇILIŞTA sıfırlanıyor ve kapanış
  animasyonu boyunca son kişi gösterilmeye devam ediyor (SohbetIstegiModali'deki `sonKisi`
  kalıbı).
*/

const MADDELER = [
  'Birbirinize istek gönderemezsiniz.',
  'Bekleyen istekleriniz kapanır ve engeli kaldırsan da geri gelmez.',
  'Birbirinizin arama sonuçlarında görünmezsiniz.',
  'Karşı tarafa bildirilmez.',
]

/**
 * @param kisi          `{ userId, displayName }` — engellenecek kişi. null ise kip kapalı.
 * @param onEngellendi  Başarıdan sonra çağrılır, tek argüman görünen ad.
 */
export function EngellemeModali({ kisi, onClose, onEngellendi }) {
  const [not, setNot] = useState('')
  const [hata, setHata] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sonKisi, setSonKisi] = useState(null)

  /* Bağımlılık userId değil NESNE: profil ekranı aynı kişiyi yeniden açtığında userId
     değişmiyor ama null → nesne geçişi var. userId'ye bağlansaydı vazgeçilen not ve eski
     hata bir sonraki açılışta geri gelirdi. */
  useEffect(() => {
    if (kisi) {
      setSonKisi(kisi)
      setNot('')
      setHata(null)
    }
  }, [kisi])
  const gosterilen = kisi ?? sonKisi

  async function engelle() {
    if (busy || !kisi) return
    setBusy(true)
    setHata(null)
    try {
      await api.blockUser(kisi.userId, not.trim() || null)
      // Kurulu kalan Keşfet odakta tazelensin (bkz. lib/engelSurumu).
      engelDegisti()
      onEngellendi(kisi.displayName)
    } catch (err) {
      setHata(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={Boolean(kisi)}
      onClose={onClose}
      title="Kişiyi engelle"
      footer={
        <>
          {/* HATA DÜĞMELERİN ÜSTÜNDE, kaydırma alanının sonunda DEĞİL: 360x640 ve altında
              içerik kaydırılıyor ve Engelle'ye basınca oluşan hata görünmeyen yere
              düşüyordu. Footer satırı flex-wrap: tam genişlik kutu düğmeleri alta iter. */}
          {hata ? (
            <View className="w-full">
              <ErrorBox error={hata} />
            </View>
          ) : null}
          <Button variant="secondary" onPress={onClose}>
            Vazgeç
          </Button>
          <Button variant="danger" loading={busy} onPress={engelle}>
            Engelle
          </Button>
        </>
      }
    >
      {gosterilen && (
        <View className="gap-3 pb-2">
          <Text className="text-sm text-slate-700">
            <Text className="font-semibold text-slate-900">{gosterilen.displayName}</Text> engellenecek.
          </Text>

          <View className="gap-1">
            {MADDELER.map((madde) => (
              <View key={madde} className="flex-row gap-2">
                {/* Nokta metinle AYNI punto ve satır yüksekliğinde: text-xs iken satırın
                    ~3 px üstünde duruyordu. */}
                <Text className="text-sm leading-relaxed text-slate-400">•</Text>
                <Text className="flex-1 text-sm leading-relaxed text-slate-600">{madde}</Text>
              </View>
            ))}
          </View>

          {/* UYARI NOTUN ÜSTÜNDE: not isteğe bağlı, uyarı değil. Eskiden en sondaydı ve 320x568'de
              ilk görünümde yalnızca üst kenarı seçiliyordu — taciz yaşayan kullanıcının
              okuması gereken tek cümle kaydırmanın arkasında kalıyordu.
              Web'in amber kutusu yerine ui.jsx'teki uyarı yüzeyi: aynı ton, yeni yüzey
              icat edilmiyor; punto 14 küçük ekranda daha okunur. */}
          <Notice tone="warning">
            Taciz ya da kural ihlali varsa engellemek yetmez — dersin sayfasından şikayet et ki
            yönetimin haberi olsun.
          </Notice>

          {/* Not SUNUCUDA da yalnızca engelleyene dönüyor (GetMyBlocksHandler); karşı
              taraf ne engellendiğini ne de not yazıldığını görüyor. */}
          <Field
            label="Kendine not (isteğe bağlı)"
            hint="Yalnızca sen görürsün. Neden engellediğini sonra hatırlamak için."
          >
            {/* ÇOK SATIRLI: 500 karakter kabul eden tek satırlık kutuda ~78 karakterden sonra
                yazılan notun başı görünmüyordu. */}
            <Girdi
              value={not}
              onChangeText={setNot}
              maxLength={500}
              multiline
              textAlignVertical="top"
              className="h-20"
              placeholder="Örn. tanımıyorum"
            />
          </Field>
        </View>
      )}
    </Modal>
  )
}
