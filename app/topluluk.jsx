import { useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../src/lib/api'
import { useAuth } from '../src/state/AuthContext'
import { amber, brand, rose, slate } from '../src/lib/theme'
import { Avatar } from '../src/components/Avatar'
import { SeviyeRozeti } from '../src/components/SeviyeRozeti'
import { BayrakIkonu, MesajIkonu, OyOkuIkonu, UyariIkonu } from '../src/components/Ikonlar'
import { YonetimRozeti } from '../src/components/YonetimRozeti'
import {
  Badge,
  Button,
  Card,
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
  ══════════════════════════════════════════════════════════════════════════════
  TOPLULUK — akran forumu. Web'deki pages/Topluluk.jsx'in portu.

  ─── SUNUCU NEYİ YAPIYOR, İSTEMCİ NEYİ ────────────────────────────────────────
  SIRALAMA, TARİH PENCERESİ VE ETİKET FİLTRESİ SUNUCUDA. İstemcide yapılsaydı
  sayfalama anlamsız olurdu: ikinci sayfayı verebilmek için tüm gönderileri indirmek
  gerekirdi. Bu yüzden her filtre değişikliği yeni bir istek.

  İSTEMCİDE KALAN TEK HESAP: oyun optimistik gösterimi. Kullanıcı oka bastığı anda sayı
  değişiyor, sunucu yanıtı gelince gerçek sayaçla düzeltiliyor, hata gelirse tıklama
  ÖNCESİ hâline dönüyor.

  ⚠️ SIRALAMA OY VERİNCE YENİLENMİYOR — bilerek. "En çok oy" listesinde bir gönderiye
  oy vermek, o kartı parmağının altından kaydırırdı. Görünen sayı hemen değişiyor,
  yalnızca SIRA sabit kalıyor; liste ancak filtre değişince, çekerek yenileyince ya da
  yeni gönderi paylaşılınca yeniden çekiliyor.

  ─── MODERASYON ARAYÜZÜ İKİNCİL DEĞİL, DÜZENİN PARÇASI ────────────────────────
  Aktif bir öğrenci forumunda spam, argo, izinsiz PDF ve trollemenin OLUP OLMAYACAĞI
  sorusu yok; ne zaman olacağı sorusu var. Önlemler akışın kendisine yerleştirildi:
    • Her gönderide ve her yorumda "Şikayet et" — tek dokunuş uzakta, ama sessiz.
    • Şikayet formu SEBEP ve YAZILI AÇIKLAMA soruyor.
    • Eşiği geçen içerik AKIŞTA PERDELENİR (silinmez): sebep + sayı yazar, "Yine de
      göster" duruyor. Sessiz silme, moderasyonu görünmez ve tartışılamaz yapar.
    • Gönderi kutusu DOSYA YÜKLEME SUNMUYOR. Telif ihlalinin bu üründeki en olası yolu
      izinsiz PDF paylaşımı; en ucuz önlem o yolu arayüzde hiç açmamak.

  ─── WEB'DEN BİLİNÇLİ SAPMALAR (mobil) ────────────────────────────────────────
  1. SAYFALAMA YOK, BİRİKEN LİSTE VAR: numaralı sayfalama başparmağa ters. Sayfalar
     FlatList onEndReached ile ekleniyor ve postId'ye göre TEKİLLEŞTİRİLİYOR — sunucu
     saf ofset sayfalıyor, üste yeni gönderi düşerse sonraki sayfa öncekinin son
     öğesini tekrar getirir.
  2. YORUM İPLİĞİ SATIR İÇİ DEĞİL, ALT SAYFADA: çok satırlı bir yazma alanı + klavye,
     FlatList satırının içinde çözülemez. Web'in "cevapladığını görmelisin" gerekçesi
     korunuyor — alt sayfanın başında gönderinin TAM gövdesi duruyor (akıştaki kart üç
     satırda kesiyor, iplikte kesmiyor).
  3. TARİH FİLTRESİ <select> DEĞİL PİL ŞERİDİ, etiketleri kısaltılmış ("Bu hafta" →
     "Hafta"); tam adı açıklama satırı yazıyor. Sıralama etiketleri de kısaltıldı:
     "En Çok Oy Alanlar" 360px'te üç düğmeyle tek satıra sığmıyor.
  4. TEK SÜTUN: web'in yan sütunundaki kurallar/önlemler kartları listenin ALTINA
     düşüyor (web de lg altında bunu yapıyordu — mobilde forumdan önce dört maddelik
     kural duvarı okutmak, kimsenin okumadığı bir duvar üretir).
  ══════════════════════════════════════════════════════════════════════════════
*/

/* ─── SUNUCU SÖZLEŞMESİ ────────────────────────────────────────────────────────

   Arayüz Türkçe anahtarlarla çalışıyor ('yeni', 'stres'), sunucu enum adlarıyla
   ('Newest', 'ExamStress'). Çeviri TEK YERDE, burada: iki tarafın da kendi doğal
   sözlüğünü kullanabilmesi için.                                                */

const SIRA_ENUM = { yeni: 'Newest', oy: 'Top', tartismali: 'Controversial' }
const ZAMAN_ENUM = { hepsi: 'All', gun: 'Day', hafta: 'Week', ay: 'Month' }
const ETIKET_ENUM = {
  stres: 'ExamStress',
  soru: 'Question',
  kaynak: 'Resource',
  program: 'StudyPlan',
  motivasyon: 'Motivation',
  tercih: 'Preference',
}
/** Ters yön: sunucudan gelen etiketi arayüz anahtarına çevirir. */
const ETIKET_ANAHTARI = Object.fromEntries(
  Object.entries(ETIKET_ENUM).map(([anahtar, enumAdi]) => [enumAdi, anahtar]),
)

/*
  ŞİKAYET SEBEBİ → SUNUCU ENUM'U. Dördü (Spam, Copyright, PersonalInfo, OffTopic) forum
  için ReportReason'a eklenmişti; öncesinde hepsi `Other`'a düşüyordu ve moderasyon
  kuyruğundaki sebep sütunu forum şikayetleri için hiçbir şey söylemiyordu.
*/
const SEBEP_ENUM = {
  spam: 'Spam',
  dil: 'Abuse',
  telif: 'Copyright',
  kisisel: 'PersonalInfo',
  konudisi: 'OffTopic',
  diger: 'Other',
}

/*
  AÇIKLAMA ALT SINIRI — SUNUCUYLA AYNI SAYI (CreateReportHandler.MinDescriptionLength).
  İstemcide daha gevşek bir sınır, kullanıcıya 12 karakter yazdırıp gönderdikten sonra
  400 gösterirdi.

  ⚠️ AÇIKLAMA HER SEBEPTE ZORUNLU: (a) sunucu ayrım yapmıyor, (b) yazılı bir cümle
  istemek brigading'i pahalılaştırıyor. Üç şikayet gönderiyi perdeliyor; tek dokunuşluk
  şikayet, o eşiği örgütlü bir susturma aracına çevirirdi.
*/
const EN_AZ_ACIKLAMA = 15

/* Gönderi ve yorum sınırları sunucudaki ForumRules ile birebir. */
const BASLIK_EN_AZ = 10
const BASLIK_EN_COK = 120
const METIN_EN_AZ = 20
const METIN_EN_COK = 2000
const YORUM_EN_AZ = 5
const YORUM_EN_COK = 1000

/* ─── SIRALAMA ─────────────────────────────────────────────────────────────── */

/*
  Sıralama ŞERİT (segment), açılır menü değil: üç seçenek var ve üçü de aynı anda
  görünüyor. Keşfet'teki sekme şeridiyle aynı bileşen dili — uygulama içinde ikinci bir
  sekme biçimi doğmuyor.

  ⚠️ ETİKETLER KISALTILDI (web: "En Yeniler / En Çok Oy Alanlar / Tartışmalı"). 360px'te
  üç düğme tek satıra sığmıyordu; yatay kaydırma seçilmedi (kaydırılabildiği görünmeyen
  bir şerit = gizli seçenek). Kısaltmanın bedeli yok: seçilenin NE YAPTIĞI zaten şeridin
  altında tam cümleyle yazıyor.
*/
const SIRALAMALAR = [
  { key: 'yeni', label: 'Yeni', aciklama: 'Son paylaşılanlar önce.' },
  {
    key: 'oy',
    label: 'En çok oy',
    aciklama: 'Topluluğun en çok işe yarar bulduğu gönderiler.',
  },
  {
    key: 'tartismali',
    label: 'Tartışmalı',
    aciklama: 'Oyların ikiye bölündüğü, cevabı net olmayan başlıklar.',
  },
]

/*
  TARİH FİLTRESİ — sıralamadan AYRI bir eksen. Sıralama "hangisi önce gelsin", tarih
  filtresi "hangileri hiç görünmesin" diyor. Tek listede birleştirmek seçenek sayısını
  3'ten 12'ye çıkarırdı.

  ⚠️ Filtre HER SIRALAMADA açık: ortadan kaybolan bir denetim, kullanıcının "az önce
  buradaydı" diye aradığı bir şeye dönüşür. "Yeni + Bugün" de anlamlı bir soru.

  `kisa` yalnızca pilin üstündeki metin; tam ad ("Bu hafta") açıklama satırında geçiyor
  ki kısaltma anlamı yutmasın. Pencere SUNUCUDA uygulanıyor (ForumRange).
*/
const ZAMAN_ARALIKLARI = [
  { key: 'hepsi', label: 'Tüm zamanlar', kisa: 'Tümü' },
  { key: 'gun', label: 'Bugün', kisa: 'Bugün' },
  { key: 'hafta', label: 'Bu hafta', kisa: 'Hafta' },
  { key: 'ay', label: 'Bu ay', kisa: 'Ay' },
]

const ETIKETLER = [
  { key: 'hepsi', label: 'Tümü' },
  { key: 'stres', label: 'Sınav Stresi' },
  { key: 'soru', label: 'Soru Sor' },
  { key: 'kaynak', label: 'Kaynak' },
  { key: 'program', label: 'Ders Programı' },
  { key: 'motivasyon', label: 'Motivasyon' },
  { key: 'tercih', label: 'Tercih' },
]

/*
  Etiket renkleri: 100/700-800 çiftleri — ui.jsx'teki Badge tonlarıyla aynı aile, yani
  forum kendi renk dilini kurmuyor. (Badge doğrudan kullanılamıyor: tonları violet ve
  sky taşımıyor, altı etiket ise birbirinden ayrışmak zorunda.)

  Marka mavisi SORU etiketine verildi: bu üründe soru sormak ana eylem.
*/
const ETIKET_TONU = {
  stres: { kutu: 'bg-amber-100', yazi: 'text-amber-800' },
  soru: { kutu: 'bg-brand-100', yazi: 'text-brand-700' },
  kaynak: { kutu: 'bg-emerald-100', yazi: 'text-emerald-700' },
  program: { kutu: 'bg-violet-100', yazi: 'text-violet-700' },
  motivasyon: { kutu: 'bg-rose-100', yazi: 'text-rose-700' },
  tercih: { kutu: 'bg-sky-100', yazi: 'text-sky-800' },
}

const VARSAYILAN_ETIKET_TONU = { kutu: 'bg-slate-100', yazi: 'text-slate-700' }

const ETIKET_ADI = Object.fromEntries(ETIKETLER.map((e) => [e.key, e.label]))

/*
  ŞİKAYET SEBEPLERİ — beşi bu ürünün gerçek risklerine birebir karşılık geliyor,
  altıncısı ("Diğer") açık uç. Sıra rastgele değil, BEKLENEN SIKLIĞA göre: spam ve dil
  ihlali her forumda ilk ikidir.
*/
const SIKAYET_SEBEPLERI = [
  { key: 'spam', baslik: 'Spam veya reklam', aciklama: 'Satış, yönlendirme bağlantısı, tekrar eden gönderi.' },
  { key: 'dil', baslik: 'Hakaret, argo veya taciz', aciklama: 'Kişiye yönelik saldırı ya da aşağılayıcı dil.' },
  { key: 'telif', baslik: 'Telif ihlali', aciklama: 'İzinsiz kitap, PDF, deneme ya da video paylaşımı.' },
  {
    key: 'kisisel',
    baslik: 'Kişisel bilgi paylaşımı',
    aciklama: 'Telefon, adres, sosyal hesap — kendisinin ya da başkasının.',
  },
  { key: 'konudisi', baslik: 'Konu dışı veya trolleme', aciklama: 'Tartışmayı bilerek bozan içerik.' },
  { key: 'diger', baslik: 'Diğer', aciklama: 'Yukarıdakilere girmiyorsa kısaca anlat.' },
]

/* Kurallar kullanıcıya GÖRÜNÜR yerde duruyor: yazılmamış kural, uygulandığında keyfî
   görünür ve moderasyona duyulan güveni bitirir.

   ⚠️ "AYNI SORUYU TEKRAR AÇMA" KURALI YOK ve bu bilinçli (ürün sahibi kararı): bir
   öğrenci aynı soruyu ikinci kez soruyorsa çoğu zaman ilk cevabı anlamamıştır. Onu
   "zaten sorulmuştu" diye geri çevirmek, forumun var oluş sebebine ters. */
const KURALLAR = [
  'Argo, hakaret ve kişisel saldırı yok. Fikre karşı çık, kişiye değil.',
  'Telif hakkı olan kitap, PDF ve denemeleri paylaşma — kaynağın adını yaz, dosyasını değil.',
  'Reklam, satış ve yönlendirme bağlantısı yasak.',
  'Kendinin ya da başkasının telefon, adres ve sosyal hesap bilgisini paylaşma.',
]

/*
  ⚠️ DÖRDÜNÜN DE SUNUCUDA KARŞILIĞI VAR — kullanıcıya söz veren bir arayüz metni, sözü
  tutan bir kural olmadan yazılamaz:
    • dosya yükleme yok  → formda alan hiç yok (bkz. GonderiAltSayfasi)
    • günde 3 gönderi    → ForumRules.NewAccountDailyPostLimit / NewAccountDays
    • bağlantı eşiği     → ForumRules.LinkMinLevel
    • otomatik inceleme  → ForumRules.AutoReviewThreshold (CreateReportHandler)
*/
const ONLEMLER = [
  { baslik: 'Yalnızca metin', metin: 'Dosya yükleme kapalı; izinsiz PDF paylaşımının yolu hiç açılmıyor.' },
  { baslik: 'Yeni hesap sınırı', metin: 'İlk hafta günde en fazla 3 gönderi — spam duvarı.' },
  { baslik: 'Bağlantı eşiği', metin: 'Dışarıya bağlantı paylaşımı 3. seviyeden itibaren açılıyor.' },
  { baslik: 'Otomatik inceleme', metin: 'Kısa sürede 3 şikayet alan gönderi akışta kapatılır.' },
]

/* ─── YARDIMCILAR ──────────────────────────────────────────────────────────── */

/**
 * İptal edilen istek hata DEĞİL, bizim kararımız: kullanıcıya gösterilmez.
 *
 * Web'de tek kontrol yetiyordu (fetch → AbortError). Mobil katman axios kullanıyor ve
 * iptali kendi sınıfına sarıyor (CanceledError / ERR_CANCELED); api.js bu hatayı
 * ApiError'a çevirmeden AYNEN fırlatıyor. Üçü birden kontrol ediliyor ki katman
 * değişse de sessiz kalma davranışı bozulmasın.
 */
function iptalMi(err) {
  return err?.name === 'CanceledError' || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED'
}

/**
 * Sunucudan gelen UTC damgasını milisaniyeye çevirir.
 *
 * ⚠️ ZAMAN DİLİMİ EKİ YOKSA 'Z' EKLENİYOR. .NET, DateTime'ı Kind=Utc iken sonunda 'Z'
 * ile yazıyor; Kind=Unspecified iken YAZMIYOR ve o durumda metin YEREL saat sanılır.
 * Türkiye'de bu üç saatlik bir kayma demek: üç saat önce yazılmış bir gönderi "şimdi"
 * görünür, bir dakika önce yazılan gelecekte kalır. Sütun timestamptz olduğu için EF
 * bugün Utc döndürüyor — ama tek bir DTO'nun Kind'i değiştiğinde hata SESSİZ olur.
 */
function damgayaCevir(metin) {
  if (!metin) return null
  const tamDamga = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(metin) ? metin : `${metin}Z`
  const ms = Date.parse(tamDamga)
  return Number.isNaN(ms) ? null : ms
}

/** Damganın kaç dakika önce olduğunu verir; okunamayan damga 0 sayılıyor ("şimdi"). */
function yasDakika(metin) {
  const ms = damgayaCevir(metin)
  if (ms === null) return 0
  // Negatife düşebilir: sunucu saati istemciden birkaç saniye ileriyse. "-1 dk" yerine
  // "şimdi" göstermek doğru, çünkü fark saat farkı değil senkron gürültüsü.
  return Math.max(0, Math.round((Date.now() - ms) / 60000))
}

/** "22 dk" / "3 sa" / "2 g". Forumda mutlak tarih işe yaramıyor: okuyanın sorduğu şey
    "ne zaman yazıldı" değil, "hâlâ taze mi". */
function zamanKisalt(dakika) {
  // "0 dk" sayı olarak doğru ama okunuşu bozuktu — sıfır birimli bir süre, süre değil.
  if (dakika < 1) return 'şimdi'
  if (dakika < 60) return `${dakika} dk`
  const saat = Math.floor(dakika / 60)
  if (saat < 24) return `${saat} sa`
  return `${Math.floor(saat / 24)} g`
}

function goreliZaman(damga) {
  return zamanKisalt(yasDakika(damga))
}

/**
 * OY UYGULAMA — sunucudaki üç durumun istemci aynası (VoteForumContentHandler).
 *
 *   oy yok      → oy ekle
 *   aynı yön    → GERİ AL (sunucu satırı siler, sayaç düşer)
 *   ters yön    → çevir (bir taraftan düş, diğerine ekle)
 *
 * Tek fonksiyon çünkü üç durumun sayaç etkisi birbirine bağlı. Yine de bu yalnızca
 * TAHMİN: yanıt gelince sunucunun sayaçları yazılıyor.
 */
function oyUygula(icerik, yon) {
  const onceki = icerik.myVote ?? 0
  const yeni = onceki === yon ? 0 : yon

  let arti = icerik.upvoteCount
  let eksi = icerik.downvoteCount

  if (onceki === 1) arti -= 1
  else if (onceki === -1) eksi -= 1

  if (yeni === 1) arti += 1
  else if (yeni === -1) eksi += 1

  return { ...icerik, upvoteCount: arti, downvoteCount: eksi, myVote: yeni }
}

function EtiketPili({ etiket }) {
  const ton = ETIKET_TONU[etiket] ?? VARSAYILAN_ETIKET_TONU
  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${ton.kutu}`}>
      <Text className={`text-xs font-semibold ${ton.yazi}`}>{ETIKET_ADI[etiket] ?? etiket}</Text>
    </View>
  )
}

/**
 * Yazar satırı: avatar + ad + (yönetim rozeti) + seviye + zaman.
 *
 * Gönderide ve yorumda AYNI bileşen: yazarın nasıl gösterildiği iki yerde ayrı
 * yazılsaydı, rozet birine eklenip diğerine eklenmeden kalabilirdi.
 *
 * WEB'DEN FARK: zaman damgası bu satırın İÇİNDE. Web'de etiket + yazar + zaman tek
 * satırdaydı; 360px'te o satır etiket ve şikayet düğmesiyle birlikte üç kez sarıyordu.
 * Etiket ve şikayet yukarı alındı, yazarla zaman birlikte kaldı (ikisi tek bir bilgi:
 * kim, ne zaman).
 *
 * Seviye rozeti ETİKETSİZ: "Seviye" kelimesi bu dar satırda ada yer bırakmıyordu; rozet
 * yalnızca `level` ile besleniyor — puan başkasının verisi ve forum DTO'su göndermiyor.
 */
function YazarSatiri({ yazar, damga, kucuk = false }) {
  return (
    <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-1">
      <Avatar userId={yazar?.userId} name={yazar?.displayName ?? 'Kullanıcı'} size="sm" />
      <Text
        numberOfLines={1}
        className={`max-w-[45%] font-medium text-slate-700 ${kucuk ? 'text-[11px]' : 'text-xs'}`}
      >
        {yazar?.displayName ?? 'Kullanıcı'}
      </Text>
      {/* isStaff SUNUCUDAN gelir, istemci türetmez. */}
      {yazar?.isStaff ? <YonetimRozeti kucuk /> : null}
      <SeviyeRozeti kaynak={{ level: yazar?.level }} boyut="sm" ton="acik" etiketli={false} />
      <Text className="text-xs text-slate-500">· {goreliZaman(damga)}</Text>
    </View>
  )
}

/*
  OY RAYI.

  Renk oyun yönünü söylüyor: yukarı marka mavisi (bu ürünün "evet" rengi), aşağı rose.
  Sayı da oyun rengini alıyor — kullanıcı kendi oyunu, okların hangisinin dolu olduğuna
  bakmadan görebiliyor.

  ⚠️ GÖSTERİLEN SAYI = arti − eksi. Kendi oyu AYRICA EKLENMİYOR: sunucudan gelen
  upvoteCount/downvoteCount kullanıcının kendi oyunu zaten içeriyor.

  İKİ MOBİL AYRINTI:
  • Gönderi rayında düğmeler 44px. Yorum rayında 36px + hitSlop: 44'lük iki ok, iki
    satırlık bir yorumdan uzun bir ray üretiyordu. hitSlop dokunma hedefini kurala
    getiriyor, aradaki sayı (18px) iki bölgenin çakışmasını engelliyor.
  • `yatay` yalnızca yorum ipliğinin başındaki gönderi için: orada gövde tam genişlikte
    akıyor ve solda dikey bir ray okuma genişliğini boşuna daraltırdı.
*/
function OyRayi({ arti, eksi, oy = 0, onOy, kucuk = false, yatay = false }) {
  const olcu = kucuk ? 'h-9 w-9' : 'h-11 w-11'
  const hedefBuyutme = kucuk ? { top: 4, bottom: 4, left: 6, right: 6 } : undefined
  const sayiRengi = oy === 1 ? 'text-brand-700' : oy === -1 ? 'text-rose-700' : 'text-slate-800'

  return (
    <View
      className={`shrink-0 items-center gap-0.5 ${yatay ? 'flex-row' : 'flex-col'}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Yukarı oy ver"
        accessibilityState={{ selected: oy === 1 }}
        hitSlop={hedefBuyutme}
        onPress={() => onOy(1)}
        className={`${olcu} items-center justify-center rounded-lg ${oy === 1 ? 'bg-brand-50' : 'active:bg-slate-100'}`}
      >
        {/* Tek çizim, iki yön: OyOkuIkonu YUKARI çizilir, aşağı oy 180° döndürülür.
            Gövdeli ok (sap + baş) basılabilir bir eylem gibi okunur; çıplak chevron
            oy düğmesinde "aşağı kaydır" gibi dururdu (bkz. Ikonlar.jsx). */}
        <OyOkuIkonu renk={oy === 1 ? brand[600] : slate[400]} boy={18} kalinlik={oy === 1 ? 2.6 : 2} />
      </Pressable>

      <Text
        className={`text-sm font-bold ${sayiRengi}`}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {arti - eksi}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aşağı oy ver"
        accessibilityState={{ selected: oy === -1 }}
        hitSlop={hedefBuyutme}
        onPress={() => onOy(-1)}
        className={`${olcu} items-center justify-center rounded-lg ${oy === -1 ? 'bg-rose-50' : 'active:bg-slate-100'}`}
      >
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <OyOkuIkonu renk={oy === -1 ? rose[600] : slate[400]} boy={18} kalinlik={oy === -1 ? 2.6 : 2} />
        </View>
      </Pressable>
    </View>
  )
}

/*
  ŞİKAYET DÜĞMESİ — her gönderide ve her yorumda, aynı çizim, aynı yer (sağ üst).
  Sessiz duruyor (slate-500, küçük metin) ama saklı değil: dikkat çeken bir düğme forumu
  ihbar hattı gibi gösterir, üç nokta menüsüne gömülen bir şikayet ise ihlali gören
  kullanıcının vazgeçtiği bir yol olur. Basılınca rose'a dönüyor (hover yok).

  İKON BAYRAK, ÜÇGEN DEĞİL: UyariIkonu (üçgen) bu ekranda "incelemede" perdesini
  çiziyor — aynı çizimi şikayet düğmesinde de kullanmak, sistemin verdiği uyarı ile
  kullanıcının verdiği işareti birbirine karıştırırdı (bkz. Ikonlar.jsx BayrakIkonu).
  Metin her boyutta duruyor: dar ekranda yalnız ikon bırakmak, eylemi tanınmaz yapardı.
*/
function SikayetDugmesi({ onPress, kucuk = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Şikayet et"
      onPress={onPress}
      hitSlop={kucuk ? 8 : undefined}
      className={`shrink-0 flex-row items-center justify-center gap-1 rounded-lg px-2 active:bg-rose-50
                  ${kucuk ? 'min-h-[36px]' : 'min-h-[44px]'}`}
    >
      <BayrakIkonu renk={slate[500]} boy={kucuk ? 12 : 14} />
      <Text className={`font-medium text-slate-500 ${kucuk ? 'text-[11px]' : 'text-xs'}`}>
        Şikayet et
      </Text>
    </Pressable>
  )
}

/* ─── SAYFA ────────────────────────────────────────────────────────────────── */

export default function Topluluk() {
  const router = useRouter()
  const { session } = useAuth()

  const [sira, setSira] = useState('yeni')
  const [zaman, setZaman] = useState('hepsi')
  const [etiket, setEtiket] = useState('hepsi')

  const [gonderiler, setGonderiler] = useState([])
  const [toplam, setToplam] = useState(0)
  const [dahaVar, setDahaVar] = useState(false)
  const [sayfa, setSayfa] = useState(0)
  const [ilkYukleme, setIlkYukleme] = useState(true)
  const [ekYukleme, setEkYukleme] = useState(false)
  const [tazeleniyor, setTazeleniyor] = useState(false)
  const [hata, setHata] = useState(null)

  /*
    Açık iplik, gönderinin AÇILDIĞI ANDAKİ KOPYASI olarak tutuluyor. Ekranda gösterilen
    kayıt yine de listedeki güncel olan (optimistik oy oradan geliyor); kopya yalnızca
    yedek: şikayetten sonra akış 1. sayfadan yeniden çekiliyor ve o an biriken
    sayfalarda duran bir gönderi listeden düşebiliyor. Kopya olmasaydı iplik, kullanıcı
    okurken kendiliğinden kapanırdı.
  */
  const [acikGonderiKopya, setAcikGonderiKopya] = useState(null)
  const [acilanGizli, setAcilanGizli] = useState([])
  const [sikayetHedefi, setSikayetHedefi] = useState(null)
  const [bildirim, setBildirim] = useState(null)
  const [yaziyor, setYaziyor] = useState(false)

  /*
    YORUMLAR GÖNDERİ AÇILINCA ÇEKİLİYOR, akışla birlikte değil: akışta 20 gönderi var ve
    hepsinin yorumlarını önden indirmek, kullanıcının açmayacağı 20 istek demek. Açılan
    gönderininkiler burada birikiyor ({ [postId]: { yukleniyor, hata, liste } }) ve
    kapanıp yeniden açılınca tekrar istenmiyor.
  */
  const [yorumlar, setYorumlar] = useState({})

  /*
    UÇUŞTAKİ OYLAR. Aynı içeriğe ikinci dokunuş, yanıt gelmeden YOK SAYILIYOR. Kuyruğa
    alınsaydı iki isteğin sırası garanti olmazdı: ikinci yanıt önce dönerse ekrandaki
    sayı sunucudakinden kalıcı olarak ayrışırdı. Ref, state değil — bu bilginin ekranda
    karşılığı yok ve her dokunuşta yeniden çizim yapmaya değmez.
  */
  const oyKilidi = useRef(new Set())

  /* Yeni gönderi/şikayet sonrası akışı yeniden çekmek için: sayaç değişince efekt koşar. */
  const [yenilemeSayaci, setYenilemeSayaci] = useState(0)
  const yenile = () => setYenilemeSayaci((n) => n + 1)

  const listeRef = useRef(null)
  /* Geç dönen eski yanıt yeni listeyi ezmesin: her yükleme kendi sıra numarasını taşır. */
  const seq = useRef(0)
  const sayfaKilidi = useRef(false)
  const basarisizHedef = useRef(null)
  /* Sonraki sayfa isteği de filtre değişiminde iptal edilebilsin diye kontrolör ref'te. */
  const kontrolRef = useRef(null)

  async function sayfaGetir(hedef, signal) {
    const benimSeq = ++seq.current
    sayfaKilidi.current = true
    if (hedef === 1) setIlkYukleme(true)
    else setEkYukleme(true)
    setHata(null)

    try {
      const sonuc = await api.forumFeed(
        {
          sort: SIRA_ENUM[sira],
          range: ZAMAN_ENUM[zaman],
          tag: etiket === 'hepsi' ? null : ETIKET_ENUM[etiket],
          page: hedef,
        },
        signal,
      )
      if (seq.current !== benimSeq) return

      setGonderiler((onceki) => {
        if (hedef === 1) return sonuc.items
        /*
          Ekleme postId'ye göre TEKİLLEŞTİRİLİR: sunucu saf ofset sayfalıyor ve sayfalar
          okunurken üste yeni gönderi düşerse bir sonraki sayfa öncekinin son öğesini
          tekrar getirir; süzülmezse aynı anahtar FlatList'e iki kez girer.
        */
        const görülen = new Set(onceki.map((g) => g.postId))
        return [...onceki, ...sonuc.items.filter((g) => !görülen.has(g.postId))]
      })
      setToplam(sonuc.totalCount)
      setDahaVar(Boolean(sonuc.hasNextPage ?? hedef < sonuc.totalPages))
      setSayfa(hedef)
      basarisizHedef.current = null
    } catch (err) {
      if (seq.current !== benimSeq || iptalMi(err)) return
      // Başarısız HEDEF ayrıca tutulur: sayfa yalnızca başarıda ilerliyor ve "tekrar
      // dene" sayfayı hedeflerse zaten yüklü sayfayı ikinci kez eklerdi.
      basarisizHedef.current = hedef
      setHata(err)
    } finally {
      if (seq.current === benimSeq) {
        sayfaKilidi.current = false
        setIlkYukleme(false)
        setEkYukleme(false)
        setTazeleniyor(false)
      }
    }
  }

  useEffect(() => {
    /*
      ESKİ İSTEĞİ İPTAL ET. Filtreler hızlı değiştirildiğinde yanıtların GELİŞ SIRASI
      garanti değil: iptal olmasaydı önce gönderilen isteğin geç dönen yanıtı, sonra
      seçilen filtrenin sonucunu ezerdi ve ekranda seçili olmayan bir filtrenin listesi
      kalırdı.
    */
    const kontrol = new AbortController()
    kontrolRef.current = kontrol
    sayfaGetir(1, kontrol.signal)
    return () => kontrol.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sira, zaman, etiket, yenilemeSayaci])

  function dahaGetir() {
    if (sayfaKilidi.current || !dahaVar || ilkYukleme) return
    sayfaGetir(sayfa + 1, kontrolRef.current?.signal)
  }

  function basaSar() {
    listeRef.current?.scrollToOffset({ offset: 0, animated: true })
  }

  /*
    Filtre değişince ilk sayfaya dönülüyor (efekt zaten 1'den kuruyor), açık yorum ipliği
    kapanıyor ve liste BAŞA SARIYOR: web'de sayfa değişimi kaydırmayı sıfırlıyordu;
    biriken listede öyle bir sıfırlama olmadığı için kullanıcı yeni listenin ortasında
    bir yere düşerdi.
  */
  const filtreDegistir = (uygula) => {
    uygula()
    setAcikGonderiKopya(null)
    basaSar()
  }

  /* ─── OY ───────────────────────────────────────────────────────────────── */

  const gonderiOyla = async (postId, yon) => {
    if (oyKilidi.current.has(postId)) return
    oyKilidi.current.add(postId)

    /*
      Geri alma için tıklama ÖNCESİ hâli. Snapshot setState'in DIŞINDA alınıyor:
      güncelleyici fonksiyonun içinde dış bir değişkene yazmak onu saf olmaktan çıkarır
      ve React güncelleyiciyi iki kez çağırdığında hangi değerin yakalandığı belirsizleşir.
    */
    const oncekiHal = gonderiler.find((g) => g.postId === postId) ?? null

    setGonderiler((mevcut) => mevcut.map((g) => (g.postId === postId ? oyUygula(g, yon) : g)))

    try {
      const sonuc = await api.voteForumPost(postId, yon)
      // Sunucunun sayaçları YAZILIYOR: iki kişi aynı anda oy verdiyse optimistik tahmin
      // eksik kalır ve yalnızca kendi oyumu sayardı.
      setGonderiler((mevcut) => mevcut.map((g) => (g.postId === postId ? { ...g, ...sonuc } : g)))
    } catch (err) {
      if (oncekiHal) {
        setGonderiler((mevcut) => mevcut.map((g) => (g.postId === postId ? oncekiHal : g)))
      }
      setHata(err)
    } finally {
      oyKilidi.current.delete(postId)
    }
  }

  const yorumOyla = async (postId, commentId, yon) => {
    if (oyKilidi.current.has(commentId)) return
    oyKilidi.current.add(commentId)

    // Snapshot setState'in dışında (bkz. gonderiOyla'daki not).
    const oncekiHal = yorumlar[postId]?.liste?.find((y) => y.commentId === commentId) ?? null

    const listeyiDegistir = (donustur) =>
      setYorumlar((mevcut) => {
        const durum = mevcut[postId]
        if (!durum?.liste) return mevcut
        return { ...mevcut, [postId]: { ...durum, liste: durum.liste.map(donustur) } }
      })

    listeyiDegistir((y) => (y.commentId === commentId ? oyUygula(y, yon) : y))

    try {
      const sonuc = await api.voteForumComment(commentId, yon)
      listeyiDegistir((y) => (y.commentId === commentId ? { ...y, ...sonuc } : y))
    } catch (err) {
      if (oncekiHal) listeyiDegistir((y) => (y.commentId === commentId ? oncekiHal : y))
      setHata(err)
    } finally {
      oyKilidi.current.delete(commentId)
    }
  }

  /* ─── YORUMLAR ─────────────────────────────────────────────────────────── */

  const ipligiAc = (gonderi) => {
    const postId = gonderi.postId
    setAcikGonderiKopya(gonderi)
    // Zaten çekildiyse tekrar isteme: kapat-aç, ağ isteği değil bir görünürlük kararı.
    if (yorumlar[postId]?.liste) return

    setYorumlar((m) => ({ ...m, [postId]: { yukleniyor: true, hata: null, liste: null } }))
    api
      .forumComments(postId)
      .then((liste) =>
        setYorumlar((m) => ({ ...m, [postId]: { yukleniyor: false, hata: null, liste } })),
      )
      .catch((err) =>
        setYorumlar((m) => ({ ...m, [postId]: { yukleniyor: false, hata: err, liste: null } })),
      )
  }

  const yorumEkle = async (postId, metin) => {
    await api.createForumComment(postId, metin)

    /*
      YAZILAN YORUM SUNUCUDAN YENİDEN OKUNUYOR, elle listeye eklenmiyor. POST yalnızca id
      döndürüyor; yazarın adı, seviyesi ve yönetim işareti orada yok. Elle kurulsaydı bu
      üç alan istemcide TAHMİN edilmiş olurdu — özellikle yönetim rozeti, istemcide
      üretilmemesi gereken tam olarak o bilgi.

      ⚠️ BU İKİNCİ İSTEĞİN HATASI, GÖNDERİM HATASI DEĞİLDİR. Yorum sunucuya çoktan
      yazıldı; okuma düşerse çağırana hata fırlatmak taslağı korur ve kullanıcının
      "tekrar dene" demesi AYNI yorumu ikinci kez oluşturur. Bu yüzden okuma hatası
      burada yutuluyor: liste yenilenemedi diye işaretleniyor, gönderim başarılı sayılıyor.
    */
    let liste
    try {
      liste = await api.forumComments(postId)
    } catch {
      setYorumlar((m) => ({
        ...m,
        [postId]: {
          yukleniyor: false,
          hata: null,
          liste: m[postId]?.liste ?? [],
          tazelenemedi: true,
        },
      }))
      return
    }
    setYorumlar((m) => ({ ...m, [postId]: { yukleniyor: false, hata: null, liste } }))

    /*
      Kartın yorum sayısı GÖRÜNEN listeyle eşitleniyor, +1 ile artırılmıyor: sunucudaki
      CommentCount kaldırılmış yorumları da sayıyor, liste yalnızca görünenleri getiriyor.
      "5 yorum" yazan bir kartı açınca dört yorum görmek, kullanıcıya bir şeyin
      yüklenmediğini düşündürür.
    */
    setGonderiler((mevcut) =>
      mevcut.map((g) => (g.postId === postId ? { ...g, commentCount: liste.length } : g)),
    )
  }

  /* ─── GÖNDERİ ──────────────────────────────────────────────────────────── */

  const gonderiEkle = async ({ baslik, etiket: yeniEtiket, ozet }) => {
    await api.createForumPost(ETIKET_ENUM[yeniEtiket], baslik, ozet)

    setYaziyor(false)
    /* Yazdığı şeyi görebilsin: filtreler onu gizliyor olabilir, o yüzden akış varsayılana
       dönüyor. Sessizce "kayboldu" görünen bir gönderi, kullanıcıya paylaşımın başarısız
       olduğunu düşündürür. */
    setSira('yeni')
    setZaman('hepsi')
    setEtiket('hepsi')
    setAcikGonderiKopya(null)
    yenile()
    basaSar()
    setBildirim('Gönderin paylaşıldı.')
  }

  /* ─── ŞİKAYET ──────────────────────────────────────────────────────────── */

  const sikayetGonder = async (hedef, sebepAnahtari, aciklama) => {
    const sebep = SEBEP_ENUM[sebepAnahtari]

    if (hedef.tur === 'Yorum') await api.reportForumComment(hedef.id, sebep, aciklama)
    else await api.reportForumPost(hedef.id, sebep, aciklama)

    setBildirim('Şikayetin iletildi. Moderasyon ekibi inceleyip sonucunu değerlendirecek.')
    /*
      AKIŞ YENİLENİYOR: bu şikayet eşiği (3) geçmiş olabilir ve gönderi artık perdeli.
      Yenilemeseydik, kullanıcı az önce bildirdiği içeriği hiçbir şey olmamış gibi
      görmeye devam ederdi.
    */
    yenile()
  }

  const seciliSiralama = SIRALAMALAR.find((s) => s.key === sira)
  const zamanAdi = ZAMAN_ARALIKLARI.find((z) => z.key === zaman)?.label
  /*
    Açık iplik listeden düşebilir: şikayet sonrası akış 1. sayfadan yeniden çekiliyor ve
    biriken sayfalardaki bir gönderi artık listede olmayabilir. O durumda ekranda kopya
    gösteriliyor (kullanıcı okuduğu şeyi kaybetmesin) — AMA kopya CANLI DEĞİL: oyu
    listeye yazacak yer yok, yani basılan ok ekranda hiçbir şeyi değiştirmezken sunucuya
    oy yazmaya devam ederdi. `gonderiOylanabilir`, oy rayını yalnızca gönderi gerçekten
    listedeyken açıyor.
  */
  const acikGonderiCanli = gonderiler.find((g) => g.postId === acikGonderiKopya?.postId)
  const acikGonderi = acikGonderiCanli ?? acikGonderiKopya
  const gonderiOylanabilir = Boolean(acikGonderiCanli)
  const benimUserId = session?.userId

  const baslikBolumu = (
    <View className="gap-3 pb-1">
      <Text className="text-sm leading-relaxed text-slate-600">
        Sınav stresinden soru çözümüne, kaynak tartışmasından tercih kararına — herkesin aynı
        sıralarda olduğu ortak alan. Ders almak için eşleşmene gerek yok; buraya yazıp topluluğa
        sorabilirsin.
      </Text>

      {bildirim && (
        <Notice tone="success" onDismiss={() => setBildirim(null)}>
          {bildirim}
        </Notice>
      )}

      <GonderiKutusu session={session} onAc={() => setYaziyor(true)} />

      <FiltreSeridi
        sira={sira}
        onSira={(k) => filtreDegistir(() => setSira(k))}
        zaman={zaman}
        onZaman={(k) => filtreDegistir(() => setZaman(k))}
        etiket={etiket}
        onEtiket={(k) => filtreDegistir(() => setEtiket(k))}
        aciklama={seciliSiralama?.aciklama}
        zamanAdi={zamanAdi}
        sonuc={toplam}
        yukleniyor={ilkYukleme}
      />

      {/* Hata akışın ÜSTÜNDE ve liste yerinde kalıyor: oy verirken düşen bir istek,
          okunmakta olan listeyi silmemeli. */}
      <ErrorBox
        error={hata}
        onRetry={() => sayfaGetir(basarisizHedef.current ?? 1, kontrolRef.current?.signal)}
      />
    </View>
  )

  const bosDurum = ilkYukleme ? (
    <Loading label="Gönderiler yükleniyor…" />
  ) : hata ? null : etiket === 'hepsi' && zaman === 'hepsi' ? (
    /* Boş sonuç iki sebepten gelebilir (etiket ya da tarih); hangisi olduğunu tahmin eden
       bir metin kullanıcıyı çalışmayan düzeltmeye yollar. Hiç gönderi yoksa metin bunu
       ayrıca söylüyor. */
    <EmptyState
      title="Burada henüz kimse yazmadı."
      description="İlk gönderiyi sen paylaşabilirsin — bir soru sormak da yeterli."
      action={<Button onPress={() => setYaziyor(true)}>Yeni gönderi</Button>}
    />
  ) : (
    <EmptyState
      title="Bu filtrelerle gösterilecek gönderi yok."
      description="Tarih aralığını genişlet ya da etiketi “Tümü”ne al."
    />
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
        <Text className="flex-1 text-lg font-bold text-slate-900">Topluluk</Text>
      </View>

      <FlatList
        ref={listeRef}
        data={gonderiler}
        keyExtractor={(g) => g.postId}
        renderItem={({ item }) => (
          <GonderiKarti
            gonderi={item}
            benimUserId={benimUserId}
            onOy={gonderiOyla}
            onAc={() => ipligiAc(item)}
            gizliAcik={acilanGizli.includes(item.postId)}
            onGizliAc={() => setAcilanGizli((l) => [...l, item.postId])}
            onSikayet={setSikayetHedefi}
          />
        )}
        contentContainerClassName="gap-4 p-4"
        ListHeaderComponent={baslikBolumu}
        ListEmptyComponent={bosDurum}
        onEndReached={dahaGetir}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={tazeleniyor}
            onRefresh={() => {
              setTazeleniyor(true)
              yenile()
            }}
            tintColor={brand[600]}
            colors={[brand[600]]}
          />
        }
        ListFooterComponent={
          <View className="gap-4 pt-2">
            {ekYukleme && (
              <View className="py-2">
                <Spinner />
              </View>
            )}
            {/* Kurallar ve önlemler listenin ALTINDA: forumdan önce dört maddelik bir
                kural listesi okutmak, kimsenin okumadığı bir duvar üretirdi. */}
            <KurallarKarti />
            <OnlemlerKarti />
          </View>
        }
      />

      {yaziyor && <GonderiAltSayfasi onClose={() => setYaziyor(false)} onPaylas={gonderiEkle} />}

      {acikGonderi && (
        <YorumAltSayfasi
          /* key: taslak ve yerel bildirim gönderi değişince sıfırlansın. */
          key={acikGonderi.postId}
          gonderi={acikGonderi}
          benimUserId={benimUserId}
          durum={yorumlar[acikGonderi.postId]}
          onClose={() => setAcikGonderiKopya(null)}
          /* Gönderi listeden düştüyse oy rayı çizilmez: basılan ok ekranda hiçbir şeyi
             değiştiremezken sunucuya oy yazmaya devam ederdi (bkz. gonderiOylanabilir). */
          onGonderiOy={gonderiOylanabilir ? gonderiOyla : null}
          onYorumOy={(commentId, yon) => yorumOyla(acikGonderi.postId, commentId, yon)}
          onYaz={(metin) => yorumEkle(acikGonderi.postId, metin)}
          onSikayetGonder={sikayetGonder}
        />
      )}

      {sikayetHedefi && (
        <SikayetAltSayfasi
          key={sikayetHedefi.id}
          hedef={sikayetHedefi}
          onClose={() => setSikayetHedefi(null)}
          onGonder={sikayetGonder}
        />
      )}
    </SafeAreaView>
  )
}

