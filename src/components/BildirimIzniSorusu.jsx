import { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { KANALLAR } from '../lib/bildirimler'
import { useBildirim } from '../state/BildirimSaglayici'
import { Button, Card, Modal } from './ui'

/*
  BİLDİRİM AYDINLATMASI VE İZİN SORUSU — iki biçim, tek metin:
  • BildirimIzniModali: kök layout'ta TEK örnek. Bir eylemden sonra (istek gönderildi,
    istek kabul edildi) kendiliğinden ya da Bildirim ayarları'ndan elle açılır. Durumu
    BildirimSaglayici'de (soru), çünkü aynı soru hem modal hem kart olarak sorulabiliyor
    ve oturum başına tek yüzey kuralı iki biçimi birlikte görmeli.
  • BildirimIzniKarti: ekranın İÇİNDE, satır içi. Modal yazmayı keserdi (sohbette ilk
    mesajdan sonra) ya da not alınması gereken bir bilgiyi örterdi (rezervasyondaki
    doğrulama kodu); oralarda soru kart olarak duruyor.

  BU BİR ONAY KUTUSU DEĞİL, AYDINLATMA: KVKK Aydınlatma Tebliği m.5/1(b) gereği veri akışı
  (Firebase/APNs token'ı, Expo, dersmate sunucusu) BAŞLAMADAN ne olacağı anlatılıyor.
  "Aç/Devam"dan önce hiçbir token alınmıyor; sunucu da aydınlatma damgası olmadan cihaz
  kaydını kabul etmiyor. Metin bu yüzden kısaltılamaz: dört olay türü, taşıyıcılar ve
  bildirimde NE OLDUĞU ve OLMADIĞI (mesaj içeriği yok; ad yalnızca mesaj ve kabul
  bildiriminde) burada söylenmeli.

  iOS'TA TEK DÜĞME ("Devam") VE KAPATILAMAZ — yalnızca sistem istemi henüz hiç
  görülmemişse (izin belirsiz). Apple'ın izin öncesi ekran kuralı: kendi ekranımızda
  "Şimdi değil" sunup sistem istemini hiç göstermemek, kararı kullanıcıdan saklamak
  sayılıyor. Karar SİSTEM İSTEMİNDE veriliyor; metin bunu da söylüyor. Android'de ve
  sistem isteminin gelmeyeceği durumlarda (izin zaten açık) "Şimdi değil" duruyor.
*/

/* Soruyu doğuran an → açılış cümlesi. Kimse "neden şimdi?" diye sormasın: cümle az önce
   yapılan eylemle bağlanıyor. Bilinmeyen sebep genel cümleye düşer. */
const SEBEPLER = {
  'istek-gonderildi': 'İsteğin kabul edilince haber verelim mi?',
  'istek-kabul': 'Arkadaşın yazınca ya da ders planlanınca haber verelim mi?',
  'ilk-mesaj': 'Yanıt gelince haber verelim mi?',
  rezervasyon: 'Ders yaklaşınca ve onay beklerken haber verelim mi?',
  'gelen-istek': 'Yeni istekleri kaçırmamak için bildirimleri açabilirsin.',
  ayarlar: 'Bildirimleri açınca şu durumlarda haber veririz.',
}
const VARSAYILAN_SEBEP = 'Önemli bir şey olunca haber verelim mi?'

/* Taşıyıcılar ve yükün sınırı — modal, kart ve Bildirim ayarları ekranı (app/bildirimler.jsx
   → Bilgi) AYNI cümleyi kullanıyor; gizlilik §6 aynı olguyu uzun anlatıyor. Metin sunucunun
   gerçek davranışını anlatıyor: mesaj içeriği hiçbir koşulda push'a girmiyor; kişi adı
   yalnızca mesaj ve kabul bildiriminde, o da alıcının kendi arkadaşının adı.

   ⚠️ 2026-09-25'e kadar ikinci cümle "istek ve ders bildirimlerinde kimsenin adı geçmez"
   diyordu. YANLIŞTI: "Arkadaş isteğin kabul edildi" de bir istek bildirimi (aynı
   `istekler` kanalı, KANALLAR'daki açıklama "Yeni istek, kabul ve …") ve gövdesinde kabul
   edenin adı var (sunucu BildirimMetni.IstekKabul). Mesaj bildirimindeki ad da hiç
   söylenmiyordu. Aydınlatma, veri akışından ÖNCE gösterilen tek metin; olguyu eksik
   söyleyemez. */
export const TASIYICI_METNI =
  'Bildirimler Expo, Google ve Apple sunucuları üzerinden iletilir. Bildirimlerde mesaj içeriği yer almaz. Kişi adı yalnızca yeni mesaj ve kabul edilen istek bildiriminde, arkadaşının görünen adı olarak geçer; diğer istek ve ders bildirimlerinde ad geçmez.'

/** Sistem istemi bu dokunuşun ARDINDAN gelecek mi (iOS, hiç sorulmamış)? */
function sistemIstemiGelecek(izin) {
  return Platform.OS === 'ios' && Boolean(izin?.belirsiz)
}

/*
  GİZLİLİK BAĞLANTISI — IzinSayfasi'nin okuma kipiyle AYNI sorun ve AYNI çözüm: RN Modal
  ayrı bir yerel pencere, altına itilen /gizlilik modalın ARKASINDA kalır ve bağlantı ölü
  görünür. Modal bu yüzden metin okunurken GİZLENİYOR (kapatılmıyor: iOS'ta kapatılamaz
  kipte tek çıkış bu bağlantı olurdu) ve kullanıcı dönünce kendiliğinden geri geliyor.
  "Hedefe bir kez ulaşılmadan sıfırlama yok" kuralının gerekçesi IzinSayfasi.jsx'te.
*/
function useOkumaKipi() {
  const router = useRouter()
  const pathname = usePathname()
  const [hedef, setHedef] = useState(null)
  const ulasti = useRef(false)

  useEffect(() => {
    if (!hedef) return
    if (pathname === hedef) {
      ulasti.current = true
      return
    }
    if (ulasti.current) {
      ulasti.current = false
      setHedef(null)
    }
  }, [pathname, hedef])

  function oku(yol) {
    setHedef(yol)
    router.push(yol)
  }

  return { okunuyor: Boolean(hedef), oku }
}

function GizlilikBaglantisi({ onPress }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} className="min-h-[44px] justify-center self-start">
      <Text className="text-sm font-medium text-brand-700">Gizlilik metnini oku</Text>
    </Pressable>
  )
}