/* ─── GÖNDERİ KUTUSU ───────────────────────────────────────────────────────── */

/*
  Gönderi kutusu — forumun ANA EYLEMİ. Bir akış, yazma yolu görünmeden anlaşılmıyor:
  kullanıcı "burada ben ne yapıyorum" sorusunun cevabını gönderilerden değil bu kutudan
  alıyor.

  Gerçek bir girdi DEĞİL, ALT SAYFAYI AÇAN bir düğme: gönderi başlık + etiket + metin
  istiyor, yani tek satırlık bir kutuya sığmıyor. Satır içi bir alan kullanıcıya "bir
  cümle yaz ve gönder" diye söz verip sonra üç alanlık bir forma çıkarırdı.

  DOSYA EKLEME DÜĞMESİ YOK ve bu tasarımın kendisi bir önlem: telif ihlalinin bu üründe
  en olası yolu izinsiz PDF paylaşımı; en ucuz çözüm o yolu arayüzde hiç açmamak.
  Kutunun altındaki şerit bunu kural olarak da söylüyor.
*/
function GonderiKutusu({ session, onAc }) {
  return (
    /* Card'ın kendi dolgusu (p-5) EZİLMİYOR: NativeWind çakışan iki utility'yi string
       sırasına göre değil üretilen CSS sırasına göre çözüyor, yani "p-4" güvenilir bir
       geçersiz kılma değil. Yüzeyin dolgusu tek yerde (ui.jsx) kalıyor. */
    <Card>
      <View className="flex-row items-center gap-3">
        <Avatar userId={session?.userId} name={session?.displayName} size="sm" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yeni gönderi yaz"
          onPress={onAc}
          className="min-h-[44px] flex-1 justify-center rounded-xl border border-slate-200 bg-white px-4 active:bg-slate-50"
        >
          <Text numberOfLines={1} className="text-sm text-slate-500">
            Bir soru sor ya da neler olduğunu anlat…
          </Text>
        </Pressable>
      </View>

      <Text className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
        Yalnızca metin · Dosya yükleme kapalı · Etiket seçmek zorunlu
      </Text>
    </Card>
  )
}

/* ─── FİLTRE ŞERİDİ ────────────────────────────────────────────────────────── */

/** Tek seçimli filtre pili — Keşfet'teki Pill'in aynısı (uygulama içinde ikinci bir
    filtre biçimi doğmasın). `ad`, görünen metin kısaltılmışsa ekran okuyucuya okunacak
    TAM addır ("Hafta" → "Bu hafta"); verilmezse metnin kendisi okunur. */
function Pil({ aktif, onPress, ad, children }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={ad}
      accessibilityState={{ checked: aktif }}
      onPress={onPress}
      className={`min-h-[44px] justify-center rounded-full border px-3.5 ${
        aktif ? 'border-brand-500 bg-brand-600' : 'border-slate-200 bg-white active:bg-brand-50'
      }`}
    >
      <Text className={`text-sm font-medium ${aktif ? 'text-white' : 'text-slate-600'}`}>
        {children}
      </Text>
    </Pressable>
  )
}

/*
  Üç denetim, üç ayrı soru: "neye göre sıralansın", "hangi tarih aralığı", "ne
  konuşulsun". Ayrı satırlarda ve BAŞLIKLI duruyorlar — başlıksız iki pil şeridi arka
  arkaya tek bir denetim gibi okunurdu (web'de tarih bir <select> olduğu için bu ayrım
  biçimin kendisinden geliyordu).
*/
function FiltreSeridi({
  sira,
  onSira,
  zaman,
  onZaman,
  etiket,
  onEtiket,
  aciklama,
  zamanAdi,
  sonuc,
  yukleniyor,
}) {
  return (
    <Card>
      <View className="flex-row rounded-xl bg-slate-100 p-1" accessibilityRole="tablist">
        {SIRALAMALAR.map(({ key, label }) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: sira === key }}
            onPress={() => onSira(key)}
            className={`min-h-[44px] flex-1 items-center justify-center rounded-lg px-2 ${
              sira === key ? 'bg-white' : ''
            }`}
          >
            <Text
              numberOfLines={1}
              /* 12px: 320px'te üç düğmeye düşen ~66px'e "Tartışmalı" ancak bu puntoda
                 kesilmeden sığıyor. Dokunma hedefi puntodan bağımsız 44px. */
              className={`text-xs font-medium ${sira === key ? 'text-brand-700' : 'text-slate-600'}`}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Seçilen sıralamanın ne yaptığı YAZIYOR: "Tartışmalı" hiçbir kullanıcının tahmin
          edemeyeceği bir ölçüt. Tarih aralığı da burada tam adıyla tekrar ediyor — sonuç
          sayısının neden düştüğü, sayının yanında yazmazsa fark edilmiyor. */}
      <Text className="mt-3 text-xs text-slate-600">
        {aciklama} · {zamanAdi} ·{' '}
        {/* Yüklenirken eski sayıyı göstermek yanlış olurdu: filtre değişmiş ama sayı hâlâ
            önceki filtrenin sonucunu söylüyor olurdu. */}
        {yukleniyor ? 'yükleniyor…' : `${sonuc} gönderi`}
      </Text>

      <View className="mt-4 border-t border-slate-100 pt-4">
        <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Tarih
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {/* Görünen metin kısa ("Hafta"), okunan ad tam ("Bu hafta"): dört pil tek
              satıra sığsın ama ekran okuyucu kısaltmayı çözmek zorunda kalmasın. */}
          {ZAMAN_ARALIKLARI.map(({ key, label, kisa }) => (
            <Pil key={key} ad={label} aktif={zaman === key} onPress={() => onZaman(key)}>
              {kisa}
            </Pil>
          ))}
        </View>

        <Text className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
          Etiket
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {ETIKETLER.map(({ key, label }) => (
            <Pil key={key} aktif={etiket === key} onPress={() => onEtiket(key)}>
              {label}
            </Pil>
          ))}
        </View>
      </View>
    </Card>
  )
}