/**
 * Kök modal — app/_layout.jsx'te BildirimSaglayici'nin içinde bir kez çizilir. Açma ve
 * kapama kararları sağlayıcıda (soruGoster / soruAc / soruKapat).
 */
export function BildirimIzniModali() {
  const { soru, izin, soruKapat, soruGosterildi, aydinlatmayiOnayla } = useBildirim()
  const { okunuyor, oku } = useOkumaKipi()
  const [mesgul, setMesgul] = useState(false)

  /*
    Kapanış animasyonunda içerik ve düğmeler DEĞİŞMESİN: "Devam"dan 350 ms sonra sistem
    istemi izni değiştiriyor ve modal hâlâ aşağı süzülürken düğme biçimi dönerse sayfa
    bir an zıplardı. Biçim açılışta sabitleniyor — render sırasında (React'in "prop
    değişince durumu ayarla" kalıbı), efektte değil: efekt bir kare geç kalır ve iOS'ta
    tek düğmeli sayfa ilk karede iki düğmeli çizilirdi.
  */
  const [bicim, setBicim] = useState({ tekDugme: false, izinAcik: false })
  const [acikti, setAcikti] = useState(false)
  if (soru.acik !== acikti) {
    setAcikti(soru.acik)
    if (soru.acik) setBicim({ tekDugme: sistemIstemiGelecek(izin), izinAcik: Boolean(izin?.verildi) })
  }

  async function ac() {
    if (mesgul) return
    setMesgul(true)
    try {
      await aydinlatmayiOnayla({ modalKapat: true })
    } finally {
      setMesgul(false)
    }
  }

  const elle = soru.kip === 'elle'

  return (
    <Modal
      open={soru.acik && !okunuyor}
      title="Bildirimler"
      onShow={soruGosterildi}
      // Kapatmanın her yolu (✕, karartma, geri tuşu) soruKapat'a gider ve kendiliğinden
      // açılmış soruda erteleme sayılır.
      onClose={soruKapat}
      kapatilabilir={!bicim.tekDugme}
      footer={
        bicim.tekDugme ? (
          <Button onPress={ac} loading={mesgul}>
            Devam
          </Button>
        ) : (
          <>
            <Button variant="secondary" onPress={soruKapat} disabled={mesgul}>
              {elle ? 'Vazgeç' : 'Şimdi değil'}
            </Button>
            <Button onPress={ac} loading={mesgul}>
              Bildirimleri aç
            </Button>
          </>
        )
      }
    >
      <View className="gap-4 pb-2">
        <Text className="text-base font-semibold text-slate-900">
          {SEBEPLER[soru.sebep] ?? VARSAYILAN_SEBEP}
        </Text>

        {/* Dört olay türü — ayarlar ekranındaki dört anahtarla ve Android'in dört
            kanalıyla AYNI liste (tek kaynak KANALLAR). */}
        <View className="gap-2">
          <Text className="text-sm text-slate-700">Şu durumlarda bildirim gönderebiliriz:</Text>
          {KANALLAR.map((k) => (
            <View key={k.kimlik} className="flex-row items-start gap-2">
              <View className="mt-[7px] h-1.5 w-1.5 rounded-full bg-brand-500" />
              <Text className="flex-1 text-sm leading-relaxed text-slate-600">
                <Text className="font-semibold text-slate-800">{k.ad}:</Text> {k.aciklama}
              </Text>
            </View>
          ))}
        </View>

        <Text className="text-sm leading-relaxed text-slate-600">{TASIYICI_METNI}</Text>

        <Text className="text-sm leading-relaxed text-slate-600">
          Gece 22.00–09.00 arasında acil olmayan bildirimler sabaha kalır. Hangilerini
          alacağını sonra Profil › Bildirim ayarları'ndan değiştirebilirsin.
        </Text>

        {bicim.tekDugme ? (
          <Text className="text-sm leading-relaxed text-slate-700">
            Devam'a basınca telefonunun izin sorusu açılır; kararını orada verirsin.
          </Text>
        ) : bicim.izinAcik ? (
          /* Android 7-12: işletim sistemi izni kurulumla açık geliyor. Kullanıcı "zaten
             açıkmış" sanmasın — bu cihaz, o onaylamadan bildirime kaydedilmiyor. */
          <Text className="text-sm leading-relaxed text-slate-700">
            Telefonunda bildirim izni açık görünüyor; yine de sen onaylamadan bu cihazı
            bildirimlere kaydetmiyoruz.
          </Text>
        ) : null}

        <GizlilikBaglantisi onPress={() => oku('/gizlilik')} />
      </View>
    </Modal>
  )
}