/* ─── GÖNDERİ KARTI ────────────────────────────────────────────────────────── */

/*
  Kart yüzeyi ui.jsx'teki Card ile AYNI dil (rounded-2xl + border-slate-100 + beyaz) ama
  Card bileşeni değil: perde şeridinin kartın üst kenarına yapışması için iç dolgunun
  bölünmesi gerekiyor, Card ise tek parça p-5 veriyor (dersler.jsx'teki ders kartı da
  aynı sebeple ham View).
*/
function GonderiKarti({ gonderi, benimUserId, onOy, onAc, gizliAcik, onGizliAc, onSikayet }) {
  const etiketAnahtari = ETIKET_ANAHTARI[gonderi.tag] ?? gonderi.tag
  const benimGonderim = gonderi.author?.userId === benimUserId

  const sikayetEt = () =>
    onSikayet({
      tur: 'Gönderi',
      id: gonderi.postId,
      baslik: gonderi.title,
      yazar: gonderi.author?.displayName,
    })

  /*
    İNCELEMEDEKİ GÖNDERİ AKIŞTA KAPALI GELİR. Silinmiyor, PERDELENİYOR. Aradaki fark
    moderasyonun görünürlüğü: sessizce silinen içerik, hem yazarına hem okuyanına hiçbir
    şey söylemez ve "burada sansür var mı" sorusunu cevaplanamaz hâle getirir. Perde ise
    sebebi yazıyor, sayıyı veriyor ve kararı okuyana bırakıyor.
  */
  if (gonderi.underReview && !gizliAcik) {
    return (
      <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <View className="flex-row items-start gap-3">
          <View className="mt-0.5">
            <UyariIkonu renk={amber[800]} boy={20} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold text-slate-900">Bu gönderi incelemede</Text>
            <Text className="mt-1 text-sm leading-relaxed text-slate-700">
              {gonderi.reportCount} kişi topluluk kurallarını ihlal ettiğini bildirdi. Moderasyon
              sonuçlanana kadar akışta kapalı tutuluyor.
            </Text>
            <View className="mt-3 flex-row flex-wrap items-center gap-3">
              <Pressable
                accessibilityRole="button"
                onPress={onGizliAc}
                className="min-h-[44px] justify-center rounded-lg border border-amber-300 bg-white px-3 active:bg-amber-100"
              >
                <Text className="text-xs font-semibold text-amber-900">Yine de göster</Text>
              </Pressable>
              <Text className="text-xs text-slate-600">
                Etiket: {ETIKET_ADI[etiketAnahtari] ?? etiketAnahtari}
              </Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      {/* Perde açıldıysa uyarı kartın ÜSTÜNDE kalıyor: kullanıcı "yine de göster"e
          bastığı anı unutabilir, içeriğin durumu unutulmamalı. */}
      {gonderi.underReview && (
        <View className="flex-row items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
          <UyariIkonu renk={amber[800]} boy={16} />
          <Text className="flex-1 text-xs font-medium text-amber-900">
            İncelemede — {gonderi.reportCount} şikayet aldı, moderasyon sürüyor.
          </Text>
        </View>
      )}

      <View className="flex-row gap-3 p-4">
        <OyRayi
          arti={gonderi.upvoteCount}
          eksi={gonderi.downvoteCount}
          oy={gonderi.myVote}
          onOy={(yon) => onOy(gonderi.postId, yon)}
        />

        <View className="min-w-0 flex-1 gap-2">
          <View className="flex-row items-center justify-between gap-2">
            <EtiketPili etiket={etiketAnahtari} />
            {/* KENDİ GÖNDERİNİ ŞİKAYET EDEMEZSİN: sunucu da reddediyor, ama hatayı
                göstermektense düğmeyi hiç çizmemek doğru — tıklandığında reddedilen bir
                düğme, kırık bir düğmedir. */}
            {!benimGonderim && <SikayetDugmesi onPress={sikayetEt} />}
          </View>

          <YazarSatiri yazar={gonderi.author} damga={gonderi.createdAtUtc} />

          {/*
            Başlık ve özet gönderiyi AÇAR. Web'de gönderi sayfası yoktu ve başlık düz
            metindi; mobilde ipliğin kendisi bir alt sayfa olduğu için kartın gövdesi onu
            açan doğal hedef — "Yorumlar" düğmesini aramak zorunda kalmadan.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${gonderi.title} — gönderiyi ve yorumları aç`}
            onPress={onAc}
            className="active:opacity-70"
          >
            <Text numberOfLines={3} className="text-[17px] font-bold leading-snug text-slate-900">
              {gonderi.title}
            </Text>
            {/* Akış TARANABİLİR kalmalı: özet üç satırda kesiliyor, tam metin iplikte.
                Kullanıcının bıraktığı satır araları korunuyor (RN Text \n'i zaten
                yutmaz) — madde madde yazılmış bir soru tek paragrafa çökerse okunmaz. */}
            <Text numberOfLines={3} className="mt-2 text-sm leading-relaxed text-slate-600">
              {gonderi.body}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onAc}
            className="min-h-[44px] flex-row items-center gap-2 self-start rounded-lg px-2.5 active:bg-slate-100"
          >
            <MesajIkonu renk={slate[600]} boy={16} />
            <Text className="text-xs font-semibold text-slate-600">
              {gonderi.commentCount > 0 ? `${gonderi.commentCount} yorum` : 'Yorumlar'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

/* ─── YORUM İPLİĞİ (ALT SAYFA) ─────────────────────────────────────────────── */

/*
  Yorumlar web'de gönderinin İÇİNDE açılıyordu; mobilde ALT SAYFADA. Sebep biçimsel
  değil işlevsel: çok satırlı bir yazma alanı + klavye, kaydırılan bir FlatList satırının
  içinde çözülemez (klavye açılınca satır ekranın dışına çıkar).

  Web'in gerekçesi — "cevap yazarken cevapladığın şeyi görmelisin" — alt sayfanın başında
  gönderinin TAM gövdesi (kesilmemiş) gösterilerek korunuyor. Kartta üç satırda kesilen
  metnin tamamı ilk kez burada okunuyor; oy rayı da burada, çünkü tam metni okuduktan
  sonra oy vermek en doğru an.

  İÇ İÇE DİKEY KAYDIRMA YOK: yorumlar FlatList değil, alt sayfanın kendi ScrollView'una
  düz map ile diziliyor (tek gönderinin yorumları sınırlı bir küme).
*/
function YorumAltSayfasi({
  gonderi,
  benimUserId,
  durum,
  onClose,
  onGonderiOy,
  onYorumOy,
  onYaz,
  onSikayetGonder,
}) {
  const [taslak, setTaslak] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState(null)
  const [yerelBildirim, setYerelBildirim] = useState(null)
  const [yorumSikayeti, setYorumSikayeti] = useState(null)
  const gonderimKilidi = useRef(false)

  const etiketAnahtari = ETIKET_ANAHTARI[gonderi.tag] ?? gonderi.tag
  const liste = durum?.liste

  /* Alt sınır 5 karakter (ForumRules.CommentMinLength): "+1" ya da "aynen" gibi tek
     kelimelik onaylar bir tartışmayı ilerletmiyor. Gönderideki 20 karakterlik eşik
     burada fazla olurdu — kısa ve isabetli cevaplar meşru. */
  const gonderilebilir = taslak.trim().length >= YORUM_EN_AZ && !gonderiliyor

  async function gonder() {
    if (gonderimKilidi.current || !gonderilebilir) return
    gonderimKilidi.current = true
    setGonderiliyor(true)
    setHata(null)
    try {
      await onYaz(taslak.trim())
      setTaslak('')
    } catch (err) {
      // Taslak SİLİNMİYOR: yazdığı yorumu kaybeden kullanıcı yeniden yazmıyor, vazgeçiyor.
      setHata(err)
    } finally {
      gonderimKilidi.current = false
      setGonderiliyor(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Gönderi">
      <View className="gap-4 pb-2">
        {yerelBildirim && (
          <Notice tone="success" onDismiss={() => setYerelBildirim(null)}>
            {yerelBildirim}
          </Notice>
        )}

        {gonderi.underReview && (
          <View className="flex-row items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <UyariIkonu renk={amber[800]} boy={16} />
            <Text className="flex-1 text-xs font-medium text-amber-900">
              İncelemede — {gonderi.reportCount} şikayet aldı, moderasyon sürüyor.
            </Text>
          </View>
        )}

        <View className="flex-row items-center justify-between gap-2">
          <EtiketPili etiket={etiketAnahtari} />
          {gonderi.author?.userId !== benimUserId && (
            <SikayetDugmesi
              onPress={() =>
                setYorumSikayeti({
                  tur: 'Gönderi',
                  id: gonderi.postId,
                  baslik: gonderi.title,
                  yazar: gonderi.author?.displayName,
                })
              }
            />
          )}
        </View>

        <YazarSatiri yazar={gonderi.author} damga={gonderi.createdAtUtc} />

        <View>
          <Text className="text-lg font-bold leading-snug text-slate-900">{gonderi.title}</Text>
          {/* Kesme YOK: kartta üç satırda kesilen metnin tamamı burada. */}
          <Text className="mt-2 text-sm leading-relaxed text-slate-700">{gonderi.body}</Text>
        </View>

        <View className="flex-row items-center justify-between border-y border-slate-100 py-2">
          {onGonderiOy ? (
            <OyRayi
              yatay
              arti={gonderi.upvoteCount}
              eksi={gonderi.downvoteCount}
              oy={gonderi.myVote}
              onOy={(yon) => onGonderiOy(gonderi.postId, yon)}
            />
          ) : (
            /* Gönderi akıştan düştü (ör. şikayet sonrası liste yenilendi): oy rayı
               yerine durumu SÖYLEYEN bir satır. Çalışmayan bir ok göstermek, basana
               oyunun sayıldığını düşündürürdü. */
            <Text className="text-xs text-slate-500">
              Bu gönderi akıştan düştü — oy vermek için listeyi yenile.
            </Text>
          )}
          <Text className="text-xs font-semibold text-slate-600">
            {liste ? `${liste.length} yorum` : 'Yorumlar'}
          </Text>
        </View>

        {durum?.yukleniyor ? (
          <Loading label="Yorumlar yükleniyor…" />
        ) : durum?.hata ? (
          <ErrorBox error={durum.hata} />
        ) : !liste || liste.length === 0 ? (
          <Text className="text-sm text-slate-600">
            Bu gönderide henüz yorum yok. İlk cevabı sen yazabilirsin.
          </Text>
        ) : (
          <View className="gap-3">
            {liste.map((yorum) => (
              <View key={yorum.commentId} className="flex-row items-start gap-2.5 border-t border-slate-100 pt-3">
                <OyRayi
                  kucuk
                  arti={yorum.upvoteCount}
                  eksi={yorum.downvoteCount}
                  oy={yorum.myVote}
                  onOy={(yon) => onYorumOy(yorum.commentId, yon)}
                />

                <View className="min-w-0 flex-1">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="min-w-0 flex-1">
                      <YazarSatiri yazar={yorum.author} damga={yorum.createdAtUtc} kucuk />
                    </View>
                    {/* Yorumun şikayet düğmesi de aynı yerde: sağ üst — kullanıcı kuralı
                        bir kez öğreniyor. Kendi yorumunda hiç çizilmiyor. */}
                    {yorum.author?.userId !== benimUserId && (
                      <SikayetDugmesi
                        kucuk
                        onPress={() =>
                          setYorumSikayeti({
                            tur: 'Yorum',
                            id: yorum.commentId,
                            baslik: yorum.body,
                            yazar: yorum.author?.displayName,
                          })
                        }
                      />
                    )}
                  </View>

                  {yorum.underReview && (
                    <View className="mt-1 flex-row items-center gap-1.5">
                      <UyariIkonu renk={amber[800]} boy={14} />
                      <Text className="text-xs font-medium text-amber-800">Bu yorum incelemede.</Text>
                    </View>
                  )}

                  <Text className="mt-1 text-sm leading-relaxed text-slate-700">{yorum.body}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/*
          Yazma alanı ipliğin SONUNDA — okunan şeyin ardından yazılır, cevap sırası da
          budur. Enter'la göndermek YOK: çok satırlı bir alanda Enter satır başıdır.
        */}
        <View className="gap-2 border-t border-slate-100 pt-4">
          <ErrorBox error={hata} />
          <Girdi
            value={taslak}
            onChangeText={setTaslak}
            maxLength={YORUM_EN_COK}
            multiline
            textAlignVertical="top"
            className="h-24"
            placeholder="Yorumunu yaz…"
            accessibilityLabel="Yorum yaz"
          />
          <View className="flex-row justify-end">
            <Button loading={gonderiliyor} disabled={!gonderilebilir} onPress={gonder}>
              Yorumla
            </Button>
          </View>
        </View>
      </View>

      {/*
        ŞİKAYET ALT SAYFASI BU ALT SAYFANIN İÇİNDE. iOS'ta aynı seviyede iki RN Modal
        aynı anda sunulamıyor (ikincisi hiç görünmüyor); iç içe yerleştirmek desteklenen
        yol. İpliği kapatıp şikayeti açmak da bir seçenekti — ama şikayet edilen yorumu
        ekrandan kaldırırdı, oysa kullanıcı NEYİ bildirdiğini görmeli.
      */}
      {yorumSikayeti && (
        <SikayetAltSayfasi
          key={yorumSikayeti.id}
          hedef={yorumSikayeti}
          onClose={() => setYorumSikayeti(null)}
          onGonder={async (hedef, sebep, aciklama) => {
            await onSikayetGonder(hedef, sebep, aciklama)
            // Sayfadaki bildirim ipliğin ARKASINDA kalıyor; kullanıcı şikayetinin
            // iletildiğini burada da görmeli.
            setYerelBildirim('Şikayetin iletildi. Moderasyon ekibi inceleyip değerlendirecek.')
          }}
        />
      )}
    </Modal>
  )
}

/* ─── YENİ GÖNDERİ (ALT SAYFA) ─────────────────────────────────────────────── */

/*
  Üç alan: başlık, etiket, metin. Dördüncüsü yok ve olmayacak — dosya eki, bağlantı alanı
  ve anket, hepsi ayrı birer moderasyon yükü açıyor.

  ALT SINIRLAR (başlık 10, metin 20 karakter) BİR KALİTE KAPISI ve sunucudaki ForumRules
  ile aynı sayılar. "yardım" diye açılan tek kelimelik başlıklar bir forumu en hızlı bozan
  şey. Sayılar düşük tutuldu: amaç yazmayı zorlaştırmak değil, boş göndermeyi engellemek.

  ETİKET ZORUNLU. İzin verilseydi çoğu gönderi etiketsiz gelirdi (en az dirençli yol) ve
  akıştaki filtre şeridi işe yaramaz hâle gelirdi. Web'de <select>'ti; RN'de yerleşik
  seçici yok ve altı seçenek için pil ızgarası zaten daha net (Keşfet filtreleriyle aynı
  dil).

  ⚠️ SUNUCU HATASI ALT SAYFAYI KAPATMAZ. Günlük tavan (429) ve bağlantı eşiği (400) gibi
  reddler ancak POST anında bilinebiliyor; kapansaydı kullanıcı yazdığı metni kaybederdi
  ve neden reddedildiğini de göremezdi.
*/
function GonderiAltSayfasi({ onClose, onPaylas }) {
  const [baslik, setBaslik] = useState('')
  const [etiket, setEtiket] = useState('')
  const [metin, setMetin] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState(null)
  const gonderimKilidi = useRef(false)

  const paylasilabilir =
    baslik.trim().length >= BASLIK_EN_AZ && etiket !== '' && metin.trim().length >= METIN_EN_AZ

  async function paylas() {
    if (gonderimKilidi.current || !paylasilabilir) return
    gonderimKilidi.current = true
    setGonderiliyor(true)
    setHata(null)
    try {
      await onPaylas({ baslik: baslik.trim(), etiket, ozet: metin.trim() })
    } catch (err) {
      setHata(err)
    } finally {
      // Kilit hata dalında da açılıyor: yoksa düzeltip yeniden denenemezdi.
      gonderimKilidi.current = false
      setGonderiliyor(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Yeni gönderi"
      footer={
        <>
          <Button variant="secondary" disabled={gonderiliyor} onPress={onClose}>
            Vazgeç
          </Button>
          <Button loading={gonderiliyor} disabled={!paylasilabilir || gonderiliyor} onPress={paylas}>
            Paylaş
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <ErrorBox error={hata} />

        {/* Alt sınır İPUCUNDA yazılı: mobilde pasif düğmenin üstünde gezinme (title)
            yok — sebebi söylemeyen kapalı bir düğme, kırık bir düğme gibi okunur. */}
        <Field
          label="Başlık"
          hint={`Sorunu tek cümlede özetle — akışta önce bu okunuyor. En az ${BASLIK_EN_AZ} karakter.`}
        >
          <Girdi
            value={baslik}
            onChangeText={setBaslik}
            maxLength={BASLIK_EN_COK}
            placeholder="Örn. Deneme netlerim düşünce panik oluyorum"
          />
        </Field>

        <View>
          <Text className="mb-1 text-sm font-medium text-slate-700">Etiket</Text>
          <Text className="mb-2 text-xs text-slate-500">
            Gönderinin hangi başlıkta okunacağını belirler.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {/* 'hepsi' bir etiket değil, filtrenin "tümü" seçeneği — burada listelenmez. */}
            {ETIKETLER.filter((e) => e.key !== 'hepsi').map(({ key, label }) => (
              <Pil key={key} aktif={etiket === key} onPress={() => setEtiket(key)}>
                {label}
              </Pil>
            ))}
          </View>
        </View>

        <Field
          label="Ne olduğunu anlat"
          hint={`Ayrıntı ver: ne denedin, nerede tıkandın. En az ${METIN_EN_AZ} karakter.`}
        >
          <Girdi
            value={metin}
            onChangeText={setMetin}
            maxLength={METIN_EN_COK}
            multiline
            textAlignVertical="top"
            className="h-40"
            placeholder="Durumu birkaç cümleyle anlat…"
          />
        </Field>

        <View className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Text className="text-xs font-semibold text-slate-800">Paylaşmadan önce</Text>
          <View className="mt-2 gap-1">
            {[
              'Telif hakkı olan kitap, PDF ve deneme paylaşma — kaynağın adını yaz.',
              'Telefon, adres ve sosyal hesap bilgisi yazma.',
              'Reklam ve yönlendirme bağlantısı yasak.',
            ].map((madde) => (
              <Text key={madde} className="text-xs leading-relaxed text-slate-600">
                {madde}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  )
}

/* ─── ŞİKAYET (ALT SAYFA) ──────────────────────────────────────────────────── */

/*
  Şikayet formu SEBEP SORUYOR. Tek düğmelik bir şikayet moderatöre "biri bundan
  hoşlanmadı"dan başka bir şey söylemez; gelen yığını sıraya sokan şey sebeptir.

  Şikayet edilen içeriğin bir parçası formda GÖRÜNÜYOR: yanlış içeriği şikayet etmek,
  moderatörün zamanını harcayan sessiz bir hata. Kullanıcı neyi bildirdiğini görmeli.

  "Anonim" bilgisi yazıyor: şikayet etmenin önündeki en büyük engel, şikayet edilenin
  bunu öğreneceği korkusudur.
*/
function SikayetAltSayfasi({ hedef, onClose, onGonder }) {
  const [sebep, setSebep] = useState(null)
  const [detay, setDetay] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState(null)
  const gonderimKilidi = useRef(false)

  const gonderilebilir = sebep !== null && detay.trim().length >= EN_AZ_ACIKLAMA

  async function gonder() {
    // Çift gönderim yönetime AYNI şikayetten iki kayıt düşürürdü.
    if (gonderimKilidi.current || !gonderilebilir) return
    gonderimKilidi.current = true
    setGonderiliyor(true)
    setHata(null)
    try {
      await onGonder(hedef, sebep, detay.trim())
      onClose()
    } catch (err) {
      setHata(err)
    } finally {
      gonderimKilidi.current = false
      setGonderiliyor(false)
    }
  }

  return (
    <Modal
      open
      onClose={gonderiliyor ? () => {} : onClose}
      title="Şikayet et"
      footer={
        <>
          <Button variant="secondary" disabled={gonderiliyor} onPress={onClose}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            loading={gonderiliyor}
            disabled={!gonderilebilir || gonderiliyor}
            onPress={gonder}
          >
            Şikayeti gönder
          </Button>
        </>
      }
    >
      <View className="gap-4 pb-2">
        <ErrorBox error={hata} />

        <View className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Text className="text-xs font-semibold text-slate-600">
            {hedef.tur} · {hedef.yazar ?? 'Kullanıcı'}
          </Text>
          <Text numberOfLines={2} className="mt-1 text-sm text-slate-800">
            {hedef.baslik}
          </Text>
        </View>

        <View>
          <Text className="mb-2 text-sm font-medium text-slate-700">Sebep</Text>
          <View className="gap-2">
            {SIKAYET_SEBEPLERI.map(({ key, baslik, aciklama }) => {
              const secili = sebep === key
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: secili }}
                  onPress={() => setSebep(key)}
                  className={`min-h-[44px] justify-center rounded-xl border p-3 ${
                    secili ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${secili ? 'text-brand-800' : 'text-slate-900'}`}
                  >
                    {baslik}
                  </Text>
                  <Text className="mt-0.5 text-xs leading-relaxed text-slate-600">{aciklama}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Field
          label="Ne oldu?"
          hint={`En az ${EN_AZ_ACIKLAMA} karakter. Moderatörün elindeki tek anlatım bu olacak.`}
        >
          <Girdi
            value={detay}
            onChangeText={setDetay}
            maxLength={METIN_EN_COK}
            multiline
            textAlignVertical="top"
            className="h-24"
            placeholder="Örn. gönderi izinsiz PDF bağlantısı paylaşıyor."
          />
        </Field>

        <Text className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          Şikayetin <Text className="font-semibold">anonimdir</Text>; şikayet ettiğin kişiye kim
          olduğun gösterilmez.
        </Text>
      </View>
    </Modal>
  )
}

/* ─── KURALLAR VE ÖNLEMLER ─────────────────────────────────────────────────── */

function KurallarKarti() {
  return (
    <Card>
      <Text className="text-sm font-bold text-slate-900">Topluluk kuralları</Text>

      <View className="mt-3 gap-2.5">
        {KURALLAR.map((kural, i) => (
          <View key={kural} className="flex-row gap-2.5">
            {/* Numara madde işaretinden daha iyi: kurallar bir moderasyon kararında
                referans veriliyor ("3. kural"), numarasız bir liste bunu yapamaz. */}
            <View className="mt-0.5 h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100">
              <Text className="text-[11px] font-bold text-slate-600">{i + 1}</Text>
            </View>
            <Text className="flex-1 text-xs leading-relaxed text-slate-600">{kural}</Text>
          </View>
        ))}
      </View>

      <Text className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
        Kuralları ihlal eden içerik moderasyon ekibince kaldırılır; tekrarlayan ihlallerde hesaba
        yaptırım uygulanır.
      </Text>
    </Card>
  )
}

function OnlemlerKarti() {
  return (
    <Card>
      <Text className="text-sm font-bold text-slate-900">Nasıl korunuyor?</Text>

      <View className="mt-3 gap-3">
        {ONLEMLER.map(({ baslik, metin }) => (
          <View key={baslik}>
            <Text className="text-xs font-semibold text-slate-800">{baslik}</Text>
            <Text className="mt-0.5 text-xs leading-relaxed text-slate-600">{metin}</Text>
          </View>
        ))}
      </View>
    </Card>
  )
}