/**
 * Satır içi aydınlatma kartı — ekranın akışında durur, hiçbir şeyi örtmez.
 *
 * Görünürlük tamamen sağlayıcıda (kartGorunur): ihtiyaç, geri çekilme, izin sayfası ve
 * tur, ve OTURUM BAŞINA TEK YÜZEY — bu oturumda modal ya da başka bir ekranın kartı
 * sorduysa kart çizilmez. İlk görünen kart yüzeyi sahiplenir ve o ekranda durmayı sürdürür.
 *
 * "Gizle" her zaman erteleme sayılır: kart kendiliğinden çıkıyor, kullanıcı istemedi.
 *
 * @param kimlik Kartın yeri ('ilk-mesaj', 'rezervasyon', 'gelen-istek' …) — sahiplenme
 *   bununla yapılıyor. @param sebep açılış cümlesi (verilmezse kimlik).
 * @param className kartın kendi kenar boşluğu. Boşluk çağıranın sarmalayıcısına değil
 *   BURAYA verilir: kart gerekmeyince null dönüyor ve dıştaki dolgulu bir View ekranda
 *   boş bir aralık olarak kalırdı.
 */
export function BildirimIzniKarti({ kimlik, sebep = kimlik, className = '' }) {
  const { izin, kartGorunur, kartiSahiplen, ertele, aydinlatmayiOnayla } = useBildirim()
  const router = useRouter()
  const [mesgul, setMesgul] = useState(false)
  const gorunur = kartGorunur(kimlik)

  useEffect(() => {
    if (gorunur) kartiSahiplen(kimlik)
  }, [gorunur, kimlik, kartiSahiplen])

  if (!gorunur) return null

  async function ac() {
    if (mesgul) return
    setMesgul(true)
    try {
      await aydinlatmayiOnayla()
    } finally {
      setMesgul(false)
    }
  }

  const tekDugme = sistemIstemiGelecek(izin)

  return (
    <Card dolgu="p-4" className={className}>
      <Text className="text-sm font-semibold text-slate-900">{SEBEPLER[sebep] ?? VARSAYILAN_SEBEP}</Text>
      <Text className="mt-1 text-xs leading-relaxed text-slate-600">
        Mesaj, arkadaş isteği, ders onayı ve ders hatırlatması için bildirim gönderebiliriz.{' '}
        {TASIYICI_METNI}
      </Text>
      {tekDugme ? (
        <Text className="mt-1 text-xs leading-relaxed text-slate-600">
          Devam'a basınca telefonunun izin sorusu açılır.
        </Text>
      ) : null}

      {/* Kart bir Modal değil: /gizlilik doğrudan itilebilir, dönünce kart yerinde. */}
      <GizlilikBaglantisi onPress={() => router.push('/gizlilik')} />

      <View className="flex-row flex-wrap justify-end gap-2">
        <Button variant="secondary" onPress={ertele} disabled={mesgul}>
          Gizle
        </Button>
        <Button onPress={ac} loading={mesgul}>
          {tekDugme ? 'Devam' : 'Bildirimleri aç'}
        </Button>
      </View>
    </Card>
  )
}
